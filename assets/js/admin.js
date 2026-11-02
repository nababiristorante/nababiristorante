
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
  ['categories','▦','Categories'],
  ['bookings','▣','Bookings'],
  ['customers','♙','Customers'],
  ['coupons','◇','Coupons'],
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
  staff:'staff',
  performance:'staff_activity_logs',
  attendance:'staff_attendance',
  activity:'staff_activity_logs',
  tables:'restaurant_tables',
  gallery:'gallery_items',
  delivery:'delivery_orders',
  menu_public:'menu_items',
  menu_manager:'menu_items',
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
  categories:'Organizza le categorie del menu.',
  bookings:'Consulta le prenotazioni dei tavoli.',
  customers:'Archivio clienti.',
  coupons:'Crea e gestisci codici sconto.',
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
}

function showLoginMessage(message) {
  const out = $('#loginMessage');
  if (out) out.textContent = message || '';
}

function openApp(email) {
  $('#loginScreen').hidden = true;
  $('#adminApp').hidden = false;

  $('#adminEmail').textContent =
    (userRole === 'admin' ? 'SUPER ADMIN · ' : 'STAFF · ') +
    (email || 'Account');

  nav();

  // Open the coupon redemption screen immediately after login.
  // Staff still need the existing "secret" permission.
  render(canSee('secret') ? 'secret' : 'dashboard');
}

async function verifyAdmin(user) {
  if (!user?.id) {
    throw new Error('Account utente non valido.');
  }

  sessionUser = user;

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

  const [visits,clicks,gallery,coupons,bookings,reviews,staff] =
    await Promise.all([
      count('site_visits'),
      count('menu_clicks'),
      count('gallery_items'),
      count('coupon_redemptions'),
      count('bookings'),
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
      $('#uploadedUrl').innerHTML = '<p class="success-text">Logo salvato! Header, Footer e Favicon saranno aggiornati sul sito.</p>';
      status.textContent = 'Logo caricato e salvato correttamente.';
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
          <article class="menu-dish-row">
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
  `;
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
  const {data,error} = await db.from('site_settings').select('setting_value').eq('setting_key','restaurant_logo_url').maybeSingle();
  if (error) throw error;
  const url = data?.setting_value || '';
  return `<section class="section-card">
    <div class="section-title"><h2>Logo attuale</h2><span class="help">Header, Footer e icona del browser</span></div>
    <div class="upload-box">
      <img id="currentLogoPreview" class="preview-img" alt="Logo attuale" src="${esc(url)}" ${url ? '' : 'hidden'}>
      <p id="currentLogoFallback" class="help" ${url ? 'hidden' : ''}>Nessun logo personalizzato salvato.</p>
    </div>
  </section>
  ${uploadPanel('logo')}`;
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
          ${row.is_read ? '' : `<button class="outline-btn" type="button" data-mark-contact="${esc(row.id)}">Segna come letto</button>`}
        </article>
      `).join('')}
    </div>
  </section>`;
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
    if (id === 'contact') {
      host.innerHTML = await contactMessagesPage();
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
      return;
    }

    if (id === 'gallery') {
      host.innerHTML = uploadPanel(id);
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

    if (id === 'menu_manager') {
      host.innerHTML = menuPage();
      await loadDishCategories();
      await dishLoad();

      $('#dishForm').onsubmit = saveDish;
      $('#dishCancelEdit').onclick = resetDishForm;
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
