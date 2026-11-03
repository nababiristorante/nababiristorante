
(() => {
'use strict';

/* NABABI RISTORANTE — ADMIN PANEL */

const cfg = window.NABABI_CONFIG || {};

const STAFF_QR_URL = 'https://nababiristorante.vercel.app/staff-qr.html';

const STAFF_QR_IMAGE =
  'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' +
  encodeURIComponent(STAFF_QR_URL);

const $ = s => document.querySelector(s);

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[c]));

const menu = [
  ['dashboard','▦','Dashboard'],
  ['secret','🎁','Secret Coupon Box'],
  ['discounts','％','Discount Management'],
  ['menu_manager','🍛','Menu Manager'],
  ['qr_menu','▣','QR Menu Images'],
  ['categories','▦','Categories'],
  ['bookings','▣','Bookings'],
  ['customers','♙','Customers'],
  ['coupons','◇','Coupons'],
  ['games','🎮','Games Management'],
  ['staff','♟','Staff Management'],
  ['performance','▥','Staff Performance'],
  ['attendance','◷','Staff Attendance'],
  ['activity','✦','Staff Activity Log'],
  ['tables','▤','Tavolo'],
  ['gallery','▧','Gallery'],
  ['delivery','🛵','Food Delivery Links'],
  ['social','🔗','Social Links'],
  ['menu_public','☷','Menu'],
  ['news','◈','Breaking News'],
  ['reviews','☆','Reviews'],
  ['hours','◷','Hours'],
  ['logo','♛','Logo Management'],
  ['reports','▤','Reports'],
  ['contact','✉','Contact'],
  ['settings','⚙','Settings']
];

const tableMap = {
  categories:'categories',
  bookings:'bookings',
  customers:'customers',
  coupons:'coupons',
  games:'games',
  staff:'staff',
  performance:'staff_activity_logs',
  attendance:'staff_attendance',
  activity:'staff_activity_logs',
  tables:'restaurant_tables',
  gallery:'gallery_items',
  delivery:'delivery_orders',
  menu_public:'menu_items',
  menu_manager:'menu_items',
  qr_menu:'qr_menu_images',
  news:'breaking_news',
  reviews:'reviews',
  hours:'opening_hours',
  secret:'secret_coupon_boxes',
  social:'social_links',
  contact:'contact_messages',
  logo:'site_settings',
  settings:'site_settings'
};

const descriptions = {
  secret:'Gestisci offerte riservate e coupon esclusivi.',
  discounts:'Imposta sconto, periodo di validità e limite dei coupon per i clienti.',
  menu_manager:'Aggiungi e modifica piatti, descrizioni, prezzi e immagini.',
  qr_menu:'Carica le pagine immagine del menu da mostrare solo tramite QR Code.',
  categories:'Organizza le categorie del menu.',
  bookings:'Consulta le prenotazioni dei tavoli.',
  customers:'Archivio clienti.',
  coupons:'Crea e gestisci codici sconto.',
  games:'Gestisci giochi, immagini, premi e disponibilità sul sito.',
  staff:'Gestisci profili e ruoli del personale.',
  performance:'Consulta le attività e le prestazioni del personale.',
  attendance:'Presenze e turni del personale.',
  activity:'Registro delle attività degli utenti staff.',
  tables:'Gestisci tavoli, posti e disponibilità.',
  gallery:'Carica e gestisci le foto del ristorante.',
  delivery:'Consulta gli ordini Food Delivery.',
  social:'Gestisci i collegamenti ai social network.',
  menu_public:'Controlla il menu pubblico del sito.',
  news:'Pubblica annunci e Breaking News.',
  reviews:'Consulta le recensioni dei clienti.',
  hours:'Orari di apertura e chiusura.',
  logo:'Carica il logo del ristorante dal tuo telefono.',
  reports:'Statistiche e report del ristorante.',
  contact:'Leggi e gestisci i messaggi inviati dal modulo Contatti.',
  settings:'Impostazioni generali del sito.'
};

const MODULES = menu.filter(([id]) =>
  !['dashboard','staff','discounts'].includes(id)
);

let db = null;
let current = 'dashboard';
let sessionUser = null;
let userRole = 'guest';
let staffPermissions = {};

function permissionObject(value) {
  const result = {};

  MODULES.forEach(([id]) => {
    result[id] = false;
  });

  if (Array.isArray(value)) {
    value.forEach(id => {
      if (Object.prototype.hasOwnProperty.call(result,id)) {
        result[id] = true;
      }
    });
  } else if (value && typeof value === 'object') {
    MODULES.forEach(([id]) => {
      result[id] = value[id] === true;
    });
  }

  return result;
}

function canSee(id) {
  if (userRole === 'admin') return true;
  if (id === 'dashboard' && userRole === 'staff') return true;

  return userRole === 'staff' &&
    staffPermissions[id] === true;
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

function moduleInfo(id) {
  return menu.find(x => x[0] === id)?.[2] || 'Dashboard';
}

function nav() {
  const side = $('#sideNav');
  const mobile = $('#mobileNav');

  if (side) {
    side.innerHTML = menu
      .filter(([id]) => canSee(id))
      .map(([id,ico,label]) => `
        <button class="nav-btn ${id===current?'active':''}" data-page="${id}">
          <span class="ico">${ico}</span>${esc(label)}
        </button>
      `).join('');
  }

  if (mobile) {
    mobile.querySelectorAll('[data-page]').forEach(button => {
      button.hidden = !canSee(button.dataset.page);
    });
  }

  if (db && userRole === 'admin') refreshNewBookingBadge();
}

async function refreshNewBookingBadge() {
  try {
    const {count,error} = await db.from('bookings')
      .select('*',{count:'exact',head:true}).eq('status','pending');
    if (error) throw error;
    const total = Number(count || 0);
    document.querySelectorAll('[data-page="bookings"]').forEach(button => {
      let badge = button.querySelector('.new-booking-count');
      if (!badge && total > 0) {
        badge = document.createElement('span');
        badge.className = 'new-booking-count';
        badge.style.cssText = 'display:inline-block;margin-left:8px;padding:2px 7px;border-radius:20px;background:#f5c542;color:#382900;font-size:11px;font-weight:800;';
        button.appendChild(badge);
      }
      if (badge) {
        badge.textContent = total > 0 ? 'NEW ' + total : '';
        badge.hidden = total === 0;
      }
    });
  } catch (error) {
    console.warn('New booking count unavailable:', error.message);
  }
}

function showLoginMessage(message) {
  const out = $('#loginMessage');
  if (out) out.textContent = message || '';
}

async function loadAdminBrandLogo() {
  if (!db) return;
  try {
    const {data,error} = await db.from('site_settings').select('setting_key,setting_value')
      .in('setting_key',['restaurant_logo_url','restaurant_logo_show_admin_header']);
    if (error) throw error;
    const settings = Object.fromEntries((data || []).map(row => [row.setting_key,row.setting_value]));
    const image = $('#adminHeaderLogo');
    const fallback = $('#adminHeaderBrandFallback');
    const enabled = settings.restaurant_logo_show_admin_header !== 'false';
    if (image && settings.restaurant_logo_url && enabled) {
      image.src = settings.restaurant_logo_url;
      image.hidden = false;
      if (fallback) fallback.hidden = true;
    } else {
      if (image) image.hidden = true;
      if (fallback) fallback.hidden = false;
    }
  } catch (error) {
    console.warn('Admin logo could not be loaded:', error.message);
  }
}

function openApp(email) {
  $('#loginScreen').hidden = true;
  $('#adminApp').hidden = false;

  $('#adminEmail').textContent =
    (userRole === 'admin' ? 'SUPER ADMIN · ' : 'STAFF · ') +
    (email || 'Account');

  nav();
  loadAdminBrandLogo();

  // Open the coupon redemption screen immediately after login.
  // Staff still need the existing "secret" permission.
  render(canSee('secret') ? 'secret' : 'dashboard');
}

async function verifyAdmin(user) {
  if (!user?.id) {
    throw new Error('Account utente non valido.');
  }

  sessionUser = user;

  // The configured owner account is the primary Super Admin.
  // This also keeps login working if the optional admin_users table has
  // not been created yet. Authentication still requires a valid Supabase
  // email/password session, and the UUID is never a password or secret.
  if (cfg.ADMIN_USER_ID && user.id === cfg.ADMIN_USER_ID) {
    userRole = 'admin';
    staffPermissions = permissionObject({});
    return true;
  }

  const {data:admin,error:adminError} = await db
    .from('admin_users')
    .select('user_id')
    .eq('user_id',user.id)
    .maybeSingle();

  if (adminError) throw adminError;

  if (admin) {
    userRole = 'admin';
    staffPermissions = permissionObject({});
    return true;
  }

  const {data:staff,error:staffError} = await db
    .from('staff')
    .select('id,auth_user_id,permissions,is_active')
    .eq('auth_user_id',user.id)
    .maybeSingle();

  if (staffError) {
    throw new Error('Verifica Staff: ' + staffError.message);
  }

  if (!staff || staff.is_active !== true) {
    throw new Error(
      'Questo account non è autorizzato. Contatta il Super Admin.'
    );
  }

  userRole = 'staff';
  staffPermissions = permissionObject(staff.permissions);

  return true;
}

/* PASSWORD RECOVERY */
function showPasswordResetForm() {
  const loginFields = $('#loginFields');
  const resetFields = $('#passwordResetFields');
  if (loginFields) loginFields.hidden = true;
  if (resetFields) resetFields.hidden = false;
  showLoginMessage('Imposta una nuova password per continuare.');
}

async function requestPasswordRecovery() {
  const email = String($('#email')?.value || '').trim();
  if (!email) {
    showLoginMessage('Inserisci prima la tua email.');
    $('#email')?.focus();
    return;
  }
  const button = $('#forgotPasswordBtn');
  if (button) { button.disabled = true; button.textContent = 'Invio in corso…'; }
  try {
    if (!db) {
      if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
        throw new Error('Configurazione Supabase mancante.');
      }
      db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }
    const redirectTo = window.location.origin + window.location.pathname;
    const {error} = await db.auth.resetPasswordForEmail(email, {redirectTo});
    if (error) throw error;
    showLoginMessage('Email di recupero inviata. Controlla anche Spam/Junk e apri il link da questo dispositivo.');
  } catch (err) {
    showLoginMessage(err.message || 'Impossibile inviare l’email di recupero.');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Password dimenticata? Recuperala'; }
  }
}

async function saveRecoveredPassword() {
  const password = $('#newPassword')?.value || '';
  const confirmation = $('#confirmPassword')?.value || '';
  if (password.length < 8) {
    showLoginMessage('La nuova password deve contenere almeno 8 caratteri.');
    return;
  }
  if (password !== confirmation) {
    showLoginMessage('Le due password non corrispondono.');
    return;
  }
  const button = $('#saveNewPasswordBtn');
  if (button) { button.disabled = true; button.textContent = 'Salvataggio…'; }
  try {
    const {error} = await db.auth.updateUser({password});
    if (error) throw error;
    await db.auth.signOut();
    $('#password').value = '';
    $('#newPassword').value = '';
    $('#confirmPassword').value = '';
    $('#passwordResetFields').hidden = true;
    $('#loginFields').hidden = false;
    showLoginMessage('Password aggiornata. Ora accedi con la nuova password.');
  } catch (err) {
    showLoginMessage(err.message || 'Non è stato possibile aggiornare la password.');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Salva nuova password'; }
  }
}

/* LOGIN */

async function signIn(e) {
  e.preventDefault();

  const btn = $('#loginBtn');
  const email = $('#email')?.value.trim();
  const password = $('#password')?.value;

  showLoginMessage('');

  if (!window.supabase ||
      !cfg.SUPABASE_URL ||
      !cfg.SUPABASE_ANON_KEY) {
    showLoginMessage('Configurazione Supabase mancante.');
    return;
  }

  if (!email || !password) {
    showLoginMessage('Inserisci email e password.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Accesso in corso…';

  try {
    db = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY
    );

    const {data,error} = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    await verifyAdmin(data.user);
    openApp(data.user.email);

  } catch (err) {
    userRole = 'guest';
    staffPermissions = {};
    sessionUser = null;

    try {
      await db?.auth.signOut();
    } catch (_) {}

    showLoginMessage(err.message || 'Accesso non riuscito.');

  } finally {
    btn.disabled = false;
    btn.textContent = 'Accedi';
  }
}

/* DASHBOARD */

function statCard(icon,label,value) {
  return `<article class="stat-card">
    <div class="stat-top">
      <span class="stat-icon">${icon}</span>${esc(label)}
    </div>
    <strong>${esc(value)}</strong>
  </article>`;
}

async function count(table) {
  try {
    const {count,error} = await db
      .from(table)
      .select('*',{count:'exact',head:true});

    if (error) throw error;
    return count ?? 0;
  } catch (_) {
    return '—';
  }
}

async function dashboard() {
  if (userRole === 'staff') {
    const shortcuts = menu
      .filter(([id]) => id !== 'dashboard' && canSee(id))
      .map(([id,ico,label]) => `
        <button class="quick-btn" data-page="${id}">
          ${ico} ${esc(label)}
          <small>Apri modulo</small>
        </button>
      `).join('');

    return `<section class="hero-card">
      <div>
        <p class="eyebrow">NABABI RISTORANTE</p>
        <h2>Benvenuto</h2>
        <p>Accedi ai moduli autorizzati dal Super Admin.</p>
      </div>
      <div class="hero-art">♛</div>
    </section>

    <section class="section-card">
      <div class="section-title"><h2>I tuoi moduli</h2></div>
      <div class="quick-grid">
        ${shortcuts || '<p class="help">Nessun modulo assegnato.</p>'}
      </div>
    </section>`;
  }

  const [visits,clicks,gallery,coupons,bookings,newBookings,reviews,staff] =
    await Promise.all([
      count('site_visits'),
      count('menu_clicks'),
      count('gallery_items'),
      count('coupon_redemptions'),
      count('bookings'),
      (async () => {
        const {count,error} = await db.from('bookings')
          .select('*',{count:'exact',head:true}).eq('status','pending');
        if (error) throw error;
        return count ?? 0;
      })(),
      count('reviews'),
      count('staff')
    ]);

  return `<section class="hero-card">
    <div>
      <p class="eyebrow">OFFERTE ESCLUSIVE</p>
      <h2>♛ Secret Coupon Box 🔒</h2>
      <p>Special discounts, exclusive offers & more!</p>
      <button class="gold-btn" data-page="secret">
        Open Coupon Box →
      </button>
    </div>
    <div class="hero-art">🎁 🍛</div>
  </section>

  <div class="stats-grid">
    ${statCard('◉','Website Visits',visits)}
    ${statCard('♜','Menu Clicks',clicks)}
    ${statCard('▧','Gallery Items',gallery)}
    ${statCard('◇','Coupons Used',coupons)}
    ${statCard('▣','Total Bookings',bookings)}
    ${statCard('🟡','NEW Bookings',newBookings)}
    ${statCard('☆','Total Reviews',reviews)}
    ${statCard('▤','Reports','—')}
    ${statCard('♟','Staff Members',staff)}
  </div>

  <section class="section-card">
    <div class="section-title"><h2>⚡ Quick Actions</h2></div>
    <div class="quick-grid">
      ${[
        ['menu_manager','▧ Add Menu Item','＋ Add dish'],
        ['bookings','▣ New Booking','＋ View bookings'],
        ['coupons','◇ Create Coupon','＋ Manage offers'],
        ['staff','♟ Manage Staff','＋ Staff members']
      ].map(x => `
        <button class="quick-btn" data-page="${x[0]}">
          ${x[1]}<small>${x[2]}</small>
        </button>
      `).join('')}
    </div>
  </section>

  <div class="two-col">
    <section class="section-card">
      <div class="section-title">
        <h2>▣ Recent Bookings</h2>
        <button class="outline-btn" data-page="bookings">View All</button>
      </div>
      <div id="recentBookings" class="help">Loading bookings…</div>
    </section>

    <section class="section-card">
      <div class="section-title"><h2>♟ Recent Activity</h2></div>
      <p class="help">
        Le attività recenti saranno mostrate quando configurate.
      </p>
    </section>
  </div>`;
}

async function loadRecent() {
  if (userRole !== 'admin') return;

  try {
    const {data,error} = await db
      .from('bookings')
      .select('*')
      .order('created_at',{ascending:false})
      .limit(5);

    if (error) throw error;

    const el = $('#recentBookings');
    if (!el) return;

    el.innerHTML = data?.length
      ? `<div class="table-scroll"><table class="data-table">
          <thead>
            <tr><th>Cliente</th><th>Data</th><th>Stato</th></tr>
          </thead>
          <tbody>${data.map(x => `
            <tr>
              <td>${esc(x.full_name || x.name || x.customer_name || '—')}</td>
              <td>${esc(x.booking_date || '—')}</td>
              <td><span class="tag">${esc(x.status || 'Nuovo')}</span></td>
            </tr>
          `).join('')}</tbody>
        </table></div>`
      : '<div class="empty-state">Nessuna prenotazione trovata.</div>';

  } catch (e) {
    const el = $('#recentBookings');
    if (el) {
      el.innerHTML = `<span class="error-text">${esc(e.message)}</span>`;
    }
  }
}

/* STORAGE UPLOAD */

function uploadPanel(kind) {
  return `<section class="section-card">
    <div class="section-title">
      <h2>Carica ${kind==='logo'?'Logo':'immagini'}</h2>
    </div>
    <div class="upload-box">
      ${kind==='gallery' ? `
        <label class="field">Titolo foto
          <input id="galleryTitle" maxlength="150" placeholder="Nababi Ristorante">
        </label>
        <label class="field">Descrizione
          <textarea id="galleryDescription" maxlength="500" placeholder="Descrizione breve (facoltativa)"></textarea>
        </label>
      ` : ''}
      <label class="field">Scegli foto dal telefono
        <input id="mediaFile" type="file"
          accept="image/jpeg,image/png,image/webp">
      </label>
      <button id="uploadBtn" class="gold-btn">
        Carica su Supabase
      </button>
      <p id="uploadStatus" class="help">
        JPG, PNG o WebP. Massimo 8 MB. Bucket:
        ${esc(cfg.STORAGE_BUCKET || 'nababi-media')}.
      </p>
      <img id="uploadPreview" class="preview-img"
        hidden alt="Anteprima immagine">
      <div id="uploadedUrl"></div>
    </div>
  </section>`;
}

async function uploadHandler() {
  const input = $('#mediaFile');
  const btn = $('#uploadBtn');
  const status = $('#uploadStatus');
  const file = input?.files?.[0];

  if (!file) {
    status.textContent = 'Seleziona prima una foto.';
    return;
  }

  if (!['image/jpeg','image/png','image/webp'].includes(file.type) ||
      file.size > 8 * 1024 * 1024) {
    status.textContent =
      'Usa JPG, PNG o WebP con dimensione inferiore a 8 MB.';
    return;
  }

  btn.disabled = true;
  status.textContent = 'Caricamento…';

  try {
    const ext = file.type === 'image/png' ? 'png'
      : file.type === 'image/webp' ? 'webp' : 'jpg';

    const randomPart = globalThis.crypto?.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const path = `${current}/${Date.now()}-${randomPart}.${ext}`;
    const bucket = cfg.STORAGE_BUCKET || 'nababi-media';

    const {data,error} = await db.storage
      .from(bucket)
      .upload(path,file,{
        cacheControl:'3600',
        upsert:false,
        contentType:file.type
      });

    if (error) throw error;

    const {data:pub} = db.storage.from(bucket).getPublicUrl(data.path);

    if (current === 'logo') {
      const {error:saveError} = await db.from('site_settings').upsert({
        setting_key:'restaurant_logo_url',
        setting_value:pub.publicUrl,
        updated_at:new Date().toISOString()
      }, {onConflict:'setting_key'});
      if (saveError) throw saveError;
      const preview = $('#currentLogoPreview');
      if (preview) { preview.src = pub.publicUrl; preview.hidden = false; }
      const fallback = $('#currentLogoFallback');
      if (fallback) fallback.hidden = true;
      $('#uploadedUrl').innerHTML = '<p class="success-text">Logo salvato. Le posizioni selezionate saranno aggiornate sul sito e nel pannello Admin.</p>';
      await loadAdminBrandLogo();
      status.textContent = 'Logo caricato e salvato correttamente.';
      return;
    }

    if (current === 'gallery') {
      const {data:lastRows,error:lastError} = await db
        .from('gallery_items')
        .select('sort_order')
        .order('sort_order',{ascending:false})
        .limit(1);
      if (lastError) throw lastError;

      const nextOrder = Number(lastRows?.[0]?.sort_order || 0) + 1;
      const title = String($('#galleryTitle')?.value || '').trim() || 'Nababi Ristorante';
      const description = String($('#galleryDescription')?.value || '').trim() || null;
      const {error:rowError} = await db.from('gallery_items').insert({
        image_url:pub.publicUrl,
        title,
        description,
        is_active:true,
        sort_order:nextOrder
      });
      if (rowError) throw rowError;

      status.textContent = 'Foto caricata e pubblicata nella Gallery.';
      $('#uploadedUrl').innerHTML = '<p class="success-text">Foto salvata nella Gallery.</p>';
      input.value = '';
      const preview = $('#uploadPreview');
      if (preview) preview.hidden = true;
      await loadGalleryAdmin();
      return;
    }

    $('#uploadedUrl').innerHTML = '<p class="success-text">Caricamento completato.</p><input class="search-input" id="uploadedUrlInput" readonly><button class="outline-btn" id="copyUrl">Copia URL</button><p class="help">Il file è stato caricato nello Storage.</p>';
    $('#uploadedUrlInput').value = pub.publicUrl;
    $('#copyUrl').onclick = async () => {
      try { await navigator.clipboard.writeText(pub.publicUrl); status.textContent = 'URL copiato.'; }
      catch (_) { $('#uploadedUrlInput').select(); status.textContent = 'Seleziona e copia l’URL.'; }
    };
    status.textContent = 'Foto caricata nello Storage.';

  } catch (e) {
    status.textContent = e.message || 'Upload non riuscito.';
  } finally {
    btn.disabled = false;
  }
}


/* QR MENU — IMAGE PAGES ONLY */
function qrMenuAdminPage() {
  return `<section class="section-card">
    <div class="section-title"><h2>Carica le pagine del Menu QR</h2></div>
    <p class="help">Carica le immagini complete del menu: nome dei piatti e prezzi resteranno dentro l'immagine. Queste foto non vengono mostrate nel Menu del sito.</p>
    <form id="qrMenuUploadForm" class="form-grid">
      <label class="field">Scegli immagine dal telefono
        <input id="qrMenuImageFile" type="file" accept="image/jpeg,image/png,image/webp" required>
      </label>
      <img id="qrMenuPreview" class="menu-image-preview" alt="Anteprima Menu QR" hidden>
      <button class="gold-btn" type="submit">Carica immagine nel QR Menu</button>
      <p id="qrMenuStatus" class="help" aria-live="polite"></p>
    </form>
  </section>
  <section class="section-card">
    <div class="section-title"><h2>Immagini salvate</h2></div>
    <div id="qrMenuImages" class="help">Caricamento…</div>
  </section>
  <section class="section-card">
    <h2>QR Code del ristorante</h2>
    <p class="help">Stampa questo codice e posizionalo sui tavoli. Tutti i tavoli aprono lo stesso menu digitale.</p>
    <img style="width:220px;max-width:100%;background:white;padding:10px;border-radius:12px" src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2Fnababiristorante.vercel.app%2Fqr-menu.html" alt="QR Menu">
    <p><a href="https://nababiristorante.vercel.app/qr-menu.html" target="_blank" rel="noopener">Apri QR Menu</a></p>
  </section>`;
}

async function loadQrMenuImages() {
  const host = $('#qrMenuImages');
  if (!host) return;
  const {data,error} = await db.from('qr_menu_images')
    .select('id,image_url,is_active,sort_order')
    .order('sort_order',{ascending:true}).order('created_at',{ascending:true});
  if (error) throw error;
  host.innerHTML = data?.length ? `<div class="menu-dish-list">${data.map(item => `
    <article class="menu-dish-row">
      <img class="menu-dish-thumb" src="${esc(item.image_url)}" alt="Pagina Menu QR">
      <div class="menu-dish-info"><strong>Pagina Menu</strong><small>${item.is_active ? 'Visibile nel QR Menu' : 'Nascosta nel QR Menu'}</small></div>
      <div class="menu-dish-actions">
        <button class="outline-btn" data-qr-action="up" data-id="${esc(item.id)}" aria-label="Sposta su">↑</button>
        <button class="outline-btn" data-qr-action="down" data-id="${esc(item.id)}" aria-label="Sposta giù">↓</button>
        <button class="outline-btn" data-qr-action="toggle" data-active="${item.is_active}" data-id="${esc(item.id)}">${item.is_active ? 'Nascondi' : 'Mostra'}</button>
        <button class="outline-btn" data-qr-action="delete" data-id="${esc(item.id)}">Elimina</button>
      </div>
    </article>`).join('')}</div>` : '<p class="empty-state">Non hai ancora caricato immagini nel QR Menu.</p>';
}

async function uploadQrMenuImage(event) {
  event.preventDefault();
  const input = $('#qrMenuImageFile');
  const status = $('#qrMenuStatus');
  const button = event.submitter;
  const file = input.files?.[0];
  if (!file) { status.textContent = 'Scegli prima un’immagine.'; return; }
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
    status.textContent = 'Usa JPG, PNG o WebP (massimo 12 MB).'; return;
  }
  button.disabled = true;
  status.textContent = 'Caricamento…';
  try {
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = 'qr-menu/' + Date.now() + '-' + (crypto.randomUUID?.() || Math.random().toString(36).slice(2)) + '.' + ext;
    const bucket = cfg.STORAGE_BUCKET || 'nababi-media';
    const {data:uploaded,error:uploadError} = await db.storage.from(bucket).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if (uploadError) throw uploadError;
    const {data:publicFile} = db.storage.from(bucket).getPublicUrl(uploaded.path);
    const {data:last,error:lastError} = await db.from('qr_menu_images').select('sort_order').order('sort_order',{ascending:false}).limit(1);
    if (lastError) throw lastError;
    const {error} = await db.from('qr_menu_images').insert({image_url:publicFile.publicUrl,is_active:true,sort_order:Number(last?.[0]?.sort_order || 0)+1});
    if (error) throw error;
    input.value = '';
    $('#qrMenuPreview').hidden = true;
    status.textContent = 'Immagine caricata correttamente nel QR Menu.';
    await loadQrMenuImages();
  } catch (error) {
    status.textContent = error.message || 'Caricamento non riuscito.';
  } finally {
    button.disabled = false;
  }
}

