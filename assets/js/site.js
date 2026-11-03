
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
      const { data, error } = await db.from('site_settings').select('setting_key,setting_value').in('setting_key',[
        'restaurant_logo_url','restaurant_logo_show_site_header','restaurant_logo_show_site_footer','restaurant_logo_show_favicon'
      ]);
      if (error) throw error;
      const settings = Object.fromEntries((data || []).map(row => [row.setting_key,row.setting_value]));
      const url = settings.restaurant_logo_url;
      const showHeader = settings.restaurant_logo_show_site_header !== 'false';
      const showFooter = settings.restaurant_logo_show_site_footer !== 'false';
      const showFavicon = settings.restaurant_logo_show_favicon !== 'false';
      const headerImage = $('#siteHeaderLogo');
      const footerImage = $('#siteFooterLogo');
      const headerFallback = $('#siteHeaderLogoFallback');
      const footerFallback = $('#siteFooterLogoFallback');
      [headerImage, footerImage].forEach(image => {
        if (!image) return;
        const enabled = image === headerImage ? showHeader : showFooter;
        if (url && enabled) { image.src = url; image.hidden = false; } else image.hidden = true;
      });
      if (headerFallback) headerFallback.hidden = Boolean(url && showHeader);
      if (footerFallback) footerFallback.hidden = Boolean(url && showFooter);
      if (url && showFavicon) {
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


  /* NABABI GALLERY LIGHTBOX */
  function setupGalleryLightbox() {
    const gallery = $('#liveGallery');
    if (!gallery) return;

    let images = [];
    let activeIndex = 0;
    let startX = 0;
    let overlay = $('#galleryLightbox');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'galleryLightbox';
      overlay.className = 'gallery-lightbox';
      overlay.hidden = true;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Gallery image viewer');
      overlay.innerHTML = `
        <button class="gallery-lightbox-close" type="button" aria-label="Close image viewer">×</button>
        <button class="gallery-lightbox-prev" type="button" aria-label="Previous image">‹</button>
        <figure class="gallery-lightbox-figure">
          <img class="gallery-lightbox-image" alt="">
          <figcaption class="gallery-lightbox-caption"></figcaption>
        </figure>
        <button class="gallery-lightbox-next" type="button" aria-label="Next image">›</button>
        <div class="gallery-lightbox-count" aria-live="polite"></div>
      `;
      document.body.appendChild(overlay);
    }

    const largeImage = $('.gallery-lightbox-image', overlay);
    const caption = $('.gallery-lightbox-caption', overlay);
    const counter = $('.gallery-lightbox-count', overlay);
    const closeButton = $('.gallery-lightbox-close', overlay);

    function collectImages() {
      images = Array.from(gallery.querySelectorAll('.site-card img'))
        .filter(image => image.src && image.src !== window.location.href);
    }

    function showImage(index) {
      if (!images.length) return;
      activeIndex = (index + images.length) % images.length;
      const image = images[activeIndex];
      largeImage.src = image.currentSrc || image.src;
      largeImage.alt = image.alt || 'Nababi Ristorante gallery image';
      const card = image.closest('.site-card');
      const title = card?.querySelector('h3')?.textContent?.trim();
      const description = card?.querySelector('p')?.textContent?.trim();
      caption.textContent = [title || image.alt || '', description || ''].filter(Boolean).join(' — ');
      counter.textContent = (activeIndex + 1) + ' / ' + images.length;
      $('.gallery-lightbox-prev', overlay).hidden = images.length < 2;
      $('.gallery-lightbox-next', overlay).hidden = images.length < 2;
    }

    function openImage(image) {
      collectImages();
      activeIndex = images.indexOf(image);
      if (activeIndex < 0) return;
      showImage(activeIndex);
      overlay.hidden = false;
      document.body.classList.add('gallery-lightbox-open');
      closeButton.focus();
    }

    function closeImage() {
      overlay.hidden = true;
      document.body.classList.remove('gallery-lightbox-open');
    }

    gallery.addEventListener('click', event => {
      const image = event.target.closest('.site-card img');
      if (!image) return;
      event.preventDefault();
      openImage(image);
    });

    $('.gallery-lightbox-prev', overlay).addEventListener('click', () => showImage(activeIndex - 1));
    $('.gallery-lightbox-next', overlay).addEventListener('click', () => showImage(activeIndex + 1));
    closeButton.addEventListener('click', closeImage);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeImage();
    });

    document.addEventListener('keydown', event => {
      if (overlay.hidden) return;
      if (event.key === 'Escape') closeImage();
      if (event.key === 'ArrowLeft') showImage(activeIndex - 1);
      if (event.key === 'ArrowRight') showImage(activeIndex + 1);
    });

    overlay.addEventListener('touchstart', event => {
      startX = event.changedTouches[0]?.clientX || 0;
    }, {passive:true});
    overlay.addEventListener('touchend', event => {
      const endX = event.changedTouches[0]?.clientX || 0;
      const delta = endX - startX;
      if (Math.abs(delta) > 45) showImage(activeIndex + (delta < 0 ? 1 : -1));
    }, {passive:true});
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

  async function setupReviewForm() {
    const form = $('#customerReviewForm');
    if (!form) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const status = $('#customerReviewStatus');
      const button = form.querySelector('button[type="submit"]');
      const values = new FormData(form);
      const customerName = String(values.get('customer_name') || '').trim();
      const reviewText = String(values.get('review_text') || '').trim();
      const rating = Number(values.get('rating'));

      // Quiet honeypot field for basic bot protection.
      if (String(values.get('website') || '').trim()) return;

      if (!db) {
        message(status, 'Il servizio recensioni non è disponibile al momento.', 'error');
        return;
      }
      if (customerName.length < 2 || reviewText.length < 5 ||
          !Number.isInteger(rating) || rating < 1 || rating > 5) {
        message(status, 'Inserisci il nome, una recensione di almeno 5 caratteri e una valutazione.', 'error');
        return;
      }

      button.disabled = true;
      message(status, 'Invio in corso…');
      try {
        const { error } = await db.from('reviews').insert({
          customer_name: customerName,
          rating,
          review_text: reviewText,
          is_approved: false
        });
        if (error) throw error;
        form.reset();
        message(status, 'Grazie! La tua recensione è stata inviata e sarà pubblicata dopo la verifica.', 'success');
      } catch (error) {
        console.error('Nababi review submission failed:', error);
        message(status, 'Non è stato possibile inviare la recensione. Riprova più tardi.', 'error');
      } finally {
        button.disabled = false;
      }
    });
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

    const map = $('#floorMap');
    const dateInput = form.elements.booking_date;
    const timeInput = form.elements.booking_time;
    const guestsInput = form.elements.guests;
    const typeInput = form.elements.booking_type;
    const tableInput = form.elements.selected_table_id;
    const phoneInput = form.elements.phone;
    const emailInput = form.elements.email;
    let availableTables = [];

    function specialBooking() {
      return ['birthday', 'anniversary'].includes(typeInput.value);
    }

    function updateRequirements() {
      const special = specialBooking();
      phoneInput.required = special;
      emailInput.required = special;
      document.querySelectorAll('[data-contact-required]').forEach(el => {
        el.textContent = special ? '*' : ' (telefono o email obbligatori)';
      });
    }

    function renderFloorMap() {
      const guests = Number(guestsInput.value || 1);
      const rooms = ['Sala Principale', 'Sala dei Fiori', 'Dehors'];
      const selected = tableInput.value;
      map.innerHTML = '<h3>Scegli il tuo tavolo</h3>' + rooms.map(room => {
        const items = availableTables.filter(t => t.room_name === room);
        if (!items.length) return '';
        return '<section class="floor-room"><h4>' + room + '</h4><div class="floor-table-grid">' +
          items.map(t => {
            const capacityOk = guests <= Number(t.seats) &&
              (t.table_code !== 'SF-16' || guests >= 10);
            const disabled = !t.is_available || !capacityOk;
            const chosen = selected === t.id;
            return '<button type="button" class="floor-table' +
              (chosen ? ' is-selected' : '') + (disabled ? ' is-unavailable' : '') +
              '" data-floor-table="' + t.id + '"' + (disabled ? ' disabled' : '') +
              '><strong>' + t.table_code + '</strong><span>' + t.seats +
              ' posti</span><small>' + (!t.is_available ? 'Occupato' :
              (!capacityOk ? (t.table_code === 'SF-16' && guests < 10 ? 'Minimo 10 ospiti' : 'Capienza insufficiente') : 'Disponibile')) +
              '</small></button>';
          }).join('') + '</div></section>';
      }).join('') || '<p>Nessun tavolo trovato.</p>';
      if (selected && !availableTables.some(t => t.id === selected && t.is_available &&
        guests <= Number(t.seats) && (t.table_code !== 'SF-16' || guests >= 10))) {
        tableInput.value = '';
      }
    }

    async function loadFloorMap() {
      tableInput.value = '';
      if (!dateInput.value || !timeInput.value) {
        map.innerHTML = '<h3>Scegli il tuo tavolo</h3><p>Seleziona data e ora per vedere i tavoli disponibili.</p>';
        return;
      }
      map.innerHTML = '<p>Caricamento tavoli…</p>';
      const { data, error } = await db.rpc('nababi_available_floor_tables', {
        p_date: dateInput.value,
        p_time: timeInput.value
      });
      if (error) {
        map.innerHTML = '<p>Disponibilità non caricabile. Riprova più tardi.</p>';
        console.error('Floor map error:', error);
        return;
      }
      availableTables = data || [];
      renderFloorMap();
    }

    [dateInput, timeInput].forEach(input => input.addEventListener('change', loadFloorMap));
    guestsInput.addEventListener('change', () => {
      tableInput.value = '';
      renderFloorMap();
    });
    typeInput.addEventListener('change', updateRequirements);
    map.addEventListener('click', event => {
      const button = event.target.closest('[data-floor-table]');
      if (!button || button.disabled) return;
      tableInput.value = button.dataset.floorTable;
      renderFloorMap();
    });
    updateRequirements();

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const result = $('#bookingMessage');
      if (!db) {
        message(result, 'Servizio non disponibile. Contattaci su WhatsApp.', 'error');
        return;
      }

      const fd = new FormData(form);
      const booking = {
        full_name: String(fd.get('full_name') || '').trim(),
        phone: String(fd.get('phone') || '').trim() || null,
        email: String(fd.get('email') || '').trim() || null,
        booking_date: String(fd.get('booking_date') || ''),
        booking_time: String(fd.get('booking_time') || ''),
        guests: Number(fd.get('guests')),
        notes: String(fd.get('notes') || '').trim() || null,
        status: 'pending',
        booking_type: String(fd.get('booking_type') || 'table'),
        selected_table_id: String(fd.get('selected_table_id') || ''),
        booking_code: 'NAB-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()
      };

      const special = ['birthday', 'anniversary'].includes(booking.booking_type);
      if (!booking.full_name || !booking.booking_date || !booking.booking_time ||
          !Number.isInteger(booking.guests) || booking.guests < 1 || booking.guests > 16 ||
          (!booking.phone && !booking.email) ||
          (special && (!booking.phone || !booking.email))) {
        message(result, 'Controlla i campi obbligatori. Per compleanno e anniversario servono telefono ed email.', 'error');
        return;
      }
      const chosen = availableTables.find(t => t.id === booking.selected_table_id && t.is_available);
      if (!chosen || booking.guests > Number(chosen.seats) ||
          (chosen.table_code === 'SF-16' && booking.guests < 10)) {
        message(result, 'Scegli un tavolo disponibile adatto al numero di ospiti.', 'error');
        return;
      }

      const submit = $('button[type="submit"]', form);
      if (submit) submit.disabled = true;
      message(result, 'Invio della richiesta…');
      try {
        const { error } = await db.from('bookings').insert(booking);
        if (error) {
          if (error.code === '23505') throw new Error('Questo tavolo è appena stato prenotato per quell’orario. Scegline un altro.');
          throw error;
        }

        // Notify the restaurant admin only. A mail failure never cancels the saved booking.
        try {
          const { error: notifyError } = await db.functions.invoke('booking-notification', {
            body: { booking_code: booking.booking_code }
          });
          if (notifyError) console.warn('Admin booking email notification failed:', notifyError);
        } catch (notifyError) {
          console.warn('Admin booking email notification failed:', notifyError);
        }

        form.reset();
        availableTables = [];
        tableInput.value = '';
        updateRequirements();
        map.innerHTML = '<h3>Scegli il tuo tavolo</h3><p>Seleziona data e ora per vedere i tavoli disponibili.</p>';
        message(result, 'Richiesta inviata! Codice prenotazione: ' + booking.booking_code + '. Il team ti contatterà per confermare.', 'success');
      } catch (error) {
        console.error('Booking error:', error);
        message(result, error.message || 'Invio non riuscito. Contattaci tramite WhatsApp o telefono.', 'error');
        await loadFloorMap();
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  /* CUSTOMER BOOKING STATUS LOOKUP */
  function setupBookingStatusLookup() {
    const form = $('#bookingStatusForm');
    const result = $('#bookingStatusResult');
    if (!form || !result) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const input = form.elements.booking_code;
      const code = String(input.value || '').trim().toUpperCase();
      if (!/^NAB-[A-F0-9]{8,12}$/.test(code)) {
        message(result, 'Inserisci un codice prenotazione valido (es. NAB-XXXXXXXXXXXX).', 'error');
        return;
      }
      if (!db) {
        message(result, 'Servizio temporaneamente non disponibile. Contattaci direttamente.', 'error');
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      message(result, 'Controllo dello stato…');
      try {
        const { data, error } = await db.rpc('nababi_lookup_booking_status', {
          p_booking_code: code
        });
        if (error) throw error;
        const booking = Array.isArray(data) ? data[0] : null;
        if (!booking) {
          message(result, 'Codice non trovato. Controlla il codice e riprova.', 'error');
          return;
        }
        const status = String(booking.status || '').toLowerCase();
        const labels = {
          pending: 'In attesa di conferma',
          new: 'Ricevuta — in attesa di verifica',
          confirmed: 'Prenotazione confermata',
          rejected: 'Prenotazione non confermata',
          cancelled: 'Prenotazione annullata'
        };
        const statusLabel = labels[status] || 'Stato: ' + status;
        const date = booking.booking_date
          ? new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('it-IT')
          : '';
        const time = String(booking.booking_time || '').slice(0, 5);
        result.textContent = 'Codice: ' + booking.booking_code +
          ' · Stato: ' + statusLabel +
          (date ? ' · Data: ' + date : '') +
          (time ? ' · Ora: ' + time : '') +
          (booking.guests ? ' · Ospiti: ' + booking.guests : '');
        result.dataset.state = status === 'confirmed' ? 'success' :
          (status === 'rejected' || status === 'cancelled' ? 'error' : '');
      } catch (error) {
        console.error('Booking status lookup failed:', error);
        message(result, 'Non è stato possibile verificare il codice. Riprova più tardi.', 'error');
      } finally {
        if (button) button.disabled = false;
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
          '#customerCouponExpiryNotice': 'Please note: after the expiry date, the coupon can no longer be used.',
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
          '#reviewFormHeading': 'Share your experience',
          '#reviewFormIntro': 'Tell us about your visit. Your review will be published after our team checks it.',
          '#customerReviewForm button[type="submit"]': 'Submit review',
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
          '#reservation h2': 'Book Your Table',
          '#floorMap h3': 'Choose your table',
          '#floorMap p': 'Select a date and time to see available tables.',
          '#bookingForm label:nth-of-type(2) [data-contact-required]': '(phone or email required)',
          '#bookingStatusForm label': 'Booking code',
          '#bookingStatusForm button': 'Check status',
          '.booking-status-lookup h3': 'Check your booking',
          '.booking-status-lookup > p': 'Enter the code you received after submitting your request.',
          '.whatsapp-booking-copy strong': 'Prefer WhatsApp?',
          '.whatsapp-booking-copy small': 'Message us for information or bookings.',
          '#reviews .site-card h3': 'Leave your review',
          '#contact .contact-form-heading h2': 'Send us a message',
          '#contact .contact-form-heading > p': 'Fill in the form and our team will receive your message.',
          '#contactForm button[type="submit"]': 'Send message',
          '#contact .contact-hours-heading h3': 'Opening hours',
          '#contact .contact-directions-btn': 'Get directions',
          '#faq .faq-item:nth-child(1) p:nth-of-type(1)': 'You can request a table by calling us, messaging us on WhatsApp, or using the booking form.',
          '#faq .faq-item:nth-child(2) p:nth-of-type(1)': 'Check the updated hours in the Contact section. If unsure, please contact us before visiting.',
          '#faq .faq-item:nth-child(3) p:nth-of-type(1)': 'Find us at Via Vespasiano 73/75/77, Rome. Use the directions link in the Contact section.',
          '#faq .faq-item:nth-child(4) p:nth-of-type(1)': 'Please contact us to confirm takeaway availability and arrangements.',
          '#faq .faq-item:nth-child(5) p:nth-of-type(1)': 'Check any delivery links shown on the website or contact us for current options.',
          '#faq .faq-item:nth-child(6) p:nth-of-type(1)': 'Please contact us to confirm the accepted payment methods.',
          '#faq .faq-item:nth-child(7) p:nth-of-type(1)': 'Ask our staff about available vegetarian dishes and their ingredients.',
          '#faq .faq-item:nth-child(8) p:nth-of-type(1)': 'For parties, birthdays, or groups, contact us with your date, guest count, and request.',
          '.site-footer > p:last-of-type': 'Authentic Indian cuisine in the heart of Rome.'
        },
        bookingLabels: ['Full name *', 'Phone *', 'Email', 'Number of guests *', 'Date *', 'Time *', 'Booking type', 'Notes'],
        reviewLabels: ['Your name *', 'Rating *', 'Your review *'],
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
          '#customerCouponExpiryNotice': 'মনে রাখবেন: মেয়াদ শেষ হওয়ার পর এই কুপন আর ব্যবহার করা যাবে না।'
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
          '#reviewFormHeading': 'আপনার অভিজ্ঞতা লিখুন',
          '#reviewFormIntro': 'আপনার অভিজ্ঞতা আমাদের জানান। যাচাইয়ের পর রিভিউ ওয়েবসাইটে প্রকাশ করা হবে।',
          '#customerReviewForm button[type="submit"]': 'রিভিউ জমা দিন',
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
          '#reservation h2': 'আপনার টেবিল বুক করুন',
          '#floorMap h3': 'আপনার টেবিল বেছে নিন',
          '#floorMap p': 'খালি টেবিল দেখতে তারিখ ও সময় নির্বাচন করুন।',
          '#bookingStatusForm label': 'বুকিং কোড',
          '#bookingStatusForm button': 'অবস্থা যাচাই করুন',
          '.booking-status-lookup h3': 'আপনার বুকিং যাচাই করুন',
          '.booking-status-lookup > p': 'অনুরোধ পাঠানোর পর পাওয়া কোডটি লিখুন।',
          '.whatsapp-booking-copy strong': 'WhatsApp-এ যোগাযোগ করবেন?',
          '.whatsapp-booking-copy small': 'তথ্য বা বুকিংয়ের জন্য আমাদের মেসেজ করুন।',
          '#reviews .site-card h3': 'আপনার রিভিউ লিখুন',
          '#contact .contact-form-heading h2': 'আমাদের মেসেজ পাঠান',
          '#contact .contact-form-heading > p': 'ফর্ম পূরণ করুন, আমাদের টিম আপনার মেসেজ পাবে।',
          '#contactForm button[type="submit"]': 'মেসেজ পাঠান',
          '#contact .contact-hours-heading h3': 'খোলার সময়',
          '#contact .contact-directions-btn': 'যাওয়ার দিকনির্দেশনা',
          '#faq .faq-item:nth-child(1) p:nth-of-type(1)': 'ফোন, WhatsApp অথবা ওয়েবসাইটের বুকিং ফর্ম দিয়ে টেবিলের অনুরোধ করতে পারেন।',
          '#faq .faq-item:nth-child(2) p:nth-of-type(1)': 'ওয়েবসাইটের Contact অংশে আপডেট করা সময় দেখুন। নিশ্চিত না হলে আসার আগে যোগাযোগ করুন।',
          '#faq .faq-item:nth-child(3) p:nth-of-type(1)': 'আমাদের ঠিকানা Via Vespasiano 73/75/77, Roma। Contact অংশের Directions লিংক ব্যবহার করুন।',
          '#faq .faq-item:nth-child(4) p:nth-of-type(1)': 'Takeaway সুবিধা ও নিয়ম জানতে আমাদের সঙ্গে যোগাযোগ করুন।',
          '#faq .faq-item:nth-child(5) p:nth-of-type(1)': 'ডেলিভারি সুবিধা জানতে ওয়েবসাইটের লিংক দেখুন অথবা আমাদের সঙ্গে যোগাযোগ করুন।',
          '#faq .faq-item:nth-child(6) p:nth-of-type(1)': 'কোন কোন পেমেন্ট গ্রহণ করা হয়, তা জানতে যোগাযোগ করুন।',
          '#faq .faq-item:nth-child(7) p:nth-of-type(1)': 'নিরামিষ খাবার ও উপকরণ সম্পর্কে আমাদের কর্মীদের জিজ্ঞাসা করুন।',
          '#faq .faq-item:nth-child(8) p:nth-of-type(1)': 'অনুষ্ঠান, জন্মদিন বা গ্রুপ বুকিংয়ের জন্য তারিখ ও অতিথির সংখ্যা জানিয়ে যোগাযোগ করুন।',
          '.site-footer > p:last-of-type': 'রোমের হৃদয়ে আসল ভারতীয় খাবার।'
        },
        bookingLabels: ['নাম ও পদবি *', 'ফোন *', 'ইমেইল', 'অতিথির সংখ্যা *', 'তারিখ *', 'সময় *', 'বুকিংয়ের ধরন', 'বিশেষ নোট'],
        reviewLabels: ['আপনার নাম *', 'রেটিং *', 'আপনার রিভিউ *'],
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
        originals.set(node, { html: node.innerHTML, placeholder: node.getAttribute('placeholder') });
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
        if (node.isConnected) {
          node.innerHTML = value.html;
          if (value.placeholder === null) node.removeAttribute('placeholder');
          else if (value.placeholder !== undefined) node.setAttribute('placeholder', value.placeholder);
        }
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
      setLabelText($('#customerReviewForm'), t.reviewLabels);
      if ($('#customerReviewForm button[type="submit"]')) setText('#customerReviewForm button[type="submit"]', t.text['#customerReviewForm button[type="submit"]']);

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
    setupBookingStatusLookup();
    setupContactForm();
    setupMobileNavigation();
    setupLanguageSwitcher();
    setupGalleryLightbox();

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
