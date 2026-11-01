
(()=>{
'use strict';

const cfg=window.NABABI_CONFIG||{};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const enc=v=>encodeURIComponent(String(v??''));

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
tables:'restaurant_tables',gallery:'gallery_items',
delivery:'delivery_orders',menu_public:'menu_items',
menu_manager:'menu_items',news:'breaking_news',
reviews:'reviews',hours:'opening_hours',secret:'coupons'
};

let db=null,current='dashboard',newsRows=[],bookingRows=[];
let activeFloorMap=null,floorMapRows=[],selectedMapPosition=null;

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
  count('website_analytics'),count('menu_items'),count('gallery_items'),
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
   <thead><tr><th>Cliente</th><th>Data</th><th>Stato</th><th>Codice</th></tr></thead>
   <tbody>${data.map(x=>`<tr>
   <td>${esc(x.full_name||'—')}</td>
   <td>${esc(x.booking_date||'—')}</td>
   <td><span class="tag">${esc(statusLabel(x.status))}</span></td>
   <td>${esc(x.confirmation_code||'—')}</td>
   </tr>`).join('')}</tbody></table></div>`:
   '<div class="empty-state">Nessuna prenotazione trovata.</div>';
 }catch(e){
  const el=$('#recentBookings');
  if(el)el.innerHTML=`<span class="error-text">${esc(e.message)}</span>`;
 }
}

function statusLabel(status){
 const labels={
  new:'Nuova',pending:'In attesa',confirmed:'Confermata',
  cancelled:'Annullata'
 };
 return labels[String(status||'').toLowerCase()]||String(status||'Nuova');
}

function bookingTypeLabel(type){
 const labels={
  table:'Tavolo normale',birthday:'Compleanno',
  special_event:'Evento speciale'
 };
 return labels[type]||type||'Tavolo';
}

function formatBookingDate(value){
 if(!value)return '—';
 const parts=String(value).split('-');
 if(parts.length!==3)return value;
 return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function phoneDigits(phone){
 return String(phone||'').replace(/\D/g,'');
}

function bookingMessage(booking,kind){
 const name=booking.full_name||'Cliente';
 const date=formatBookingDate(booking.booking_date);
 const time=booking.booking_time||'';
 const code=booking.confirmation_code||'';
 const type=bookingTypeLabel(booking.booking_type);
 const details=`${date} alle ${time}`;
 if(kind==='invitation'){
  return `Ciao ${name}, Nababi Ristorante è lieto di invitarti per il tuo ${type.toLowerCase()}! Ti aspettiamo il ${details}. Codice richiesta: ${code}. Per informazioni contattaci al +39 393 3805350.`;
 }
 return `Gentile ${name}, la tua richiesta per ${type.toLowerCase()} del ${details} è stata confermata da Nababi Ristorante. Codice: ${code}. Ti aspettiamo! Via Vespasiano 73/75/77, Roma.`;
}

function bookingEmailUrl(booking,kind){
 const recipient=String(booking.email||'').trim();
 if(!recipient)return '';
 const subject=kind==='invitation'
  ?'Invito speciale - Nababi Ristorante'
  :'Conferma prenotazione - Nababi Ristorante';
 const body=bookingMessage(booking,kind);
 return `mailto:${encodeURIComponent(recipient)}?subject=${enc(subject)}&body=${enc(body)}`;
}

function bookingCard(booking){
 const phone=String(booking.phone||'').trim();
 const email=String(booking.email||'').trim();
 const digits=phoneDigits(phone);
 const waText=bookingMessage(booking,'confirmation');
 const inviteText=bookingMessage(booking,'invitation');
 const isConfirmed=booking.status==='confirmed';
 const isCancelled=booking.status==='cancelled';

 return `<article class="section-card booking-admin-card">
 <div class="section-title">
  <h3>${esc(booking.full_name||'Cliente')}</h3>
  <span class="tag ${isConfirmed?'success-text':isCancelled?'pending':''}">
   ${esc(statusLabel(booking.status))}
  </span>
 </div>
 <p><b>Codice:</b> ${esc(booking.confirmation_code||'Non disponibile')}</p>
 <p><b>Tipo:</b> ${esc(bookingTypeLabel(booking.booking_type))}</p>
 <p><b>Data:</b> ${esc(formatBookingDate(booking.booking_date))}</p>
 <p><b>Orario:</b> ${esc(booking.booking_time||'—')}</p>
 <p><b>Ospiti:</b> ${esc(booking.guests??'—')}</p>
 <p><b>Telefono:</b> ${
  phone
   ? `<a href="tel:${enc(phone)}">${esc(phone)}</a>`
   : 'Non fornito'
 }</p>
 <p><b>Email:</b> ${email?`<a href="mailto:${enc(email)}">${esc(email)}</a>`:'Non fornita'}</p>
 <p><b>Note:</b> ${esc(booking.notes||'—')}</p>
 <div class="booking-admin-actions">
  ${phone&&digits?`<a class="outline-btn" href="tel:${enc(phone)}">☎ Chiama</a>`:''}
  ${phone&&digits?`<a class="outline-btn" href="https://wa.me/${enc(digits)}?text=${enc(waText)}" target="_blank" rel="noopener noreferrer">WhatsApp - Conferma</a>`:''}
  ${phone&&digits&&booking.booking_type!=='table'?`<a class="outline-btn" href="https://wa.me/${enc(digits)}?text=${enc(inviteText)}" target="_blank" rel="noopener noreferrer">WhatsApp - Invito</a>`:''}
  ${email?`<a class="outline-btn" href="${esc(bookingEmailUrl(booking,'confirmation'))}">Email - Conferma</a>`:''}
  ${email&&booking.booking_type!=='table'?`<a class="outline-btn" href="${esc(bookingEmailUrl(booking,'invitation'))}">Email - Invito</a>`:''}
 </div>
 <div class="booking-admin-actions">
  ${!isConfirmed&&!isCancelled?`<button class="gold-btn" data-booking-action="confirmed" data-booking-id="${esc(booking.id)}">Conferma</button>`:''}
  ${!isCancelled?`<button class="outline-btn danger-btn" data-booking-action="cancelled" data-booking-id="${esc(booking.id)}">Annulla</button>`:''}
 </div>
 </article>`;
}

function bookingsPage(){
 return `<section class="section-card">
 <div class="section-title">
  <h2>▣ Gestione prenotazioni</h2>
  <button class="outline-btn" id="bookingRefresh">Aggiorna</button>
 </div>
 <p class="help">Controlla le richieste, contatta i clienti e aggiorna lo stato della prenotazione.</p>
 <div id="bookingAdminList" class="help">Caricamento prenotazioni…</div>
 <p id="bookingAdminStatus" class="help" aria-live="polite"></p>
 </section>`;
}

async function bookingsLoad(){
 const box=$('#bookingAdminList');
 if(!box)return;
 box.textContent='Caricamento prenotazioni…';
 try{
  const {data,error}=await db.from('bookings').select('*')
   .order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  bookingRows=data||[];
  box.innerHTML=bookingRows.length
   ?bookingRows.map(bookingCard).join('')
   :'<div class="empty-state">Nessuna prenotazione trovata.</div>';
 }catch(e){
  box.innerHTML=`<div class="empty-state"><span class="error-text">${esc(e.message)}</span>
  <p class="help">Verifica i permessi SELECT della tabella bookings per l'account Admin.</p></div>`;
 }
}