/* GALLERY ADMIN */

async function loadGalleryAdmin() {
  const host = $('#galleryAdminList');
  if (!host) return;

  host.innerHTML = '<p class="help">Caricamento foto…</p>';
  try {
    const {data,error} = await db
      .from('gallery_items')
      .select('id,image_url,title,description,is_active,sort_order')
      .order('sort_order',{ascending:true});
    if (error) throw error;

    host.innerHTML = data?.length ? `
      <div class="menu-dish-list">${data.map(item => `
        <article class="menu-dish-row">
          <img class="menu-dish-thumb" src="${esc(item.image_url)}" alt="${esc(item.title || 'Gallery')}">
          <div class="menu-dish-info">
            <strong>${esc(item.title || 'Nababi Ristorante')}</strong>
            <small>${item.is_active === false ? 'Nascosta dal sito' : 'Visibile sul sito'}</small>
            ${item.description ? `<small>${esc(item.description)}</small>` : ''}
          </div>
          <div class="menu-dish-actions">
            <button type="button" class="outline-btn" data-gallery-move="up" data-gallery-id="${esc(item.id)}" aria-label="Sposta foto in alto">↑</button>
            <button type="button" class="outline-btn" data-gallery-move="down" data-gallery-id="${esc(item.id)}" aria-label="Sposta foto in basso">↓</button>
            <button type="button" class="outline-btn" data-edit-gallery="${esc(item.id)}">Modifica</button>
            <button type="button" class="menu-delete-btn" data-delete-gallery="${esc(item.id)}">Elimina</button>
          </div>
          <form class="gallery-edit-form" data-gallery-edit-form="${esc(item.id)}" hidden>
            <label class="field">Titolo foto
              <input name="title" maxlength="150" required value="${esc(item.title || '')}">
            </label>
            <label class="field">Descrizione
              <textarea name="description" maxlength="500">${esc(item.description || '')}</textarea>
            </label>
            <label class="field">Sostituisci foto (facoltativo)
              <input name="replacement_image" type="file" accept="image/jpeg,image/png,image/webp">
            </label>
            <label class="gallery-active-toggle">
              <input name="is_active" type="checkbox" ${item.is_active === false ? '' : 'checked'}>
              Mostra questa foto sul sito
            </label>
            <div class="gallery-edit-actions">
              <button type="submit" class="gold-btn">Salva modifiche</button>
              <button type="button" class="outline-btn" data-cancel-gallery-edit="${esc(item.id)}">Annulla</button>
            </div>
            <p class="help" data-gallery-edit-status></p>
          </form>
        </article>
      `).join('')}</div>`
      : '<div class="empty-state">Nessuna foto nella Gallery.</div>';
  } catch (e) {
    host.innerHTML = `<p class="error-text">${esc(e.message || 'Impossibile caricare la Gallery.')}</p>`;
  }
}

async function updateGalleryItem(id, form) {
  const title = String(form.elements.title?.value || '').trim();
  const description = String(form.elements.description?.value || '').trim() || null;
  const is_active = Boolean(form.elements.is_active?.checked);
  const replacement = form.elements.replacement_image?.files?.[0] || null;
  if (!title) throw new Error('Inserisci il titolo della foto.');
  if (replacement && (!['image/jpeg','image/png','image/webp'].includes(replacement.type) || replacement.size > 8 * 1024 * 1024)) {
    throw new Error('Usa JPG, PNG o WebP con dimensione inferiore a 8 MB.');
  }

  const status = form.querySelector('[data-gallery-edit-status]');
  const save = form.querySelector('button[type="submit"]');
  if (save) save.disabled = true;
  if (status) status.textContent = 'Salvataggio…';
  try {
    const changes = {title, description, is_active};
    if (replacement) {
      const ext = replacement.type === 'image/png' ? 'png' : replacement.type === 'image/webp' ? 'webp' : 'jpg';
      const randomPart = globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const path = `gallery/${Date.now()}-${randomPart}.${ext}`;
      const bucket = cfg.STORAGE_BUCKET || 'nababi-media';
      const {data:uploaded,error:uploadError} = await db.storage.from(bucket).upload(path,replacement,{
        cacheControl:'3600',upsert:false,contentType:replacement.type
      });
      if (uploadError) throw uploadError;
      const {data:publicData} = db.storage.from(bucket).getPublicUrl(uploaded.path);
      changes.image_url = publicData.publicUrl;
    }
    const {error} = await db.from('gallery_items').update(changes).eq('id', id);
    if (error) throw error;
    await loadGalleryAdmin();
  } catch (error) {
    if (status) status.textContent = error.message || 'Salvataggio non riuscito.';
    if (save) save.disabled = false;
    throw error;
  }
}

async function moveGalleryItem(id, direction) {
  const {data:rows,error} = await db.from('gallery_items')
    .select('id,sort_order')
    .order('sort_order',{ascending:true});
  if (error) throw error;
  const index = rows.findIndex(row => String(row.id) === String(id));
  const targetIndex = index + (direction === 'up' ? -1 : 1);
  if (index < 0 || targetIndex < 0 || targetIndex >= rows.length) return;
  const current = rows[index];
  const adjacent = rows[targetIndex];
  const first = await db.from('gallery_items').update({sort_order:adjacent.sort_order}).eq('id',current.id);
  if (first.error) throw first.error;
  const second = await db.from('gallery_items').update({sort_order:current.sort_order}).eq('id',adjacent.id);
  if (second.error) throw second.error;
  await loadGalleryAdmin();
}

async function deleteGalleryItem(id) {
  if (!confirm('Eliminare definitivamente questa foto dal sito e da Supabase Storage?')) return;

  const {data:item,error:readError} = await db
    .from('gallery_items')
    .select('id,image_url')
    .eq('id',id)
    .single();
  if (readError) throw readError;

  const {data:deleted,error:deleteError} = await db
    .from('gallery_items')
    .delete()
    .eq('id',id)
    .select('id')
    .maybeSingle();
  if (deleteError) throw deleteError;
  if (!deleted) throw new Error('Foto non eliminata. Controlla la policy DELETE di gallery_items.');

  const bucket = cfg.STORAGE_BUCKET || 'nababi-media';
  try {
    const marker = '/object/public/' + bucket + '/';
    const url = new URL(item.image_url);
    const at = url.pathname.indexOf(marker);
    if (at >= 0) {
      const path = decodeURIComponent(url.pathname.slice(at + marker.length));
      const {error:storageError} = await db.storage.from(bucket).remove([path]);
      if (storageError) throw storageError;
    }
  } catch (e) {
    throw new Error('Foto rimossa dal sito, ma Storage non è riuscito a eliminarla: ' + e.message);
  }

  await loadGalleryAdmin();
}

/* CATEGORIES */

function categoryPage() {
  return `<section class="section-card">
    <div class="section-title"><h2>Nuova categoria</h2></div>
    <form id="categoryForm" class="form-grid">
      <label class="field">Nome categoria
        <input name="name" required
          placeholder="Antipasti" maxlength="100">
      </label>
      <div style="align-self:end">
        <button class="gold-btn">Salva categoria</button>
      </div>
    </form>
    <div id="categoryList" class="help">Caricamento…</div>
  </section>`;
}

async function categoryLoad() {
  const host = $('#categoryList');
  if (!host) return;

  try {
    const {data,error} = await db
      .from('categories')
      .select('*')
      .order('name');

    if (error) throw error;

    host.innerHTML = data?.length
      ? data.map(x => `
          <p>• ${esc(x.name)}
            <button class="outline-btn"
              data-delete-category="${esc(x.id)}">
              Elimina
            </button>
          </p>
        `).join('')
      : 'Nessuna categoria.';

  } catch (e) {
    host.innerHTML =
      `<span class="error-text">${esc(e.message)}</span>`;
  }
}

/* MENU MANAGER */

let editingDishId = null;

function menuPage() {
  return `<section class="section-card menu-manager-card">
    <div class="section-title">
      <h2 id="dishFormTitle">Aggiungi piatto</h2>
    </div>
    <form id="dishForm" class="form-grid">
      <label class="field">Nome del piatto
        <input name="name" required maxlength="150"
          placeholder="Es. Chicken Biryani">
      </label>
      <label class="field">Prezzo (€)
        <input name="price" type="number"
          min="0" step="0.01" required placeholder="0,00">
      </label>
      <label class="field">Categoria
        <select name="category" id="dishCategory" required>
          <option value="">Seleziona categoria</option>
        </select>
      </label>
      <label class="field">Descrizione
        <textarea name="description" maxlength="1000"
          placeholder="Descrizione del piatto"></textarea>
      </label>
      <label class="field menu-photo-field">Foto del piatto
        <input id="dishImage" name="image" type="file"
          accept="image/jpeg,image/png,image/webp">
        <span class="help">Scegli una foto dalla Galleria/Foto del telefono (JPG, PNG o WebP, max 8 MB).</span>
      </label>
      <div class="menu-image-preview-wrap">
        <img id="dishImagePreview" class="menu-image-preview"
          alt="Anteprima foto piatto" hidden>
      </div>
      <label class="field">Disponibilità
        <select name="is_available">
          <option value="true">Disponibile</option>
          <option value="false">Non disponibile</option>
        </select>
      </label>
      <div class="menu-form-actions">
        <button id="dishSaveBtn" class="gold-btn" type="submit">Salva piatto</button>
        <button id="dishCancelEdit" class="outline-btn" type="button" hidden>Annulla modifica</button>
      </div>
    </form>
    <p id="dishStatus" class="help" aria-live="polite"></p>
  </section>

  <section class="section-card">
    <div class="section-title"><h2>Piatti salvati</h2></div>
    <label class="field">Cerca un piatto
      <input id="dishSearch" type="search" placeholder="Nome o categoria…">
    </label>
    <div id="dishList" class="help">Caricamento…</div>
  </section>`;
}

async function loadDishCategories(selected = '') {
  const select = $('#dishCategory');
  if (!select) return;

  const {data,error} = await db
    .from('categories')
    .select('name')
    .order('name');

  if (error) throw error;

  const names = (data || []).map(x => x.name).filter(Boolean);
  select.innerHTML = '<option value="">Seleziona categoria</option>' +
    names.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');

  if (selected && !names.includes(selected)) {
    select.insertAdjacentHTML('beforeend',
      `<option value="${esc(selected)}">${esc(selected)}</option>`);
  }
  select.value = selected || '';
}

async function dishLoad() {
  const host = $('#dishList');
  if (!host) return;

  try {
    const {data,error} = await db
      .from('menu_items')
      .select('*')
      .order('name')
      .limit(200);

    if (error) throw error;

    host.innerHTML = data?.length
      ? `<div class="menu-dish-list">${data.map(x => `
          <article class="menu-dish-row" data-search="${esc((x.name + ' ' + (x.category || '')).toLocaleLowerCase())}">
            ${x.image_url
              ? `<img class="menu-dish-thumb" src="${esc(x.image_url)}" alt="${esc(x.name)}">`
              : '<div class="menu-dish-thumb menu-no-photo">🍽️</div>'}
            <div class="menu-dish-info">
              <strong>${esc(x.name)}</strong>
              <span>€${esc(Number(x.price).toFixed(2))} · ${esc(x.category || 'Senza categoria')}</span>
              <small>${x.is_available ? 'Disponibile' : 'Non disponibile'}</small>
            </div>
            <div class="menu-dish-actions">
              <button type="button" class="outline-btn"
                data-toggle-dish="${esc(x.id)}" data-available="${x.is_available ? 'true' : 'false'}">${x.is_available ? 'Segna non disponibile' : 'Rendi disponibile'}</button>
              <button type="button" class="outline-btn"
                data-edit-dish="${esc(x.id)}">Modifica</button>
              <button type="button" class="menu-delete-btn"
                data-delete-dish="${esc(x.id)}">Elimina</button>
            </div>
          </article>
        `).join('')}</div>`
      : '<div class="empty-state">Nessun piatto inserito. Aggiungi il primo piatto qui sopra.</div>';

  } catch (e) {
    host.innerHTML = `<span class="error-text">${esc(e.message)}</span>`;
  }
}

function resetDishForm() {
  const form = $('#dishForm');
  if (!form) return;
  form.reset();
  editingDishId = null;
  $('#dishFormTitle').textContent = 'Aggiungi piatto';
  $('#dishSaveBtn').textContent = 'Salva piatto';
  $('#dishCancelEdit').hidden = true;
  const preview = $('#dishImagePreview');
  preview.hidden = true;
  preview.removeAttribute('src');
  $('#dishStatus').textContent = '';
  loadDishCategories().catch(err => {
    $('#dishStatus').textContent = err.message;
  });
}

async function editDish(id) {
  const status = $('#dishStatus');
  try {
    const {data,error} = await db
      .from('menu_items')
      .select('*')
      .eq('id',id)
      .single();
    if (error) throw error;

    const form = $('#dishForm');
    form.elements.name.value = data.name || '';
    form.elements.price.value = data.price ?? '';
    form.elements.description.value = data.description || '';
    form.elements.is_available.value = data.is_available ? 'true' : 'false';
    await loadDishCategories(data.category || '');
    editingDishId = id;
    $('#dishFormTitle').textContent = 'Modifica piatto';
    $('#dishSaveBtn').textContent = 'Salva modifiche';
    $('#dishCancelEdit').hidden = false;

    const preview = $('#dishImagePreview');
    if (data.image_url) {
      preview.src = data.image_url;
      preview.hidden = false;
    } else {
      preview.hidden = true;
    }
    status.textContent = 'Modifica i campi e premi Salva modifiche.';
    form.scrollIntoView({behavior:'smooth',block:'start'});
  } catch (e) {
    status.textContent = e.message || 'Impossibile aprire il piatto.';
  }
}

