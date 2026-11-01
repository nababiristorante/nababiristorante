
(()=>{
'use strict';

const cfg = window.NABABI_CONFIG || {};
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
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

const MODULES = menu.filter(([id]) => !['dashboard','staff'].includes(id));
let db = null;
let current = 'dashboard';
let sessionUser = null;
let userRole = 'guest';
let staffPermissions = [];

function canSee(id) {
  return userRole === 'admin' ||
    (id === 'dashboard' && userRole === 'staff') ||
    (userRole === 'staff' && staffPermissions.includes(id));
}

function moduleInfo(id) {
  return menu.find(x => x[0] === id)?.[2] || 'Dashboard';
}

function nav() {
  const visible = menu.filter(([id]) => canSee(id));
  $('#sideNav').innerHTML = visible.map(([id,ico,label]) =>
    `<button class="nav-btn ${id===current?'active':''}" data-page="${id}">
      <span class="ico">${ico}</span>${esc(label)}
    </button>`
  ).join('');

  $('#mobileNav').querySelectorAll('[data-page]').forEach(b => {
    b.hidden = !canSee(b.dataset.page);
  });
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
  sessionUser = user;

  const {data:admin,error:adminErr} = await db
    .from('admin_users')
    .select('user_id')
    .eq('user_id',user.id)
    .maybeSingle();

  if (adminErr) throw adminErr;

  if (admin) {
    userRole = 'admin';
    staffPermissions = MODULES.map(x => x[0]);
    return true;
  }

  const {data:staff,error} = await db
    .from('staff')
    .select('id,auth_user_id,permissions,is_active')
    .eq('auth_user_id',user.id)
    .maybeSingle();

  if (error) throw new Error('Verifica Staff: ' + error.message);

  if (!staff || staff.is_active !== true) {
    throw new Error(
      'Questo account non è autorizzato. Chiedi al Super Admin di attivare il tuo accesso.'
    );
  }

  userRole = 'staff';
  staffPermissions = Array.isArray(staff.permissions)
    ? staff.permissions.filter(p => MODULES.some(m => m[0] === p))
    : [];

  return true;
}

async function signIn(e) {
  e.preventDefault();

  const btn = $('#loginBtn');
  const out = $('#loginMessage');
  out.textContent = '';

  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    out.textContent = 'Configurazione Supabase mancante. Controlla assets/js/config.js.';
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
      email: $('#email').value.trim(),
      password: $('#password').value
    });

    if (error) throw error;

    await verifyAdmin(data.user);
    openApp(data.user.email);

  } catch (err) {
    out.textContent = err.message || 'Accesso non riuscito.';
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
  } catch (e) {
    return '—';
  }
}

async function dashboard() {
  // Staff dashboard: no global statistics or queries across unrelated modules.
  if (userRole === 'staff') {
    const shortcuts = menu
      .filter(([id]) => id !== 'dashboard' && canSee(id))
      .map(([id,ico,label]) =>
        `<button class="quick-btn" data-page="${id}">
          ${ico} ${esc(label)}
          <small>Apri modulo</small>
        </button>`
      ).join('');

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
        ${shortcuts || '<p class="help">Nessun modulo assegnato. Contatta il Super Admin.</p>'}
      </div>
    </section>`;
  }

  const [
    visits,clicks,gallery,coupons,bookings,reviews,staff
  ] = await Promise.all([
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
      ].map(x => `<button class="quick-btn" data-page="${x[0]}">
        ${x[1]}<small>${x[2]}</small>
      </button>`).join('')}
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
      <p class="help">Le attività recenti saranno mostrate quando la tabella activity è configurata.</p>
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
          <tbody>${data.map(x => `<tr>
            <td>${esc(x.name || x.customer_name || x.full_name || '—')}</td>
            <td>${esc(x.booking_date || x.date || '—')}</td>
            <td><span class="tag">${esc(x.status || 'Nuovo')}</span></td>
          </tr>`).join('')}</tbody>
        </table></div>`
      : '<div class="empty-state">Nessuna prenotazione trovata.</div>';

  } catch (e) {
    const el = $('#recentBookings');
    if (el) el.innerHTML = `<span class="error-text">${esc(e.message)}</span>`;
  }
}

