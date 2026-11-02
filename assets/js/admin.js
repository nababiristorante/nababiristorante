
(() => {
'use strict';

/* NABABI RISTORANTE — ADMIN PANEL */

const cfg = window.NABABI_CONFIG || {};
  const STAFF_QR_URL =
  'https://nababiristorante.vercel.app/staff-qr.html';

const STAFF_QR_IMAGE =
  'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' +
  encodeURIComponent(STAFF_QR_URL);
const $ = s => document.querySelector(s);

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

const menu = [
  ['dashboard','▦','Dashboard'],
  ['secret','🎁','Secret Coupon Box'],
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
  ['delivery','🛵','Food Delivery'],
  ['social','◎','Social'],
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
  contact:'Informazioni di contatto del ristorante.',
  settings:'Impostazioni generali del sito.'
};

const MODULES = menu.filter(([id]) =>
  !['dashboard','staff'].includes(id)
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

  // Accept old array data when reading, but normalize to object.
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
  return userRole === 'staff' && staffPermissions[id] === true;
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
  render('dashboard');
}

async function verifyAdmin(user) {
  if (!user?.id) throw new Error('Account utente non valido.');

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
    throw new Error('Questo account non è autorizzato. Contatta il Super Admin.');
  }

  userRole = 'staff';
  staffPermissions = permissionObject(staff.permissions);

  return true;
}

async function signIn(e) {
  e.preventDefault();

  const btn = $('#loginBtn');
  const email = $('#email')?.value.trim();
  const password = $('#password')?.value;

  showLoginMessage('');

  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
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

    // Do not leave an authenticated but unauthorized session active.
    try {
      await db?.auth.signOut();
    } catch (_) {}

    showLoginMessage(err.message || 'Accesso non riuscito.');

  } finally {
    btn.disabled = false;
    btn.textContent = 'Accedi';
  }
}

function statCard(icon,label,value) {
  return `<article class="stat-card">
    <div class="stat-top"><span class="stat-icon">${icon}</span>${esc(label)}</div>
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
          ${ico} ${esc(label)}<small>Apri modulo</small>
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
      <button class="gold-btn" data-page="secret">Open Coupon Box →</button>
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
      <p class="help">Le attività recenti saranno mostrate quando configurate.</p>
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
          <thead><tr><th>Cliente</th><th>Data</th><th>Stato</th></tr></thead>
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
    if (el) el.innerHTML = `<span class="error-text">${esc(e.message)}</span>`;
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
        <input id="mediaFile" type="file" accept="image/jpeg,image/png,image/webp">
      </label>
      <button id="uploadBtn" class="gold-btn">Carica su Supabase</button>
      <p id="uploadStatus" class="help">
        JPG, PNG o WebP. Massimo 8 MB. Bucket:
        ${esc(cfg.STORAGE_BUCKET || 'nababi-media')}.
      </p>
      <img id="uploadPreview" class="preview-img" hidden alt="Anteprima immagine">
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
    status.textContent = 'Usa JPG, PNG o WebP con dimensione inferiore a 8 MB.';
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

    $('#uploadedUrl').innerHTML = `
      <p class="success-text">Caricamento completato.</p>
      <input class="search-input" id="uploadedUrlInput" readonly>
      <button class="outline-btn" id="copyUrl">Copia URL</button>
      <p class="help">Il file è nello Storage. Per visualizzarlo nella Gallery o come Logo bisogna anche salvare il relativo record nelle tabelle del sito.</p>`;

    $('#uploadedUrlInput').value = pub.publicUrl;

    $('#copyUrl').onclick = async () => {
      try {
        await navigator.clipboard.writeText(pub.publicUrl);
        status.textContent = 'URL copiato.';
      } catch (_) {
        $('#uploadedUrlInput').select();
        status.textContent = 'Seleziona e copia l’URL.';
      }
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
        <input name="name" required placeholder="Antipasti" maxlength="100">
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
            <button class="outline-btn" data-delete-category="${esc(x.id)}">Elimina</button>
          </p>
        `).join('')
      : 'Nessuna categoria.';

  } catch (e) {
    host.innerHTML = `<span class="error-text">${esc(e.message)}</span>`;
  }
}

/* MENU MANAGER */