async function saveDish(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const status = $('#dishStatus');
  const btn = $('#dishSaveBtn');
  const file = fd.get('image');
  btn.disabled = true;
  status.textContent = 'Salvataggio in corso…';

  try {
    const payload = {
      name:String(fd.get('name') || '').trim(),
      price:Number(fd.get('price')),
      category:String(fd.get('category') || '').trim(),
      description:String(fd.get('description') || '').trim() || null,
      is_available:fd.get('is_available') === 'true'
    };

    if (!payload.name || !payload.category ||
        !Number.isFinite(payload.price) || payload.price < 0) {
      throw new Error('Inserisci nome, prezzo valido e categoria.');
    }

    if (file?.size) {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) ||
          file.size > 8 * 1024 * 1024) {
        throw new Error('Usa JPG, PNG o WebP con dimensione massima di 8 MB.');
      }
      const ext = file.type === 'image/png' ? 'png'
        : file.type === 'image/webp' ? 'webp' : 'jpg';
      const unique = globalThis.crypto?.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const bucket = cfg.STORAGE_BUCKET || 'nababi-media';
      const path = `menu/${unique}.${ext}`;
      const {data,error} = await db.storage.from(bucket).upload(path,file,{
        cacheControl:'3600',upsert:false,contentType:file.type
      });
      if (error) throw error;
      const publicUrl = db.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
      if (!publicUrl) throw new Error('Foto caricata ma URL non disponibile.');
      payload.image_url = publicUrl;
    }

    const request = editingDishId
      ? db.from('menu_items').update(payload).eq('id',editingDishId)
      : db.from('menu_items').insert(payload);
    const {error} = await request;
    if (error) throw error;

    status.textContent = editingDishId
      ? 'Piatto aggiornato correttamente.'
      : 'Piatto salvato correttamente.';
    resetDishForm();
    await dishLoad();
  } catch (err) {
    status.textContent = err.message || 'Salvataggio non riuscito.';
  } finally {
    btn.disabled = false;
  }
}

async function deleteDish(id) {
  if (!confirm('Vuoi eliminare definitivamente questo piatto dal menu?')) return;
  const {error} = await db.from('menu_items').delete().eq('id',id);
  if (error) throw error;
  if (String(editingDishId) === String(id)) resetDishForm();
  await dishLoad();
}


/* RESTAURANT TABLE MANAGEMENT — TAVOLO */

let editingTableId = null;

function tablesPage() {
  return `
    <section class="section-card table-manager-card">
      <div class="section-title">
        <h2 id="tableFormTitle">Aggiungi tavolo</h2>
      </div>
      <form id="restaurantTableForm" class="form-grid">
        <label class="field">Nome / Numero tavolo
          <input name="name" required maxlength="80"
            placeholder="Es. Tavolo 1">
        </label>
        <label class="field">Numero posti
          <input name="capacity" type="number" min="1"
            max="100" step="1" required placeholder="Es. 4">
        </label>
        <label class="field">Note
          <textarea name="notes" maxlength="500"
            placeholder="Es. Vicino alla finestra"></textarea>
        </label>
        <label class="field">Stato del tavolo
          <select name="is_active">
            <option value="true">Attivo</option>
            <option value="false">Disattivato</option>
          </select>
        </label>
        <div class="table-form-actions">
          <button id="tableSaveBtn" class="gold-btn" type="submit">Salva tavolo</button>
          <button id="tableCancelEdit" class="outline-btn" type="button" hidden>Annulla modifica</button>
        </div>
      </form>
      <p id="tableStatus" class="help" aria-live="polite"></p>
    </section>

    <section class="section-card">
      <div class="section-title">
        <h2>Tutti i tavoli</h2>
        <span id="tableCount" class="help"></span>
      </div>
      <div id="restaurantTableList" class="help">Caricamento…</div>
    </section>
  `;
}

async function loadRestaurantTables() {
  const host = $('#restaurantTableList');
  if (!host) return;

  try {
    const {data,error} = await db
      .from('restaurant_tables')
      .select('id,name,capacity,is_active,notes,created_at')
      .order('id',{ascending:true});

    if (error) throw error;
    const rows = data || [];
    const count = $('#tableCount');
    if (count) count.textContent = rows.length + ' tavoli';

    host.innerHTML = rows.length
      ? `<div class="restaurant-table-grid">${rows.map(t => `
          <article class="restaurant-table-card ${t.is_active === false ? 'is-disabled' : ''}">
            <div class="restaurant-table-top">
              <span class="restaurant-table-icon">▤</span>
              <span class="restaurant-table-state ${t.is_active === false ? 'off' : 'on'}">
                ${t.is_active === false ? 'Disattivato' : 'Attivo'}
              </span>
            </div>
            <h3>${esc(t.name)}</h3>
            <p class="restaurant-table-capacity">♙ ${esc(t.capacity)} posti</p>
            ${t.notes ? `<p class="restaurant-table-notes">${esc(t.notes)}</p>` : ''}
            <div class="restaurant-table-actions">
              <button type="button" class="outline-btn"
                data-edit-table="${esc(t.id)}">Modifica</button>
              <button type="button" class="table-delete-btn"
                data-delete-table="${esc(t.id)}">Elimina</button>
            </div>
          </article>
        `).join('')}</div>`
      : '<div class="empty-state">Nessun tavolo ancora inserito. Aggiungi il primo tavolo qui sopra.</div>';
  } catch (e) {
    host.innerHTML = `<p class="error-text">${esc(e.message || 'Impossibile caricare i tavoli.')}</p>`;
  }
}

function resetTableForm() {
  const form = $('#restaurantTableForm');
  if (!form) return;
  form.reset();
  editingTableId = null;
  $('#tableFormTitle').textContent = 'Aggiungi tavolo';
  $('#tableSaveBtn').textContent = 'Salva tavolo';
  $('#tableCancelEdit').hidden = true;
  $('#tableStatus').textContent = '';
}

async function editRestaurantTable(id) {
  const status = $('#tableStatus');
  try {
    const {data,error} = await db
      .from('restaurant_tables')
      .select('id,name,capacity,is_active,notes')
      .eq('id',id)
      .single();
    if (error) throw error;

    const form = $('#restaurantTableForm');
    form.elements.name.value = data.name || '';
    form.elements.capacity.value = data.capacity ?? 1;
    form.elements.notes.value = data.notes || '';
    form.elements.is_active.value = data.is_active === false ? 'false' : 'true';
    editingTableId = id;
    $('#tableFormTitle').textContent = 'Modifica tavolo';
    $('#tableSaveBtn').textContent = 'Salva modifiche';
    $('#tableCancelEdit').hidden = false;
    status.textContent = 'Modifica i dati e premi Salva modifiche.';
    form.scrollIntoView({behavior:'smooth',block:'start'});
  } catch (e) {
    status.textContent = e.message || 'Impossibile aprire il tavolo.';
  }
}

async function saveRestaurantTable(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const status = $('#tableStatus');
  const btn = $('#tableSaveBtn');

  const name = String(fd.get('name') || '').trim();
  const capacity = Number(fd.get('capacity'));
  const notes = String(fd.get('notes') || '').trim() || null;
  const is_active = fd.get('is_active') === 'true';

  if (!name || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
    status.textContent = 'Inserisci un nome e un numero di posti valido (1–100).';
    return;
  }

  btn.disabled = true;
  status.textContent = 'Salvataggio in corso…';
  try {
    const payload = {name,capacity,notes,is_active};
    const request = editingTableId
      ? db.from('restaurant_tables').update(payload).eq('id',editingTableId)
      : db.from('restaurant_tables').insert(payload);
    const {error} = await request;
    if (error) throw error;

    status.textContent = editingTableId
      ? 'Tavolo aggiornato correttamente.'
      : 'Tavolo aggiunto correttamente.';
    resetTableForm();
    await loadRestaurantTables();
  } catch (err) {
    status.textContent = err.message || 'Salvataggio non riuscito.';
  } finally {
    btn.disabled = false;
  }
}

async function deleteRestaurantTable(id) {
  if (!confirm('Vuoi eliminare definitivamente questo tavolo?')) return;
  const {error} = await db
    .from('restaurant_tables')
    .delete()
    .eq('id',id);
  if (error) throw error;
  if (String(editingTableId) === String(id)) resetTableForm();
  await loadRestaurantTables();
}

/* STAFF PERMISSIONS */

function permissionOptions(selected = {}) {
  const permissions = permissionObject(selected);

  return MODULES.map(([id,,label]) => `
    <label class="field" style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" name="perm"
        value="${esc(id)}"
        ${permissions[id] ? 'checked' : ''}
        style="width:auto">
      ${esc(label)}
    </label>
  `).join('');
}

/* STAFF MANAGEMENT — TWO ACCOUNT TYPES */

function staffPage() {
  return `
    <section class="section-card">
      <div class="section-title">
        <h2>Full Staff Account — Email & Password</h2>
      </div>

      <p class="help">
        Crea un account Staff con nome, email e password.
        Il dipendente potrà accedere con le proprie credenziali.
        Seleziona solo i moduli autorizzati.
      </p>

      <form id="fullStaffForm" class="form-grid">
        <label class="field">Staff Name
          <input name="full_name" required maxlength="120"
            placeholder="Nome del dipendente">
        </label>

        <label class="field">Email
          <input name="email" type="email" required maxlength="254"
            autocomplete="off">
        </label>

        <label class="field">Phone
          <input name="phone" type="tel" maxlength="40">
        </label>

        <label class="field">Password (minimum 10 characters)
          <input name="password" type="password"
            minlength="10" autocomplete="new-password" required>
        </label>

        <div class="section-card">
          <h3>Module Permissions</h3>
          <p class="help">
            Seleziona i moduli che questo dipendente può utilizzare.
          </p>
          <div class="form-grid">
            ${permissionOptions({})}
          </div>
        </div>

        <div>
          <button id="createFullStaffBtn"
            class="gold-btn" type="submit">
            Create Full Staff Account
          </button>
        </div>
      </form>

      <p id="fullStaffStatus" class="help"
        aria-live="polite"></p>
    </section>

    <section class="section-card">
      <div class="section-title">
        <h2>Attendance-only Account — Photo & PIN</h2>
      </div>

      <p class="help">
        Crea un profilo per il QR Check-in / Check-out.
        Non servono email o password.
      </p>

      <form id="staffForm" class="form-grid">
        <label class="field">Staff Name
          <input name="full_name" required maxlength="120"
            placeholder="Nome del dipendente">
        </label>

        <label class="field">Staff Photo
          <input name="photo" type="file"
            accept="image/jpeg,image/png,image/webp" required>
        </label>

        <label class="field">Personal PIN (4 digits)
          <input name="pin" type="password"
            inputmode="numeric" pattern="[0-9]{4}"
            minlength="4" maxlength="4"
            autocomplete="new-password" required
            placeholder="••••">
        </label>

        <div>
          <button id="createStaffBtn"
            class="gold-btn" type="submit">
            Create Attendance Account
          </button>
        </div>
      </form>

      <p id="staffStatus" class="help"
        aria-live="polite"></p>
    </section>

    <section class="section-card">
      <div class="section-title">
        <h2>Staff Accounts</h2>
      </div>
      <div id="staffList">Loading…</div>
    </section>

    <section class="section-card">
      <div class="section-title">
        <h2>Staff Check-in Popup Announcements</h2>
      </div>
      <p class="help">Pubblica qui un messaggio che apparirà ai dipendenti dopo un Check-in completato. Questa sezione è gestita dal Main Admin Panel.</p>
      <form id="staffAnnouncementForm" class="form-grid">
        <label class="field">Titolo
          <input name="title" required maxlength="180" placeholder="Es. Istruzioni per oggi">
        </label>
        <label class="field">Messaggio
          <textarea name="message" rows="4" required maxlength="2000" placeholder="Scrivi le istruzioni per il personale"></textarea>
        </label>
        <div class="form-grid">
          <label class="field">Mostra dal
            <input name="starts_at" type="datetime-local">
          </label>
          <label class="field">Nascondi dal
            <input name="ends_at" type="datetime-local">
          </label>
        </div>
        <button class="gold-btn" type="submit">Pubblica messaggio Staff</button>
      </form>
      <p id="staffAnnouncementStatus" class="help" aria-live="polite"></p>
      <div id="staffAnnouncementList" class="help">Caricamento messaggi…</div>
    </section>
  `;
}

async function staffLoadAnnouncements() {
  const host = $('#staffAnnouncementList');
  if (!host) return;
  const {data,error} = await db.from('staff_announcements')
    .select('id,title,message,starts_at,ends_at,is_active')
    .order('starts_at',{ascending:false}).limit(50);
  if (error) {
    host.textContent = error.message;
    return;
  }
  host.innerHTML = (data || []).length ? (data || []).map(row => `
    <article class="section-card">
      <b>${esc(row.title)}</b>
      <p>${esc(row.message)}</p>
      <p class="help">${row.is_active ? 'Attivo' : 'Disattivato'} · Inizio: ${esc(row.starts_at ? new Date(row.starts_at).toLocaleString('it-IT') : 'Subito')} · Fine: ${esc(row.ends_at ? new Date(row.ends_at).toLocaleString('it-IT') : 'Nessuna')}</p>
      ${row.is_active ? `<button type="button" class="outline-btn" data-disable-staff-announcement="${esc(row.id)}">Disattiva</button>` : ''}
    </article>
  `).join('') : '<p class="empty-state">Nessun messaggio Staff pubblicato.</p>';
  host.querySelectorAll('[data-disable-staff-announcement]').forEach(button => {
    button.onclick = async () => {
      if (!confirm('Disattivare questo messaggio?')) return;
      const {error} = await db.from('staff_announcements')
        .update({is_active:false}).eq('id',button.dataset.disableStaffAnnouncement);
      if (error) {
        $('#staffAnnouncementStatus').textContent = error.message;
        return;
      }
      await staffLoadAnnouncements();
    };
  });
}

async function publishStaffAnnouncement(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const title = String(fd.get('title') || '').trim();
  const message = String(fd.get('message') || '').trim();
  if (!title || !message) return;
  const {error} = await db.from('staff_announcements').insert({
    title, message,
    starts_at: fd.get('starts_at') ? new Date(fd.get('starts_at')).toISOString() : new Date().toISOString(),
    ends_at: fd.get('ends_at') ? new Date(fd.get('ends_at')).toISOString() : null,
    is_active: true
  });
  $('#staffAnnouncementStatus').textContent = error ? error.message : 'Messaggio Staff pubblicato.';
  if (!error) {
    form.reset();
    await staffLoadAnnouncements();
  }
}

