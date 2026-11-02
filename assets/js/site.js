
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
        nav: ['Home','Menu','About us','Gallery','Events','Book a table','Contact'],
        hero: ['A royal journey of flavours','Authentic Indian cuisine in the heart of Rome'],
        sections: {
          menu: 'Our Menu', about: 'Our Story', gallery: 'Gallery',
          events: 'Events', reservation: 'Book a table', reviews: 'What our guests say',
          contact: 'Visit us', faq: 'Frequently asked questions'
        },
        contact: ['WHERE WE ARE','Our restaurant','PHONE','Call us','WHATSAPP','Message us directly','EMAIL','Send us an email','OPENING HOURS','Get directions','We are here for you','Send us a message','Fill in the form and our team will receive your message.','Full name *','Email','Phone','Subject','Message *','Send message'],
        buttons: { review: '⭐ Write a Google review', directions: '➤ Get directions ↗', whatsapp: 'Message us on WhatsApp' },
        about: 'Nababi Ristorante brings the authentic flavours of India to Rome, with dishes prepared using traditional recipes and a modern touch.',
        reviewIntro: 'Our guests’ satisfaction is our greatest reward.',
        contactIntro: 'We look forward to welcoming you for an authentic Indian dining experience.',
        hours: 'Opening hours: please contact us to confirm.',
        faqIntro: 'Answers to the most common questions about Nababi Ristorante.',
        footer: 'Authentic Indian cuisine in the heart of Rome.',
        form: ['Name and surname *','Email','Phone','Subject','Message *','Send message']
      },
      bn: {
        nav: ['হোম','মেনু','আমাদের পরিচয়','গ্যালারি','অনুষ্ঠান','টেবিল বুকিং','যোগাযোগ'],
        hero: ['স্বাদের রাজকীয় ভ্রমণ','রোমের হৃদয়ে আসল ভারতীয় খাবার'],
        sections: {
          menu: 'আমাদের মেনু', about: 'আমাদের গল্প', gallery: 'গ্যালারি',
          events: 'অনুষ্ঠান', reservation: 'টেবিল বুকিং', reviews: 'গ্রাহকদের মতামত',
          contact: 'আমাদের ঠিকানা', faq: 'সাধারণ প্রশ্ন'
        },
        contact: ['আমাদের ঠিকানা','আমাদের রেস্টুরেন্ট','ফোন','কল করুন','হোয়াটসঅ্যাপ','সরাসরি মেসেজ করুন','ইমেইল','ইমেইল পাঠান','খোলার সময়','দিকনির্দেশনা','আমরা আপনার জন্য আছি','আমাদের মেসেজ পাঠান','ফর্ম পূরণ করুন, আমাদের টিম আপনার মেসেজ পাবে।','নাম ও পদবি *','ইমেইল','ফোন','বিষয়','মেসেজ *','মেসেজ পাঠান'],
        buttons: { review: '⭐ Google-এ রিভিউ লিখুন', directions: '➤ যাওয়ার দিকনির্দেশনা ↗', whatsapp: 'WhatsApp-এ মেসেজ করুন' },
        about: 'Nababi Ristorante রোমে নিয়ে এসেছে ভারতের আসল স্বাদ—ঐতিহ্যবাহী রেসিপি ও আধুনিক পরিবেশনায় তৈরি খাবার।',
        reviewIntro: 'আমাদের অতিথিদের সন্তুষ্টিই আমাদের সবচেয়ে বড় প্রাপ্তি।',
        contactIntro: 'আসল ভারতীয় খাবারের অভিজ্ঞতার জন্য আপনাকে স্বাগত জানাই।',
        hours: 'খোলার সময় নিশ্চিত করতে আমাদের সঙ্গে যোগাযোগ করুন।',
        faqIntro: 'Nababi Ristorante সম্পর্কে সাধারণ প্রশ্নের উত্তর।',
        footer: 'রোমের হৃদয়ে আসল ভারতীয় খাবার।',
        form: ['নাম ও পদবি *','ইমেইল','ফোন','বিষয়','মেসেজ *','মেসেজ পাঠান']
      }
    };

    const original = {
      nav: Array.from($('#mainNavigation')?.querySelectorAll('a') || []).map(a => a.textContent),
      headings: {
        menu: $('#menu h2')?.textContent, about: $('#about h2')?.textContent,
        gallery: $('#gallery h2')?.textContent, events: $('#events h2')?.textContent,
        reservation: $('#reservation h2')?.textContent, reviews: $('#reviews h2')?.textContent,
        contact: $('#contact > .contact-heading h2')?.textContent, faq: $('#faq h2')?.textContent
      },
      about: $('#about > p')?.textContent, reviewIntro: $('#reviews > p')?.textContent,
      contactIntro: $('#contact .contact-heading > p')?.textContent,
      faqIntro: $('#faq .faq-intro')?.textContent,
      footer: document.querySelector('.site-footer > p:last-of-type')?.textContent
    };

    function applyLanguage(lang) {
      const t = translations[lang];
      document.documentElement.lang = lang;
      if (!t) {
        selector.value = 'it';
        document.documentElement.lang = 'it';
        $('#mainNavigation')?.querySelectorAll('a').forEach((a,i)=>a.textContent=original.nav[i] || a.textContent);
        Object.entries(original.headings).forEach(([key,value])=>{const el=key==='contact'?$('#contact > .contact-heading h2'):$(`#${key} h2`);if(el&&value)el.textContent=value;});
        if($('#about > p'))$('#about > p').textContent=original.about;
        if($('#reviews > p'))$('#reviews > p').textContent=original.reviewIntro;
        if($('#contact .contact-heading > p'))$('#contact .contact-heading > p').textContent=original.contactIntro;
        if($('#faq .faq-intro'))$('#faq .faq-intro').textContent=original.faqIntro;
        if(document.querySelector('.site-footer > p:last-of-type'))document.querySelector('.site-footer > p:last-of-type').textContent=original.footer;
        document.querySelectorAll('#contact .contact-info-card').forEach((card,i)=>{const h=card.querySelector('h3');const p=card.querySelector('.contact-card-label');if(h)h.textContent=['Il nostro ristorante','Chiamaci','Scrivici direttamente','Mandaci un’email'][i];if(p)p.textContent=['DOVE SIAMO','TELEFONO','WHATSAPP','EMAIL'][i];});
        const hoursTitle=$('#contact .contact-hours-heading h3');if(hoursTitle)hoursTitle.textContent='Orari di apertura';
        const form=$('#contactForm');if(form){const labels=form.querySelectorAll('label');const names=['Nome e cognome *','Email','Telefono','Oggetto','Messaggio *'];labels.forEach((label,i)=>{if(names[i]){const input=label.querySelector('input,textarea');label.childNodes[0].textContent=names[i];}});const btn=form.querySelector('button[type="submit"]');if(btn)btn.textContent='Invia messaggio';}
        const directions=$('#contact .contact-directions-btn');if(directions)directions.innerHTML='<span aria-hidden="true">➤</span> Indicazioni stradali <span aria-hidden="true">↗</span>';
        return;
      }
      $('#mainNavigation')?.querySelectorAll('a').forEach((a,i)=>{if(t.nav[i])a.textContent=t.nav[i];});
      Object.entries(t.sections).forEach(([key,value])=>{const el=key==='contact'?$('#contact > .contact-heading h2'):$(`#${key} h2`);if(el)el.textContent=value;});
      if($('#about > p'))$('#about > p').textContent=t.about;
      if($('#reviews > p'))$('#reviews > p').textContent=t.reviewIntro;
      if($('#contact .contact-heading > p'))$('#contact .contact-heading > p').textContent=t.contactIntro;
      if($('#faq .faq-intro'))$('#faq .faq-intro').textContent=t.faqIntro;
      if(document.querySelector('.site-footer > p:last-of-type'))document.querySelector('.site-footer > p:last-of-type').textContent=t.footer;
      const cards=Array.from(document.querySelectorAll('#contact .contact-info-card'));
      cards.forEach((card,i)=>{const label=card.querySelector('.contact-card-label'),heading=card.querySelector('h3');if(label)label.textContent=t.contact[i*2];if(heading)heading.textContent=t.contact[i*2+1];});
      const hoursTitle=$('#contact .contact-hours-heading h3');if(hoursTitle)hoursTitle.textContent=t.contact[9];
      const directions=$('#contact .contact-directions-btn');if(directions)directions.innerHTML=t.buttons.directions;
      const form=$('#contactForm');if(form){const labels=form.querySelectorAll('label');labels.forEach((label,i)=>{const input=label.querySelector('input,textarea');if(input){label.childNodes[0].textContent=t.form[i] || label.childNodes[0].textContent;}});const btn=form.querySelector('button[type="submit"]');if(btn)btn.textContent=t.form[5];}
      try{localStorage.setItem('nababi-language',lang);}catch(_){}
    }

    let saved='it';try{saved=localStorage.getItem('nababi-language')||'it';}catch(_){}
    selector.value=['it','en','bn'].includes(saved)?saved:'it';
    selector.addEventListener('change',()=>applyLanguage(selector.value));
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
