
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

  /* RESTAURANT LOGO */
  async function loadRestaurantLogo() {
    if (!db) return;
    try {
      const { data, error } = await db.from('site_settings').select('setting_value').eq('setting_key', 'restaurant_logo_url').maybeSingle();
      if (error) throw error;
      const url = data?.setting_value;
      const headerImage = $('#siteHeaderLogo');
      const footerImage = $('#siteFooterLogo');
      const headerFallback = $('#siteHeaderLogoFallback');
      const footerFallback = $('#siteFooterLogoFallback');
      [headerImage, footerImage].forEach(image => {
        if (!image) return;
        if (url) { image.src = url; image.hidden = false; } else image.hidden = true;
      });
      if (headerFallback) headerFallback.hidden = Boolean(url);
      if (footerFallback) footerFallback.hidden = Boolean(url);
      if (url) {
        let favicon = $('#siteFavicon');
        if (!favicon) { favicon = document.createElement('link'); favicon.id = 'siteFavicon'; favicon.rel = 'icon'; document.head.appendChild(favicon); }
        favicon.href = url;
      }
    } catch (error) { console.error('Nababi logo could not be loaded:', error.message); }
  }

  function menuFallbackImage(item) {
    const text = `${item?.name || ''} ${item?.category || ''}`.toLowerCase();
    if (/biryani|biriyani|briyani|riso/.test(text)) {
      return 'https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=900&q=85';
    }
    if (/samosa|antipast|starter|snack/.test(text)) {
      return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=85';
    }
    if (/dessert|dolc|sweet|gulab|jamun/.test(text)) {
      return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=85';
    }
    return 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=85';
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

        ${`<img
          src="${escapeHTML(item.image_url || menuFallbackImage(item))}"
          alt="${escapeHTML(item.name)}"
          loading="lazy"
          onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=85'">`}

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
        .eq('is_approved', true)
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

  /* PUBLIC CONTACT FORM */

  function setupContactForm() {
    const form = $('#contactForm');
    if (!form) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const status = $('#contactMessage');

      if (!db) {
        message(status, 'Servizio non disponibile. Contattaci per telefono o WhatsApp.', 'error');
        return;
      }

      const values = new FormData(form);
      const payload = {
        full_name: String(values.get('full_name') || '').trim(),
        email: String(values.get('email') || '').trim() || null,
        phone: String(values.get('phone') || '').trim() || null,
        subject: String(values.get('subject') || '').trim() || null,
        message: String(values.get('message') || '').trim(),
        is_read: false
      };

      if (!payload.full_name || !payload.message) {
        message(status, 'Inserisci nome e messaggio.', 'error');
        return;
      }

      const submit = $('button[type="submit"]', form);
      if (submit) submit.disabled = true;
      message(status, 'Invio del messaggio…');

      try {
        const { error } = await db.from('contact_messages').insert(payload);
        if (error) throw error;
        form.reset();
        message(status, 'Messaggio inviato! Grazie per averci contattato.', 'success');
      } catch (error) {
        console.error('Contact form error:', error);
        message(status, 'Invio non riuscito. Riprova o contattaci su WhatsApp.', 'error');
      } finally {
        if (submit) submit.disabled = false;
      }
    });
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


  /* WEBSITE LANGUAGE SWITCHER */
  function setupLanguageSwitcher() {
    const selector = $('#siteLanguage');
    if (!selector) return;

    const translations = {
      en: {
        nav: ['Home', 'Menu', 'About us', 'Gallery', 'Events', 'Book a table', 'Contact'],
        text: {
          '.site-hero .eyebrow': 'WELCOME TO',
          '.site-hero > div > h2': 'Authentic Indian cuisine in the heart of Rome.',
          '.site-hero > div > p:not(.eyebrow)': 'A journey of flavour, tradition and passion. Discover our authentic dishes, prepared with selected ingredients and original recipes.',
          '.site-hero a[href="#menu"]': 'Explore the Menu',
          '.site-hero a[href="#reservation"]': 'Book a Table',
          '#liveNewsSection h2': 'News and announcements',
          '#customerCouponSection .eyebrow': 'NABABI SPECIAL OFFER',
          '#customerCouponSection h2': 'Get your Coupon',
          '#customerCouponPeriod': 'Offer valid for a limited time.',
          '#claimCustomerCoupon': 'Get Coupon',
          '#customerCouponCode > p:first-child': 'Your coupon code:',
          '#copyCustomerCoupon': 'Copy code',
          '#customerCouponSection .site-card > p.help:last-child': 'No name, phone number or email required. Show the code to our staff.',
          '#menu > p': 'Discover our special dishes, prepared with care and tradition.',
          '#gallery > p': 'Experience the atmosphere of our restaurant through our photos.',
          '#events > p': 'Discover the events organised by Nababi Ristorante.',
          '#reservation > p': 'Send us a booking request. Our staff will contact you to confirm your reservation.',
          '#bookingForm button[type="submit"]': 'Send request',
          '.whatsapp-mini-label': 'DIRECT CONTACT',
          '.whatsapp-booking-copy strong': 'Prefer WhatsApp?',
          '.whatsapp-booking-copy small': 'Message us for information or bookings.',
          '.whatsapp-cta span:not(.whatsapp-cta-arrow)': 'Message us on WhatsApp',
          '#about > h2': 'About us',
          '#about > p': 'Nababi Ristorante brings the authentic flavours of India to Rome, with dishes prepared using traditional recipes and a modern touch.',
          '#reviews > h2': 'What our guests say',
          '#reviews > p': 'Our guests’ satisfaction is our greatest reward.',
          '.google-review-btn': '⭐ Write a Google review',
          '#contact .contact-heading h2': 'Visit us',
          '#contact .contact-heading > p': 'We look forward to welcoming you for an authentic Indian dining experience.',
          '#contact .contact-info-card:nth-child(1) .contact-card-label': 'WHERE WE ARE',
          '#contact .contact-info-card:nth-child(1) h3': 'Our restaurant',
          '#contact .contact-info-card:nth-child(2) .contact-card-label': 'PHONE',
          '#contact .contact-info-card:nth-child(2) h3': 'Call us',
          '#contact .contact-info-card:nth-child(3) .contact-card-label': 'WHATSAPP',
          '#contact .contact-info-card:nth-child(3) h3': 'Message us directly',
          '#contact .contact-info-card:nth-child(4) .contact-card-label': 'EMAIL',
          '#contact .contact-info-card:nth-child(4) h3': 'Send us an email',
          '#contact .contact-hours-heading .contact-card-label': 'WE LOOK FORWARD TO SEEING YOU',
          '#contact .contact-hours-heading h3': 'Opening hours',
          '#contact .contact-form-heading .contact-eyebrow': 'WE ARE HERE FOR YOU',
          '#contact .contact-form-heading h2': 'Send us a message',
          '#contact .contact-form-heading > p': 'Fill in the form and our team will receive your message.',
          '#faq > h2': 'Frequently asked questions',
          '#faq .faq-intro': 'Answers to the most common questions about Nababi Ristorante.',
          '.site-footer > p:last-of-type': 'Authentic Indian cuisine in the heart of Rome.'
        },
        bookingLabels: ['Full name *', 'Phone *', 'Email', 'Number of guests *', 'Date *', 'Time *', 'Booking type', 'Notes'],
        bookingTypes: ['Table', 'Birthday', 'Special event'],
        bookingPlaceholder: 'Special requests (optional)',
        contactLabels: ['Full name *', 'Email', 'Phone', 'Subject', 'Message *'],
        contactButton: 'Send message',
        directions: 'Get directions',
        faq: ['Bookings / Reservations / বুকিং', 'Opening hours / Orari / খোলার সময়', 'Location / Dove siamo / ঠিকানা', 'Takeaway / Asporto / খাবার নিয়ে যাওয়া', 'Home delivery / Consegna a domicilio / হোম ডেলিভারি', 'Payments / Pagamenti / পেমেন্ট', 'Vegetarian options / Menu vegetariano / নিরামিষ খাবার', 'Events and birthdays / Eventi e compleanni / অনুষ্ঠান ও জন্মদিন']
      },
      bn: {
        nav: ['হোম', 'মেনু', 'আমাদের পরিচয়', 'গ্যালারি', 'অনুষ্ঠান', 'টেবিল বুকিং', 'যোগাযোগ'],
        text: {
          '.site-hero .eyebrow': 'নবাবিতে আপনাকে স্বাগতম',
          '.site-hero > div > h2': 'রোমের হৃদয়ে আসল ভারতীয় খাবার।',
          '.site-hero > div > p:not(.eyebrow)': 'স্বাদ, ঐতিহ্য ও ভালোবাসার এক ভ্রমণ। বাছাই করা উপকরণ ও আসল রেসিপিতে তৈরি আমাদের বিশেষ খাবার উপভোগ করুন।',
          '.site-hero a[href="#menu"]': 'মেনু দেখুন',
          '.site-hero a[href="#reservation"]': 'টেবিল বুক করুন',
          '#liveNewsSection h2': 'নতুন খবর ও ঘোষণা',
          '#customerCouponSection .eyebrow': 'নবাবির বিশেষ অফার',
          '#customerCouponSection h2': 'আপনার কুপন নিন',
          '#customerCouponPeriod': 'এই অফারটি সীমিত সময়ের জন্য।',
          '#claimCustomerCoupon': 'কুপন নিন',
          '#customerCouponCode > p:first-child': 'আপনার কুপন কোড:',
          '#copyCustomerCoupon': 'কোড কপি করুন',
          '#customerCouponSection .site-card > p.help:last-child': 'নাম, ফোন বা ইমেইল দেওয়ার প্রয়োজন নেই। স্টাফকে কোডটি দেখান।',
          '#menu > p': 'ভালোবাসা ও ঐতিহ্যে তৈরি আমাদের বিশেষ খাবারগুলো দেখুন।',
          '#gallery > p': 'ছবির মাধ্যমে আমাদের রেস্টুরেন্টের পরিবেশ উপভোগ করুন।',
          '#events > p': 'Nababi Ristorante-এর আয়োজিত অনুষ্ঠানগুলো দেখুন।',
          '#reservation > p': 'টেবিল বুকিংয়ের অনুরোধ পাঠান। বুকিং নিশ্চিত করতে আমাদের স্টাফ আপনার সঙ্গে যোগাযোগ করবে।',
          '#bookingForm button[type="submit"]': 'অনুরোধ পাঠান',
          '.whatsapp-mini-label': 'সরাসরি যোগাযোগ',
          '.whatsapp-booking-copy strong': 'WhatsApp-এ যোগাযোগ করবেন?',
          '.whatsapp-booking-copy small': 'তথ্য বা বুকিংয়ের জন্য আমাদের মেসেজ করুন।',
          '.whatsapp-cta span:not(.whatsapp-cta-arrow)': 'WhatsApp-এ মেসেজ করুন',
          '#about > h2': 'আমাদের পরিচয়',
          '#about > p': 'Nababi Ristorante রোমে নিয়ে এসেছে ভারতের আসল স্বাদ—ঐতিহ্যবাহী রেসিপি ও আধুনিক পরিবেশনায় তৈরি খাবার।',
          '#reviews > h2': 'আমাদের সম্পর্কে অতিথিদের মতামত',
          '#reviews > p': 'আমাদের অতিথিদের সন্তুষ্টিই আমাদের সবচেয়ে বড় প্রাপ্তি।',
          '.google-review-btn': '⭐ Google-এ রিভিউ লিখুন',
          '#contact .contact-heading h2': 'আমাদের ঠিকানা',
          '#contact .contact-heading > p': 'আসল ভারতীয় খাবারের অভিজ্ঞতার জন্য আপনাকে স্বাগত জানাই।',
          '#contact .contact-info-card:nth-child(1) .contact-card-label': 'আমাদের ঠিকানা',
          '#contact .contact-info-card:nth-child(1) h3': 'আমাদের রেস্টুরেন্ট',
          '#contact .contact-info-card:nth-child(2) .contact-card-label': 'ফোন',
          '#contact .contact-info-card:nth-child(2) h3': 'কল করুন',
          '#contact .contact-info-card:nth-child(3) .contact-card-label': 'হোয়াটসঅ্যাপ',
          '#contact .contact-info-card:nth-child(3) h3': 'সরাসরি মেসেজ করুন',
          '#contact .contact-info-card:nth-child(4) .contact-card-label': 'ইমেইল',
          '#contact .contact-info-card:nth-child(4) h3': 'ইমেইল পাঠান',
          '#contact .contact-hours-heading .contact-card-label': 'আপনার অপেক্ষায়',
          '#contact .contact-hours-heading h3': 'খোলার সময়',
          '#contact .contact-form-heading .contact-eyebrow': 'আমরা আপনার জন্য আছি',
          '#contact .contact-form-heading h2': 'আমাদের মেসেজ পাঠান',
          '#contact .contact-form-heading > p': 'ফর্ম পূরণ করুন, আমাদের টিম আপনার মেসেজ পাবে।',
          '#faq > h2': 'সাধারণ প্রশ্ন',
          '#faq .faq-intro': 'Nababi Ristorante সম্পর্কে সাধারণ প্রশ্নের উত্তর।',
          '.site-footer > p:last-of-type': 'রোমের হৃদয়ে আসল ভারতীয় খাবার।'
        },
        bookingLabels: ['নাম ও পদবি *', 'ফোন *', 'ইমেইল', 'অতিথির সংখ্যা *', 'তারিখ *', 'সময় *', 'বুকিংয়ের ধরন', 'বিশেষ নোট'],
        bookingTypes: ['টেবিল', 'জন্মদিন', 'বিশেষ অনুষ্ঠান'],
        bookingPlaceholder: 'বিশেষ অনুরোধ (ঐচ্ছিক)',
        contactLabels: ['নাম ও পদবি *', 'ইমেইল', 'ফোন', 'বিষয়', 'মেসেজ *'],
        contactButton: 'মেসেজ পাঠান',
        directions: 'যাওয়ার দিকনির্দেশনা',
        faq: ['বুকিং / Reservations / বুকিং', 'খোলার সময় / Opening hours / Orari', 'ঠিকানা / Location / Dove siamo', 'খাবার নিয়ে যাওয়া / Takeaway / Asporto', 'হোম ডেলিভারি / Delivery / Consegna a domicilio', 'পেমেন্ট / Payments / Pagamenti', 'নিরামিষ খাবার / Vegetarian options', 'অনুষ্ঠান ও জন্মদিন / Events and birthdays']
      }
    };

    const originals = new Map();
    function remember(node) {
      if (node && !originals.has(node)) {
        originals.set(node, { html: node.innerHTML });
      }
    }
    function setText(selector, value) {
      document.querySelectorAll(selector).forEach(node => {
        remember(node);
        const textNode = Array.from(node.childNodes).find(child =>
          child.nodeType === 3 && child.textContent.trim()
        );
        if (textNode) textNode.textContent = value;
        else node.textContent = value;
      });
    }
    function setLabelText(form, labels) {
      if (!form) return;
      form.querySelectorAll('label').forEach((label, index) => {
        if (labels[index] === undefined) return;
        remember(label);
        const textNode = Array.from(label.childNodes).find(child =>
          child.nodeType === 3 && child.textContent.trim()
        );
        if (textNode) textNode.textContent = labels[index] + ' ';
      });
    }
    function restore() {
      originals.forEach((value, node) => {
        if (node.isConnected) node.innerHTML = value.html;
      });
    }

    function applyLanguage(lang) {
      const language = translations[lang] ? lang : 'it';
      document.documentElement.lang = language;
      selector.value = language;
      if (language === 'it') {
        restore();
        try { localStorage.setItem('nababi-language', 'it'); } catch (_) {}
        return;
      }

      const t = translations[language];
      $('#mainNavigation')?.querySelectorAll('a').forEach((anchor, index) => {
        if (t.nav[index]) setText('#mainNavigation a:nth-child(' + (index + 1) + ')', t.nav[index]);
      });
      Object.entries(t.text).forEach(([selectorText, value]) => setText(selectorText, value));
      setLabelText($('#bookingForm'), t.bookingLabels);
      setLabelText($('#contactForm'), t.contactLabels);

      const bookingType = $('#bookingForm select[name="booking_type"]');
      if (bookingType) {
        Array.from(bookingType.options).forEach((option, index) => {
          if (t.bookingTypes[index]) {
            remember(option);
            option.textContent = t.bookingTypes[index];
          }
        });
      }
      const notes = $('#bookingForm textarea[name="notes"]');
      if (notes) {
        remember(notes);
        notes.placeholder = t.bookingPlaceholder;
      }
      if ($('#contactForm button[type="submit"]')) {
        setText('#contactForm button[type="submit"]', t.contactButton);
      }

      const direction = $('#contact .contact-directions-btn');
      if (direction) {
        remember(direction);
        direction.innerHTML = '<span aria-hidden="true">➤</span> ' + t.directions + ' <span aria-hidden="true">↗</span>';
      }
      Array.from(document.querySelectorAll('#faq .faq-item summary')).forEach((node, index) => {
        if (t.faq[index]) setText('#faq .faq-item:nth-child(' + (index + 1) + ') summary', t.faq[index]);
      });
      try { localStorage.setItem('nababi-language', language); } catch (_) {}
    }

    let saved = 'it';
    try { saved = localStorage.getItem('nababi-language') || 'it'; } catch (_) {}
    selector.value = ['it', 'en', 'bn'].includes(saved) ? saved : 'it';
    selector.addEventListener('change', () => applyLanguage(selector.value));
    applyLanguage(selector.value);
  }

  /* INITIALIZATION */

  async function initializeWebsite() {

    setupBooking();
    setupContactForm();
    setupMobileNavigation();
    setupLanguageSwitcher();

    if (!db) {

      console.error(
        'Nababi: Website could not connect to Supabase.'
      );

      return;
    }

    await Promise.allSettled([

      loadRestaurantLogo(),

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