async function staffLoad() {
  const host = $('#staffList');
  if (!host) return;

  try {
    const {data,error} = await db
      .from('staff')
      .select(
        'id,full_name,photo_url,email,phone,role,auth_user_id,permissions,is_active'
      )
      .order('full_name');

    if (error) throw error;

    host.innerHTML = data?.length
      ? data.map(x => {
          const permissions = permissionObject(x.permissions);

          const checks = MODULES.map(([id,,label]) => `
            <label class="field"
              style="display:flex;gap:8px;align-items:center">
              <input type="checkbox"
                data-edit-perm="${esc(id)}"
                data-staff-id="${esc(x.id)}"
                ${permissions[id] ? 'checked' : ''}
                style="width:auto">
              ${esc(label)}
            </label>
          `).join('');

          return `<article class="section-card">
            <div style="display:flex;gap:14px;align-items:center">
              ${
                x.photo_url
                  ? `<img src="${esc(x.photo_url)}"
                      alt="${esc(x.full_name)}"
                      style="width:76px;height:76px;
                      object-fit:cover;border-radius:50%">`
                  : ''
              }

              <div>
                <b>${esc(x.full_name || 'Staff')}</b>
                <p class="help">${esc(x.email || 'No email')}</p>
                <p class="help">${esc(x.phone || 'No phone')}</p>
                <p class="help">
                  ${x.auth_user_id
                    ? 'Full Staff Account — Email Login'
                    : 'Attendance-only Account — PIN'}
                </p>
              </div>
            </div>

            <p>
              <b>Status:</b>
              ${x.is_active === true ? 'Active' : 'Disabled'}
            </p>

            ${
              x.auth_user_id ? `
                <details>
                  <summary>Manage module permissions</summary>
                  <div class="form-grid">${checks}</div>
                  <button class="gold-btn"
                    data-save-perms="${esc(x.id)}">
                    Save Permissions
                  </button>
                </details>

                <details>
                  <summary>Reset Staff Password</summary>
                  <label class="field">
                    New Password (minimum 10 characters)
                    <input type="password" minlength="10"
                      autocomplete="new-password"
                      data-reset-password="${esc(x.id)}">
                  </label>
                  <button class="gold-btn"
                    data-reset-staff="${esc(x.id)}">
                    Update Password
                  </button>
                </details>
              ` : `
                <p class="help">
                  Attendance is managed with the personal PIN.
                </p>
              `
            }

            <button class="outline-btn"
              data-toggle-staff="${esc(x.id)}"
              data-active="${x.is_active === true ? 'true' : 'false'}">
              ${x.is_active === true ? 'Disable' : 'Enable'}
            </button>

            <button class="outline-btn"
              data-remove-staff="${esc(x.id)}">
              Remove Staff Profile
            </button>
          </article>`;
        }).join('')
      : '<p class="empty-state">No staff accounts found.</p>';

  } catch (e) {
    host.innerHTML =
      `<span class="error-text">${esc(e.message)}</span>`;
  }
}

/* CREATE FULL STAFF ACCOUNT */

async function createFullStaff(e) {
  e.preventDefault();

  if (userRole !== 'admin') {
    throw new Error('Only Super Admin can create Staff accounts.');
  }

  const form = e.target;
  const btn = $('#createFullStaffBtn');
  const status = $('#fullStaffStatus');
  const fd = new FormData(form);

  const full_name = String(fd.get('full_name') || '').trim();
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const phone = String(fd.get('phone') || '').trim();
  const password = String(fd.get('password') || '');

  if (full_name.length < 2) {
    status.textContent = 'Enter a valid Staff name.';
    return;
  }

  if (!email) {
    status.textContent = 'Enter a valid email address.';
    return;
  }

  if (password.length < 10) {
    status.textContent = 'Password must be at least 10 characters.';
    return;
  }

  const permissions = {};

  MODULES.forEach(([id]) => {
    permissions[id] = false;
  });

  form.querySelectorAll('input[name="perm"]:checked').forEach(box => {
    if (Object.prototype.hasOwnProperty.call(permissions,box.value)) {
      permissions[box.value] = true;
    }
  });

  btn.disabled = true;
  btn.textContent = 'Creating account…';
  status.textContent = 'Creating Full Staff Account…';

  try {
    const {data,error} = await db.functions.invoke(
      'create-staff-account',
      {
        body: {
          full_name,
          email,
          phone,
          password,
          permissions
        }
      }
    );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    if (!data?.success) {
      throw new Error('Staff account creation was not confirmed.');
    }

    status.textContent =
      data.message || 'Full Staff Account created successfully.';

    form.reset();
    await staffLoad();

  } catch (err) {
    status.textContent = err.message || 'Account creation failed.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Full Staff Account';
  }
}

/* CREATE ATTENDANCE PIN ACCOUNT */

async function createStaff(e) {
  e.preventDefault();

  if (userRole !== 'admin') {
    throw new Error('Only Super Admin can create Staff accounts.');
  }

  const form = e.target;
  const btn = $('#createStaffBtn');
  const status = $('#staffStatus');

  const fd = new FormData(form);
  const full_name = String(fd.get('full_name') || '').trim();
  const pin = String(fd.get('pin') || '').trim();
  const file = fd.get('photo');

  if (full_name.length < 2) {
    status.textContent = 'Enter a valid Staff name.';
    return;
  }

  if (!/^[0-9]{4}$/.test(pin)) {
    status.textContent = 'PIN must contain exactly 4 digits.';
    return;
  }

  if (!(file instanceof File) || !file.size) {
    status.textContent = 'Please select a Staff photo.';
    return;
  }

  if (!['image/jpeg','image/png','image/webp'].includes(file.type) ||
      file.size > 8 * 1024 * 1024) {
    status.textContent =
      'Use JPG, PNG or WebP. Maximum size: 8 MB.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating account…';
  status.textContent = 'Uploading Staff photo…';

  let uploadedPath = null;
  const bucket = cfg.STORAGE_BUCKET || 'nababi-media';

  try {
    const ext = file.type === 'image/png' ? 'png'
      : file.type === 'image/webp' ? 'webp' : 'jpg';

    const uniqueId = crypto.randomUUID();
    const path = `staff/${uniqueId}.${ext}`;

    const {data:uploadData,error:uploadError} = await db.storage
      .from(bucket)
      .upload(path,file,{
        cacheControl:'3600',
        upsert:false,
        contentType:file.type
      });

    if (uploadError) throw uploadError;

    uploadedPath = uploadData.path;

    const {data:publicData} = db.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    const photo_url = publicData?.publicUrl;

    if (!photo_url) {
      throw new Error('Could not create Staff photo URL.');
    }

    status.textContent = 'Creating PIN account…';

    const {data,error} = await db.rpc(
      'admin_create_staff_pin_account',
      {
        p_full_name: full_name,
        p_photo_url: photo_url,
        p_pin: pin
      }
    );

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(
        data?.message || 'Staff account creation failed.'
      );
    }

    status.textContent =
      data.message || 'Staff account created successfully.';

    form.reset();
    await staffLoad();

  } catch (err) {
    if (uploadedPath) {
      try {
        await db.storage.from(bucket).remove([uploadedPath]);
      } catch (_) {}
    }

    status.textContent = err.message || 'Creation failed.';

  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Attendance Account';
  }
}

/* RESET STAFF PASSWORD */

async function resetStaffPassword(id) {
  if (userRole !== 'admin') {
    throw new Error('Only Super Admin can reset passwords.');
  }

  const input = [...document.querySelectorAll('[data-reset-password]')]
    .find(el => el.dataset.resetPassword === String(id));

  const password = input?.value || '';

  if (password.length < 10) {
    alert('Password must be at least 10 characters.');
    return;
  }

  if (!confirm('Change this Staff account password?')) return;

  const {data,error} = await db.functions.invoke(
    'reset-staff-password',
    {
      body:{staff_id:id,password}
    }
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  input.value = '';
  alert(data?.message || 'Password updated successfully.');
}

/* SAVE STAFF PERMISSIONS */

async function savePermissions(staffId) {
  if (userRole !== 'admin') {
    throw new Error('Only Super Admin can change permissions.');
  }

  const boxes = [...document.querySelectorAll('[data-edit-perm]')]
    .filter(b => b.dataset.staffId === String(staffId));

  const permissions = {};

  MODULES.forEach(([id]) => {
    permissions[id] = boxes.some(b =>
      b.dataset.editPerm === id && b.checked
    );
  });

  const {error} = await db
    .from('staff')
    .update({permissions})
    .eq('id',staffId);

  if (error) throw error;

  await staffLoad();
  alert('Staff permissions updated.');
}

/* ENABLE / DISABLE STAFF */

async function toggleStaff(id,currentlyActive) {
  if (userRole !== 'admin') {
    throw new Error('Only Super Admin can change Staff status.');
  }

  const {error} = await db
    .from('staff')
    .update({is_active:currentlyActive !== true})
    .eq('id',id);

  if (error) throw error;

  await staffLoad();
}

/* REMOVE STAFF */

async function removeStaffLink(id) {
  if (userRole !== 'admin') {
    throw new Error('Only Super Admin can remove Staff accounts.');
  }

  const confirmed = confirm(
    'Remove this Staff profile permanently? ' +
    'The Staff member will no longer appear in the active Staff list. ' +
    'Attendance Records will be retained. Continue?'
  );

  if (!confirmed) return;

  const {data,error} = await db.functions.invoke(
    'delete-staff-account',
    {
      body:{staff_id:id}
    }
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  alert(
    data?.message ||
    'Staff profile removed. Attendance records retained.'
  );

  await staffLoad();
}

/* STAFF ATTENDANCE + SHARED QR */

async function attendancePage() {
  const {data,error} = await db
    .from('staff_attendance')
    .select('staff_name,attendance_date,check_in,check_out,status')
    .order('attendance_date',{ascending:false})
    .limit(100);

  if (error) throw error;

  const rows = data || [];

  return `
    <section class="section-card">
      <div class="section-title">
        <h2>Shared Staff QR Code</h2>
      </div>

      <p class="help">
        Tutto il personale può utilizzare questo unico QR Code.
        Ogni persona deve selezionare il proprio nome e inserire
        il proprio PIN personale.
      </p>

      <div style="text-align:center;padding:20px">
        <img src="${STAFF_QR_IMAGE}"
          alt="Nababi Staff Attendance QR Code"
          style="width:280px;max-width:100%;height:auto;
          background:white;padding:10px;border-radius:12px">

        <p><b>NABABI RISTORANTE</b></p>
        <p class="help">Staff Check In / Check Out</p>

        <p>
          <a href="${STAFF_QR_URL}" target="_blank" rel="noopener">
            Open Staff QR Page
          </a>
        </p>

        <button class="gold-btn" data-print-attendance-qr>
          Print QR Code
        </button>
      </div>
    </section>

    <section class="section-card">
      <div class="section-title">
        <h2>Attendance Records</h2>
        <span class="help">${rows.length} records</span>
      </div>

      ${
        rows.length
          ? `<div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map(row => `
                    <tr>
                      <td>${esc(row.staff_name || '—')}</td>
                      <td>${esc(row.attendance_date || '—')}</td>
                      <td>${esc(row.check_in || '—')}</td>
                      <td>${esc(row.check_out || '—')}</td>
                      <td>${esc(row.status || '—')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
          : '<div class="empty-state">Nessun record trovato.</div>'
      }
    </section>
  `;
}

/* SECRET COUPON BOX */

function secretPage() {
  return `
    <section class="coupon-redeem-card">
      <div class="coupon-brand">♛ NABABI RISTORANTE</div>
      <p class="coupon-eyebrow">EXCLUSIVE CUSTOMER REWARD</p>
      <div class="coupon-gift">🎁</div>
      <h2>Secret Coupon Box</h2>
      <p class="coupon-instruction">
        Enter the secret number given by the customer.
      </p>

      <form id="redeemSecretForm" class="coupon-redeem-form">
        <label for="secretCouponCode">CUSTOMER COUPON NUMBER</label>
        <input id="secretCouponCode" name="code" type="text"
          inputmode="numeric" pattern="[0-9]{5,9}"
          minlength="5" maxlength="9" autocomplete="off"
          placeholder="Enter coupon number" required>
        <button type="submit" id="redeemSecretBtn"
          class="coupon-collect-btn">
          COLLECT COUPON
        </button>
      </form>

      <p id="redeemSecretStatus" class="coupon-status"
        aria-live="polite"></p>
      <p class="coupon-footnote">
        Each coupon can be used only once.
      </p>
    </section>

    ${
      userRole === 'admin' ? `
        <section class="section-card">
          <h3>Generate New Coupon</h3>
          <p class="help">
            Admin only. Create a new customer coupon code.
          </p>
          <button type="button" id="generateSecretCoupon"
            class="gold-btn">
            Generate Coupon
          </button>
          <div id="generatedCoupon" class="help"
            aria-live="polite"></div>
        </section>
      ` : ''
    }

    <section class="section-card">
      <div class="section-title">
        <h2>Redemption History</h2>
        <button type="button" id="refreshSecretHistory"
          class="outline-btn">
          Refresh
        </button>
      </div>
      <div id="secretHistory">Loading…</div>
    </section>
  `;
}

async function loadSecretHistory() {
  const host = $('#secretHistory');
  if (!host) return;

  try {
    const {data,error} = await db
      .from('coupon_redemptions')
      .select(
        'coupon_code,discount_percent,redeemed_by_name,redeemed_at'
      )
      .order('redeemed_at',{ascending:false})
      .limit(100);

    if (error) throw error;

    host.innerHTML = data?.length
      ? `<div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Coupon</th>
                <th>Discount</th>
                <th>Collected By</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  <td>${esc(row.coupon_code)}</td>
                  <td>${esc(row.discount_percent)}%</td>
                  <td>${esc(row.redeemed_by_name || 'Staff')}</td>
                  <td>${esc(
                    row.redeemed_at
                      ? new Date(row.redeemed_at).toLocaleString('it-IT')
                      : '—'
                  )}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`
      : '<div class="empty-state">No redeemed coupons yet.</div>';

  } catch (err) {
    host.innerHTML =
      `<p class="error-text">${esc(err.message)}</p>`;
  }
}

async function generateSecretCoupon() {
  if (userRole !== 'admin') {
    throw new Error('Only Admin can generate coupons.');
  }

  const btn = $('#generateSecretCoupon');
  const output = $('#generatedCoupon');

  btn.disabled = true;
  btn.textContent = 'Generating…';
  output.textContent = 'Please wait…';

  try {
    const {data,error} = await db.rpc(
      'generate_nababi_coupon'
    );

    if (error) throw error;

    if (!data?.success) {
      throw new Error(data?.message || 'Coupon generation failed.');
    }

    output.innerHTML = `
      <div class="section-card">
        <p class="success-text">Coupon generated successfully!</p>
        <h2 style="letter-spacing:4px">
          ${esc(data.code)}
        </h2>
        <p><b>${esc(data.discount_percent)}% OFF</b></p>
        <button type="button" class="gold-btn"
          id="copySecretCoupon">
          Copy Coupon Code
        </button>
        <p class="help">
          Expires: ${esc(data.expires_at || 'Offer end date')}
        </p>
      </div>
    `;

    $('#copySecretCoupon').onclick = async () => {
      try {
        await navigator.clipboard.writeText(String(data.code));
        $('#copySecretCoupon').textContent = 'Copied!';
      } catch (_) {
        alert('Coupon code: ' + data.code);
      }
    };

  } catch (err) {
    output.innerHTML =
      `<p class="error-text">${esc(err.message)}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Coupon';
  }
}

function playCouponCelebration() {
  // Sound starts only after the Staff member taps Collect Coupon.
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (AudioContextClass) {
      const audio = new AudioContextClass();

      [523,659,784,1046].forEach((frequency,index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gain.gain.setValueAtTime(0.0001,audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.12,audio.currentTime + 0.03 + index * 0.18
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,audio.currentTime + 0.25 + index * 0.18
        );

        oscillator.connect(gain);
        gain.connect(audio.destination);

        oscillator.start(audio.currentTime + index * 0.18);
        oscillator.stop(audio.currentTime + 0.3 + index * 0.18);
      });

      setTimeout(() => audio.close().catch(() => {}),1800);
    }
  } catch (_) {}

  // Browser voice announcement, where supported.
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const announcement = new SpeechSynthesisUtterance(
        'Congratulations! Coupon successfully collected!'
      );

      announcement.lang = 'en-GB';
      window.speechSynthesis.speak(announcement);
    }
  } catch (_) {}
}

function showCouponFireworks(discount,code) {
  document.querySelector('#couponCelebration')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'couponCelebration';

  overlay.innerHTML = `
    <style>
      #couponCelebration {
        position:fixed;
        inset:0;
        z-index:99999;
        background:rgba(5,20,15,.96);
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
        color:#f7f1e5;
        text-align:center;
        font-family:Arial,sans-serif;
      }
      #couponCelebration .celebrate-content {
        position:relative;
        z-index:2;
        padding:28px;
        border:1px solid #d8b76a;
        border-radius:18px;
        background:rgba(16,45,36,.92);
        max-width:90%;
      }
      #couponCelebration h1 {
        color:#d8b76a;
        font-size:clamp(30px,8vw,54px);
        margin:12px 0;
      }
      #couponCelebration .firework {
        position:absolute;
        left:var(--left);
        top:var(--top);
        width:7px;
        height:7px;
        border-radius:50%;
        background:var(--color);
        box-shadow:0 0 12px 3px var(--color);
        animation:couponBurst 1.8s ease-out forwards;
        animation-delay:var(--delay);
        opacity:0;
      }
      @keyframes couponBurst {
        0% {
          opacity:1;
          transform:translate(0,0) scale(.2);
        }
        100% {
          opacity:0;
          transform:translate(var(--x),var(--y)) scale(1.5);
        }
      }
    </style>

    <div class="celebrate-content">
      <div style="font-size:48px">🎉 ✨ 🎉</div>
      <h1>Congratulations!</h1>
      <h2>${esc(discount)}% DISCOUNT</h2>
      <p>Coupon successfully collected.</p>
      <p>Code: <b>${esc(code)}</b></p>
      <button type="button" id="closeCouponCelebration"
        class="gold-btn">
        Continue
      </button>
    </div>
  `;

  for (let i=0;i<65;i++) {
    const particle = document.createElement('span');
    particle.className = 'firework';

    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 190;

    particle.style.setProperty('--left',`${10+Math.random()*80}%`);
    particle.style.setProperty('--top',`${10+Math.random()*75}%`);
    particle.style.setProperty(
      '--x',`${Math.cos(angle)*distance}px`
    );
    particle.style.setProperty(
      '--y',`${Math.sin(angle)*distance}px`
    );
    particle.style.setProperty(
      '--color',`hsl(${Math.floor(Math.random()*360)},100%,65%)`
    );
    particle.style.setProperty(
      '--delay',`${Math.random()*1.2}s`
    );

    overlay.appendChild(particle);
  }

  document.body.appendChild(overlay);

  $('#closeCouponCelebration').onclick = () => overlay.remove();

  playCouponCelebration();
}

function showCouponErrorScreen(message) {
  const existing = document.getElementById('couponErrorScreen');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'couponErrorScreen';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:999999',
    'background:#b5121b',
    'color:#fff',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'text-align:center',
    'padding:24px',
    'box-sizing:border-box'
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = 'width:min(100%,620px);font-family:Arial,sans-serif';

  const heading = document.createElement('div');
  heading.textContent = message;
  heading.style.cssText = 'font-size:clamp(34px,8vw,64px);font-weight:900;letter-spacing:2px;margin-bottom:18px';

  const detail = document.createElement('p');
  detail.textContent = 'This coupon has already been used. It cannot be used again.';
  detail.style.cssText = 'font-size:clamp(18px,4vw,25px);line-height:1.5;margin:0 0 30px';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'CLOSE';
  close.style.cssText = 'background:#fff;color:#9d1018;border:0;border-radius:8px;padding:14px 30px;font-size:16px;font-weight:800;cursor:pointer';
  close.addEventListener('click', () => overlay.remove());

  panel.append(heading, detail, close);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  close.focus();
}

async function redeemSecretCoupon(e) {
  e.preventDefault();

  const form = e.target;
  const btn = $('#redeemSecretBtn');
  const status = $('#redeemSecretStatus');
  const code = String(new FormData(form).get('code') || '').trim();

  if (!/^[0-9]{5,9}$/.test(code)) {
    status.className = 'help error-text';
    status.textContent = 'Enter a valid 5–9 digit coupon code.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Checking coupon…';
  status.className = 'help';
  status.textContent = 'Verifying coupon…';

  try {
    const {data,error} = await db.rpc(
      'redeem_nababi_coupon',
      {p_code:code}
    );

    if (error) throw error;

    if (!data?.success) {
      throw new Error(data?.message || 'Coupon could not be redeemed.');
    }

    status.className = 'help success-text';
    status.textContent = 'Coupon collected successfully.';

    form.reset();

    showCouponFireworks(
      data.discount_percent,
      data.code || code
    );

    await loadSecretHistory();

  } catch (err) {
    const message = String(err.message || 'Redemption failed.');
    status.className = 'help error-text';
    status.textContent = [
      'ALREADY USED',
      'EXPIRED',
      'NOT ACTIVE'
    ].includes(message.toUpperCase())
      ? message.toUpperCase()
      : message;

    if (message.toUpperCase() === 'ALREADY USED') {
      showCouponErrorScreen('ALREADY USED');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Collect Coupon';
  }
}


/* CUSTOMER DISCOUNT OFFER MANAGEMENT — ADMIN ONLY */

function discountPage() {
  return `
    <section class="section-card">
      <div class="section-title">
        <h2>Offerta Coupon per i Clienti</h2>
      </div>
      <p class="help">
        Imposta la percentuale e il periodo. Quando l'offerta è attiva,
        il sito mostrerà automaticamente il pulsante per ottenere un coupon.
        Non vengono richiesti nome, telefono o email.
      </p>
      <form id="discountOfferForm" class="form-grid">
        <label class="field">Percentuale di sconto
          <select name="discount_percent" id="discountPercent" required>
            <option value="10">10%</option>
            <option value="15">15%</option>
            <option value="20">20%</option>
            <option value="25">25%</option>
            <option value="30">30%</option>
          </select>
        </label>
        <label class="field">Massimo coupon (facoltativo)
          <input id="discountMaxCoupons" name="max_coupons"
            type="number" min="1" step="1"
            placeholder="Vuoto = senza limite">
        </label>
        <label class="field">Inizio offerta
          <input id="discountStartsAt" name="starts_at"
            type="datetime-local" required>
        </label>
        <label class="field">Fine offerta
          <input id="discountEndsAt" name="ends_at"
            type="datetime-local" required>
        </label>
        <label class="field" style="display:flex;gap:10px;align-items:center">
          <input id="discountEnabled" name="is_enabled"
            type="checkbox" style="width:auto">
          Attiva l'offerta sul sito
        </label>
        <div>
          <button id="saveDiscountOffer" class="gold-btn" type="submit">
            Salva offerta
          </button>
        </div>
      </form>
      <p id="discountOfferStatus" class="help" aria-live="polite">
        Caricamento impostazioni…
      </p>
    </section>
    <section class="section-card">
      <h2>Stato coupon</h2>
      <div id="discountOfferSummary" class="help">
        Caricamento…
      </div>
      <p class="help">
        I coupon già emessi mantengono la propria data di scadenza.
        Disattivare l'offerta impedisce soltanto nuove richieste.
      </p>
    </section>
  `;
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0,16);
}

async function loadDiscountSettings() {
  const status = $('#discountOfferStatus');
  const summary = $('#discountOfferSummary');

  try {
    const {data,error} = await db.rpc('get_nababi_coupon_offer');
    if (error) throw error;

    if (!data?.success) {
      if (status) status.textContent = 'Nessuna offerta configurata.';
      if (summary) summary.textContent = 'Nessuna offerta disponibile.';
      return;
    }

    $('#discountPercent').value = String(data.discount_percent || 10);
    $('#discountStartsAt').value = toDateTimeLocal(data.starts_at);
    $('#discountEndsAt').value = toDateTimeLocal(data.ends_at);
    $('#discountEnabled').checked = data.is_enabled === true;
    $('#discountMaxCoupons').value =
      data.max_coupons == null ? '' : String(data.max_coupons);

    const active = data.is_active === true;
    const limitText = data.max_coupons == null
      ? 'Senza limite'
      : `${data.issued_count || 0} / ${data.max_coupons}`;

    summary.textContent =
      `${active ? 'ATTIVA' : 'NON ATTIVA'} · ${data.discount_percent}% · Coupon emessi: ${limitText}`;

    if (status) status.textContent = 'Impostazioni caricate.';
  } catch (err) {
    if (status) status.textContent =
      'Errore caricamento: ' + (err.message || 'richiesta non riuscita');
    if (summary) summary.textContent = 'Impossibile leggere lo stato dell’offerta.';
  }
}

async function saveDiscountOffer(e) {
  e.preventDefault();

  if (userRole !== 'admin') {
    throw new Error('Solo il Super Admin può modificare le offerte.');
  }

  const form = e.currentTarget;
  const btn = $('#saveDiscountOffer');
  const status = $('#discountOfferStatus');

  const discount = Number($('#discountPercent').value);
  const starts = $('#discountStartsAt').value;
  const ends = $('#discountEndsAt').value;
  const maxRaw = $('#discountMaxCoupons').value.trim();
  const maxCoupons = maxRaw === '' ? null : Number(maxRaw);
  const enabled = $('#discountEnabled').checked;

  if (!starts || !ends || new Date(ends) <= new Date(starts)) {
    status.textContent = 'Controlla la data e l’ora di inizio e fine.';
    return;
  }

  if (maxCoupons !== null &&
      (!Number.isInteger(maxCoupons) || maxCoupons < 1)) {
    status.textContent = 'Il limite deve essere un numero intero maggiore di zero.';
    return;
  }

  btn.disabled = true;
  status.textContent = 'Salvataggio…';

  try {
    const {data,error} = await db.rpc('save_nababi_coupon_offer', {
      p_discount_percent: discount,
      p_starts_at: new Date(starts).toISOString(),
      p_ends_at: new Date(ends).toISOString(),
      p_is_enabled: enabled,
      p_max_coupons: maxCoupons
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.message || 'Salvataggio non riuscito.');
    }

    status.textContent = 'Offerta salvata. Il sito mostrerà l’offerta quando il periodo sarà attivo.';
    await loadDiscountSettings();
  } catch (err) {
    status.textContent = err.message || 'Salvataggio non riuscito.';
  } finally {
    btn.disabled = false;
  }
}


/* BREAKING NEWS MANAGER — SCHEDULED IMAGE / VIDEO */

let editingNewsId = null;
let newsExistingMedia = {image_url:null,youtube_url:null};

function localDateTimeValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0,16);
}