function uploadPanel(kind) {
  return `<section class="section-card">
    <div class="section-title">
      <h2>Carica ${kind==='logo'?'Logo':'immagini'}</h2>
    </div>
    <div class="upload-box">
      <label class="field">Scegli foto dal telefono
        <input id="mediaFile" type="file" accept="image/*" capture="environment">
      </label>
      <button id="uploadBtn" class="gold-btn">Carica su Supabase</button>
      <p id="uploadStatus" class="help">
        Formato consigliato: JPG, PNG o WebP. Bucket:
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

  if (!file.type.startsWith('image/')) {
    status.textContent = 'Seleziona un file immagine.';
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    status.textContent = 'La foto deve essere inferiore a 8 MB.';
    return;
  }

  btn.disabled = true;
  status.textContent = 'Caricamento…';

  try {
    const ext = (file.name.split('.').pop() || 'jpg')
      .toLowerCase().replace(/[^a-z0-9]/g,'');

    const path = `${current}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const {data,error} = await db.storage
      .from(cfg.STORAGE_BUCKET || 'nababi-media')
      .upload(path,file,{
        cacheControl:'3600',
        upsert:false,
        contentType:file.type
      });

    if (error) throw error;

    const {data:pub} = db.storage
      .from(cfg.STORAGE_BUCKET || 'nababi-media')
      .getPublicUrl(data.path);

    $('#uploadedUrl').innerHTML = `
      <p class="success-text">Caricamento completato.</p>
      <input class="search-input" readonly value="${esc(pub.publicUrl)}">
      <button class="outline-btn" id="copyUrl">Copia URL</button>`;

    $('#copyUrl').onclick = () =>
      navigator.clipboard?.writeText(pub.publicUrl);

    status.textContent = 'Foto salvata. URL pronto da copiare.';

  } catch (e) {
    status.innerHTML = `<span class="error-text">${esc(e.message)}.
      Verifica bucket e policy Storage.</span>`;
  } finally {
    btn.disabled = false;
  }
}

function categoryPage() {
  return `<section class="section-card">
    <div class="section-title"><h2>Nuova categoria</h2></div>
    <form id="categoryForm" class="form-grid">
      <label class="field">Nome categoria
        <input name="name" required placeholder="Antipasti">
      </label>
      <div style="align-self:end">
        <button class="gold-btn">Salva categoria</button>
      </div>
    </form>
    <div id="categoryList" class="help">Caricamento…</div>
  </section>`;
}

async function categoryLoad() {
  try {
    const {data,error} = await db
      .from('categories').select('*').order('name');

    if (error) throw error;

    $('#categoryList').innerHTML = data?.length
      ? data.map(x => `<p>• ${esc(x.name)}
          <button class="outline-btn" data-delete-category="${esc(x.id)}">Elimina</button>
        </p>`).join('')
      : 'Nessuna categoria.';

  } catch (e) {
    $('#categoryList').innerHTML =
      `<span class="error-text">${esc(e.message)}</span>`;
  }
}

function menuPage() {
  return `<section class="section-card">
    <div class="section-title"><h2>Aggiungi piatto</h2></div>
    <form id="dishForm" class="form-grid">
      <label class="field">Nome<input name="name" required></label>
      <label class="field">Prezzo (€)
        <input name="price" type="number" min="0" step="0.01" required>
      </label>
      <label class="field">Categoria<input name="category"></label>
      <label class="field">Descrizione<textarea name="description"></textarea></label>
      <label class="field">Foto del piatto
        <input name="image" type="file" accept="image/*">
      </label>
      <label class="field">Disponibile
        <select name="is_available">
          <option value="true">Sì</option>
          <option value="false">No</option>
        </select>
      </label>
      <div><button class="gold-btn">Salva piatto</button></div>
    </form>
    <p id="dishStatus" class="help"></p>
  </section>
  <section class="section-card">
    <h2>Menu Items</h2>
    <div id="dishList" class="help">Caricamento…</div>
  </section>`;
}

async function dishLoad() {
  try {
    const {data,error} = await db
      .from('menu_items')
      .select('*')
      .order('created_at',{ascending:false})
      .limit(100);

    if (error) throw error;

    $('#dishList').innerHTML = data?.length
      ? `<div class="table-scroll"><table class="data-table">
          <thead><tr><th>Nome</th><th>Prezzo</th><th>Categoria</th><th>Disponibile</th></tr></thead>
          <tbody>${data.map(x => `<tr>
            <td>${esc(x.name)}</td>
            <td>€${esc(x.price)}</td>
            <td>${esc(x.category)}</td>
            <td>${x.is_available?'Sì':'No'}</td>
          </tr>`).join('')}</tbody>
        </table></div>`
      : 'Nessun piatto inserito.';

  } catch (e) {
    $('#dishList').innerHTML =
      `<span class="error-text">${esc(e.message)}</span>`;
  }
}