function menuPage() {
  return `<section class="section-card">
    <div class="section-title"><h2>Aggiungi piatto</h2></div>
    <form id="dishForm" class="form-grid">
      <label class="field">Nome
        <input name="name" required maxlength="150">
      </label>
      <label class="field">Prezzo (€)
        <input name="price" type="number" min="0" step="0.01" required>
      </label>
      <label class="field">Categoria
        <input name="category" maxlength="100">
      </label>
      <label class="field">Descrizione
        <textarea name="description"></textarea>
      </label>
      <label class="field">Foto del piatto
        <input name="image" type="file" accept="image/jpeg,image/png,image/webp">
      </label>
      <label class="field">Disponibile
        <select name="is_available">
          <option value="true">Sì</option>
          <option value="false">No</option>
        </select>
      </label>
      <div><button class="gold-btn">Salva piatto</button></div>
    </form>
    <p id="dishStatus" class="help" aria-live="polite"></p>
  </section>
  <section class="section-card">
    <h2>Menu Items</h2>
    <div id="dishList" class="help">Caricamento…</div>
  </section>`;
}

async function dishLoad() {
  const host = $('#dishList');
  if (!host) return;

  try {
    const {data,error} = await db
      .from('menu_items')
      .select('*')
      .limit(100);

    if (error) throw error;

    host.innerHTML = data?.length
      ? `<div class="table-scroll"><table class="data-table">
          <thead><tr><th>Nome</th><th>Prezzo</th><th>Categoria</th><th>Disponibile</th></tr></thead>
          <tbody>${data.map(x => `
            <tr>
              <td>${esc(x.name)}</td>
              <td>€${esc(x.price)}</td>
              <td>${esc(x.category)}</td>
              <td>${x.is_available ? 'Sì' : 'No'}</td>
            </tr>
          `).join('')}</tbody>
        </table></div>`
      : 'Nessun piatto inserito.';

  } catch (e) {
    host.innerHTML = `<span class="error-text">${esc(e.message)}</span>`;
  }
}

/* STAFF MANAGEMENT */

function permissionOptions(selected = {}) {
  const permissions = permissionObject(selected);

  return MODULES.map(([id,,label]) => `
    <label class="field" style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" name="perm" value="${esc(id)}"
        ${permissions[id] ? 'checked' : ''} style="width:auto">
      ${esc(label)}
    </label>
  `).join('');
}

function staffPage() {
  return `<section class="section-card">
    <div class="section-title"><h2>Nuovo Staff Account</h2></div>
    <p class="help">
      L’account viene creato tramite la Edge Function protetta di Supabase.
    </p>
    <form id="staffForm" class="form-grid">
      <label class="field">Staff Name
        <input name="full_name" required maxlength="120">
      </label>
      <label class="field">Email
        <input name="email" type="email" required>
      </label>
      <label class="field">Phone
        <input name="phone" type="tel">
      </label>
      <label class="field">Password (minimo 10 caratteri)
        <input name="password" type="password" minlength="10"
          autocomplete="new-password" required>
      </label>
      <div class="field" style="grid-column:1/-1">
        <b>Permessi dei moduli</b>
        <div class="form-grid">${permissionOptions()}</div>
      </div>
      <div>
        <button id="createStaffBtn" class="gold-btn">Create Staff Account</button>
      </div>
    </form>
    <p id="staffStatus" class="help" aria-live="polite"></p>
  </section>
  <section class="section-card">
    <div class="section-title"><h2>Staff Accounts</h2></div>
    <div id="staffList">Loading…</div>
  </section>`;
}