function newsPage() {
  return `
    <section class="section-card news-manager-card">
      <div class="section-title">
        <h2 id="newsFormTitle">Nuova Breaking News</h2>
      </div>
      <form id="breakingNewsForm" class="form-grid">
        <label class="field">Titolo
          <input name="title" required maxlength="180"
            placeholder="Es. Serata speciale da Nababi">
        </label>
        <label class="field">Descrizione
          <textarea name="body" rows="3" maxlength="2000"
            placeholder="Scrivi il messaggio da mostrare sul sito"></textarea>
        </label>
        <label class="field">Foto o video dal telefono
          <input id="newsMediaFile" name="media" type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm">
          <span class="help">Foto JPG/PNG/WebP max 8 MB. Video MP4/MOV/WebM max 50 MB.</span>
        </label>
        <div class="news-media-preview-wrap">
          <img id="newsImagePreview" alt="Anteprima foto" hidden>
          <video id="newsVideoPreview" controls playsinline hidden></video>
          <p id="newsExistingMediaLabel" class="help"></p>
        </div>
        <label class="field">Mostra dal giorno e ora
          <input name="starts_at" type="datetime-local" required>
        </label>
        <label class="field">Nascondi dal giorno e ora
          <input name="ends_at" type="datetime-local" required>
        </label>
        <label class="field">Pubblicazione
          <select name="is_active">
            <option value="true">Attiva</option>
            <option value="false">Disattivata</option>
          </select>
        </label>
        <div class="news-form-actions">
          <button id="newsSaveBtn" class="gold-btn" type="submit">Salva Breaking News</button>
          <button id="newsCancelEdit" class="outline-btn" type="button" hidden>Annulla modifica</button>
        </div>
      </form>
      <p id="newsStatus" class="help" aria-live="polite"></p>
      <p class="help">La notizia apparirà automaticamente all’ora iniziale e scomparirà dal sito all’ora finale. Il contenuto resterà nell’Admin Panel.</p>
    </section>

    <section class="section-card">
      <div class="section-title"><h2>Notizie salvate</h2></div>
      <div id="breakingNewsList" class="help">Caricamento…</div>
    </section>
  `;
}

async function loadBreakingNews() {
  const host = $('#breakingNewsList');
  if (!host) return;
  try {
    const {data,error} = await db
      .from('breaking_news')
      .select('id,title,body,image_url,youtube_url,starts_at,ends_at,is_active,created_at')
      .order('created_at',{ascending:false})
      .limit(100);
    if (error) throw error;

    const rows = data || [];
    host.innerHTML = rows.length
      ? `<div class="breaking-news-admin-list">${rows.map(item => {
          const now = Date.now();
          const start = item.starts_at ? new Date(item.starts_at).getTime() : 0;
          const end = item.ends_at ? new Date(item.ends_at).getTime() : Infinity;
          const state = item.is_active === false ? 'Disattivata'
            : now < start ? 'Programmata'
            : now > end ? 'Terminata' : 'Online';
          const stateClass = state === 'Online' ? 'live'
            : state === 'Terminata' || state === 'Disattivata' ? 'ended' : 'scheduled';
          const media = item.image_url
            ? `<img src="${esc(item.image_url)}" alt="" loading="lazy">`
            : item.youtube_url
              ? `<video src="${esc(item.youtube_url)}" muted playsinline preload="metadata"></video>`
              : '';
          return `
            <article class="breaking-news-admin-row">
              ${media ? `<div class="breaking-news-admin-media">${media}</div>` : ''}
              <div class="breaking-news-admin-info">
                <div class="breaking-news-admin-heading">
                  <strong>${esc(item.title)}</strong>
                  <span class="breaking-news-state ${stateClass}">${state}</span>
                </div>
                <p>${esc(item.body || '')}</p>
                <small>Dal: ${esc(item.starts_at ? new Date(item.starts_at).toLocaleString('it-IT') : '—')}</small>
                <small>Al: ${esc(item.ends_at ? new Date(item.ends_at).toLocaleString('it-IT') : '—')}</small>
                <div class="breaking-news-admin-actions">
                  <button type="button" class="outline-btn" data-edit-news="${esc(item.id)}">Modifica</button>
                  <button type="button" class="news-delete-btn" data-delete-news="${esc(item.id)}">Elimina</button>
                </div>
              </div>
            </article>`;
        }).join('')}</div>`
      : '<div class="empty-state">Nessuna Breaking News salvata.</div>';
  } catch (e) {
    host.innerHTML = `<p class="error-text">${esc(e.message || 'Impossibile caricare le notizie.')}</p>`;
  }
}

function resetNewsForm() {
  const form = $('#breakingNewsForm');
  if (!form) return;
  form.reset();
  editingNewsId = null;
  newsExistingMedia = {image_url:null,youtube_url:null};
  $('#newsFormTitle').textContent = 'Nuova Breaking News';
  $('#newsSaveBtn').textContent = 'Salva Breaking News';
  $('#newsCancelEdit').hidden = true;
  $('#newsImagePreview').hidden = true;
  $('#newsVideoPreview').pause();
  $('#newsVideoPreview').hidden = true;
  $('#newsExistingMediaLabel').textContent = '';
  $('#newsStatus').textContent = '';
}

async function editBreakingNews(id) {
  const status = $('#newsStatus');
  try {
    const {data,error} = await db
      .from('breaking_news')
      .select('id,title,body,image_url,youtube_url,starts_at,ends_at,is_active')
      .eq('id',id)
      .single();
    if (error) throw error;

    const form = $('#breakingNewsForm');
    form.elements.title.value = data.title || '';
    form.elements.body.value = data.body || '';
    form.elements.starts_at.value = localDateTimeValue(data.starts_at);
    form.elements.ends_at.value = localDateTimeValue(data.ends_at);
    form.elements.is_active.value = data.is_active === false ? 'false' : 'true';
    newsExistingMedia = {
      image_url:data.image_url || null,
      youtube_url:data.youtube_url || null
    };
    $('#newsImagePreview').hidden = true;
    $('#newsVideoPreview').hidden = true;
    $('#newsExistingMediaLabel').textContent =
      data.image_url ? 'Foto già salvata: sarà mantenuta se non scegli un nuovo file.'
      : data.youtube_url ? 'Video/link già salvato: sarà mantenuto se non scegli un nuovo file.'
      : 'Nessun file già salvato.';
    editingNewsId = id;
    $('#newsFormTitle').textContent = 'Modifica Breaking News';
    $('#newsSaveBtn').textContent = 'Salva modifiche';
    $('#newsCancelEdit').hidden = false;
    status.textContent = 'Modifica il contenuto e gli orari, poi salva.';
    form.scrollIntoView({behavior:'smooth',block:'start'});
  } catch (e) {
    status.textContent = e.message || 'Impossibile aprire la notizia.';
  }
}

async function uploadBreakingNewsMedia(file) {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const allowed = ['image/jpeg','image/png','image/webp',
    'video/mp4','video/quicktime','video/webm'];
  if (!allowed.includes(file.type) || (!isImage && !isVideo)) {
    throw new Error('Formato non supportato. Usa JPG, PNG, WebP, MP4, MOV o WebM.');
  }
  const maxBytes = isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(isVideo ? 'Il video deve essere massimo 50 MB.' : 'La foto deve essere massimo 8 MB.');
  }
  const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase()
    : (file.type === 'video/quicktime' ? 'mov' : 'bin');
  const unique = globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `breaking-news/${Date.now()}-${unique}.${ext}`;
  const bucket = cfg.STORAGE_BUCKET || 'nababi-media';
  const {data,error} = await db.storage.from(bucket).upload(path,file,{
    cacheControl:'3600',upsert:false,contentType:file.type
  });
  if (error) throw error;
  const {data:pub} = db.storage.from(bucket).getPublicUrl(data.path);
  return isImage
    ? {image_url:pub.publicUrl,youtube_url:null}
    : {image_url:null,youtube_url:pub.publicUrl};
}

async function saveBreakingNews(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const status = $('#newsStatus');
  const btn = $('#newsSaveBtn');
  const title = String(fd.get('title') || '').trim();
  const body = String(fd.get('body') || '').trim();
  const startsRaw = String(fd.get('starts_at') || '');
  const endsRaw = String(fd.get('ends_at') || '');
  const starts = new Date(startsRaw);
  const ends = new Date(endsRaw);
  const is_active = fd.get('is_active') === 'true';
  const file = $('#newsMediaFile').files?.[0];

  if (!title || !startsRaw || !endsRaw ||
      Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    status.textContent = 'Inserisci titolo, data iniziale e data finale.';
    return;
  }
  if (ends <= starts) {
    status.textContent = 'La data e ora finale deve essere successiva a quella iniziale.';
    return;
  }

  btn.disabled = true;
  status.textContent = 'Salvataggio in corso…';
  try {
    let media = {...newsExistingMedia};
    if (file) media = await uploadBreakingNewsMedia(file);
    const payload = {
      title,body,
      starts_at:starts.toISOString(),
      ends_at:ends.toISOString(),
      is_active,
      image_url:media.image_url,
      youtube_url:media.youtube_url
    };
    const request = editingNewsId
      ? db.from('breaking_news').update(payload).eq('id',editingNewsId)
      : db.from('breaking_news').insert(payload);
    const {error} = await request;
    if (error) throw error;

    status.textContent = editingNewsId
      ? 'Breaking News aggiornata.'
      : 'Breaking News salvata.';
    resetNewsForm();
    await loadBreakingNews();
  } catch (err) {
    status.textContent = err.message || 'Salvataggio non riuscito.';
  } finally {
    btn.disabled = false;
  }
}

async function deleteBreakingNews(id) {
  if (!confirm('Vuoi eliminare definitivamente questa Breaking News?')) return;
  const {error} = await db.from('breaking_news').delete().eq('id',id);
  if (error) throw error;
  if (String(editingNewsId) === String(id)) resetNewsForm();
  await loadBreakingNews();
}


/* FOOD DELIVERY LINK MANAGER */
let editingDeliveryLinkId = null;
let editingSocialLinkId = null;

async function deliveryLinksPage() {
  return `
    <section class="section-card delivery-manager-card">
      <div class="section-title"><h2 id="deliveryLinkFormTitle">Aggiungi piattaforma</h2></div>
      <form id="deliveryLinkForm" class="form-grid">
        <label class="field">Nome piattaforma
          <select name="name" required>
            <option value="Deliveroo">Deliveroo</option>
            <option value="Glovo">Glovo</option>
            <option value="Just Eat">Just Eat</option>
          </select>
        </label>
        <label class="field">Link ordine
          <input name="url" type="url" required maxlength="1000" placeholder="https://...">
        </label>
        <label class="field">Visibilità sul sito
          <select name="is_active">
            <option value="true">Mostra sul sito</option>
            <option value="false">Nascondi dal sito</option>
          </select>
        </label>
        <label class="field">Ordine di visualizzazione
          <input name="sort_order" type="number" min="0" max="999" value="0">
        </label>
        <div class="delivery-form-actions">
          <button id="deliveryLinkSave" class="gold-btn" type="submit">Salva link</button>
          <button id="deliveryLinkCancel" class="outline-btn" type="button" hidden>Annulla</button>
        </div>
      </form>
      <p id="deliveryLinkStatus" class="help" aria-live="polite"></p>
      <p class="help">Sul sito vengono mostrati soltanto i link attivi. Se elimini un link, il relativo pulsante scompare.</p>
    </section>
    <section class="section-card">
      <div class="section-title"><h2>Link salvati</h2></div>
      <div id="deliveryLinksAdminList" class="delivery-links-admin-list">
        <p class="empty-state">Caricamento…</p>
      </div>
    </section>
    <section class="section-card">
      <div class="section-title"><h2>Ordini Food Delivery</h2></div>
      ${await genericTable('delivery')}
    </section>
  `;
}

function resetDeliveryLinkForm() {
  const form = $('#deliveryLinkForm');
  if (!form) return;
  form.reset();
  form.elements.sort_order.value = '0';
  editingDeliveryLinkId = null;
  $('#deliveryLinkFormTitle').textContent = 'Aggiungi piattaforma';
  $('#deliveryLinkSave').textContent = 'Salva link';
  $('#deliveryLinkCancel').hidden = true;
  $('#deliveryLinkStatus').textContent = '';
}

async function loadDeliveryLinksAdmin() {
  const list = $('#deliveryLinksAdminList');
  const {data,error} = await db.from('food_delivery_links')
    .select('*').order('sort_order').order('created_at');
  if (error) throw error;
  if (!data?.length) {
    list.innerHTML = '<p class="empty-state">Nessun link aggiunto. Aggiungi il primo link qui sopra.</p>';
    return;
  }
  list.innerHTML = data.map(item => `
    <article class="delivery-link-admin-row">
      <div class="delivery-link-admin-info">
        <img class="brand-logo" src="${brandLogoUrl(item.name,'delivery')}" alt="" onerror="this.hidden=true">
        <strong>${esc(item.name)}</strong>
        <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.url)}</a>
        <small>${item.is_active ? 'Visibile sul sito' : 'Nascosto sul sito'} · Ordine: ${Number(item.sort_order)||0}</small>
      </div>
      <div class="delivery-link-admin-actions">
        <button class="outline-btn" type="button" data-edit-delivery="${esc(item.id)}">Modifica</button>
        <button class="news-delete-btn" type="button" data-delete-delivery="${esc(item.id)}">Elimina</button>
      </div>
    </article>
  `).join('');
  list.querySelectorAll('[data-edit-delivery]').forEach(button => {
    button.onclick = () => {
      const item = data.find(row => String(row.id) === button.dataset.editDelivery);
      if (!item) return;
      editingDeliveryLinkId = item.id;
      const form = $('#deliveryLinkForm');
      form.elements.name.value = item.name || '';
      form.elements.url.value = item.url || '';
      form.elements.is_active.value = String(item.is_active === true);
      form.elements.sort_order.value = Number(item.sort_order)||0;
      $('#deliveryLinkFormTitle').textContent = 'Modifica piattaforma';
      $('#deliveryLinkSave').textContent = 'Aggiorna link';
      $('#deliveryLinkCancel').hidden = false;
      $('#deliveryLinkStatus').textContent = '';
      form.scrollIntoView({behavior:'smooth',block:'start'});
    };
  });
  list.querySelectorAll('[data-delete-delivery]').forEach(button => {
    button.onclick = async () => {
      if (!confirm('Eliminare questo link Food Delivery?')) return;
      const {error:deleteError} = await db.from('food_delivery_links').delete().eq('id',button.dataset.deleteDelivery);
      if (deleteError) {
        $('#deliveryLinkStatus').textContent = deleteError.message;
        return;
      }
      if (String(editingDeliveryLinkId) === button.dataset.deleteDelivery) resetDeliveryLinkForm();
      await loadDeliveryLinksAdmin();
    };
  });
}

async function saveDeliveryLink(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('#deliveryLinkStatus');
  const button = $('#deliveryLinkSave');
  const values = new FormData(form);
  const url = String(values.get('url')||'').trim();
  if (!/^https?:\/\//i.test(url)) {
    status.textContent = 'Inserisci un link valido che inizi con https://';
    return;
  }
  const payload = {
    name:String(values.get('name')||'').trim(),
    url,
    is_active:values.get('is_active') === 'true',
    sort_order:Math.max(0,Number(values.get('sort_order'))||0)
  };
  if (!payload.name) return;
  button.disabled = true;
  status.textContent = 'Salvataggio…';
  try {
    const request = editingDeliveryLinkId
      ? db.from('food_delivery_links').update(payload).eq('id',editingDeliveryLinkId)
      : db.from('food_delivery_links').insert(payload);
    const {error} = await request;
    if (error) throw error;
    status.textContent = 'Link salvato.';
    resetDeliveryLinkForm();
    status.textContent = 'Link salvato.';
    await loadDeliveryLinksAdmin();
  } catch (error) {
    status.textContent = error.message || 'Salvataggio non riuscito.';
  } finally {
    button.disabled = false;
  }
}


/* SOCIAL LINKS MANAGER */
function socialLinksPage() {
  return `
    <section class="section-card">
      <div class="section-title"><h2 id="socialLinkFormTitle">Aggiungi social</h2></div>
      <form id="socialLinkForm" class="form-grid">
        <label class="field">Piattaforma
          <select name="platform" required>
            <option value="Facebook">Facebook</option>
            <option value="Instagram">Instagram</option>
            <option value="TikTok">TikTok</option>
            <option value="YouTube">YouTube</option>
          </select>
        </label>
        <label class="field">Link del profilo
          <input name="url" type="url" required maxlength="1000" placeholder="https://...">
        </label>
        <label class="field">Visibilità sul sito
          <select name="is_active">
            <option value="true">Mostra sul sito</option>
            <option value="false">Nascondi dal sito</option>
          </select>
        </label>
        <div class="delivery-form-actions">
          <button id="socialLinkSave" class="gold-btn" type="submit">Salva social</button>
          <button id="socialLinkCancel" class="outline-btn" type="button" hidden>Annulla</button>
        </div>
      </form>
      <p id="socialLinkStatus" class="help" aria-live="polite"></p>
      <p class="help">Sul sito appariranno soltanto i social attivi.</p>
    </section>
    <section class="section-card">
      <div class="section-title"><h2>Social salvati</h2></div>
      <div id="socialLinksAdminList" class="delivery-links-admin-list">
        <p class="empty-state">Caricamento…</p>
      </div>
    </section>
  `;
}

function resetSocialLinkForm() {
  const form = $('#socialLinkForm');
  if (!form) return;
  form.reset();
  editingSocialLinkId = null;
  $('#socialLinkFormTitle').textContent = 'Aggiungi social';
  $('#socialLinkSave').textContent = 'Salva social';
  $('#socialLinkCancel').hidden = true;
  $('#socialLinkStatus').textContent = '';
}

async function loadSocialLinksAdmin() {
  const list = $('#socialLinksAdminList');
  const {data,error} = await db.from('social_links').select('*').order('created_at');
  if (error) throw error;
  if (!data?.length) {
    list.innerHTML = '<p class="empty-state">Nessun social aggiunto. Aggiungi il primo link qui sopra.</p>';
    return;
  }
  list.innerHTML = data.map(item => `
    <article class="delivery-link-admin-row">
      <div class="delivery-link-admin-info">
        <img class="brand-logo" src="${brandLogoUrl(item.platform || item.name)}" alt="" onerror="this.hidden=true">
        <strong>${esc(item.platform || item.name || 'Social')}</strong>
        <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.url)}</a>
        <small>${item.is_active ? 'Visibile sul sito' : 'Nascosto sul sito'}</small>
      </div>
      <div class="delivery-link-admin-actions">
        <button class="outline-btn" type="button" data-edit-social="${esc(item.id)}">Modifica</button>
        <button class="news-delete-btn" type="button" data-delete-social="${esc(item.id)}">Elimina</button>
      </div>
    </article>
  `).join('');
  list.querySelectorAll('[data-edit-social]').forEach(button => {
    button.onclick = () => {
      const item = data.find(row => String(row.id) === button.dataset.editSocial);
      if (!item) return;
      editingSocialLinkId = item.id;
      const form = $('#socialLinkForm');
      form.elements.platform.value = item.platform || item.name || 'Facebook';
      form.elements.url.value = item.url || '';
      form.elements.is_active.value = String(item.is_active !== false);
      $('#socialLinkFormTitle').textContent = 'Modifica social';
      $('#socialLinkSave').textContent = 'Aggiorna social';
      $('#socialLinkCancel').hidden = false;
      $('#socialLinkStatus').textContent = '';
      form.scrollIntoView({behavior:'smooth',block:'start'});
    };
  });
  list.querySelectorAll('[data-delete-social]').forEach(button => {
    button.onclick = async () => {
      if (!confirm('Eliminare questo link social?')) return;
      const {error:deleteError} = await db.from('social_links').delete().eq('id',button.dataset.deleteSocial);
      if (deleteError) {
        $('#socialLinkStatus').textContent = deleteError.message;
        return;
      }
      if (String(editingSocialLinkId) === button.dataset.deleteSocial) resetSocialLinkForm();
      await loadSocialLinksAdmin();
      $('#socialLinkStatus').textContent = 'Link social eliminato.';
    };
  });
}