async function bookingAction(event){
 const button=event.target.closest('[data-booking-action]');
 if(!button)return;

 const id=button.dataset.bookingId;
 const status=button.dataset.bookingAction;
 if(!['confirmed','cancelled'].includes(status))return;

 const question=status==='confirmed'
  ?'Confermare questa prenotazione?'
  :'Annullare questa prenotazione?';

 if(!confirm(question))return;

 button.disabled=true;
 const output=$('#bookingAdminStatus');
 if(output)output.textContent='Aggiornamento…';

 try{
  const {error}=await db.from('bookings')
   .update({status})
   .eq('id',id);

  if(error)throw error;

  if(output)output.textContent=
   status==='confirmed'?'Prenotazione confermata.':'Prenotazione annullata.';

  await bookingsLoad();
 }catch(e){
  if(output)output.textContent='Errore: '+e.message;
  button.disabled=false;
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
bookings:'Consulta e gestisci le prenotazioni dei tavoli.',
customers:'Archivio clienti.',
coupons:'Crea e gestisci codici sconto.',
staff:'Gestisci profili e ruoli del personale.',
performance:'Consulta le attività e le prestazioni del personale.',
attendance:'Presenze e turni del personale.',
activity:'Registro delle attività degli utenti staff.',
tables:'Gestisci la piantina, i tavoli e i posti disponibili.',
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

/* LOGO UPLOAD */
function uploadPanel(kind){
 if(kind==='gallery'){
  return `<section class="section-card">
   <div class="section-title"><h2>Gallery immagini</h2></div>
   <div class="upload-box">
    <label class="field">Scegli una o più foto
     <input id="mediaFile" type="file" accept="image/*" multiple>
    </label>
    <img id="uploadPreview" class="preview-img" hidden alt="Anteprima immagine">
    <button id="uploadBtn" class="gold-btn" type="button">Carica foto</button>
    <p id="uploadStatus" class="help" aria-live="polite">JPG, PNG o WebP. Massimo 8 MB per foto.</p>
   </div>
  </section>
  <section class="section-card">
   <div class="section-title">
    <h2>Foto caricate</h2>
    <button class="outline-btn" id="galleryRefresh" type="button">Aggiorna</button>
   </div>
   <div id="galleryAdminList" class="gallery-admin-grid">
    <p class="help">Caricamento foto…</p>
   </div>
  </section>`;
 }

 return `<section class="section-card">
 <div class="section-title"><h2>Carica Logo</h2></div>
 <div class="upload-box">
 <label class="field">Scegli foto dal telefono
 <input id="mediaFile" type="file" accept="image/*">
 </label>
 <button id="uploadBtn" class="gold-btn" type="button">Carica su Supabase</button>
 <p id="uploadStatus" class="help">Formato JPG, PNG o WebP. Bucket: ${esc(cfg.STORAGE_BUCKET||'nababi-media')}.</p>
 <img id="uploadPreview" class="preview-img" hidden alt="Anteprima logo">
 <div id="uploadedUrl"></div>
 </div></section>`;
}

/* GALLERY: LOAD IMAGES */
async function galleryLoad(){
 const box=$('#galleryAdminList');
 if(!box)return;

 box.innerHTML='<p class="help">Caricamento foto…</p>';

 try{
  const {data,error}=await db.from('gallery_items')
   .select('id,image_url,sort_order,created_at')
   .order('sort_order',{ascending:true})
   .order('created_at',{ascending:false});

  if(error)throw error;

  if(!data?.length){
   box.innerHTML='<div class="empty-state">Nessuna foto caricata.</div>';
   return;
  }

  box.innerHTML=data.map(item=>`
   <article class="gallery-admin-card">
    <img src="${esc(item.image_url)}" alt="Foto Gallery" loading="lazy">
    <button class="outline-btn danger-btn gallery-delete-btn"
     type="button" data-gallery-delete="${esc(item.id)}">
     Elimina
    </button>
   </article>
  `).join('');

 }catch(error){
  box.innerHTML=`<div class="empty-state">
   <span class="error-text">${esc(error.message)}</span>
   <p class="help">Controlla i permessi SELECT della tabella gallery_items.</p>
  </div>`;
 }
}

function galleryStoragePath(url){
 try{
  const parsed=new URL(url);
  const marker='/storage/v1/object/public/';
  const position=parsed.pathname.indexOf(marker);

  if(position===-1)return null;

  const rest=parsed.pathname.slice(position+marker.length);
  const slash=rest.indexOf('/');

  if(slash===-1)return null;

  const bucket=decodeURIComponent(rest.slice(0,slash));
  const path=decodeURIComponent(rest.slice(slash+1));

  if(bucket!==(cfg.STORAGE_BUCKET||'nababi-media'))return null;

  return path;
 }catch(error){
  return null;
 }
}

async function galleryDelete(event){
 const button=event.target.closest('[data-gallery-delete]');
 if(!button)return;

 const id=button.dataset.galleryDelete;

 if(!confirm('Vuoi eliminare definitivamente questa foto?'))return;

 button.disabled=true;
 button.textContent='Eliminazione…';

 try{
  const {data,error}=await db.from('gallery_items')
   .select('id,image_url')
   .eq('id',id)
   .single();

  if(error)throw error;
  if(!data)throw new Error('Foto non trovata.');

  const path=galleryStoragePath(data.image_url);

  if(path){
   const {error:storageError}=await db.storage
    .from(cfg.STORAGE_BUCKET||'nababi-media')
    .remove([path]);

   if(storageError)throw storageError;
  }

  const {error:rowError}=await db.from('gallery_items')
   .delete().eq('id',id);

  if(rowError){
   throw new Error('File eliminato, ma il record non è stato eliminato: '+rowError.message);
  }

  await galleryLoad();

 }catch(error){
  alert('Errore durante l’eliminazione: '+error.message);
  button.disabled=false;
  button.textContent='Elimina';
 }
}

/* UPLOAD HANDLER */
async function uploadHandler(){
 const input=$('#mediaFile');
 const btn=$('#uploadBtn');
 const status=$('#uploadStatus');
 const files=Array.from(input?.files||[]);

 if(!files.length){
  status.textContent='Seleziona prima una foto.';
  return;
 }

 const invalid=files.find(file=>!file.type.startsWith('image/'));
 if(invalid){
  status.textContent='Seleziona solo file immagine.';
  return;
 }

 const tooLarge=files.find(file=>file.size>8*1024*1024);
 if(tooLarge){
  status.textContent='Ogni foto deve essere inferiore a 8 MB.';
  return;
 }

 btn.disabled=true;
 status.textContent='Caricamento in corso…';

 const bucket=cfg.STORAGE_BUCKET||'nababi-media';
 const uploaded=[];

 try{
  for(const file of files){
   const ext=(file.name.split('.').pop()||'jpg')
    .toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';

   const path=`${current}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

   const {data,error}=await db.storage.from(bucket)
    .upload(path,file,{
     cacheControl:'3600',
     upsert:false,
     contentType:file.type
    });

   if(error)throw error;

   const pub=db.storage.from(bucket)
    .getPublicUrl(data.path).data.publicUrl;

   if(current==='gallery'){
    const {error:dbError}=await db.from('gallery_items')
     .insert({
      image_url:pub,
      is_active:true,
      sort_order:0
     });

    if(dbError)throw dbError;
   }

   uploaded.push(pub);
  }

  input.value='';

  if(current==='gallery'){
   status.textContent=`${uploaded.length} foto Gallery-তে যোগ হয়েছে।`;
   const preview=$('#uploadPreview');
   if(preview){
    preview.hidden=true;
    preview.removeAttribute('src');
   }
   await galleryLoad();
   return;
  }

  $('#uploadedUrl').innerHTML=uploaded.map((url,index)=>`
   <div class="uploaded-image-result">
    <p class="success-text">Immagine ${index+1} caricata.</p>
    <input class="search-input" readonly value="${esc(url)}">
    <button class="outline-btn copy-image-url" type="button"
     data-url="${esc(url)}">Copia URL</button>
   </div>
  `).join('');

  $('#uploadedUrl').querySelectorAll('.copy-image-url').forEach(button=>{
   button.onclick=async()=>{
    try{
     await navigator.clipboard.writeText(button.dataset.url);
     button.textContent='Copiato';
    }catch(e){
     button.textContent='Copia non disponibile';
    }
   };
  });

  status.textContent='Caricamento completato. URL pronto da copiare.';

 }catch(e){
  status.innerHTML=`<span class="error-text">${esc(e.message)}. Verifica bucket, tabella gallery_items e policy Supabase.</span>`;
 }finally{
  btn.disabled=false;
 }
}

/* CATEGORIES */
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

/* MENU */
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

/* FLOOR MAP MANAGEMENT */

function tablesPage(){
 return `
 <section class="section-card">
  <div class="section-title"><h2>Floor Map del ristorante</h2></div>
  <p class="help">Carica la piantina del ristorante. Poi tocca la mappa per scegliere dove posizionare ogni tavolo.</p>
  <label class="field">Nome della mappa
   <input id="floorMapName" value="Sala principale">
  </label>
  <label class="field">Carica la piantina
   <input id="floorMapFile" type="file" accept="image/*">
  </label>
  <button class="gold-btn" id="floorMapUpload" type="button">Carica Floor Map</button>
  <p id="floorMapStatus" class="help" aria-live="polite"></p>
 </section>

 <section class="section-card">
  <h2>Posizione dei tavoli</h2>
  <p class="help">Tocca un punto della mappa per selezionare la posizione.</p>
  <div id="floorMapCanvas" style="position:relative;width:100%;min-height:180px;border:1px solid #d8b76a;border-radius:12px;overflow:hidden;background:#eee;">
   <p class="help" style="padding:20px">Caricamento mappa…</p>
  </div>
  <p id="mapPositionStatus" class="help">Nessuna posizione selezionata.</p>
 </section>

 <section class="section-card">
  <h2>Aggiungi un tavolo</h2>
  <form id="mapTableForm" class="form-grid">
   <label class="field">Numero tavolo
    <input name="table_number" required placeholder="T1">
   </label>
   <label class="field">Numero posti
    <input name="seat_count" type="number" min="1" max="30" value="2" required>
   </label>
   <button class="gold-btn" type="submit">Salva tavolo</button>
  </form>
  <p id="mapTableStatus" class="help" aria-live="polite"></p>
 </section>

 <section class="section-card">
  <div class="section-title">
   <h2>Tavoli salvati</h2>
   <button class="outline-btn" id="mapTableRefresh" type="button">Aggiorna</button>
  </div>
  <div id="mapTableList" class="help">Caricamento…</div>
 </section>`;
}

function renderFloorMap(){
 const canvas=$('#floorMapCanvas');
 if(!canvas)return;

 if(!activeFloorMap){
  canvas.innerHTML='<p class="help" style="padding:20px">Nessuna mappa caricata.</p>';
  return;
 }

 canvas.innerHTML=`
  <img src="${esc(activeFloorMap.image_url)}"
   alt="Floor Map"
   id="floorMapImage"
   style="display:block;width:100%;height:auto;cursor:crosshair">
  <div id="floorMapMarkers" style="position:absolute;inset:0;pointer-events:none"></div>
 `;

 const image=$('#floorMapImage');

 image.onclick=event=>{
  const rect=image.getBoundingClientRect();
  selectedMapPosition={
   x:Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100)),
   y:Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100))
  };

  $('#mapPositionStatus').textContent=
   `Posizione selezionata: X ${selectedMapPosition.x.toFixed(1)}%, Y ${selectedMapPosition.y.toFixed(1)}%.`;
 };

 renderFloorMarkers();
}

function renderFloorMarkers(){
 const image=$('#floorMapImage');
 const markers=$('#floorMapMarkers');
 if(!image||!markers||!activeFloorMap)return;

 markers.innerHTML=floorMapRows
  .filter(t=>t.is_active)
  .map(t=>`
   <span style="
    position:absolute;
    left:${Number(t.x_percent)}%;
    top:${Number(t.y_percent)}%;
    transform:translate(-50%,-50%);
    background:#183e31;color:#fff;
    border:2px solid #d8b76a;
    border-radius:50%;
    min-width:34px;height:34px;
    display:flex;align-items:center;justify-content:center;
    font-size:12px;font-weight:bold;
   ">${esc(t.table_number)}</span>
  `).join('');
}

async function floorMapLoad(){
 const status=$('#floorMapStatus');

 try{
  const {data,error}=await db
   .from('restaurant_floor_maps')
   .select('*')
   .eq('is_active',true)
   .order('created_at',{ascending:false})
   .limit(1);

  if(error)throw error;

  activeFloorMap=data?.[0]||null;
  selectedMapPosition=null;

  renderFloorMap();
  await mapTablesLoad();

 }catch(error){
  if(status)status.textContent='Errore: '+error.message;
 }
}

async function mapTablesLoad(){
 const box=$('#mapTableList');
 if(!box)return;

 if(!activeFloorMap){
  box.innerHTML='<p class="help">Carica prima una Floor Map.</p>';
  floorMapRows=[];
  return;
 }

 box.textContent='Caricamento tavoli…';

 try{
  const {data,error}=await db
   .from('restaurant_map_tables')
   .select('*')
   .eq('floor_map_id',activeFloorMap.id)
   .order('table_number');

  if(error)throw error;

  floorMapRows=data||[];

  box.innerHTML=floorMapRows.length
   ?`<div class="table-scroll"><table class="data-table">
     <thead><tr><th>Tavolo</th><th>Posti</th><th>Stato</th><th>Azioni</th></tr></thead>
     <tbody>${floorMapRows.map(t=>`
      <tr>
       <td>${esc(t.table_number)}</td>
       <td>${esc(t.seat_count)}</td>
       <td>${t.is_active?'Attivo':'Non attivo'}</td>
       <td>
        <button class="outline-btn"
         data-map-toggle="${esc(t.id)}"
         data-active="${t.is_active?'true':'false'}">
         ${t.is_active?'Disattiva':'Attiva'}
        </button>
        <button class="outline-btn danger-btn"
         data-map-delete="${esc(t.id)}">Elimina</button>
       </td>
      </tr>
     `).join('')}</tbody>
    </table></div>`
   :'<p class="help">Nessun tavolo inserito.</p>';

  renderFloorMarkers();

 }catch(error){
  box.innerHTML=`<span class="error-text">${esc(error.message)}</span>`;
 }
}

async function floorMapUpload(){
 const file=$('#floorMapFile')?.files?.[0];
 const status=$('#floorMapStatus');
 const button=$('#floorMapUpload');

 if(!file){
  status.textContent='Seleziona prima una piantina.';
  return;
 }

 if(!file.type.startsWith('image/')||file.size>8*1024*1024){
  status.textContent='Seleziona un’immagine valida inferiore a 8 MB.';
  return;
 }

 button.disabled=true;
 status.textContent='Caricamento in corso…';

 let uploadedPath=null;

 try{
  const bucket=cfg.STORAGE_BUCKET||'nababi-media';
  const ext=(file.name.split('.').pop()||'jpg')
   .toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';

  const path=`floor-map/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const {data,error}=await db.storage
   .from(bucket)
   .upload(path,file,{
    upsert:false,
    contentType:file.type,
    cacheControl:'3600'
   });

  if(error)throw error;
  uploadedPath=data.path;

  const imageUrl=db.storage
   .from(bucket)
   .getPublicUrl(data.path).data.publicUrl;

  const {error:deactivateError}=await db
   .from('restaurant_floor_maps')
   .update({is_active:false})
   .eq('is_active',true);

  if(deactivateError)throw deactivateError;

  const {data:saved,error:saveError}=await db
   .from('restaurant_floor_maps')
   .insert({
    name:$('#floorMapName').value.trim()||'Sala principale',
    image_url:imageUrl,
    is_active:true
   })
   .select()
   .single();

  if(saveError)throw saveError;

  activeFloorMap=saved;
  status.textContent='Floor Map caricata con successo.';
  $('#floorMapFile').value='';
  await floorMapLoad();

 }catch(error){
  status.textContent='Errore: '+error.message;
  if(uploadedPath){
   status.textContent+=' Il file potrebbe essere già stato caricato nello Storage.';
  }
 }finally{
  button.disabled=false;
 }
}

async function mapTableSave(event){
 event.preventDefault();

 const status=$('#mapTableStatus');

 if(!activeFloorMap){
  status.textContent='Carica prima la Floor Map.';
  return;
 }

 if(!selectedMapPosition){
  status.textContent='Tocca prima la posizione sulla mappa.';
  return;
 }

 const fd=new FormData(event.currentTarget);
 const payload={
  floor_map_id:activeFloorMap.id,
  table_number:String(fd.get('table_number')).trim(),
  seat_count:Number(fd.get('seat_count')),
  x_percent:Number(selectedMapPosition.x.toFixed(2)),
  y_percent:Number(selectedMapPosition.y.toFixed(2)),
  is_active:true
 };

 if(!payload.table_number||!Number.isInteger(payload.seat_count)||
    payload.seat_count<1||payload.seat_count>30){
  status.textContent='Controlla numero tavolo e posti.';
  return;
 }

 const button=event.currentTarget.querySelector('button[type="submit"]');
 button.disabled=true;
 status.textContent='Salvataggio…';

 try{
  const {error}=await db
   .from('restaurant_map_tables')
   .insert(payload);

  if(error)throw error;

  status.textContent='Tavolo salvato.';
  event.currentTarget.reset();
  selectedMapPosition=null;
  $('#mapPositionStatus').textContent='Nessuna posizione selezionata.';

  await mapTablesLoad();

 }catch(error){
  status.textContent='Errore: '+error.message;
 }finally{
  button.disabled=false;
 }
}

async function mapTableAction(event){
 const toggle=event.target.closest('[data-map-toggle]');
 const del=event.target.closest('[data-map-delete]');

 try{
  if(toggle){
   toggle.disabled=true;
   const active=toggle.dataset.active!=='true';

   const {error}=await db
    .from('restaurant_map_tables')
    .update({is_active:active})
    .eq('id',toggle.dataset.mapToggle);

   if(error)throw error;
   await mapTablesLoad();
  }

  if(del){
   if(!confirm('Eliminare questo tavolo?'))return;
   del.disabled=true;

   const {error}=await db
    .from('restaurant_map_tables')
    .delete()
    .eq('id',del.dataset.mapDelete);

   if(error)throw error;
   await mapTablesLoad();
  }

 }catch(error){
  alert('Errore: '+error.message);
  await mapTablesLoad();
 }
}

/* GENERIC TABLE */
async function genericTable(id){
 const table=tableMap[id];
 if(!table)return '<div class="empty-state">Modulo pronto per configurazione.</div>';
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

/* PAGE RENDERER */
async function render(id){
 current=id;
 nav();
 $('#pageTitle').textContent=moduleInfo(id);
 const host=$('#pageContent');
 host.innerHTML='<div class="empty-state">Caricamento…</div>';

 if(id==='dashboard'){
  host.innerHTML=await dashboard();
  loadRecent();
  return;
 }

 if(id==='bookings'){
  host.innerHTML=bookingsPage();
  $('#bookingRefresh').onclick=bookingsLoad;
  $('#bookingAdminList').addEventListener('click',bookingAction);
  bookingsLoad();
  return;
 }

 if(id==='tables'){
  host.innerHTML=tablesPage();
  $('#floorMapUpload').onclick=floorMapUpload;
  $('#mapTableForm').onsubmit=mapTableSave;
  $('#mapTableRefresh').onclick=mapTablesLoad;
  $('#mapTableList').addEventListener('click',mapTableAction);
  await floorMapLoad();
  return;
 }

 if(id==='news'){
  host.innerHTML=newsPage();
  $('#newsForm').onsubmit=newsSave;
  $('#newsCancelBtn').onclick=resetNewsForm;
  $('#newsRefreshBtn').onclick=newsLoad;
  $('#newsList').onclick=newsAction;
  newsLoad();
  return;
 }

 if(id==='gallery'){
  host.innerHTML=uploadPanel('gallery');

  $('#mediaFile').onchange=()=>{
   const files=Array.from($('#mediaFile').files||[]);
   const preview=$('#uploadPreview');

   if(!files.length){
    preview.hidden=true;
    preview.removeAttribute('src');
    return;
   }

   if(files.length===1){
    preview.src=URL.createObjectURL(files[0]);
    preview.hidden=false;
   }else{
    preview.hidden=true;
    preview.removeAttribute('src');
   }
  };

  $('#uploadBtn').onclick=uploadHandler;
  $('#galleryRefresh').onclick=galleryLoad;
  $('#galleryAdminList').addEventListener('click',galleryDelete);

  await galleryLoad();
  return;
 }

 if(id==='logo'){
  host.innerHTML=uploadPanel('logo');

  $('#mediaFile').onchange=()=>{
   const file=$('#mediaFile').files[0];
   if(file){
    const img=$('#uploadPreview');
    img.src=URL.createObjectURL(file);
    img.hidden=false;
   }
  };

  $('#uploadBtn').onclick=uploadHandler;
  return;
 }

 if(id==='categories'){
  host.innerHTML=categoryPage();
  categoryLoad();

  $('#categoryForm').onsubmit=async e=>{
   e.preventDefault();
   const name=new FormData(e.target).get('name');
   const {error}=await db.from('categories').insert({name});
   if(error)alert(error.message);
   else{
    e.target.reset();
    categoryLoad();
   }
  };

  host.onclick=async e=>{
   const id=e.target.dataset.deleteCategory;
   if(id&&confirm('Eliminare questa categoria?')){
    const {error}=await db.from('categories').delete().eq('id',id);
    if(error)alert(error.message);
    else categoryLoad();
   }
  };
  return;
 }

 if(id==='menu_manager'){
  host.innerHTML=menuPage();
  dishLoad();

  $('#dishForm').onsubmit=async e=>{
   e.preventDefault();
   const fd=new FormData(e.target);
   let image_url=null;
   const file=fd.get('image');

   try{
    if(file?.size){
     const ext=file.name.split('.').pop();
     const path=`menu/${Date.now()}.${ext}`;
     const {data,error}=await db.storage
      .from(cfg.STORAGE_BUCKET||'nababi-media')
      .upload(path,file,{contentType:file.type});

     if(error)throw error;

     image_url=db.storage.from(cfg.STORAGE_BUCKET||'nababi-media')
      .getPublicUrl(data.path).data.publicUrl;
    }

    const payload={
     name:fd.get('name'),
     price:Number(fd.get('price')),
     category:fd.get('category')||null,
     description:fd.get('description')||null,
     is_available:fd.get('is_available')==='true'
    };

    if(image_url)payload.image_url=image_url;

    const {error}=await db.from('menu_items').insert(payload);
    if(error)throw error;

    $('#dishStatus').textContent='Piatto salvato.';
    e.target.reset();
    dishLoad();

   }catch(err){
    $('#dishStatus').innerHTML=`<span class="error-text">${esc(err.message)}</span>`;
   }
  };
  return;
 }

 const body=await genericTable(id);

 host.innerHTML=`<section class="section-card">
 <div class="section-title"><h2>${esc(moduleInfo(id))}</h2>
 <span class="help">${esc(descriptions[id]||'Gestione Nababi')}</span></div>${body}</section>
 ${['secret','menu_public','social','hours','contact','settings','reports','performance','attendance','activity','delivery','customers','coupons','staff','reviews'].includes(id)?
 `<section class="section-card"><h2>Gestione e configurazione</h2>
 <p class="help">Il pannello legge la tabella disponibile. Per attivare aggiunta/modifica completa bisogna verificare le colonne reali della tabella Supabase.</p>
 ${id==='secret'?uploadPanel('logo'):''}</section>`:''}`;

 if(id==='secret'){
  const b=$('#uploadBtn');
  if(b)b.onclick=uploadHandler;
 }
}

/* GLOBAL EVENTS */
$('#loginForm').addEventListener('submit',signIn);

$('#sideNav').addEventListener('click',e=>{
 const b=e.target.closest('[data-page]');
 if(b)render(b.dataset.page);
});

$('#pageContent').addEventListener('click',e=>{
 const b=e.target.closest('[data-page]');
 if(b)render(b.dataset.page);
});

$('#menuToggle').onclick=()=>$('#sidebar').classList.toggle('open');
$('#mobileMore').onclick=()=>$('#sidebar').classList.toggle('open');

$('#mobileNav').addEventListener('click',e=>{
 const b=e.target.closest('[data-page]');
 if(b)render(b.dataset.page);
});

$('#logoutBtn').onclick=async()=>{
 try{
  await db?.auth.signOut();
 }finally{
  $('#adminApp').hidden=true;
  $('#loginScreen').hidden=false;
  $('#password').value='';
 }
};

/* SESSION CHECK */
(async()=>{
 if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){
  $('#loginMessage').textContent='Supabase config non disponibile.';
  return;
 }

 db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);

 try{
  const {data,error}=await db.auth.getSession();
  if(error)throw error;

  if(data.session){
   await verifyAdmin(data.session.user);
   openApp(data.session.user.email);
  }
 }catch(e){
  $('#loginMessage').textContent=e.message;
 }
})();
})();
