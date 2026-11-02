
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



  function brandLogoUrl(name, type = 'social') {
    const key = String(name || '').trim().toLowerCase().replace(/\s+/g, '');
    const logos = type === 'delivery' ? {
      deliveroo: ['deliveroo','00CCBC'],
      glovo: ['glovo','FFC244'],
      justeat: ['justeat','F36D00'],
      'just-eat': ['justeat','F36D00']
    } : {
      facebook: ['facebook','0866FF'],
      instagram: ['instagram','E4405F'],
      tiktok: ['tiktok','000000'],
      youtube: ['youtube','FF0000']
    };
    const item = logos[key];
    return item ? 'https://cdn.simpleicons.org/' + item[0] + '/' + item[1] : '';
  }

  /* FOOD DELIVERY — original provider brand marks beside social icons in footer */
  async function loadFoodDeliveryLinks() {
    const section = $('#foodDelivery');
    const container = $('#publicDeliveryLinks');
    if (!section || !container) return;

    const rows = await getRows(
      'food_delivery_links',
      query => query.eq('is_active', true).order('sort_order').order('created_at')
    );

    container.innerHTML = rows.map(item => {
      let parsed;
      try { parsed = new URL(item.url); } catch (_) { return ''; }
      if (!['https:', 'http:'].includes(parsed.protocol)) return '';
      const logo = brandLogoUrl(item.name, 'delivery');
      if (!logo) return '';
      const label = String(item.name || 'Food delivery');
      return `<a class="delivery-link" href="${escapeHTML(parsed.href)}"
        target="_blank" rel="noopener noreferrer"
        aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}">
        <img class="brand-logo" src="${logo}" alt="${escapeHTML(label)}"
          onerror="this.closest('a').hidden=true">
      </a>`;
    }).join('');

    section.hidden = !container.innerHTML;
  }

  /* SOCIAL LINKS */
  async function loadSocialLinks() {
    const container = $('#publicSocialLinks');
    if (!container) return;
    const rows = await getRows(
      'social_links',
      query => query.eq('is_active', true).order('created_at')
    );
    const allowed = new Set(['Facebook','Instagram','TikTok','YouTube']);
    const links = rows.filter(item => allowed.has(item.platform || item.name));
    if (!links.length) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }
    container.innerHTML = links.map(item => {
      let parsed;
      try { parsed = new URL(item.url); } catch (_) { return ''; }
      if (!['https:', 'http:'].includes(parsed.protocol)) return '';
      const label = item.platform || item.name;
      return `<a class="social-link" href="${escapeHTML(parsed.href)}" target="_blank" rel="noopener noreferrer"><img class="brand-logo" src="${brandLogoUrl(label)}" alt="" onerror="this.hidden=true"><span>${escapeHTML(label)}</span></a>`;
    }).join('');
    container.hidden = !container.innerHTML;
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
            ? /\.(mp4|mov|webm)(?:[?#]|$)/i.test(item.youtube_url)
              ? `<video class="news-video" controls playsinline preload="metadata">
                  <source src="${escapeHTML(item.youtube_url)}">
                </video>`
              : `<p>
                  <a href="${escapeHTML(item.youtube_url)}"
                    target="_blank" rel="noopener noreferrer">
                    Guarda il video
                  </a>
                </p>`
            : ''
        }

      </article>
    `).join('');
  }


  /* CUSTOMER COUPON COLLECTION */

  function getVisitorToken() {
    const key = 'nababi_coupon_visitor_v1';
    let token = localStorage.getItem(key);

    if (!token) {
      token = window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : 'nb-' + Date.now().toString(36) + '-' +
          Math.random().toString(36).slice(2) + '-' +
          Math.random().toString(36).slice(2);

      localStorage.setItem(key, token);
    }

    return token;
  }

  async function loadCustomerCouponOffer() {
    const section = $('#customerCouponSection');
    if (!section || !db) return;

    try {
      const {data,error} = await db.rpc('get_nababi_coupon_offer');
      if (error) throw error;

      if (!data?.success || data.is_active !== true) {
        section.hidden = true;
        return;
      }

      section.hidden = false;
      $('#customerCouponDiscount').textContent =
        Number(data.discount_percent) + '% DI SCONTO';

      $('#customerCouponPeriod').textContent =
        'Valido fino al ' +
        new Date(data.ends_at).toLocaleString('it-IT');

      $('#customerCouponRemaining').textContent =
        data.remaining == null
          ? 'Coupon disponibili fino alla fine dell’offerta.'
          : 'Coupon rimanenti: ' + data.remaining;

      $('#claimCustomerCoupon').onclick = claimCustomerCoupon;
    } catch (error) {
      console.error('Nababi coupon offer:', error);
      section.hidden = true;
    }
  }

  async function claimCustomerCoupon() {
    const button = $('#claimCustomerCoupon');
    const status = $('#customerCouponStatus');
    const codePanel = $('#customerCouponCode');

    button.disabled = true;
    status.textContent = 'Generazione del coupon…';
    codePanel.hidden = true;

    try {
      const visitorToken = getVisitorToken();
      const {data,error} = await db.rpc('claim_nababi_coupon', {
        p_visitor_token: visitorToken
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || 'Coupon non disponibile.');
      }

      $('#customerCouponCodeValue').textContent = data.code;
      $('#customerCouponExpiry').textContent =
        'Scade: ' + new Date(data.expires_at).toLocaleString('it-IT');
      codePanel.hidden = false;
      status.textContent =
        'Coupon del ' + data.discount_percent + '% ottenuto con successo!';

      $('#copyCustomerCoupon').onclick = async () => {
        try {
          await navigator.clipboard.writeText(String(data.code));
          status.textContent = 'Codice copiato.';
        } catch (_) {
          status.textContent = 'Il tuo codice è: ' + data.code;
        }
      };
    } catch (error) {
      status.textContent = error.message ||
        'Non è stato possibile ottenere il coupon.';
    } finally {
      button.disabled = false;
    }
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

      loadFoodDeliveryLinks(),

      loadSocialLinks(),

      loadCustomerCouponOffer(),

      loadEvents(),

      loadReviews(),

      loadOpeningHours()

    ]);

    // Refresh Breaking News so scheduled start/end times apply while the page stays open.
    window.setInterval(loadNews, 30000);
    window.setInterval(loadFoodDeliveryLinks, 60000);

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