async function saveSocialLink(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('#socialLinkStatus');
  const button = $('#socialLinkSave');
  const values = new FormData(form);
  const url = String(values.get('url') || '').trim();
  let parsed;
  try { parsed = new URL(url); } catch (_) {
    status.textContent = 'Inserisci un indirizzo web valido.';
    return;
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    status.textContent = 'Usa un link che inizi con https://';
    return;
  }
  const payload = {
    platform: String(values.get('platform') || '').trim(),
    url: parsed.href,
    is_active: values.get('is_active') === 'true'
  };
  if (!['Facebook','Instagram','TikTok','YouTube'].includes(payload.platform)) {
    status.textContent = 'Seleziona una piattaforma valida.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Salvataggio…';
  try {
    const request = editingSocialLinkId
      ? db.from('social_links').update(payload).eq('id', editingSocialLinkId)
      : db.from('social_links').insert(payload);
    const {error} = await request;
    if (error) throw error;
    resetSocialLinkForm();
    await loadSocialLinksAdmin();
    $('#socialLinkStatus').textContent = 'Social salvato correttamente.';
  } catch (error) {
    status.textContent = error.message || 'Salvataggio non riuscito.';
  } finally {
    button.disabled = false;
  }
}

async function logoManagementPage() {
  const keys = ['restaurant_logo_url','restaurant_logo_show_site_header','restaurant_logo_show_site_footer','restaurant_logo_show_admin_header','restaurant_logo_show_favicon','restaurant_logo_show_staff_qr'];
  const {data,error} = await db.from('site_settings').select('setting_key,setting_value').in('setting_key',keys);
  if (error) throw error;
  const settings = Object.fromEntries((data || []).map(row => [row.setting_key,row.setting_value]));
  const url = settings.restaurant_logo_url || '';
  const enabled = key => settings[key] !== 'false';
  return `<section class="section-card">
    <div class="section-title"><h2>Logo Nababi attuale</h2><span class="help">Un solo logo per tutte le aree</span></div>
    <div class="upload-box">
      <img id="currentLogoPreview" class="preview-img" alt="Logo attuale" src="${esc(url)}" ${url ? '' : 'hidden'}>
      <p id="currentLogoFallback" class="help" ${url ? 'hidden' : ''}>Nessun logo personalizzato salvato.</p>
    </div>
    <h3 style="margin-top:22px">Dove mostrare il logo</h3>
    <p class="help">Seleziona le posizioni. Le modifiche vengono salvate insieme alle impostazioni del logo.</p>
    <div class="logo-placement-options">
      <label><input type="checkbox" id="logoShowSiteHeader" ${enabled('restaurant_logo_show_site_header')?'checked':''}> Sito web — in alto a sinistra</label>
      <label><input type="checkbox" id="logoShowSiteFooter" ${enabled('restaurant_logo_show_site_footer')?'checked':''}> Sito web — Footer</label>
      <label><input type="checkbox" id="logoShowAdminHeader" ${enabled('restaurant_logo_show_admin_header')?'checked':''}> Admin Panel — in alto a sinistra</label>
      <label><input type="checkbox" id="logoShowFavicon" ${enabled('restaurant_logo_show_favicon')?'checked':''}> Icona del browser (Favicon)</label>
      <label><input type="checkbox" id="logoShowStaffQr" ${enabled('restaurant_logo_show_staff_qr')?'checked':''}> Staff QR — in alto nella pagina presenze</label>
    </div>
    <button id="saveLogoPlacements" class="gold-btn" type="button" style="margin-top:16px">Salva posizioni logo</button>
    <p id="logoPlacementStatus" class="help" aria-live="polite"></p>
  </section>
  ${uploadPanel('logo')}`;
}

async function saveLogoPlacements() {
  const button = $('#saveLogoPlacements');
  const status = $('#logoPlacementStatus');
  const values = {
    restaurant_logo_show_site_header: $('#logoShowSiteHeader').checked,
    restaurant_logo_show_site_footer: $('#logoShowSiteFooter').checked,
    restaurant_logo_show_admin_header: $('#logoShowAdminHeader').checked,
    restaurant_logo_show_favicon: $('#logoShowFavicon').checked,
    restaurant_logo_show_staff_qr: $('#logoShowStaffQr').checked
  };
  button.disabled = true;
  status.textContent = 'Salvataggio…';
  try {
    const rows = Object.entries(values).map(([setting_key,value]) => ({
      setting_key, setting_value: String(value), updated_at: new Date().toISOString()
    }));
    const {error} = await db.from('site_settings').upsert(rows,{onConflict:'setting_key'});
    if (error) throw error;
    await loadAdminBrandLogo();
    status.textContent = 'Posizioni del logo salvate correttamente.';
  } catch (error) {
    status.textContent = error.message || 'Salvataggio non riuscito.';
  } finally {
    button.disabled = false;
  }
}
function gmailReplyUrl(row) {
  const subject = row.subject
    ? 'Re: ' + row.subject
    : 'Grazie per aver contattato Nababi Ristorante';
  const body = `Gentile ${row.full_name || 'Cliente'},

Grazie per aver contattato Nababi Ristorante.
Abbiamo ricevuto il tuo messaggio e ti risponderemo appena possibile.

Cordiali saluti,
Nababi Ristorante
Via Vespasiano 73/75/77, Roma
Tel. +39 393 3805350`;
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: row.email,
    su: subject,
    body
  });
  return 'https://mail.google.com/mail/?' + params.toString();
}

/* CONTACT MESSAGE INBOX */

async function contactMessagesPage() {
  const host = $('#pageContent');
  const { data, error } = await db
    .from('contact_messages')
    .select('id,full_name,email,phone,subject,message,is_read,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  if (!data?.length) {
    return '<section class="section-card"><h2>Messaggi ricevuti</h2><p class="empty-state">Nessun messaggio ricevuto.</p></section>';
  }

  const unread = data.filter(row => row.is_read !== true).length;
  return `<section class="section-card">
    <div class="section-title">
      <h2>Messaggi ricevuti</h2>
      <span class="help">${unread} da leggere · ultimi 100 messaggi</span>
    </div>
    <div class="contact-message-list">
      ${data.map(row => `
        <article class="section-card" style="margin:14px 0">
          <div class="section-title">
            <h3>${esc(row.subject || 'Senza oggetto')}</h3>
            <span class="help">${row.is_read ? 'Letto' : 'Nuovo'}</span>
          </div>
          <p><strong>${esc(row.full_name)}</strong></p>
          <p>Email: ${row.email ? `<a href="mailto:${esc(row.email)}">${esc(row.email)}</a>` : 'Non indicata'}</p>
          <p>Telefono: ${row.phone ? esc(row.phone) : 'Non indicato'}</p>
          <p class="help">${esc(row.created_at ? new Date(row.created_at).toLocaleString('it-IT') : '')}</p>
          <p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(row.message)}</p>
          ${row.email
            ? `<a class="gold-btn" href="${esc(gmailReplyUrl(row))}" target="_blank" rel="noopener noreferrer">Rispondi con Gmail</a>`
            : '<p class="help">Per rispondere via Gmail serve l’indirizzo email del cliente.</p>'}
          ${row.is_read ? '' : `<button class="outline-btn" type="button" data-mark-contact="${esc(row.id)}">Segna come letto</button>`}
        </article>
      `).join('')}
    </div>
  </section>`;
}


/* OPENING HOURS MANAGEMENT */

async function hoursPage() {
  const {data,error} = await db
    .from('opening_hours')
    .select('id,day_of_week,day_name,is_closed,opens_at,closes_at')
    .order('day_of_week');

  if (error) throw error;

  const rows = data || [];
  const cards = rows.map(row => `
    <article class="section-card" style="margin:12px 0">
      <div class="section-title">
        <h3>${esc(row.day_name)}</h3>
        <label class="field" style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" data-hour-closed="${esc(row.id)}" ${row.is_closed === true ? 'checked' : ''}>
          Chiuso
        </label>
      </div>
      <div class="form-grid">
        <label class="field">Apertura
          <input type="time" data-hour-open="${esc(row.id)}" value="${esc(row.opens_at ? String(row.opens_at).slice(0,5) : '')}">
        </label>
        <label class="field">Chiusura
          <input type="time" data-hour-close="${esc(row.id)}" value="${esc(row.closes_at ? String(row.closes_at).slice(0,5) : '')}">
        </label>
      </div>
    </article>
  `).join('');

  return `
    <section class="section-card">
      <div class="section-title">
        <h2>Orari di apertura e chiusura</h2>
        <span class="help">Modifica gli orari direttamente da Admin</span>
      </div>
      <form id="openingHoursForm">
        ${cards || '<p class="empty-state">Nessun giorno configurato nella tabella opening_hours.</p>'}
        <button class="gold-btn" id="saveOpeningHours" type="submit" ${rows.length ? '' : 'disabled'}>Salva orari</button>
        <p id="openingHoursStatus" class="help" aria-live="polite"></p>
      </form>
    </section>
  `;
}