async function staffLoad() {
  const host = $('#staffList');
  if (!host) return;

  try {
    const {data,error} = await db
      .from('staff')
      .select('id,full_name,email,phone,role,auth_user_id,permissions,is_active');

    if (error) throw error;

    host.innerHTML = data?.length
      ? data.map(x => {
          const permissions = permissionObject(x.permissions);

          const checks = MODULES.map(([id,,label]) => `
            <label class="field" style="display:flex;gap:8px;align-items:center">
              <input type="checkbox"
                data-edit-perm="${esc(id)}"
                data-staff-id="${esc(x.id)}"
                ${permissions[id] ? 'checked' : ''}
                style="width:auto">
              ${esc(label)}
            </label>
          `).join('');

          return `<article class="section-card">
            <b>${esc(x.full_name || 'Staff')}</b>
            <p>${esc(x.email || 'No email')}</p>
            <p class="help">${esc(x.phone || 'No phone')} · ${esc(x.role || 'Staff')}</p>
            <p class="help">${x.auth_user_id ? 'Auth account linked' : 'Auth account not linked'}</p>
            <p><b>Status:</b> ${x.is_active === true ? 'Active' : 'Disabled'}</p>

            <details>
              <summary>Manage module permissions</summary>
              <div class="form-grid">${checks}</div>
              <button class="gold-btn" data-save-perms="${esc(x.id)}">Save Permissions</button>
            </details>

            <details>
              <summary>Reset Staff Password</summary>
              ${x.auth_user_id ? `
                <label class="field">New Password (minimum 10 characters)
                  <input type="password" minlength="10"
                    autocomplete="new-password"
                    data-reset-password="${esc(x.id)}">
                </label>
                <button class="gold-btn" data-reset-staff="${esc(x.id)}">
                  Update Password
                </button>
              ` : '<p class="help">No linked Auth account.</p>'}
            </details>

            <p class="help">Current permissions: ${
              esc(Object.keys(permissions).filter(k => permissions[k]).join(', ') || 'None')
            }</p>

            <button class="outline-btn"
              data-toggle-staff="${esc(x.id)}"
              data-active="${x.is_active===true?'true':'false'}">
              ${x.is_active===true?'Disable':'Enable'}
            </button>

            <button class="outline-btn" data-remove-staff="${esc(x.id)}">
              Remove Staff Link
            </button>
          </article>`;
        }).join('')
      : '<p class="empty-state">No staff accounts found.</p>';

  } catch (e) {
    host.innerHTML = `<span class="error-text">${esc(e.message)}</span>`;
  }
}

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
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const phone = String(fd.get('phone') || '').trim();
  const password = String(fd.get('password') || '');

  const permissions = {};
  MODULES.forEach(([id]) => {
    permissions[id] = fd.getAll('perm').includes(id);
  });

  if (!full_name || !email || password.length < 10) {
    status.textContent = 'Name, email and a password of at least 10 characters are required.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating account…';
  status.textContent = 'Creating Staff account…';

  try {
    const {data,error} = await db.functions.invoke('create-staff-account', {
      body:{
        full_name,
        email,
        phone:phone || null,
        password,
        permissions
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    status.textContent = data?.message || 'Staff account created successfully.';
    form.reset();
    await staffLoad();

  } catch (err) {
    status.textContent = err.message || 'Creation failed.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Staff Account';
  }
}

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

  const {data,error} = await db.functions.invoke('reset-staff-password', {
    body:{staff_id:id,password}
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  input.value = '';
  alert(data?.message || 'Password updated successfully.');
}

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

async function removeStaffLink(id) {
  if (userRole !== 'admin') {
    throw new Error('Only Super Admin can remove a Staff link.');
  }

  if (!confirm('Remove this Staff link? The Auth user itself will not be deleted.')) {
    return;
  }

  const {error} = await db
    .from('staff')
    .update({
      auth_user_id:null,
      permissions:{},
      is_active:false
    })
    .eq('id',id);

  if (error) throw error;
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
        Ogni persona deve selezionare il proprio nome e inserire il
        proprio PIN personale.
      </p>

      <div style="text-align:center;padding:20px">
        <img
          src="${STAFF_QR_IMAGE}"
          alt="Nababi Staff Attendance QR Code"
          style="width:280px;max-width:100%;height:auto;background:white;padding:10px;border-radius:12px"
        >

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

      $('#staffForm').onsubmit = async e => {
        try {
          await createStaff(e);
        } catch (err) {
          $('#staffStatus').textContent = err.message;
        }
      };
      return;
    }
   if (id === 'attendance') {
    host.innerHTML = await attendancePage();
     return;
}
    if (id === 'logo' || id === 'gallery') {
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

        const name = String(new FormData(e.target).get('name') || '').trim();
        if (!name) return;

        const {error} = await db.from('categories').insert({name});

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
      await dishLoad();

      $('#dishForm').onsubmit = async e => {
        e.preventDefault();

        const fd = new FormData(e.target);
        const status = $('#dishStatus');
        const submit = e.target.querySelector('button[type="submit"],button:not([type])');

        if (submit) submit.disabled = true;

        try {
          let image_url = null;
          const file = fd.get('image');

          if (file?.size) {
            if (!['image/jpeg','image/png','image/webp'].includes(file.type) ||
                file.size > 8 * 1024 * 1024) {
              throw new Error('Usa JPG, PNG o WebP con dimensione inferiore a 8 MB.');
            }

            const ext = file.type === 'image/png' ? 'png'
              : file.type === 'image/webp' ? 'webp' : 'jpg';

            const path = `menu/${Date.now()}.${ext}`;
            const bucket = cfg.STORAGE_BUCKET || 'nababi-media';

            const {data,error} = await db.storage
              .from(bucket)
              .upload(path,file,{contentType:file.type});

            if (error) throw error;

            image_url = db.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
          }

          const payload = {
            name:String(fd.get('name') || '').trim(),
            price:Number(fd.get('price')),
            category:String(fd.get('category') || '').trim() || null,
            description:String(fd.get('description') || '').trim() || null,
            is_available:fd.get('is_available') === 'true'
          };

          if (image_url) payload.image_url = image_url;

          if (!payload.name || !Number.isFinite(payload.price) || payload.price < 0) {
            throw new Error('Controlla il nome e il prezzo del piatto.');
          }

          const {error} = await db.from('menu_items').insert(payload);
          if (error) throw error;

          status.textContent = 'Piatto salvato.';
          e.target.reset();
          await dishLoad();

        } catch (err) {
          status.textContent = err.message || 'Salvataggio non riuscito.';
        } finally {
          if (submit) submit.disabled = false;
        }
      };
      return;
    }

    const body = await genericTable(id);

    host.innerHTML = `<section class="section-card">
      <div class="section-title">
        <h2>${esc(moduleInfo(id))}</h2>
        <span class="help">${esc(descriptions[id] || 'Gestione Nababi')}</span>
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

      if (uploadButton) uploadButton.onclick = uploadHandler;
    }

  } catch (err) {
    host.innerHTML = `<section class="section-card">
      <h2>${esc(moduleInfo(id))}</h2>
      <p class="error-text">${esc(err.message || 'Errore durante il caricamento.')}</p>
    </section>`;
  }
}

async function genericTable(id) {
  const table = tableMap[id];
  if (!table) {
    return '<div class="empty-state">Modulo pronto per configurazione.</div>';
  }

  try {
    const {data,error} = await db.from(table).select('*').limit(50);
    if (error) throw error;

    if (!data?.length) {
      return `<div class="empty-state">Nessun record trovato nella tabella <b>${esc(table)}</b>.</div>`;
    }

    const cols = Object.keys(data[0]).slice(0,5);

    return `<div class="table-scroll"><table class="data-table">
      <thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${data.map(row => `
        <tr>${cols.map(c => `<td>${esc(
          typeof row[c] === 'object' ? JSON.stringify(row[c]) : row[c]
        )}</td>`).join('')}</tr>
      `).join('')}</tbody>
    </table></div>`;

  } catch (e) {
    return `<div class="empty-state">
      <span class="error-text">${esc(e.message)}</span>
      <p class="help">La tabella ${esc(table)} potrebbe non essere disponibile o accessibile.</p>
    </div>`;
  }
}

/* EVENT LISTENERS */

$('#loginForm').addEventListener('submit',signIn);

$('#sideNav').addEventListener('click',e => {
  const button = e.target.closest('[data-page]');
  if (button) render(button.dataset.page);
});

$('#pageContent').addEventListener('click',async e => {
   try {
 
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
    }

  } catch (err) {
    alert(err.message || 'Operation failed.');
  }
});

$('#menuToggle').onclick = () => $('#sidebar').classList.toggle('open');
$('#mobileMore').onclick = () => $('#sidebar').classList.toggle('open');

$('#mobileNav').addEventListener('click',e => {
  const button = e.target.closest('[data-page]');
  if (button) render(button.dataset.page);
});

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
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
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

    showLoginMessage(e.message || 'Sessione non valida.');

    try {
      await db.auth.signOut();
    } catch (_) {}
  }


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
        window.onload = () => {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);
