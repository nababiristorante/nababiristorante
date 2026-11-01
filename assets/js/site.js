
(() => {
  'use strict';

  const cfg = window.NABABI_CONFIG || {};
  const $ = selector => document.querySelector(selector);

  const NEWS_TABLE = 'breaking_news';
  const BOOKING_TABLE = 'bookings';
  const GALLERY_TABLE = 'gallery_items';
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

  function createConfirmationCode() {
    const randomPart =
      window.crypto &&
      typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
            .replace(/-/g, '')
            .slice(0, 8)
        : Array.from(
            { length: 8 },
            () => Math.floor(Math.random() * 16).toString(16)
          ).join('');

    return 'NAB-' + randomPart.toUpperCase();
  }

  function setupBookingForm() {
    const form = $('#bookingForm');
    if (!form) return;

    const dateInput = form.elements.booking_date;
    const typeInput = form.elements.booking_type;
    const phoneInput = form.elements.phone;
    const emailInput = form.elements.email;

    const confirmationBox = $('#bookingConfirmation');
    const confirmationCode = $('#bookingConfirmationCode');
    const copyButton = $('#copyBookingCode');
    const copyStatus = $('#bookingCopyStatus');

    if (
      !dateInput ||
      !typeInput ||
      !phoneInput ||
      !emailInput
    ) {
      console.error('Booking form fields mancanti.');
      return;
    }

    const today = new Date();

    const localToday = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');

    dateInput.min = localToday;

    function updateContactRequirements() {
      const type = typeInput.value;

      const isSpecial =
        type === 'birthday' ||
        type === 'special_event';

      phoneInput.required = isSpecial;
      emailInput.required = isSpecial;

      phoneInput.setCustomValidity('');
      emailInput.setCustomValidity('');
    }

    typeInput.addEventListener(
      'change',
      updateContactRequirements
    );

    updateContactRequirements();

    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        const code = confirmationCode?.textContent?.trim();

        if (!code || !copyStatus) return;

        try {
          await navigator.clipboard.writeText(code);
          copyStatus.textContent = 'Codice copiato.';
        } catch {
          copyStatus.textContent =
            'Copia non disponibile. Seleziona il codice e copialo manualmente.';
        }
      });
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const status = $('#bookingStatus');
      const button = $('#bookingSubmit');

      if (!status || !button) return;

      if (!form.reportValidity()) return;

      const data = new FormData(form);

      const bookingDate =
        String(data.get('booking_date') || '');

      const bookingTime =
        String(data.get('booking_time') || '');

      const guests = Number(data.get('guests'));

      const bookingType =
        String(data.get('booking_type') || 'table');

      const fullName =
        String(data.get('full_name') || '').trim();

      const phone =
        String(data.get('phone') || '').trim();

      const email =
        String(data.get('email') || '').trim();

      if (bookingDate < localToday) {
        status.textContent = 'Seleziona una data valida.';
        return;
      }

      if (
        !Number.isInteger(guests) ||
        guests < 1 ||
        guests > 30
      ) {
        status.textContent = 'Numero di ospiti non valido.';
        return;
      }

      if (!fullName) {
        status.textContent = 'Inserisci nome e cognome.';
        return;
      }

      if (
        !['table', 'birthday', 'special_event']
          .includes(bookingType)
      ) {
        status.textContent =
          'Tipo di prenotazione non valido.';
        return;
      }

      if (bookingType === 'table' && !phone && !email) {
        status.textContent =
          'Inserisci almeno un numero di telefono oppure un indirizzo email.';
        return;
      }

      if (
        (bookingType === 'birthday' ||
          bookingType === 'special_event') &&
        (!phone || !email)
      ) {
        status.textContent =
          'Per compleanni ed eventi inserisci telefono ed email.';
        return;
      }

      if (
        email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        status.textContent =
          'Inserisci un indirizzo email valido.';
        return;
      }

      const code = createConfirmationCode();

      const payload = {
        full_name: fullName,
        phone: phone || null,
        email: email || null,
        booking_date: bookingDate,
        booking_time: bookingTime,
        guests,
        booking_type: bookingType,
        notes:
          String(data.get('notes') || '').trim() || null,
        status: 'new',
        confirmation_code: code
      };

      button.disabled = true;
      button.textContent = 'Invio in corso…';
      status.textContent = 'Invio della richiesta…';

      if (confirmationBox) {
        confirmationBox.hidden = true;
      }

      try {
        const client = getClient();

        const { error } = await client
          .from(BOOKING_TABLE)
          .insert(payload);

        if (error) throw error;

        form.reset();
        dateInput.min = localToday;

        updateContactRequirements();

        if (confirmationCode) {
          confirmationCode.textContent = code;
        }

        if (copyStatus) {
          copyStatus.textContent = '';
        }

        if (confirmationBox) {
          confirmationBox.hidden = false;
        }

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

      return (
        item.is_active === true &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start <= now &&
        now < end
      );
    });

    bar.replaceChildren();

    if (!active.length) {
      bar.hidden = true;
      return;
    }

    bar.hidden = false;

    active.forEach(item => {
      const article = makeElement(
        'article',
        'breaking-news-item'
      );

      const content = makeElement(
        'div',
        'breaking-news-content'
      );

      content.append(
        makeElement(
          'span',
          'breaking-news-label',
          'ULTIME NOTIZIE'
        ),
        makeElement('h2', '', item.title || ''),
        makeElement('p', '', item.body || '')
      );

      article.append(content);

      const imageUrl = safeUrl(item.image_url);

      if (imageUrl) {
        const image = makeElement(
          'img',
          'breaking-news-image'
        );

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
        .select(
          'id,title,body,image_url,youtube_url,starts_at,ends_at,is_active'
        )
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
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(100);

      if (error) throw error;

      gallery.replaceChildren();

      if (!data || !data.length) {
        gallery.append(
          makeElement(
            'p',
            'help',
            'Nessuna foto disponibile.'
          )
        );

        return;
      }

      let shown = 0;

      data.forEach(item => {
        const imageUrl = safeUrl(item.image_url);

        if (!imageUrl) return;

        const card = makeElement(
          'article',
          'site-card'
        );

        const image = makeElement('img');

        image.src = imageUrl;
        image.alt =
          item.title || 'Nababi Ristorante Gallery';

        image.loading = 'lazy';

        card.append(image);

        if (item.title) {
          const content = makeElement('div');

          content.append(
            makeElement('h3', '', item.title)
          );

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
            'Nessuna foto disponibile.'
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

      document.addEventListener(
        'visibilitychange',
        () => {
          if (!document.hidden) {
            loadBreakingNews();
            loadGallery();
          }
        }
      );

    } catch (error) {
      console.error('Nababi site:', error.message);

      const status = $('#bookingStatus');

      if (status) {
        status.textContent =
          'Servizio temporaneamente non disponibile.';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      startSite
    );
  } else {
    startSite();
  }
})();