async function genericTable(id) {
  const table = tableMap[id];
  if (!table) return '<div class="empty-state">Modulo pronto per configurazione.</div>';

  try {
    const {data,error} = await db.from(table).select('*').limit(50);
    if (error) throw error;

    if (!data?.length) {
      return `<div class="empty-state">Nessun record trovato nella tabella <b>${esc(table)}</b>.</div>`;
    }

    const cols = Object.keys(data[0]).slice(0,5);

    return `<div class="table-scroll"><table class="data-table">
      <thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${data.map(row => `<tr>
        ${cols.map(c => `<td>${esc(row[c])}</td>`).join('')}
      </tr>`).join('')}</tbody>
    </table></div>`;

  } catch (e) {
    return `<div class="empty-state">
      <span class="error-text">${esc(e.message)}</span>
      <p class="help">La tabella “${esc(table)}” o le relative colonne potrebbero non essere presenti. Nessun dato è stato modificato.</p>
    </div>`;
  }
}

/* ---------------- STAFF MANAGEMENT ---------------- */

function staffPage() {
  const opts = MODULES.map(([id,,label]) => `
    <label class="field" style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" name="perm" value="${esc(id)}" style="width:auto">
      ${esc(label)}
    </label>
  `).join('');

  return `<section class="section-card">
    <div class="section-title"><h2>Nuovo Staff Account</h2></div>
    <p class="help">
      Inserisci il nome e l'email del collaboratore. Supabase invierà
      un invito email. Seleziona soltanto i moduli che potrà utilizzare.
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
      <div class="field" style="grid-column:1/-1">
        <b>Permessi dei moduli</b>
        <div class="form-grid">${opts}</div>
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
      .select('id,full_name,email,phone,role,auth_user_id,permissions,is_active')
      .order('created_at',{ascending:false});

    if (error) throw error;

    host.innerHTML = data?.length
      ? data.map(x => {
          const permissions = Array.isArray(x.permissions)
            ? x.permissions : [];

          const checks = MODULES.map(([id,,label]) => `
            <label class="field" style="display:flex;gap:8px;align-items:center">
              <input type="checkbox"
                data-edit-perm="${esc(id)}"
                data-staff-id="${esc(x.id)}"
                ${permissions.includes(id)?'checked':''}
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
              <button class="gold-btn" data-save-perms="${esc(x.id)}">
                Save Permissions
              </button>
            </details>

            <p class="help">
              Current permissions: ${esc(permissions.join(', ') || 'None')}
            </p>

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
  const permissions = fd.getAll('perm').filter(p =>
    MODULES.some(m => m[0] === p)
  );

  if (!full_name || !email) {
    status.textContent = 'Nome ed email sono obbligatori.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating account…';
  status.textContent = 'Invio invito in corso…';

  try {
    const {data,error} = await db.functions.invoke(
      'create-staff-account',
      {
        body: {
          full_name,
          email,
          phone: phone || null,
          permissions
        }
      }
    );

    if (error) throw error;

    if (data?.error) throw new Error(data.error);

    status.textContent =
      data?.message || 'Staff account creato. Controlla l’email di invito.';

    form.reset();
    await staffLoad();

  } catch (err) {
    status.textContent =
      err.message || 'Creazione account non riuscita.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Staff Account';
  }
}

async function savePermissions(staffId) {
  const boxes = document.querySelectorAll(
    `[data-staff-id="${CSS.escape(String(staffId))}"][data-edit-perm]`
  );

  const permissions = [...boxes]
    .filter(b => b.checked)
    .map(b => b.dataset.editPerm);

  const {error} = await db
    .from('staff')
    .update({permissions})
    .eq('id',staffId);

  if (error) throw error;

  await staffLoad();
  alert('Staff permissions updated.');
}

async function toggleStaff(id,currentlyActive) {
  const {error} = await db
    .from('staff')
    .update({is_active: currentlyActive !== true})
    .eq('id',id);

  if (error) throw error;

  await staffLoad();
}

async function removeStaffLink(id) {
  const confirmed = confirm(
    'Remove this Staff link? The Auth user itself will not be deleted.'
  );

  if (!confirmed) return;

  const {error} = await db
    .from('staff')
    .update({
      auth_user_id:null,
      permissions:[],
      is_active:false
    })
    .eq('id',id);

  if (error) throw error;

  await staffLoad();
}

/* ---------------- MODULE RENDERING ---------------- */

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

  if (id === 'logo' || id === 'gallery') {
    host.innerHTML = uploadPanel(id);

    $('#mediaFile').onchange = () => {
      const f = $('#mediaFile').files[0];
      if (f) {
        const img = $('#uploadPreview');
        img.src = URL.createObjectURL(f);
        img.hidden = false;
      }
    };

    $('#uploadBtn').onclick = uploadHandler;
    return;
  }

  if (id === 'categories') {
    host.innerHTML = categoryPage();
    categoryLoad();

    $('#categoryForm').onsubmit = async e => {
      e.preventDefault();
      const name = new FormData(e.target).get('name');

      const {error} = await db.from('categories').insert({name});

      if (error) alert(error.message);
      else {
        e.target.reset();
        categoryLoad();
      }
    };

    host.onclick = async e => {
      const categoryId = e.target.dataset.deleteCategory;

      if (categoryId && confirm('Eliminare questa categoria?')) {
        const {error} = await db
          .from('categories')
          .delete()
          .eq('id',categoryId);

        if (error) alert(error.message);
        else categoryLoad();
      }
    };

    return;
  }

  if (id === 'menu_manager') {
    host.innerHTML = menuPage();
    dishLoad();

    $('#dishForm').onsubmit = async e => {
      e.preventDefault();

      const fd = new FormData(e.target);
      let image_url = null;
      const file = fd.get('image');

      try {
        if (file?.size) {
          const ext = file.name.split('.').pop();
          const path = `menu/${Date.now()}.${ext}`;

          const {data,error} = await db.storage
            .from(cfg.STORAGE_BUCKET || 'nababi-media')
            .upload(path,file,{contentType:file.type});

          if (error) throw error;

          image_url = db.storage
            .from(cfg.STORAGE_BUCKET || 'nababi-media')
            .getPublicUrl(data.path).data.publicUrl;
        }

        const payload = {
          name:fd.get('name'),
          price:Number(fd.get('price')),
          category:fd.get('category') || null,
          description:fd.get('description') || null,
          is_available:fd.get('is_available') === 'true'
        };

        if (image_url) payload.image_url = image_url;

        const {error} = await db.from('menu_items').insert(payload);
        if (error) throw error;

        $('#dishStatus').textContent = 'Piatto salvato.';
        e.target.reset();
        dishLoad();

      } catch (err) {
        $('#dishStatus').innerHTML =
          `<span class="error-text">${esc(err.message)}</span>`;
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
        Il pannello mostra i dati disponibili. Per aggiungere o modificare
        completamente questo modulo bisogna verificare le colonne reali
        della tabella Supabase.
      </p>
      ${id==='secret' || id==='news' ? uploadPanel('gallery') : ''}
    </section>` : ''}`;

  if (id === 'secret' || id === 'news') {
    const b = $('#uploadBtn');
    if (b) b.onclick = uploadHandler;
  }
}

/* ---------------- EVENT LISTENERS ---------------- */

$('#loginForm').addEventListener('submit',signIn);

$('#sideNav').addEventListener('click',e => {
  const b = e.target.closest('[data-page]');
  if (b) render(b.dataset.page);
});

$('#pageContent').addEventListener('click',async e => {
  const pageButton = e.target.closest('[data-page]');
  if (pageButton) {
    render(pageButton.dataset.page);
    return;
  }

  try {
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
    }

  } catch (err) {
    alert(err.message || 'Operation failed.');
  }
});

$('#menuToggle').onclick = () =>
  $('#sidebar').classList.toggle('open');

$('#mobileMore').onclick = () =>
  $('#sidebar').classList.toggle('open');

$('#mobileNav').addEventListener('click',e => {
  const b = e.target.closest('[data-page]');
  if (b) render(b.dataset.page);
});

$('#logoutBtn').onclick = async () => {
  try {
    await db?.auth.signOut();
  } finally {
    userRole = 'guest';
    staffPermissions = [];
    sessionUser = null;
    $('#adminApp').hidden = true;
    $('#loginScreen').hidden = false;
    $('#password').value = '';
  }
};

/* ---------------- SESSION RESTORE ---------------- */

(async () => {
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    $('#loginMessage').textContent =
      'Supabase config non disponibile.';
    return;
  }

  db = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  try {
    const {data,error} = await db.auth.getSession();
    if (error) throw error;

    if (data.session) {
      await verifyAdmin(data.session.user);
      openApp(data.session.user.email);
    }

  } catch (e) {
    $('#loginMessage').textContent = e.message;
    try {
      await db.auth.signOut();
    } catch (_) {}
  }
})();

})();
