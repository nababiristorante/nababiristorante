
/* =========================================================
   NABABI RISTORANTE
   PUBLIC WEBSITE + SUPABASE CONNECTION
   ========================================================= */

(function () {
  'use strict';

  const CONFIG = window.NABABI_CONFIG || {};

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const escapeHTML = (value) => {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  };

  const money = (value) => {
    const number = Number(value);

    if (!Number.isFinite(number)) return '';

    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(number);
  };

  function message(element, text, state = '') {
    if (!element) return;

    element.textContent = text;
    element.dataset.state = state;
  }

  /* SUPABASE CONNECTION */

  function createDatabase() {
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
      console.error('Nababi: Supabase configuration missing.');
      return null;
    }

    if (!window.supabase || !window.supabase.createClient) {
      console.error('Nababi: Supabase library unavailable.');
      return null;
    }

    return window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY
    );
  }

  const db = createDatabase();

  async function getRows(table, builder) {
    if (!db) return [];

    try {
      let request = db.from(table).select('*');

      if (builder) {
        request = builder(request);
      }

      const { data, error } = await request;

      if (error) {
        console.error(
          'Nababi database error:',
          table,
          error.message
        );

        return [];
      }

      return Array.isArray(data) ? data : [];

    } catch (error) {
      console.error('Nababi request failed:', error);
      return [];
    }
  }

  /* MENU */

  async function loadMenu() {
    const container = $('#liveMenu');

    if (!container) return;

    const rows = await getRows(
      'menu_items',
      query => query
        .eq('is_available', true)
        .order('name')
    );

    if (!rows.length) {
      container.innerHTML =
        '<p class="site-empty">Il menu sarà disponibile a breve.</p>';
      return;
    }

    container.innerHTML = rows.map(item => `
      <article class="site-card live-card">

        ${
          item.image_url
            ? `<img
                src="${escapeHTML(item.image_url)}"
                alt="${escapeHTML(item.name)}"
                loading="lazy">`
            : ''
        }

        <div>
          <h3>${escapeHTML(item.name)}</h3>

          <p>${escapeHTML(item.description || '')}</p>

          <p class="site-price">
            ${escapeHTML(money(item.price))}
          </p>
        </div>

      </article>
    `).join('');
  }

  /* GALLERY */

  async function loadGallery() {
    const container = $('#liveGallery');

    if (!container) return;

    const rows = await getRows(
      'gallery_items',
      query => query
        .eq('is_active', true)
        .order('sort_order')
    );

    if (!rows.length) {
      container.innerHTML =
        '<p class="site-empty">Le nostre foto saranno disponibili a breve.</p>';
      return;
    }

    container.innerHTML = rows.map(item => `
      <article class="site-card live-card">

        <img
          src="${escapeHTML(item.image_url || '')}"
          alt="${escapeHTML(item.title || 'Nababi Ristorante')}"
          loading="lazy">

        <div>
          <h3>${escapeHTML(item.title || '')}</h3>

          <p>${escapeHTML(item.description || '')}</p>
        </div>

      </article>
    `).join('');
  }

  /* BREAKING NEWS */

  async function loadNews() {
    const container = $('#liveNews');

    if (!container) return;

    const now = new Date().toISOString();

    const rows = await getRows(
      'breaking_news',
      query => query
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('created_at', { ascending: false })
    );

    if (!rows.length) {
      container.innerHTML =
        '<p class="site-empty">Nessuna comunicazione al momento.</p>';
      return;
    }

    container.innerHTML = rows.map(item => `
      <article class="news-card">

        <h3>${escapeHTML(item.title)}</h3>

        <p>${escapeHTML(item.body || '')}</p>

        ${
          item.image_url
            ? `<img
                src="${escapeHTML(item.image_url)}"
                alt=""
                loading="lazy">`
            : ''
        }

        ${
          item.youtube_url
            ? `<p>
                <a
                  href="${escapeHTML(item.youtube_url)}"
                  target="_blank"
                  rel="noopener noreferrer">
                  Guarda il video
                </a>
              </p>`
            : ''
        }

      </article>
    `).join('');
  }

  /* EVENTS */

  async function loadEvents() {
    const container = $('#liveEvents');

    if (!container) return;

    const now = new Date().toISOString();

    const rows = await getRows(
      'events',
      query => query
        .eq('is_published', true)
        .gte('ends_at', now)
        .order('starts_at', { ascending: true })
    );

    if (!rows.length) {
      container.innerHTML =
        '<p class="site-empty">Al momento non ci sono eventi pubblicati.</p>';
      return;
    }

    container.innerHTML = rows.map(item => `
      <article class="site-card live-card">

        ${
          item.image_url
            ? `<img
                src="${escapeHTML(item.image_url)}"
                alt="${escapeHTML(item.title)}"
                loading="lazy">`
            : ''
        }

        <div>
          <h3>${escapeHTML(item.title)}</h3>

          <p>${escapeHTML(item.description || '')}</p>

          ${
            item.starts_at
              ? `<p>${escapeHTML(
                  new Date(item.starts_at).toLocaleString('it-IT')
                )}</p>`
              : ''
          }
        </div>

      </article>
    `).join('');
  }

  /* REVIEWS */

  async function loadReviews() {
    const container = $('#liveReviews');

    if (!container) return;

    const rows = await getRows(
      'reviews',
      query => query
        .order('created_at', { ascending: false })
        .limit(6)
    );

    if (!rows.length) {
      container.innerHTML =
        '<p class="site-empty">Le recensioni saranno disponibili a breve.</p>';
      return;
    }

    container.innerHTML = rows.map(item => {

      const rating = Math.max(
        0,
        Math.min(5, Number(item.rating || item.stars || 5))
      );

      const name =
        item.customer_name ||
        item.full_name ||
        item.name ||
        'Cliente';

      const review =
        item.review ||
        item.comment ||
        item.message ||
        item.text ||
        '';

      return `
        <article class="site-card review-card">

          <p class="review-stars">
            ${'★'.repeat(rating)}${'☆'.repeat(5-rating)}
          </p>

          <h3>${escapeHTML(name)}</h3>

          <p>${escapeHTML(review)}</p>

        </article>
      `;

    }).join('');
  }

  /* OPENING HOURS */

  async function loadOpeningHours() {
    const container = $('#liveHours');

    if (!container) return;

    const rows = await getRows('opening_hours');

    if (!rows.length) return;

    container.innerHTML = rows.map(row => {

      const day =
        row.day_name ||
        row.day ||
        row.weekday ||
        '';

      const open =
        row.open_time ||
        row.opens_at ||
        row.opening_time ||
        '';

      const close =
        row.close_time ||
        row.closes_at ||
        row.closing_time ||
        '';

      const closed = row.is_closed === true;

      return `
        <p>
          <strong>${escapeHTML(day)}</strong> —
          ${
            closed
              ? 'Chiuso'
              : `${escapeHTML(open)} – ${escapeHTML(close)}`
          }
        </p>
      `;

    }).join('');
  }

  /* TABLE BOOKING */

  function setupBooking() {
    const form = $('#bookingForm');

    if (!form) return;

    form.addEventListener('submit', async event => {

      event.preventDefault();

      const result = $('#bookingMessage');

      if (!db) {
        message(
          result,
          'Servizio non disponibile. Contattaci su WhatsApp.',
          'error'
        );

        return;
      }

      const formData = new FormData(form);

      const booking = {
        full_name: String(
          formData.get('full_name') || ''
        ).trim(),

        phone: String(
          formData.get('phone') || ''
        ).trim(),

        email: String(
          formData.get('email') || ''
        ).trim() || null,

        booking_date: String(
          formData.get('booking_date') || ''
        ),

        booking_time: String(
          formData.get('booking_time') || ''
        ),

        guests: Number(
          formData.get('guests')
        ),

        notes: String(
          formData.get('notes') || ''
        ).trim() || null,

        status: 'pending',

        booking_type: String(
          formData.get('booking_type') || 'table'
        )
      };

      if (
        !booking.full_name ||
        !booking.phone ||
        !booking.booking_date ||
        !booking.booking_time ||
        !Number.isInteger(booking.guests) ||
        booking.guests < 1 ||
        booking.guests > 30
      ) {
        message(
          result,
          'Controlla i campi obbligatori e il numero di ospiti.',
          'error'
        );

        return;
      }

      const submit = $('button[type="submit"]', form);

      if (submit) submit.disabled = true;

      message(result, 'Invio della richiesta in corso…');

      try {

        const { error } = await db
          .from('bookings')
          .insert(booking);

        if (error) throw error;

        form.reset();

        message(
          result,
          'Richiesta inviata! Ti contatteremo per confermare la prenotazione.',
          'success'
        );

      } catch (error) {

        console.error('Booking error:', error);

        message(
          result,
          'Invio non riuscito. Contattaci tramite WhatsApp o telefono.',
          'error'
        );

      } finally {

        if (submit) submit.disabled = false;

      }

    });
  }

  /* MOBILE NAVIGATION */

  function setupMobileNavigation() {

    const button = $('#mobileMenuButton');
    const navigation = $('#mainNavigation');

    if (!button || !navigation) return;

    button.addEventListener('click', () => {

      const opened =
        navigation.classList.toggle('is-open');

      button.setAttribute(
        'aria-expanded',
        String(opened)
      );

    });

    navigation.addEventListener('click', event => {

      if (event.target.closest('a')) {

        navigation.classList.remove('is-open');

        button.setAttribute(
          'aria-expanded',
          'false'
        );

      }

    });

  }

  /* INITIALIZATION */

  async function initializeWebsite() {

    setupBooking();
    setupMobileNavigation();

    if (!db) {

      console.error(
        'Nababi: Website could not connect to Supabase.'
      );

      return;
    }

    await Promise.allSettled([

      loadMenu(),

      loadGallery(),

      loadNews(),

      loadEvents(),

      loadReviews(),

      loadOpeningHours()

    ]);

    console.log('Nababi public website initialized.');

  }

  if (document.readyState === 'loading') {

    document.addEventListener(
      'DOMContentLoaded',
      initializeWebsite,
      { once: true }
    );

  } else {

    initializeWebsite();

  }

})();
