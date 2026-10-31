
(() => {
  'use strict';

  const cfg = window.NABABI_CONFIG || {};
  const $ = selector => document.querySelector(selector);
  const NEWS_TABLE = 'breaking_news';
  const BOOKING_TABLE = 'bookings';
  const GALLERY_TABLE = 'gallery_images';
  const REFRESH_MS = 30000;

  document.documentElement.lang = 'it';

  let db = null;

  function getClient() {
    if (db) return db;

    if (
      !window.supabase ||
      !cfg.SUPABASE_URL ||
      !cfg.SUPABASE_ANON_KEY
    ) {
      throw new Error('Configurazione Supabase mancante.');
    }

    db = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY
    );

    return db;
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return ['https:', 'http:'].includes(url.protocol)
        ? url.href
        : '';
    } catch {
      return '';
    }
  }

  function makeElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  /* =========================
     BOOKING FORM
  ========================= */

  function setupBookingForm() {
    const form = $('#bookingForm');
    if (!form) return;

    const dateInput = form.elements.booking_date;
    const today = new Date();
    const localToday = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');

    dateInput.min = localToday;

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const status = $('#bookingStatus');
      const button = $('#bookingSubmit');

      if (!form.reportValidity()) return;

      const data = new FormData(form);
      const bookingDate = String(data.get('booking_date') || '');
      const bookingTime = String(data.get('booking_time') || '');
      const guests = Number(data.get('guests'));

      if (bookingDate < localToday) {
        status.textContent = 'Seleziona una data valida.';
        return;
      }

      if (!Number.isInteger(guests) || guests < 1 || guests > 30) {
        status.textContent = 'Numero di ospiti non valido.';
        return;
      }

      const payload = {
        full_name: String(data.get('full_name') || '').trim(),
        phone: String(data.get('phone') || '').trim(),
        booking_date: bookingDate,
        booking_time: bookingTime,
        guests,
        booking_type: String(data.get('booking_type') || 'table'),
        notes: String(data.get('notes') || '').trim() || null,
        status: 'new'
      };

      if (!payload.full_name || !payload.phone) {
        status.textContent = 'Inserisci nome e telefono.';
        return;
      }

      button.disabled = true;
      button.textContent = 'Invio in corso…';
      status.textContent = 'Invio della richiesta…';

      try {
        const client = getClient();

        const { error } = await client
          .from(BOOKING_TABLE)
          .insert(payload);

        if (error) throw error;

        form.reset();
        dateInput.min = localToday;

        status.textContent =
          'Richiesta inviata! Ti contatteremo per confermare la prenotazione.';

      } catch (error) {
        console.error('Booking error:', error);

        status.textContent =
          'Non è stato possibile inviare la richiesta. Riprova o contattaci su WhatsApp.';
      } finally {
        button.disabled = false;
        button.textContent = 'Invia richiesta';
      }
    });
  }

  /* =========================
     BREAKING NEWS
  ========================= */

  function createNewsBar() {
    let bar = $('#breakingNewsBar');

    if (!bar) {
      bar = makeElement('section', 'breaking-news-bar');
      bar.id = 'breakingNewsBar';
      bar.setAttribute('aria-live', 'polite');

      const header = $('.site-header');

      if (header) {
        header.insertAdjacentElement('afterend', bar);
      } else {
        document.body.prepend(bar);
      }
    }

    return bar;
  }

  function renderNews(items) {
    const bar = createNewsBar();
    const now = Date.now();

    const active = (items || []).filter(item => {
      const start = Date.parse(item.starts_at);
      const end = Date.parse(item.ends_at);

      return item.is_active === true &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start <= now &&
        now < end;
    });

    bar.replaceChildren();

    if (!active.length) {
      bar.hidden = true;
      return;
    }

    bar.hidden = false;

    active.forEach(item => {
      const article = makeElement('article', 'breaking-news-item');
      const content = makeElement('div', 'breaking-news-content');

      content.append(
        makeElement('span', 'breaking-news-label', 'ULTIME NOTIZIE'),
        makeElement('h2', '', item.title || ''),
        makeElement('p', '', item.body || '')
      );

      article.append(content);

      const imageUrl = safeUrl(item.image_url);

      if (imageUrl) {
        const image = makeElement('img', 'breaking-news-image');
        image.src = imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        article.append(image);
      }

      const videoUrl = safeUrl(item.youtube_url);

      if (videoUrl) {
        const link = makeElement(
          'a',
          'breaking-news-video',
          'Guarda il video'
        );

        link.href = videoUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        content.append(link);
      }

      bar.append(article);
    });
  }

  async function loadBreakingNews() {
    try {
      const client = getClient();

      const { data, error } = await client
        .from(NEWS_TABLE)
        .select('id,title,body,image_url,youtube_url,starts_at,ends_at,is_active')
        .eq('is_active', true)
        .lte('starts_at', new Date().toISOString())
        .gt('ends_at', new Date().toISOString())
        .order('starts_at', { ascending: true });

      if (error) throw error;

      renderNews(data || []);
    } catch (error) {
      console.error('Breaking News:', error.message);
      const bar = createNewsBar();
      bar.hidden = true;
    }
  }

  /* =========================
     PUBLIC GALLERY
  ========================= */

  async function loadGallery() {
    const gallery = $('#publicGallery');
    if (!gallery) return;

    try {
      const client = getClient();

      const { data, error } = await client
        .from(GALLERY_TABLE)
        .select('*')
        .limit(100);

      if (error) throw error;

      gallery.replaceChildren();

      if (!data || !data.length) {
        gallery.append(
          makeElement('p', 'help', 'Nessuna foto disponibile.')
        );
        return;
      }

      let shown = 0;

      data.forEach(item => {
        const imageValue =
          item.image_url ||
          item.public_url ||
          item.url ||
          item.photo_url;

        const imageUrl = safeUrl(imageValue);
        if (!imageUrl) return;

        const card = makeElement('article', 'site-card');
        const image = makeElement('img');

        image.src = imageUrl;
        image.alt = item.title || 'Nababi Ristorante Gallery';
        image.loading = 'lazy';

        card.append(image);

        if (item.title) {
          const content = makeElement('div');
          content.append(makeElement('h3', '', item.title));
          card.append(content);
        }

        gallery.append(card);
        shown++;
      });

      if (!shown) {
        gallery.append(
          makeElement(
            'p',
            'help',
            'Le foto non sono ancora disponibili. Verifica le colonne della tabella gallery_images.'
          )
        );
      }

    } catch (error) {
      console.error('Gallery error:', error);

      gallery.replaceChildren(
        makeElement(
          'p',
          'help',
          'Impossibile caricare le foto della Gallery.'
        )
      );
    }
  }

  /* =========================
     START
  ========================= */

  async function startSite() {
    setupBookingForm();

    try {
      getClient();

      await Promise.allSettled([
        loadBreakingNews(),
        loadGallery()
      ]);

      window.setInterval(() => {
        loadBreakingNews();
      }, REFRESH_MS);

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          loadBreakingNews();
          loadGallery();
        }
      });

    } catch (error) {
      console.error('Nababi site:', error.message);

      const status = $('#bookingStatus');
      if (status) {
        status.textContent = 'Servizio temporaneamente non disponibile.';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSite);
  } else {
    startSite();
  }
})();