async function saveOpeningHours(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('#openingHoursStatus');
  const button = $('#saveOpeningHours');
  const closedInputs = [...form.querySelectorAll('[data-hour-closed]')];

  button.disabled = true;
  status.textContent = 'Salvataggio…';

  try {
    for (const closedInput of closedInputs) {
      const id = closedInput.dataset.hourClosed;
      const isClosed = closedInput.checked;
      const opensAt = form.querySelector('[data-hour-open="' + id + '"]')?.value || '';
      const closesAt = form.querySelector('[data-hour-close="' + id + '"]')?.value || '';

      if (!isClosed && (!opensAt || !closesAt)) {
        throw new Error('Inserisci sia l’orario di apertura sia quello di chiusura, oppure seleziona Chiuso.');
      }
      if (!isClosed && opensAt >= closesAt) {
        throw new Error('L’orario di chiusura deve essere successivo a quello di apertura.');
      }

      const {data: updatedRow, error} = await db
        .from('opening_hours')
        .update({
          is_closed: isClosed,
          opens_at: isClosed ? null : opensAt,
          closes_at: isClosed ? null : closesAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!updatedRow) {
        throw new Error('Nessuna riga aggiornata. Controlla la policy UPDATE della tabella opening_hours in Supabase.');
      }
    }

    status.textContent = 'Orari salvati correttamente.';
  } catch (error) {
    status.textContent = error.message || 'Salvataggio non riuscito.';
  } finally {
    button.disabled = false;
  }
}


/* REVIEWS MANAGEMENT */

async function reviewsPage() {
  return `
    <section class="section-card reviews-manager-card">
      <div class="section-title">
        <h2>Gestione Reviews</h2>
        <p class="help">Aggiungi recensioni e scegli quali pubblicare sul sito.</p>
      </div>
      <form id="reviewForm" class="form-grid reviews-form">
        <input type="hidden" name="id" id="reviewId">
        <label class="field" for="reviewCustomerName">Nome cliente
          <input id="reviewCustomerName" name="customer_name" maxlength="120" required>
        </label>
        <label class="field" for="reviewRating">Valutazione
          <select id="reviewRating" name="rating" required>
            <option value="5">★★★★★ — 5</option>
            <option value="4">★★★★☆ — 4</option>
            <option value="3">★★★☆☆ — 3</option>
            <option value="2">★★☆☆☆ — 2</option>
            <option value="1">★☆☆☆☆ — 1</option>
          </select>
        </label>
        <label class="field" for="reviewText">Testo della recensione
          <textarea id="reviewText" name="review_text" rows="3" maxlength="3000" required></textarea>
        </label>
        <label class="field reviews-publish-field">
          <span>Pubblicazione</span>
          <span class="checkbox-row">
            <input type="checkbox" name="is_approved" id="reviewApproved">
            Pubblica sul sito
          </span>
        </label>
        <div class="news-form-actions reviews-form-actions">
          <button class="gold-btn" type="submit" id="reviewSaveButton">Salva recensione</button>
          <button class="outline-btn" type="button" id="reviewCancelButton">Annulla modifica</button>
        </div>
        <p id="reviewStatus" class="help" role="status" aria-live="polite"></p>
      </form>
    </section>
    <section class="section-card reviews-list-card">
      <div class="section-title"><h2>Recensioni ricevute</h2></div>
      <div id="reviewsAdminList"><p class="help">Caricamento recensioni…</p></div>
    </section>
  `;
}

function resetReviewForm() {
  const form = $('#reviewForm');
  if (!form) return;
  form.reset();
  $('#reviewId').value = '';
  $('#reviewRating').value = '5';
  $('#reviewApproved').checked = false;
  $('#reviewSaveButton').textContent = 'Salva recensione';
  $('#reviewStatus').textContent = '';
}

async function loadReviewsAdmin() {
  const host = $('#reviewsAdminList');
  if (!host) return;

  const { data, error } = await db
    .from('reviews')
    .select('id,customer_name,rating,review_text,is_approved,created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  if (!data?.length) {
    host.innerHTML = '<p class="empty-state">Nessuna recensione trovata.</p>';
    return;
  }

  host.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr>
          <th>Cliente</th><th>Valutazione</th><th>Recensione</th><th>Stato</th><th>Azioni</th>
        </tr></thead>
        <tbody>
          ${data.map(row => `
            <tr>
              <td>${esc(row.customer_name)}</td>
              <td>${'★'.repeat(Number(row.rating))}${'☆'.repeat(5-Number(row.rating))}</td>
              <td>${esc(row.review_text)}</td>
              <td>${row.is_approved ? 'Pubblicata' : 'In attesa'}</td>
              <td>
                <button type="button" class="btn btn-secondary" data-edit-review="${esc(row.id)}">Modifica</button>
                <button type="button" class="btn btn-secondary" data-toggle-review="${esc(row.id)}" data-approved="${row.is_approved ? 'true' : 'false'}">${row.is_approved ? 'Nascondi' : 'Approva'}</button>
                <button type="button" class="btn btn-danger" data-delete-review="${esc(row.id)}">Elimina</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  host.dataset.rows = JSON.stringify(data);
}

async function saveReview(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const status = $('#reviewStatus');
  const button = $('#reviewSaveButton');
  const values = new FormData(form);
  const id = String(values.get('id') || '').trim();
  const customerName = String(values.get('customer_name') || '').trim();
  const reviewText = String(values.get('review_text') || '').trim();
  const rating = Number(values.get('rating'));
  const isApproved = $('#reviewApproved').checked;

  if (!customerName || !reviewText || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    status.textContent = 'Inserisci nome, recensione e una valutazione da 1 a 5.';
    return;
  }

  button.disabled = true;
  status.textContent = 'Salvataggio…';

  try {
    const payload = {
      customer_name: customerName,
      rating,
      review_text: reviewText,
      is_approved: isApproved
    };

    const result = id
      ? await db.from('reviews').update(payload).eq('id', id).select('id').maybeSingle()
      : await db.from('reviews').insert(payload).select('id').maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) throw new Error('Nessuna riga salvata. Controlla le policy RLS di Supabase.');

    resetReviewForm();
    status.textContent = 'Recensione salvata.';
    await loadReviewsAdmin();
  } catch (error) {
    status.textContent = error.message || 'Salvataggio non riuscito.';
  } finally {
    button.disabled = false;
  }
}

async function editReview(id) {
  const host = $('#reviewsAdminList');
  const rows = JSON.parse(host?.dataset.rows || '[]');
  const row = rows.find(item => item.id === id);
  if (!row) throw new Error('Recensione non trovata.');

  $('#reviewId').value = row.id;
  $('#reviewCustomerName').value = row.customer_name || '';
  $('#reviewRating').value = String(row.rating || 5);
  $('#reviewText').value = row.review_text || '';
  $('#reviewApproved').checked = row.is_approved === true;
  $('#reviewSaveButton').textContent = 'Aggiorna recensione';
  $('#reviewStatus').textContent = 'Stai modificando una recensione.';
  $('#reviewCustomerName').focus();
}

async function toggleReviewApproval(id, currentlyApproved) {
  const { data, error } = await db
    .from('reviews')
    .update({ is_approved: !currentlyApproved })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Nessuna riga aggiornata. Controlla la policy UPDATE di reviews in Supabase.');
  await loadReviewsAdmin();
}

async function deleteReview(id) {
  if (!confirm('Vuoi eliminare definitivamente questa recensione?')) return;

  const { data, error } = await db
    .from('reviews')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Nessuna riga eliminata. Controlla la policy DELETE di reviews in Supabase.');
  await loadReviewsAdmin();
}



/* BOOKING MANAGEMENT */
async function bookingsPage() {
  if (userRole !== 'admin') return '<p>Solo l’amministratore può gestire le prenotazioni.</p>';
  const {data,error} = await db.from('bookings').select('*').order('created_at',{ascending:false}).limit(100);
  if (error) throw error;
  const rows = data || [];
  const today = new Date().toLocaleDateString('en-CA');
  const countFor = date => rows.filter(row => String(row.booking_date || '').slice(0,10) === date).length;
  return `<section class="section-card booking-calendar-card">
    <style>
      .booking-row-new{background:rgba(217,165,45,.10)}
      .booking-row-confirmed{background:rgba(35,145,85,.09)}
      .booking-row-rejected{background:rgba(190,55,55,.09)}
      .booking-status-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.3px;white-space:nowrap}
      .booking-status-new{background:#fff0c2;color:#805500;border:1px solid #e7c46a}
      .booking-status-confirmed{background:#d9f5e4;color:#17643a;border:1px solid #8fd2aa}
      .booking-status-rejected{background:#ffe0e0;color:#9d2424;border:1px solid #e7a0a0}
      .booking-calendar-tools{display:grid;grid-template-columns:minmax(180px,1fr) repeat(3,minmax(90px,.7fr));gap:10px;margin:18px 0;padding:16px;border:1px solid rgba(216,183,106,.3);border-radius:14px;background:linear-gradient(135deg,rgba(22,42,33,.8),rgba(7,15,13,.9))}
      .booking-calendar-tools label{display:grid;gap:7px;color:#e9dcbf;font-size:12px;font-weight:700}
      .booking-calendar-tools input{min-height:42px;padding:9px 11px;border:1px solid #80683a;border-radius:9px;background:#10191d;color:#fff}
      .booking-calendar-stat{padding:10px;border:1px solid rgba(216,183,106,.22);border-radius:10px;text-align:center}
      .booking-calendar-stat strong{display:block;color:#f1cf70;font-size:22px}
      .booking-calendar-stat span{font-size:11px;color:#d3c9b3}
      .booking-calendar-stat.is-pending{background:linear-gradient(145deg,#f8c43a,#e99b13);border:2px solid #ffdf75;box-shadow:0 0 0 2px rgba(248,196,58,.22),0 8px 18px rgba(233,155,19,.2)}
      .booking-calendar-stat.is-pending strong{color:#241600;font-size:25px}
      .booking-calendar-stat.is-pending span{color:#352300;font-weight:800}
      .booking-calendar-stat.is-confirmed{background:linear-gradient(145deg,#35c875,#138447);border:2px solid #83f0ae;box-shadow:0 0 0 2px rgba(53,200,117,.2),0 8px 18px rgba(19,132,71,.2)}
      .booking-calendar-stat.is-confirmed strong{color:#062b17;font-size:25px}
      .booking-calendar-stat.is-confirmed span{color:#062b17;font-weight:800}
      .booking-calendar-stat.is-cancelled{background:linear-gradient(145deg,#ff6868,#c92335);border:2px solid #ffaaaa;box-shadow:0 0 0 2px rgba(255,104,104,.2),0 8px 18px rgba(201,35,53,.2)}
      .booking-calendar-stat.is-cancelled strong{color:#39050b;font-size:25px}
      .booking-calendar-stat.is-cancelled span{color:#39050b;font-weight:800}
      @media(max-width:620px){.booking-calendar-tools{grid-template-columns:1fr 1fr}.booking-calendar-tools label{grid-column:1/-1}}
    </style>
    <div class="section-title"><h2>Prenotazioni</h2><button class="outline-btn" data-refresh-bookings>Aggiorna</button></div>
    <p class="help">Seleziona una data per vedere le prenotazioni del giorno. Le richieste restano evidenziate in giallo, confermate in verde e rifiutate in rosso.</p>
    <div class="booking-calendar-tools">
      <label>Calendario prenotazioni
        <input id="bookingCalendarDate" type="date" value="${esc(today)}">
      </label>
      <div class="booking-calendar-stat"><strong id="bookingDayTotal">${countFor(today)}</strong><span>Prenotazioni del giorno</span></div>
      <div class="booking-calendar-stat is-pending"><strong>${rows.filter(row => ['pending','new'].includes(String(row.status || 'pending').toLowerCase())).length}</strong><span>In attesa · Giallo</span></div>
      <div class="booking-calendar-stat is-confirmed"><strong>${rows.filter(row => String(row.status || '').toLowerCase() === 'confirmed').length}</strong><span>Confermate · Verde</span></div>
      <div class="booking-calendar-stat is-cancelled"><strong>${rows.filter(row => ['rejected','cancelled'].includes(String(row.status || '').toLowerCase())).length}</strong><span>Annullate · Rosso</span></div>
    </div>
    <p id="bookingCalendarNote" class="help" aria-live="polite">${countFor(today)} prenotazioni per la data selezionata.</p>
    <div class="table-scroll"><table class="data-table"><thead><tr><th>Cliente</th><th>Contatti</th><th>Data / Ora</th><th>Ospiti</th><th>Stato</th><th>Azioni</th></tr></thead><tbody id="bookingCalendarRows">
    ${rows.map(row => {
      const bookingStatus = String(row.status || 'pending').toLowerCase();
      const isNew = bookingStatus === 'pending' || bookingStatus === 'new';
      const isConfirmed = bookingStatus === 'confirmed';
      const isRejected = ['rejected', 'cancelled'].includes(bookingStatus);
      const rowClass = isNew ? 'booking-row-new' : isConfirmed ? 'booking-row-confirmed' : isRejected ? 'booking-row-rejected' : '';
      const statusClass = isNew ? 'booking-status-new' : isConfirmed ? 'booking-status-confirmed' : isRejected ? 'booking-status-rejected' : '';
      const statusLabel = isNew ? 'NUOVA · IN ATTESA' : isConfirmed ? 'CONFERMATA' : isRejected ? 'RIFIUTATA' : bookingStatus.toUpperCase();
      return `<tr class="${rowClass}" data-booking-date="${esc(String(row.booking_date || '').slice(0,10))}">
      <td>${esc(row.full_name || row.name || row.customer_name || '—')}<br><small>${esc(row.booking_code || '')}</small></td>
      <td>${esc(row.phone || '—')}<br>${esc(row.email || '')}</td>
      <td>${esc(row.booking_date || '—')}<br>${esc(row.booking_time || '—')}</td>
      <td>${esc(row.guests ?? '—')}</td>
      <td><span class="booking-status-pill ${statusClass}">${esc(statusLabel)}</span></td>
      <td>
        <button class="outline-btn" data-booking-message data-name="${esc(row.full_name || row.name || row.customer_name || '')}" data-phone="${esc(row.phone || '')}" data-email="${esc(row.email || '')}" data-date="${esc(row.booking_date || '')}" data-time="${esc(row.booking_time || '')}" data-guests="${esc(row.guests ?? '')}" data-code="${esc(row.booking_code || '')}" data-status="${esc(row.status || 'pending')}">Messaggio</button>
        ${isNew ? `<button class="gold-btn" data-booking-status="confirmed" data-booking-id="${esc(row.id)}">Conferma</button><button class="outline-btn" data-booking-status="rejected" data-booking-id="${esc(row.id)}">Rifiuta</button>` : ''}
      </td>
    </tr>`;
    }).join('')}</tbody></table></div>
    ${rows.length ? '' : '<p class="empty-state">Nessuna prenotazione trovata.</p>'}
    <section class="section-card" id="bookingMessagePanel" hidden>
      <h3>Invia un messaggio al cliente</h3>
      <p class="help" id="bookingMessageRecipient"></p>
      <label class="field">Lingua del messaggio
        <select id="bookingMessageLanguage"><option value="it">Italiano</option><option value="en">English</option><option value="bn">বাংলা</option></select>
      </label>
      <label class="field">Messaggio personalizzato
        <textarea id="bookingMessageText" rows="6" maxlength="2000"></textarea>
      </label>
      <button class="gold-btn" type="button" data-booking-send-whatsapp>Apri WhatsApp</button>
      <button class="outline-btn" type="button" data-booking-send-email>Apri Email</button>
      <button class="outline-btn" type="button" data-booking-message-close>Chiudi</button>
      <p class="help">Il pulsante apre WhatsApp o la tua app email con il testo già compilato. Controlla e premi “Invia” nell’app. L’invio automatico dal sito non è attivo.</p>
    </section>
    <p id="bookingAdminStatus" class="help" aria-live="polite"></p>
  </section>`;
}
async function setBookingStatus(id,status) {
  if (!['confirmed','rejected'].includes(status)) throw new Error('Stato non valido.');
  const label = status === 'confirmed' ? 'confermare' : 'rifiutare';
  if (!confirm('Vuoi ' + label + ' questa prenotazione?')) return;
  const {data,error} = await db.from('bookings').update({status}).eq('id',id).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Nessuna prenotazione aggiornata. Verifica la policy UPDATE della tabella bookings in Supabase.');
  await render('bookings');
}


/* GAMES MANAGEMENT */
function gamesPage() {
  return `
    <section class="section-card">
      <div class="section-title">
        <h2>Gestione giochi</h2>
        <span class="help">Attiva solo i giochi completi e verificati.</span>
      </div>
      <div id="gamesAdminList" class="empty-state">Caricamento giochi…</div>
    </section>
    <section class="section-card">
      <div class="section-title"><h2>Configurazione gioco</h2></div>
      <form id="gameForm" class="upload-box">
        <div class="form-grid">
          <label class="field">Gioco
            <select id="gameKey" name="game_key" required></select>
          </label>
          <label class="field">Titolo
            <input id="gameTitle" name="title" maxlength="120" required>
          </label>
          <label class="field">Descrizione del gioco
            <input id="gameDescription" name="description" maxlength="500" placeholder="Breve descrizione del gioco">
          </label>
          <label class="field">Tipo premio
            <select id="gameRewardType" name="reward_type">
              <option value="none">Nessun premio configurato</option>
              <option value="discount_percent">Sconto percentuale (%)</option>
              <option value="discount_euro">Sconto in euro (€)</option>
              <option value="free_food">Cibo gratuito</option>
              <option value="free_drink">Bevanda gratuita</option>
              <option value="custom">Premio personalizzato</option>
            </select>
          </label>
          <label class="field">Valore premio
            <input id="gameRewardValue" name="reward_value" type="number" min="0" step="0.01" placeholder="Es. 10">
          </label>
          <label class="field">Descrizione premio
            <input id="gameRewardLabel" name="reward_label" maxlength="180" placeholder="Es. 10% di sconto sul conto">
          </label>
          <label class="field">Limite totale dei premi
            <input id="gameMaxClaims" name="max_claims" type="number" min="1" step="1" placeholder="Vuoto = nessun limite">
          </label>
          <label class="field">Inizio validità
            <input id="gameStartsAt" name="starts_at" type="datetime-local">
          </label>
          <label class="field">Fine validità
            <input id="gameEndsAt" name="ends_at" type="datetime-local">
          </label>
        </div>
        <label class="field" style="display:flex;align-items:center;gap:10px;margin-top:14px">
          <input id="gameEnabled" name="is_enabled" type="checkbox" style="width:18px;height:18px">
          Attiva questo gioco sul sito
        </label>
        <label class="field">Immagine del gioco (JPG, PNG o WebP · max 8 MB)
          <input id="gameImageFile" type="file" accept="image/jpeg,image/png,image/webp">
        </label>
        <img id="gameImagePreview" class="preview-img" hidden alt="Anteprima immagine del gioco">
        <p id="gameStatus" class="help" aria-live="polite"></p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
          <button class="gold-btn" type="submit">Salva gioco</button>
          <button class="outline-btn" id="gameReset" type="button">Annulla modifiche</button>
        </div>
      </form>
    </section>
    <p class="help">Nota: questa sezione configura i giochi e i premi. La generazione e la convalida dei coupon devono essere completate tramite una funzione server-side prima di pubblicare i giochi interattivi.</p>
  `;
}

let gamesCache = [];

function gameDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0,16);
}

async function loadGames() {
  const list = $('#gamesAdminList');
  const select = $('#gameKey');
  if (!list || !select) return;
  const {data,error} = await db.from('games')
    .select('game_key,title,description,is_enabled,image_url,reward_type,reward_value,reward_label,max_claims,starts_at,ends_at')
    .order('title');
  if (error) throw error;
  gamesCache = data || [];
  if (!gamesCache.length) {
    list.innerHTML = '<div class="empty-state">Nessun gioco trovato nella tabella games.</div>';
    select.innerHTML = '';
    return;
  }
  select.innerHTML = gamesCache.map(game =>
    `<option value="${esc(game.game_key)}">${esc(game.title || game.game_key)}</option>`
  ).join('');
  list.innerHTML = `<div class="table-scroll"><table class="data-table">
    <thead><tr><th>Gioco</th><th>Premio</th><th>Stato</th><th>Azioni</th></tr></thead>
    <tbody>${gamesCache.map(game => {
      const reward = game.reward_label || (
        game.reward_type === 'discount_percent' ? (game.reward_value + '%') :
        game.reward_type === 'discount_euro' ? ('€' + game.reward_value) :
        game.reward_type === 'free_food' ? 'Cibo gratuito' :
        game.reward_type === 'free_drink' ? 'Bevanda gratuita' :
        game.reward_type === 'custom' ? 'Personalizzato' : 'Non configurato'
      );
      return `<tr>
        <td><strong>${esc(game.title || game.game_key)}</strong><br><small>${esc(game.game_key)}</small></td>
        <td>${esc(reward || '—')}</td>
        <td><span class="tag ${game.is_enabled ? '' : 'pending'}">${game.is_enabled ? 'ATTIVO' : 'OFF'}</span></td>
        <td>
          <button class="outline-btn" type="button" data-game-edit="${esc(game.game_key)}">Modifica</button>
          <button class="outline-btn" type="button" data-game-toggle="${esc(game.game_key)}" data-enabled="${game.is_enabled ? 'true' : 'false'}">${game.is_enabled ? 'Disattiva' : 'Attiva'}</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
  const selected = gamesCache.find(game => game.game_key === select.value) || gamesCache[0];
  if (selected) fillGameForm(selected);
}

function fillGameForm(game) {
  if (!game) return;
  $('#gameKey').value = game.game_key || '';
  $('#gameTitle').value = game.title || '';
  $('#gameDescription').value = game.description || '';
  $('#gameRewardType').value = game.reward_type || 'none';
  $('#gameRewardValue').value = game.reward_value ?? '';
  $('#gameRewardLabel').value = game.reward_label || '';
  $('#gameMaxClaims').value = game.max_claims ?? '';
  $('#gameStartsAt').value = gameDateInput(game.starts_at);
  $('#gameEndsAt').value = gameDateInput(game.ends_at);
  $('#gameEnabled').checked = game.is_enabled === true;
  const preview = $('#gameImagePreview');
  if (preview) {
    preview.src = game.image_url || '';
    preview.hidden = !game.image_url;
  }
  $('#gameImageFile').value = '';
  $('#gameStatus').textContent = game.image_url ? 'Immagine attuale caricata.' : 'Nessuna immagine impostata.';
}

function resetGameForm() {
  const game = gamesCache.find(item => item.game_key === $('#gameKey')?.value) || gamesCache[0];
  if (game) fillGameForm(game);
}

async function saveGame(e) {
  e.preventDefault();
  const status = $('#gameStatus');
  const button = e.submitter || $('#gameForm button[type="submit"]');
  const key = $('#gameKey').value;
  const currentGame = gamesCache.find(game => game.game_key === key);
  if (!currentGame) throw new Error('Seleziona un gioco valido.');
  const title = String($('#gameTitle').value || '').trim();
  const rewardType = $('#gameRewardType').value;
  const rewardLabel = String($('#gameRewardLabel').value || '').trim();
  const rawValue = $('#gameRewardValue').value;
  const rawLimit = $('#gameMaxClaims').value;
  const rewardValue = rawValue === '' ? null : Number(rawValue);
  const maxClaims = rawLimit === '' ? null : Number(rawLimit);
  if (!title) throw new Error('Inserisci il titolo del gioco.');
  if (rawValue !== '' && (!Number.isFinite(rewardValue) || rewardValue < 0)) throw new Error('Valore premio non valido.');
  if (rawLimit !== '' && (!Number.isInteger(maxClaims) || maxClaims < 1)) throw new Error('Il limite deve essere un numero intero maggiore di zero.');
  if (rewardType === 'discount_percent' && rewardValue !== null && rewardValue > 100) throw new Error('Lo sconto percentuale non può superare il 100%.');
  const starts = $('#gameStartsAt').value;
  const ends = $('#gameEndsAt').value;
  if (starts && ends && new Date(ends) <= new Date(starts)) throw new Error('La fine della validità deve essere successiva all’inizio.');
  button.disabled = true;
  status.textContent = 'Salvataggio…';
  try {
    let imageUrl = currentGame.image_url || null;
    const file = $('#gameImageFile').files?.[0];
    if (file) {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
        throw new Error('Usa JPG, PNG o WebP con dimensione massima di 8 MB.');
      }
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const randomPart = globalThis.crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
      const path = 'games/' + key.replace(/[^a-zA-Z0-9_-]/g,'-') + '/' + randomPart + '.' + ext;
      const bucket = cfg.STORAGE_BUCKET || 'nababi-media';
      const {data:uploaded,error:uploadError} = await db.storage.from(bucket).upload(path,file,{
        cacheControl:'3600',upsert:false,contentType:file.type
      });
      if (uploadError) throw uploadError;
      const {data:publicData} = db.storage.from(bucket).getPublicUrl(uploaded.path);
      imageUrl = publicData.publicUrl;
    }
    const payload = {
      title,
      description:String($('#gameDescription').value || '').trim() || null,
      is_enabled:$('#gameEnabled').checked,
      image_url:imageUrl,
      reward_type:rewardType,
      reward_value:rewardValue,
      reward_label:rewardLabel || null,
      max_claims:maxClaims,
      starts_at:starts ? new Date(starts).toISOString() : null,
      ends_at:ends ? new Date(ends).toISOString() : null,
      updated_at:new Date().toISOString()
    };
    const {data,error} = await db.from('games').update(payload).eq('game_key',key).select('game_key').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Gioco non aggiornato. Controlla la policy RLS della tabella games per l’account Admin.');
    status.textContent = 'Gioco salvato correttamente.';
    await loadGames();
    const updated = gamesCache.find(game => game.game_key === key);
    if (updated) fillGameForm(updated);
  } catch (error) {
    status.textContent = error.message || 'Salvataggio non riuscito.';
    throw error;
  } finally {
    button.disabled = false;
  }
}

async function toggleGame(key, enabled) {
  const {data,error} = await db.from('games')
    .update({is_enabled:!enabled,updated_at:new Date().toISOString()})
    .eq('game_key',key).select('game_key').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Stato non aggiornato. Verifica le policy RLS della tabella games.');
  await loadGames();
}


/* MODULE RENDERING */

async function render(id) {
  if (!canSee(id)) {
    alert('Questa funzione non è autorizzata per il tuo account.');
    return;
  }

  current = id;
  nav();

  $('#pageTitle').textContent = moduleInfo(id);

  const host = $('#pageContent');
  host.innerHTML = '<div class="empty-state">Caricamento…</div>';

  try {
    if (id === 'bookings') {
      if (userRole !== 'admin') {
        host.innerHTML = '<p>Solo l’amministratore può gestire le prenotazioni.</p>';
        return;
      }
      host.innerHTML = await bookingsPage();
      const calendarDate = $('#bookingCalendarDate');
      const filterBookingDay = () => {
        if (!calendarDate) return;
        const selected = calendarDate.value;
        let visible = 0;
        host.querySelectorAll('#bookingCalendarRows tr[data-booking-date]').forEach(row => {
          const match = !selected || row.dataset.bookingDate === selected;
          row.hidden = !match;
          if (match) visible++;
        });
        const total = $('#bookingDayTotal');
        const note = $('#bookingCalendarNote');
        if (total) total.textContent = String(visible);
        if (note) note.textContent = selected
          ? visible + ' prenotazioni per ' + selected + '.'
          : visible + ' prenotazioni visualizzate.';
      };
      calendarDate?.addEventListener('change', filterBookingDay);
      filterBookingDay();
      return;
    }

    if (id === 'reviews') {
      if (userRole !== 'admin') {
        host.innerHTML = '<p>Solo l’amministratore può gestire le recensioni.</p>';
        return;
      }
      host.innerHTML = await reviewsPage();
      $('#reviewForm').onsubmit = saveReview;
      $('#reviewCancelButton').onclick = resetReviewForm;
      await loadReviewsAdmin();
      return;
    }

    if (id === 'contact') {
      host.innerHTML = await contactMessagesPage();
      return;
    }

    if (id === 'hours') {
      host.innerHTML = await hoursPage();
      $('#openingHoursForm').onsubmit = saveOpeningHours;
      return;
    }

    if (id === 'dashboard') {
      host.innerHTML = await dashboard();
      if (userRole === 'admin') loadRecent();
      return;
    }

    if (id === 'staff') {
      if (userRole !== 'admin') {
        host.innerHTML = '<p>Not allowed.</p>';
        return;
      }

      host.innerHTML = staffPage();
      await staffLoad();
      await staffLoadAnnouncements();
      $('#staffAnnouncementForm').onsubmit = publishStaffAnnouncement;

      $('#fullStaffForm').onsubmit = async e => {
        try {
          await createFullStaff(e);
        } catch (err) {
          $('#fullStaffStatus').textContent = err.message;
        }
      };

      $('#staffForm').onsubmit = async e => {
        try {
          await createStaff(e);
        } catch (err) {
          $('#staffStatus').textContent = err.message;
        }
      };

      return;
    }

    if (id === 'discounts') {
      if (userRole !== 'admin') {
        host.innerHTML = '<p>Solo il Super Admin può gestire le offerte.</p>';
        return;
      }
      host.innerHTML = discountPage();
      await loadDiscountSettings();
      $('#discountOfferForm').onsubmit = saveDiscountOffer;
      return;
    }

    if (id === 'games') {
      if (userRole !== 'admin') {
        host.innerHTML = '<p>Solo il Super Admin può gestire i giochi.</p>';
        return;
      }
      host.innerHTML = gamesPage();
      await loadGames();
      $('#gameForm').onsubmit = async e => {
        try { await saveGame(e); }
        catch (err) { if ($('#gameStatus')) $('#gameStatus').textContent = err.message || 'Salvataggio non riuscito.'; }
      };
      $('#gameKey').onchange = () => {
        const game = gamesCache.find(item => item.game_key === $('#gameKey').value);
        if (game) fillGameForm(game);
      };
      $('#gameReset').onclick = resetGameForm;
      $('#gameImageFile').onchange = () => {
        const file = $('#gameImageFile').files?.[0];
        if (!file) return;
        if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
          $('#gameStatus').textContent = 'Usa JPG, PNG o WebP (massimo 8 MB).';
          $('#gameImageFile').value = '';
          return;
        }
        const preview = $('#gameImagePreview');
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
      };
      $('#gamesAdminList').onclick = async e => {
        const edit = e.target.closest('[data-game-edit]');
        if (edit) {
          const game = gamesCache.find(item => item.game_key === edit.dataset.gameEdit);
          if (game) fillGameForm(game);
          return;
        }
        const toggle = e.target.closest('[data-game-toggle]');
        if (toggle) {
          toggle.disabled = true;
          try { await toggleGame(toggle.dataset.gameToggle, toggle.dataset.enabled === 'true'); }
          catch (err) { alert(err.message || 'Impossibile aggiornare il gioco.'); toggle.disabled = false; }
        }
      };
      return;
    }

    if (id === 'secret') {
      host.innerHTML = secretPage();

      if (userRole === 'admin') {
        $('#generateSecretCoupon').onclick =
          generateSecretCoupon;
      }

      $('#redeemSecretForm').onsubmit =
        async e => {
          try {
            await redeemSecretCoupon(e);
          } catch (err) {
            $('#redeemSecretStatus').textContent =
              err.message || 'Redemption failed.';
          }
        };

      $('#refreshSecretHistory').onclick =
        loadSecretHistory;

      await loadSecretHistory();
      return;
    }

    if (id === 'attendance') {
      host.innerHTML = await attendancePage();
      return;
    }

    if (id === 'logo') {
      host.innerHTML = await logoManagementPage();
      $('#mediaFile').onchange = () => {
        const file = $('#mediaFile').files?.[0];
        if (!file) return;
        const img = $('#uploadPreview');
        if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        img.dataset.objectUrl = objectUrl;
        img.hidden = false;
      };
      $('#uploadBtn').onclick = uploadHandler;
      $('#saveLogoPlacements').onclick = saveLogoPlacements;
      return;
    }

    if (id === 'gallery') {
      host.innerHTML = uploadPanel(id) + `
        <section class="section-card">
          <div class="section-title"><h2>Foto salvate nella Gallery</h2></div>
          <div id="galleryAdminList" class="help">Caricamento…</div>
        </section>`;
      await loadGalleryAdmin();
      $('#mediaFile').onchange = () => {
        const file = $('#mediaFile').files?.[0];
        if (!file) return;
        const img = $('#uploadPreview');
        if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        img.dataset.objectUrl = objectUrl;
        img.hidden = false;
      };
      $('#uploadBtn').onclick = uploadHandler;
      $('#galleryAdminList').onclick = async e => {
        const move = e.target.closest('[data-gallery-move]');
        if (move) {
          move.disabled = true;
          try { await moveGalleryItem(move.dataset.galleryId, move.dataset.galleryMove); }
          catch (err) { alert(err.message || 'Impossibile riordinare le foto.'); move.disabled = false; }
          return;
        }
        const edit = e.target.closest('[data-edit-gallery]');
        if (edit) {
          const form = $('#galleryAdminList').querySelector(`[data-gallery-edit-form="${CSS.escape(edit.dataset.editGallery)}"]`);
          if (form) form.hidden = !form.hidden;
          return;
        }
        const cancel = e.target.closest('[data-cancel-gallery-edit]');
        if (cancel) {
          const form = $('#galleryAdminList').querySelector(`[data-gallery-edit-form="${CSS.escape(cancel.dataset.cancelGalleryEdit)}"]`);
          if (form) form.hidden = true;
          return;
        }
        const button = e.target.closest('[data-delete-gallery]');
        if (!button) return;
        button.disabled = true;
        try {
          await deleteGalleryItem(button.dataset.deleteGallery);
        } catch (err) {
          alert(err.message || 'Impossibile eliminare la foto.');
          button.disabled = false;
        }
      };
      $('#galleryAdminList').onsubmit = async e => {
        const form = e.target.closest('[data-gallery-edit-form]');
        if (!form) return;
        e.preventDefault();
        try {
          await updateGalleryItem(form.dataset.galleryEditForm, form);
        } catch (err) {
          alert(err.message || 'Impossibile salvare le modifiche.');
        }
      };
      return;
    }

    if (id === 'categories') {
      host.innerHTML = categoryPage();
      await categoryLoad();

      $('#categoryForm').onsubmit = async e => {
        e.preventDefault();

        const name = String(
          new FormData(e.target).get('name') || ''
        ).trim();

        if (!name) return;

        const {error} = await db
          .from('categories')
          .insert({name});

        if (error) {
          alert(error.message);
        } else {
          e.target.reset();
          await categoryLoad();
        }
      };

      return;
    }

    if (id === 'qr_menu') {
      host.innerHTML = qrMenuAdminPage();
      await loadQrMenuImages();
      $('#qrMenuUploadForm').onsubmit = uploadQrMenuImage;
      $('#qrMenuImageFile').onchange = () => {
        const file = $('#qrMenuImageFile').files?.[0];
        const preview = $('#qrMenuPreview');
        if (!file) { preview.hidden = true; return; }
        if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
          $('#qrMenuStatus').textContent = 'Usa JPG, PNG o WebP (massimo 12 MB).';
          $('#qrMenuImageFile').value = '';
          preview.hidden = true;
          return;
        }
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
      };
      $('#qrMenuImages').onclick = async e => {
        const button = e.target.closest('[data-qr-action]');
        if (!button) return;
        button.disabled = true;
        try {
          const id = button.dataset.id;
          const action = button.dataset.qrAction;
          if (action === 'toggle') {
            const {error} = await db.from('qr_menu_images').update({is_active:button.dataset.active !== 'true'}).eq('id',id);
            if (error) throw error;
          } else if (action === 'delete') {
            if (!confirm('Eliminare questa immagine del QR Menu?')) return;
            const {error} = await db.from('qr_menu_images').delete().eq('id',id);
            if (error) throw error;
          } else if (action === 'up' || action === 'down') {
            const {data:rows,error} = await db.from('qr_menu_images').select('id,sort_order').order('sort_order');
            if (error) throw error;
            const pos = rows.findIndex(row => String(row.id) === String(id));
            const other = rows[pos + (action === 'up' ? -1 : 1)];
            if (pos >= 0 && other) {
              const here = rows[pos];
              const {error:e1} = await db.from('qr_menu_images').update({sort_order:other.sort_order}).eq('id',here.id);
              if (e1) throw e1;
              const {error:e2} = await db.from('qr_menu_images').update({sort_order:here.sort_order}).eq('id',other.id);
              if (e2) throw e2;
            }
          }
          await loadQrMenuImages();
        } catch (err) {
          alert(err.message || 'Operazione non riuscita.');
        } finally {
          button.disabled = false;
        }
      };
      return;
    }

    if (id === 'menu_manager') {
      host.innerHTML = menuPage();
      await loadDishCategories();
      await dishLoad();

      $('#dishForm').onsubmit = saveDish;
      $('#dishCancelEdit').onclick = resetDishForm;
      $('#dishSearch').oninput = () => {
        const term = $('#dishSearch').value.trim().toLocaleLowerCase();
        document.querySelectorAll('#dishList .menu-dish-row').forEach(row => {
          row.hidden = !row.dataset.search.includes(term);
        });
      };
      $('#dishList').onclick = async e => {
        const toggle = e.target.closest('[data-toggle-dish]');
        if (toggle) {
          toggle.disabled = true;
          try {
            const makeAvailable = toggle.dataset.available !== 'true';
            const {error} = await db.from('menu_items')
              .update({is_available:makeAvailable})
              .eq('id',toggle.dataset.toggleDish);
            if (error) throw error;
            await dishLoad();
            const term = $('#dishSearch')?.value.trim().toLocaleLowerCase() || '';
            document.querySelectorAll('#dishList .menu-dish-row').forEach(row => {
              row.hidden = !row.dataset.search.includes(term);
            });
          } catch (err) {
            alert(err.message || 'Disponibilità non aggiornata.');
            toggle.disabled = false;
          }
          return;
        }
        const edit = e.target.closest('[data-edit-dish]');
        if (edit) {
          await editDish(edit.dataset.editDish);
          return;
        }
        const remove = e.target.closest('[data-delete-dish]');
        if (remove) {
          try { await deleteDish(remove.dataset.deleteDish); }
          catch (err) { alert(err.message || 'Impossibile eliminare il piatto.'); }
        }
      };
      $('#dishImage').onchange = () => {
        const file = $('#dishImage').files?.[0];
        const preview = $('#dishImagePreview');
        if (!file) return;
        if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
          $('#dishStatus').textContent = 'Usa JPG, PNG o WebP.';
          $('#dishImage').value = '';
          return;
        }
        if (file.size > 8 * 1024 * 1024) {
          $('#dishStatus').textContent = 'La foto deve essere massimo 8 MB.';
          $('#dishImage').value = '';
          return;
        }
        preview.src = URL.createObjectURL(file);
        preview.hidden = false;
      };
      return;
    }

    if (id === 'news') {
      host.innerHTML = newsPage();
      await loadBreakingNews();
      $('#breakingNewsForm').onsubmit = saveBreakingNews;
      $('#newsCancelEdit').onclick = resetNewsForm;
      $('#newsMediaFile').onchange = () => {
        const file = $('#newsMediaFile').files?.[0];
        if (!file) return;
        const image = $('#newsImagePreview');
        const video = $('#newsVideoPreview');
        const url = URL.createObjectURL(file);
        if (file.type.startsWith('image/')) {
          video.pause();
          video.hidden = true;
          image.src = url;
          image.hidden = false;
        } else {
          image.hidden = true;
          video.src = url;
          video.hidden = false;
        }
        $('#newsStatus').textContent = '';
      };
      return;
    }

    if (id === 'social') {
      host.innerHTML = socialLinksPage();
      await loadSocialLinksAdmin();
      $('#socialLinkForm').onsubmit = saveSocialLink;
      $('#socialLinkCancel').onclick = resetSocialLinkForm;
      return;
    }

    if (id === 'delivery') {
      host.innerHTML = await deliveryLinksPage();
      await loadDeliveryLinksAdmin();
      $('#deliveryLinkForm').onsubmit = saveDeliveryLink;
      $('#deliveryLinkCancel').onclick = resetDeliveryLinkForm;
      return;
    }

    if (id === 'tables') {
      host.innerHTML = tablesPage();
      await loadRestaurantTables();
      $('#restaurantTableForm').onsubmit = saveRestaurantTable;
      $('#tableCancelEdit').onclick = resetTableForm;
      return;
    }

    const body = await genericTable(id);

    host.innerHTML = `<section class="section-card">
      <div class="section-title">
        <h2>${esc(moduleInfo(id))}</h2>
        <span class="help">
          ${esc(descriptions[id] || 'Gestione Nababi')}
        </span>
      </div>
      ${body}
    </section>

    ${[
      'secret','menu_public','social','hours','contact','settings',
      'reports','performance','attendance','activity','tables',
      'delivery','bookings','customers','coupons','news','reviews'
    ].includes(id) ? `
      <section class="section-card">
        <h2>Gestione e configurazione</h2>
        <p class="help">
          Questo modulo mostra i dati disponibili. Le funzioni di modifica
          richiedono la verifica delle colonne e delle policy Supabase.
        </p>
        ${id==='secret' || id==='news' ? uploadPanel('gallery') : ''}
      </section>
    ` : ''}`;

    if (id === 'secret' || id === 'news') {
      const fileInput = $('#mediaFile');
      const uploadButton = $('#uploadBtn');

      if (fileInput) {
        fileInput.onchange = () => {
          const file = fileInput.files?.[0];
          if (!file) return;

          const img = $('#uploadPreview');
          img.src = URL.createObjectURL(file);
          img.hidden = false;
        };
      }

      if (uploadButton) {
        uploadButton.onclick = uploadHandler;
      }
    }

  } catch (err) {
    host.innerHTML = `<section class="section-card">
      <h2>${esc(moduleInfo(id))}</h2>
      <p class="error-text">
        ${esc(err.message || 'Errore durante il caricamento.')}
      </p>
    </section>`;
  }
}

async function genericTable(id) {
  const table = tableMap[id];

  if (!table) {
    return '<div class="empty-state">Modulo pronto per configurazione.</div>';
  }

  try {
    const {data,error} = await db
      .from(table)
      .select('*')
      .limit(50);

    if (error) throw error;

    if (!data?.length) {
      return `<div class="empty-state">
        Nessun record trovato nella tabella <b>${esc(table)}</b>.
      </div>`;
    }

    const cols = Object.keys(data[0]).slice(0,5);

    return `<div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${cols.map(c => `<td>${esc(
                typeof row[c] === 'object'
                  ? JSON.stringify(row[c])
                  : row[c]
              )}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

  } catch (e) {
    return `<div class="empty-state">
      <span class="error-text">${esc(e.message)}</span>
      <p class="help">
        La tabella ${esc(table)} potrebbe non essere disponibile
        o accessibile.
      </p>
    </div>`;
  }
}

/* PASSWORD RECOVERY EVENTS */
$('#forgotPasswordBtn').addEventListener('click', requestPasswordRecovery);
$('#saveNewPasswordBtn').addEventListener('click', saveRecoveredPassword);

db = window.supabase?.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) || null;
if (db) {
  db.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') showPasswordResetForm();
  });
}

/* EVENT LISTENERS */

$('#loginForm').addEventListener('submit', signIn);

$('#sideNav').addEventListener('click', e => {
  const button = e.target.closest('[data-page]');
  if (button) render(button.dataset.page);
});

$('#pageContent').addEventListener('click', async e => {
  try {
    const pageButton = e.target.closest('[data-page]');
    if (pageButton) {
      render(pageButton.dataset.page);
      return;
    }

    const messageButton = e.target.closest('[data-booking-message]');
    if (messageButton) {
      const panel = $('#bookingMessagePanel');
      const name = messageButton.dataset.name || 'Cliente';
      const lang = $('#bookingMessageLanguage');
      const status = messageButton.dataset.status;
      const details = {date:messageButton.dataset.date,time:messageButton.dataset.time,guests:messageButton.dataset.guests,code:messageButton.dataset.code};
      panel.dataset.phone = messageButton.dataset.phone || '';
      panel.dataset.email = messageButton.dataset.email || '';
      $('#bookingMessageRecipient').textContent = name + ' · ' + (messageButton.dataset.email || messageButton.dataset.phone || 'Contatto non disponibile');
      const makeText = language => {
        const when = [details.date,details.time].filter(Boolean).join(' ');
        if (language === 'en') return `Dear ${name}, regarding your Nababi Ristorante booking (${details.code || '—'}) for ${when}, ${details.guests || '—'} guest(s): the current status is ${status}. Please contact us if you need any assistance. Thank you.`;
        if (language === 'bn') return `প্রিয় ${name}, Nababi Ristorante-এ আপনার বুকিং (${details.code || '—'}), তারিখ ও সময়: ${when}, অতিথি: ${details.guests || '—'}। বুকিংয়ের বর্তমান অবস্থা: ${status}। কোনো সাহায্য লাগলে আমাদের সঙ্গে যোগাযোগ করুন। ধন্যবাদ।`;
        return `Gentile ${name}, in merito alla sua prenotazione Nababi Ristorante (${details.code || '—'}) del ${when}, per ${details.guests || '—'} ospiti: lo stato attuale è ${status}. Per qualsiasi necessità, ci contatti. Grazie.`;
      };
      $('#bookingMessageText').value = makeText(lang.value);
      lang.onchange = () => { $('#bookingMessageText').value = makeText(lang.value); };
      panel.hidden = false;
      panel.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    if (e.target.closest('[data-booking-message-close]')) {
      $('#bookingMessagePanel').hidden = true;
      return;
    }
    if (e.target.closest('[data-booking-send-whatsapp]')) {
      const phone = String($('#bookingMessagePanel').dataset.phone || '').replace(/[^0-9]/g,'');
      if (!phone) { alert('Numero WhatsApp non disponibile per questo cliente.'); return; }
      const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent($('#bookingMessageText').value);
      window.open(url,'_blank','noopener');
      return;
    }
    if (e.target.closest('[data-booking-send-email]')) {
      const email = $('#bookingMessagePanel').dataset.email || '';
      if (!email) { alert('Email non disponibile per questo cliente.'); return; }
      const subject = encodeURIComponent('Nababi Ristorante — Prenotazione');
      const body = encodeURIComponent($('#bookingMessageText').value);
      window.location.href = 'mailto:' + encodeURIComponent(email) + '?subject=' + subject + '&body=' + body;
      return;
    }

    const bookingAction = e.target.closest('[data-booking-status]');
    if (bookingAction) {
      bookingAction.disabled = true;
      try {
        await setBookingStatus(bookingAction.dataset.bookingId, bookingAction.dataset.bookingStatus);
      } catch (err) {
        alert(err.message || 'Impossibile aggiornare la prenotazione.');
        bookingAction.disabled = false;
      }
      return;
    }
    if (e.target.closest('[data-refresh-bookings]')) {
      await render('bookings');
      return;
    }

    const markContactButton = e.target.closest('[data-mark-contact]');
    if (markContactButton) {
      const { error } = await db
        .from('contact_messages')
        .update({ is_read: true })
        .eq('id', markContactButton.dataset.markContact);
      if (error) throw error;
      await render('contact');
      return;
    }


    const editReviewButton = e.target.closest('[data-edit-review]');
    if (editReviewButton) {
      await editReview(editReviewButton.dataset.editReview);
      return;
    }

    const toggleReviewButton = e.target.closest('[data-toggle-review]');
    if (toggleReviewButton) {
      await toggleReviewApproval(
        toggleReviewButton.dataset.toggleReview,
        toggleReviewButton.dataset.approved === 'true'
      );
      return;
    }

    const deleteReviewButton = e.target.closest('[data-delete-review]');
    if (deleteReviewButton) {
      await deleteReview(deleteReviewButton.dataset.deleteReview);
      return;
    }

    const printQR = e.target.closest('[data-print-attendance-qr]');

    if (printQR) {
      const printWindow = window.open('', '_blank');

      if (!printWindow) {
        alert('Please allow pop-ups to print the QR Code.');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Nababi Staff Attendance QR</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 35px;
            }
            img {
              width: 300px;
              max-width: 90%;
            }
          </style>
        </head>
        <body>
          <h1>NABABI RISTORANTE</h1>
          <h2>Staff Attendance</h2>
          <img src="${STAFF_QR_IMAGE}" alt="Staff QR Code">
          <p>Scan to Check In / Check Out</p>
          <p>Select your name and enter your personal PIN.</p>
          <script>
            window.onload = () => window.print();
          <\/script>
        </body>
        </html>
      `);

      printWindow.document.close();
      return;
    }

    const editNewsButton = e.target.closest('[data-edit-news]');
    if (editNewsButton) {
      await editBreakingNews(editNewsButton.dataset.editNews);
      return;
    }

    const deleteNewsButton = e.target.closest('[data-delete-news]');
    if (deleteNewsButton) {
      await deleteBreakingNews(deleteNewsButton.dataset.deleteNews);
      return;
    }

    const editTableButton = e.target.closest('[data-edit-table]');
    if (editTableButton) {
      await editRestaurantTable(editTableButton.dataset.editTable);
      return;
    }

    const deleteTableButton = e.target.closest('[data-delete-table]');
    if (deleteTableButton) {
      await deleteRestaurantTable(deleteTableButton.dataset.deleteTable);
      return;
    }

    const categoryButton = e.target.closest('[data-delete-category]');

    if (categoryButton) {
      const categoryId = categoryButton.dataset.deleteCategory;

      if (confirm('Eliminare questa categoria?')) {
        const {error} = await db
          .from('categories')
          .delete()
          .eq('id',categoryId);

        if (error) throw error;
        await categoryLoad();
      }

      return;
    }

    const editDishButton = e.target.closest('[data-edit-dish]');
    if (editDishButton) {
      await editDish(editDishButton.dataset.editDish);
      return;
    }

    const deleteDishButton = e.target.closest('[data-delete-dish]');
    if (deleteDishButton) {
      await deleteDish(deleteDishButton.dataset.deleteDish);
      return;
    }

    const saveButton = e.target.closest('[data-save-perms]');

    if (saveButton) {
      await savePermissions(saveButton.dataset.savePerms);
      return;
    }

    const toggleButton = e.target.closest('[data-toggle-staff]');

    if (toggleButton) {
      await toggleStaff(
        toggleButton.dataset.toggleStaff,
        toggleButton.dataset.active === 'true'
      );
      return;
    }

    const removeButton = e.target.closest('[data-remove-staff]');

    if (removeButton) {
      await removeStaffLink(removeButton.dataset.removeStaff);
      return;
    }

    const resetButton = e.target.closest('[data-reset-staff]');

    if (resetButton) {
      await resetStaffPassword(resetButton.dataset.resetStaff);
      return;
    }

  } catch (err) {
    alert(err.message || 'Operation failed.');
  }
});

/* MOBILE MENU */

$('#menuToggle').onclick = () => {
  $('#sidebar').classList.toggle('open');
};

$('#mobileMore').onclick = () => {
  $('#sidebar').classList.toggle('open');
};

$('#mobileNav').addEventListener('click', e => {
  const button = e.target.closest('[data-page]');
  if (button) render(button.dataset.page);
});

/* LOGOUT */

$('#logoutBtn').onclick = async () => {
  try {
    await db?.auth.signOut();
  } finally {
    userRole = 'guest';
    staffPermissions = {};
    sessionUser = null;
    current = 'dashboard';

    $('#adminApp').hidden = true;
    $('#loginScreen').hidden = false;
    $('#password').value = '';

    showLoginMessage('');
  }
};

/* SESSION RESTORE */

(async () => {
  if (
    !window.supabase ||
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_ANON_KEY
  ) {
    showLoginMessage('Supabase config non disponibile.');
    return;
  }

  db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  try {
    const {data,error} = await db.auth.getSession();

    if (error) throw error;

    if (data.session?.user) {
      await verifyAdmin(data.session.user);
      openApp(data.session.user.email);
    }

  } catch (e) {
    userRole = 'guest';
    staffPermissions = {};
    sessionUser = null;

    showLoginMessage(
      e.message || 'Sessione non valida.'
    );

    try {
      await db.auth.signOut();
    } catch (_) {}
  }
})();

})();
