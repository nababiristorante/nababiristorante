
(()=>{
'use strict';

const cfg=window.NABABI_CONFIG||{};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const menu=[
['dashboard','▦','Dashboard'],['secret','🎁','Secret Coupon Box'],
['menu_manager','🍛','Menu Manager'],['categories','▦','Categories'],
['bookings','▣','Bookings'],['customers','♙','Customers'],
['coupons','◇','Coupons'],['staff','♟','Staff Management'],
['performance','▥','Staff Performance'],['attendance','◷','Staff Attendance'],
['activity','✦','Staff Activity Log'],['tables','▤','Tavolo'],
['gallery','▧','Gallery'],['delivery','🛵','Food Delivery'],
['social','◎','Social'],['menu_public','☷','Menu'],
['news','◈','Breaking News'],['reviews','☆','Reviews'],
['hours','◷','Hours'],['logo','♛','Logo Management'],
['reports','▤','Reports'],['contact','✉','Contact'],
['settings','⚙','Settings']
];

const tableMap={
categories:'categories',bookings:'bookings',customers:'customers',
coupons:'coupons',staff:'staff',performance:'staff_activity_logs',
attendance:'staff_attendance',activity:'staff_activity_logs',
tables:'restaurant_tables',gallery:'gallery_images',
delivery:'delivery_orders',menu_public:'menu_items',
menu_manager:'menu_items',news:'breaking_news',
reviews:'reviews',hours:'opening_hours',secret:'coupons'
};

let db=null,current='dashboard',newsRows=[];

function nav(){
 const html=menu.map(([id,ico,label])=>
 `<button class="nav-btn ${id===current?'active':''}" data-page="${id}">
 <span class="ico">${ico}</span>${label}</button>`).join('');
 $('#sideNav').innerHTML=html;
}

function openApp(email){
 $('#loginScreen').hidden=true;
 $('#adminApp').hidden=false;
 $('#adminEmail').textContent=email||'Admin';
 nav();
 render('dashboard');
}

async function verifyAdmin(user){
 if(!cfg.ADMIN_USER_ID) throw new Error('ADMIN_USER_ID non configurato.');
 if(user.id!==cfg.ADMIN_USER_ID){
  const {data,error}=await db.from('admin_users')
   .select('user_id').eq('user_id',user.id).maybeSingle();
  if(error) throw new Error('Admin verification: '+error.message);
  if(!data) throw new Error('Questo account non è autorizzato come admin.');
 }
 return true;
}

async function signIn(e){
 e.preventDefault();
 const btn=$('#loginBtn'),out=$('#loginMessage');
 out.textContent='';
 if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){
  out.textContent='Configurazione Supabase mancante.';
  return;
 }
 btn.disabled=true;
 btn.textContent='Accesso in corso…';
 try{
  db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  const {data,error}=await db.auth.signInWithPassword({
   email:$('#email').value.trim(),
   password:$('#password').value
  });
  if(error) throw error;
  await verifyAdmin(data.user);
  openApp(data.user.email);
 }catch(err){
  out.textContent=err.message||'Accesso non riuscito.';
 }finally{
  btn.disabled=false;
  btn.textContent='Accedi';
 }
}

function statCard(icon,label,value){
 return `<article class="stat-card">
 <div class="stat-top"><span class="stat-icon">${icon}</span>${label}</div>
 <strong>${value}</strong></article>`;
}

async function count(table){
 try{
  const {count,error}=await db.from(table).select('*',{count:'exact',head:true});
  if(error) throw error;
  return count??0;
 }catch(e){return '—';}
}

async function dashboard(){
 const [visits,clicks,gallery,coupons,bookings,reviews,staff]=
 await Promise.all([
  count('website_analytics'),count('menu_items'),count('gallery_images'),
  count('coupon_redemptions'),count('bookings'),count('reviews'),count('staff')
 ]);
 return `<section class="hero-card"><div>
 <p class="eyebrow">OFFERTE ESCLUSIVE</p>
 <h2>♛ Secret Coupon Box 🔒</h2>
 <p>Special discounts, exclusive offers & more!</p>
 <button class="gold-btn" data-page="secret">Open Coupon Box →</button>
 </div><div class="hero-art">🎁 🍛</div></section>
 <div class="stats-grid">
 ${statCard('◉','Website Visits',visits)}
 ${statCard('♜','Menu Items',clicks)}
 ${statCard('▧','Gallery Images',gallery)}
 ${statCard('◇','Coupons Used',coupons)}
 ${statCard('▣','Total Bookings',bookings)}
 ${statCard('☆','Total Reviews',reviews)}
 ${statCard('▤','Reports','—')}
 ${statCard('♟','Staff Members',staff)}
 </div>
 <section class="section-card">
 <div class="section-title"><h2>⚡ Quick Actions</h2><span class="help">View all</span></div>
 <div class="quick-grid">
 <button class="quick-btn" data-page="menu_manager">▧ Add Menu Item<small>＋ Add dish</small></button>
 <button class="quick-btn" data-page="bookings">▣ New Booking<small>＋ View bookings</small></button>
 <button class="quick-btn" data-page="coupons">◇ Create Coupon<small>＋ Manage offers</small></button>
 <button class="quick-btn" data-page="staff">♟ Manage Staff<small>＋ Staff members</small></button>
 </div></section>
 <div class="two-col">
 <section class="section-card">
 <div class="section-title"><h2>▣ Recent Bookings</h2>
 <button class="outline-btn" data-page="bookings">View All</button></div>
 <div id="recentBookings" class="help">Loading bookings…</div>
 </section>
 <section class="section-card"><div class="section-title"><h2>♟ Recent Activity</h2></div>
 <p class="help">Le attività recenti saranno mostrate quando la tabella activity è configurata.</p>
 </section></div>`;
}

async function loadRecent(){
 try{
  const {data,error}=await db.from('bookings').select('*')
   .order('created_at',{ascending:false}).limit(5);
  if(error) throw error;
  const el=$('#recentBookings');
  if(!el)return;
  el.innerHTML=data?.length?
   `<div class="table-scroll"><table class="data-table">
   <thead><tr><th>Cliente</th><th>Data</th><th>Stato</th></tr></thead>
   <tbody>${data.map(x=>`<tr>
   <td>${esc(x.full_name||'—')}</td>
   <td>${esc(x.booking_date||'—')}</td>
   <td><span class="tag">${esc(x.status||'Nuovo')}</span></td>
   </tr>`).join('')}</tbody></table></div>`:
   '<div class="empty-state">Nessuna prenotazione trovata.</div>';
 }catch(e){
  const el=$('#recentBookings');
  if(el)el.innerHTML=`<span class="error-text">${esc(e.message)}</span>`;
 }
}

function moduleInfo(id){
 const found=menu.find(x=>x[0]===id);
 return found?found[2]:'Dashboard';
}

const descriptions={
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
logo:'Carica il logo del ristorante dal tuo iPhone.',
reports:'Statistiche e report del ristorante.',
contact:'Informazioni di contatto del ristorante.',
settings:'Impostazioni generali del sito.'
};

function uploadPanel(kind){
 return `<section class="section-card">
 <div class="section-title"><h2>Carica ${kind==='logo'?'Logo':'immagini'}</h2></div>
 <div class="upload-box">
 <label class="field">Scegli foto dal telefono
 <input id="mediaFile" type="file" accept="image/*" multiple>
 <button id="uploadBtn" class="gold-btn">Carica su Supabase</button>
 <p id="uploadStatus" class="help">Formato JPG, PNG o WebP. Bucket: ${esc(cfg.STORAGE_BUCKET||'nababi-media')}.</p>
 <img id="uploadPreview" class="preview-img" hidden alt="Anteprima immagine">
 <div id="uploadedUrl"></div>
 </div></section>`;
}

async function uploadHandler(){
 const input=$('#mediaFile'),btn=$('#uploadBtn'),
 status=$('#uploadStatus'),file=input?.files?.[0];
 if(!file){status.textContent='Seleziona prima una foto.';return;}
 if(!file.type.startsWith('image/')){status.textContent='Seleziona un file immagine.';return;}
 if(file.size>8*1024*1024){status.textContent='La foto deve essere inferiore a 8 MB.';return;}
 btn.disabled=true;status.textContent='Caricamento…';
 try{
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
  const path=`${current}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const {data,error}=await db.storage.from(cfg.STORAGE_BUCKET||'nababi-media')
   .upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
  if(error)throw error;
  const pub=db.storage.from(cfg.STORAGE_BUCKET||'nababi-media').getPublicUrl(data.path).data.publicUrl;
  $('#uploadedUrl').innerHTML=`<p class="success-text">Caricamento completato.</p>
  <input class="search-input" readonly value="${esc(pub)}">
  <button class="outline-btn" id="copyUrl">Copia URL</button>`;
  $('#copyUrl').onclick=()=>navigator.clipboard?.writeText(pub);
  status.textContent='Foto salvata. URL pronto da copiare.';
 }catch(e){
  status.innerHTML=`<span class="error-text">${esc(e.message)}. Verifica bucket e policy Storage.</span>`;
 }finally{btn.disabled=false;}
}

function categoryPage(){
 return `<section class="section-card"><div class="section-title"><h2>Nuova categoria</h2></div>
 <form id="categoryForm" class="form-grid">
 <label class="field">Nome categoria<input name="name" required placeholder="Antipasti"></label>
 <div style="align-self:end"><button class="gold-btn">Salva categoria</button></div>
 </form><div id="categoryList" class="help">Caricamento…</div></section>`;
}

async function categoryLoad(){
 try{
  const {data,error}=await db.from('categories').select('*').order('name');
  if(error)throw error;
  $('#categoryList').innerHTML=data?.length?
   data.map(x=>`<p>• ${esc(x.name)} <button class="outline-btn" data-delete-category="${esc(x.id)}">Elimina</button></p>`).join(''):
   'Nessuna categoria.';
 }catch(e){$('#categoryList').innerHTML=`<span class="error-text">${esc(e.message)}</span>`;}
}

function menuPage(){
 return `<section class="section-card"><div class="section-title"><h2>Aggiungi piatto</h2></div>
 <form id="dishForm" class="form-grid">
 <label class="field">Nome<input name="name" required></label>
 <label class="field">Prezzo (€)<input name="price" type="number" min="0" step="0.01" required></label>
 <label class="field">Categoria<input name="category"></label>
 <label class="field">Descrizione<textarea name="description"></textarea></label>
 <label class="field">Foto del piatto<input name="image" type="file" accept="image/*"></label>
 <label class="field">Disponibile<select name="is_available"><option value="true">Sì</option><option value="false">No</option></select></label>
 <div><button class="gold-btn">Salva piatto</button></div>
 </form><p id="dishStatus" class="help"></p></section>
 <section class="section-card"><h2>Menu Items</h2><div id="dishList" class="help">Caricamento…</div></section>`;
}

async function dishLoad(){
 try{
  const {data,error}=await db.from('menu_items').select('*')
   .order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  $('#dishList').innerHTML=data?.length?
   `<div class="table-scroll"><table class="data-table">
   <thead><tr><th>Nome</th><th>Prezzo</th><th>Categoria</th><th>Disponibile</th></tr></thead>
   <tbody>${data.map(x=>`<tr><td>${esc(x.name)}</td><td>€${esc(x.price)}</td><td>${esc(x.category)}</td><td>${x.is_available?'Sì':'No'}</td></tr>`).join('')}</tbody>
   </table></div>`:'Nessun piatto inserito.';
 }catch(e){$('#dishList').innerHTML=`<span class="error-text">${esc(e.message)}</span>`;}
}

/* BREAKING NEWS */
function localDateValue(value){
 if(!value)return '';
 const d=new Date(value),pad=n=>String(n).padStart(2,'0');
 return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function newsPage(){
 return `<section class="section-card">
 <div class="section-title"><h2 id="newsFormTitle">Nuova Breaking News</h2>
 <span class="help">La notizia appare solo tra inizio e fine.</span></div>
 <form id="newsForm" class="news-form">
 <input type="hidden" name="id">
 <label class="field">Titolo<input name="title" maxlength="180" required></label>
 <label class="field">Testo<textarea name="body" required></textarea></label>
 <div class="form-grid">
 <label class="field">Inizio visualizzazione<input name="starts_at" type="datetime-local" required></label>
 <label class="field">Fine visualizzazione<input name="ends_at" type="datetime-local" required></label>
 </div>
 <label class="field">URL immagine (facoltativo)<input name="image_url" type="url"></label>
 <label class="field">URL YouTube (facoltativo)<input name="youtube_url" type="url"></label>
 <label class="news-check"><input name="is_active" type="checkbox" checked> Attiva</label>
 <div class="news-actions">
 <button class="gold-btn" id="newsSaveBtn">Salva notizia</button>
 <button class="outline-btn" type="button" id="newsCancelBtn">Annulla modifica</button>
 </div>
 <p id="newsStatus" class="help" aria-live="polite"></p>
 </form></section>
 <section class="section-card">
 <div class="section-title"><h2>Notizie salvate</h2>
 <button class="outline-btn" id="newsRefreshBtn">Aggiorna</button></div>
 <div id="newsList" class="help">Caricamento…</div>
 </section>`;
}

function resetNewsForm(){
 const f=$('#newsForm');if(!f)return;
 f.reset();f.elements.id.value='';f.elements.is_active.checked=true;
 $('#newsFormTitle').textContent='Nuova Breaking News';
 $('#newsSaveBtn').textContent='Salva notizia';
}

async function newsLoad(){
 const box=$('#newsList');if(!box)return;
 box.innerHTML='Caricamento…';
 try{
  const {data,error}=await db.from('breaking_news').select('*')
   .order('created_at',{ascending:false});
  if(error)throw error;
  newsRows=data||[];
  if(!newsRows.length){box.innerHTML='<div class="empty-state">Nessuna Breaking News salvata.</div>';return;}
  box.innerHTML=`<div class="table-scroll"><table class="data-table news-table">
  <thead><tr><th>Titolo</th><th>Inizio</th><th>Fine</th><th>Attiva</th><th>Azioni</th></tr></thead>
  <tbody>${newsRows.map(n=>`<tr>
  <td>${esc(n.title)}</td>
  <td>${esc(new Date(n.starts_at).toLocaleString('it-IT'))}</td>
  <td>${esc(new Date(n.ends_at).toLocaleString('it-IT'))}</td>
  <td><span class="tag ${n.is_active?'':'pending'}">${n.is_active?'Sì':'No'}</span></td>
  <td class="news-row-actions">
  <button class="outline-btn" data-news-edit="${esc(n.id)}">Modifica</button>
  <button class="outline-btn" data-news-toggle="${esc(n.id)}" data-active="${n.is_active?'true':'false'}">${n.is_active?'Disattiva':'Attiva'}</button>
  <button class="outline-btn danger-btn" data-news-delete="${esc(n.id)}">Elimina</button>
  </td></tr>`).join('')}</tbody></table></div>`;
 }catch(e){
  box.innerHTML=`<div class="empty-state"><span class="error-text">${esc(e.message)}</span>
  <p class="help">Verifica le colonne della tabella breaking_news.</p></div>`;
 }
}

async function newsSave(e){
 e.preventDefault();
 const f=e.currentTarget,fd=new FormData(f);
 const status=$('#newsStatus'),save=$('#newsSaveBtn');
 const start=new Date(fd.get('starts_at')),end=new Date(fd.get('ends_at'));
 if(isNaN(start)||isNaN(end)||end<=start){
  status.textContent='La data/ora finale deve essere successiva a quella iniziale.';
  return;
 }
 const payload={
  title:String(fd.get('title')).trim(),
  body:String(fd.get('body')).trim(),
  starts_at:start.toISOString(),
  ends_at:end.toISOString(),
  is_active:fd.get('is_active')==='on',
  image_url:String(fd.get('image_url')||'').trim()||null,
  youtube_url:String(fd.get('youtube_url')||'').trim()||null
 };
 if(!payload.title||!payload.body){status.textContent='Inserisci titolo e testo.';return;}
 save.disabled=true;status.textContent='Salvataggio…';
 try{
  const id=fd.get('id');
  const result=id?
   await db.from('breaking_news').update(payload).eq('id',id):
   await db.from('breaking_news').insert(payload);
  if(result.error)throw result.error;
  status.textContent='Breaking News salvata.';
  resetNewsForm();
  await newsLoad();
 }catch(err){status.textContent='Errore: '+err.message;}
 finally{save.disabled=false;}
}

async function newsAction(e){
 const edit=e.target.closest('[data-news-edit]');
 const toggle=e.target.closest('[data-news-toggle]');
 const del=e.target.closest('[data-news-delete]');
 if(edit){
  const n=newsRows.find(x=>String(x.id)===edit.dataset.newsEdit);
  if(!n)return;
  const f=$('#newsForm');
  f.elements.id.value=n.id;
  f.elements.title.value=n.title||'';
  f.elements.body.value=n.body||'';
  f.elements.starts_at.value=localDateValue(n.starts_at);
  f.elements.ends_at.value=localDateValue(n.ends_at);
  f.elements.image_url.value=n.image_url||'';
  f.elements.youtube_url.value=n.youtube_url||'';
  f.elements.is_active.checked=!!n.is_active;
  $('#newsFormTitle').textContent='Modifica Breaking News';
  $('#newsSaveBtn').textContent='Aggiorna notizia';
  f.scrollIntoView({behavior:'smooth',block:'start'});
  return;
 }
 if(toggle){
  const id=toggle.dataset.newsToggle,active=toggle.dataset.active!=='true';
  toggle.disabled=true;
  try{
   const {error}=await db.from('breaking_news').update({is_active:active}).eq('id',id);
   if(error)throw error;
   await newsLoad();
  }catch(err){alert('Errore: '+err.message);toggle.disabled=false;}
  return;
 }
 if(del){
  if(!confirm('Eliminare definitivamente questa Breaking News?'))return;
  del.disabled=true;
  try{
   const {error}=await db.from('breaking_news').delete().eq('id',del.dataset.newsDelete);
   if(error)throw error;
   await newsLoad();
  }catch(err){alert('Errore: '+err.message);del.disabled=false;}
 }
}

async function genericTable(id){
 const table=tableMap[id];if(!table)return '<div class="empty-state">Modulo pronto per configurazione.</div>';
 try{
  const {data,error}=await db.from(table).select('*').limit(50);
  if(error)throw error;
  if(!data?.length)return `<div class="empty-state">Nessun record trovato nella tabella <b>${esc(table)}</b>.</div>`;
  const cols=Object.keys(data[0]).slice(0,5);
  return `<div class="table-scroll"><table class="data-table">
  <thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead>
  <tbody>${data.map(row=>`<tr>${cols.map(c=>`<td>${esc(row[c])}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
 }catch(e){
  return `<div class="empty-state"><span class="error-text">${esc(e.message)}</span>
  <p class="help">La tabella “${esc(table)}” o le relative colonne potrebbero non essere presenti.</p></div>`;
 }
}

async function render(id){
 current=id;nav();$('#pageTitle').textContent=moduleInfo(id);
 const host=$('#pageContent');host.innerHTML='<div class="empty-state">Caricamento…</div>';
 if(id==='dashboard'){host.innerHTML=await dashboard();loadRecent();return;}
 if(id==='news'){
  host.innerHTML=newsPage();
  $('#newsForm').onsubmit=newsSave;
  $('#newsCancelBtn').onclick=resetNewsForm;
  $('#newsRefreshBtn').onclick=newsLoad;
  $('#newsList').onclick=newsAction;
  newsLoad();return;
 }
 if(id==='logo'||id==='gallery'){
  host.innerHTML=uploadPanel(id);
  $('#mediaFile').onchange=()=>{
   const f=$('#mediaFile').files[0];
   if(f){const img=$('#uploadPreview');img.src=URL.createObjectURL(f);img.hidden=false;}
  };
  $('#uploadBtn').onclick=uploadHandler;return;
 }
 if(id==='categories'){
  host.innerHTML=categoryPage();categoryLoad();
  $('#categoryForm').onsubmit=async e=>{
   e.preventDefault();const name=new FormData(e.target).get('name');
   const {error}=await db.from('categories').insert({name});
   if(error)alert(error.message);else{e.target.reset();categoryLoad();}
  };
  host.onclick=async e=>{
   const id=e.target.dataset.deleteCategory;
   if(id&&confirm('Eliminare questa categoria?')){
    const {error}=await db.from('categories').delete().eq('id',id);
    if(error)alert(error.message);else categoryLoad();
   }
  };return;
 }
 if(id==='menu_manager'){
  host.innerHTML=menuPage();dishLoad();
  $('#dishForm').onsubmit=async e=>{
   e.preventDefault();const fd=new FormData(e.target);let image_url=null;
   const file=fd.get('image');
   try{
    if(file?.size){
     const ext=file.name.split('.').pop();
     const path=`menu/${Date.now()}.${ext}`;
     const {data,error}=await db.storage.from(cfg.STORAGE_BUCKET||'nababi-media')
      .upload(path,file,{contentType:file.type});
     if(error)throw error;
     image_url=db.storage.from(cfg.STORAGE_BUCKET||'nababi-media').getPublicUrl(data.path).data.publicUrl;
    }
    const payload={
     name:fd.get('name'),price:Number(fd.get('price')),
     category:fd.get('category')||null,description:fd.get('description')||null,
     is_available:fd.get('is_available')==='true'
    };
    if(image_url)payload.image_url=image_url;
    const {error}=await db.from('menu_items').insert(payload);
    if(error)throw error;
    $('#dishStatus').textContent='Piatto salvato.';
    e.target.reset();dishLoad();
   }catch(err){$('#dishStatus').innerHTML=`<span class="error-text">${esc(err.message)}</span>`;}
  };return;
 }
 const body=await genericTable(id);
 host.innerHTML=`<section class="section-card">
 <div class="section-title"><h2>${esc(moduleInfo(id))}</h2>
 <span class="help">${esc(descriptions[id]||'Gestione Nababi')}</span></div>${body}</section>
 ${['secret','menu_public','social','hours','contact','settings','reports','performance','attendance','activity','tables','delivery','bookings','customers','coupons','staff','reviews'].includes(id)?
 `<section class="section-card"><h2>Gestione e configurazione</h2>
 <p class="help">Il pannello legge la tabella disponibile. Per attivare aggiunta/modifica completa bisogna verificare le colonne reali della tabella Supabase.</p>
 ${id==='secret'?uploadPanel('gallery'):''}</section>`:''}`;
 if(id==='secret'){const b=$('#uploadBtn');if(b)b.onclick=uploadHandler;}
}

$('#loginForm').addEventListener('submit',signIn);
$('#sideNav').addEventListener('click',e=>{
 const b=e.target.closest('[data-page]');if(b)render(b.dataset.page);
});
$('#pageContent').addEventListener('click',e=>{
 const b=e.target.closest('[data-page]');if(b)render(b.dataset.page);
});
$('#menuToggle').onclick=()=>$('#sidebar').classList.toggle('open');
$('#mobileMore').onclick=()=>$('#sidebar').classList.toggle('open');
$('#mobileNav').addEventListener('click',e=>{
 const b=e.target.closest('[data-page]');if(b)render(b.dataset.page);
});
$('#logoutBtn').onclick=async()=>{
 try{await db?.auth.signOut();}
 finally{
  $('#adminApp').hidden=true;$('#loginScreen').hidden=false;
  $('#password').value='';
 }
};

(async()=>{
 if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){
  $('#loginMessage').textContent='Supabase config non disponibile.';return;
 }
 db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 try{
  const {data,error}=await db.auth.getSession();
  if(error)throw error;
  if(data.session){
   await verifyAdmin(data.session.user);
   openApp(data.session.user.email);
  }
 }catch(e){$('#loginMessage').textContent=e.message;}
})();
})();
