(() => {
'use strict';
const cfg = window.NABABI_CONFIG || {};
const $ = s => document.querySelector(s);
const i18n = {
 it:{reserved:'AREA RISERVATA',welcome:'Accesso Admin',email:'Email',password:'Password',login:'Accedi',forgot:'Password dimenticata?',logout:'Esci',dashboard:'Dashboard',menu:'Menu Manager',bookings:'Prenotazioni',customers:'Clienti',coupons:'Coupon',games:'Gestione Giochi',staff:'Staff',gallery:'Galleria',reports:'Report',settings:'Impostazioni',visits:'Visite sito',dishes:'Piatti',newBookings:'Nuove prenotazioni',reviews:'Recensioni',modules:'Moduli di gestione',welcomeBack:'Benvenuto in NABABI',secure:'Area amministrativa protetta',loading:'Caricamento…',empty:'Nessun dato disponibile',denied:'Account non autorizzato.'},
 en:{reserved:'PRIVATE AREA',welcome:'Admin access',email:'Email',password:'Password',login:'Sign in',forgot:'Forgot password?',logout:'Log out',dashboard:'Dashboard',menu:'Menu Manager',bookings:'Bookings',customers:'Customers',coupons:'Coupons',games:'Games Management',staff:'Staff',gallery:'Gallery',reports:'Reports',settings:'Settings',visits:'Website visits',dishes:'Menu items',newBookings:'New bookings',reviews:'Reviews',modules:'Management modules',welcomeBack:'Welcome to NABABI',secure:'Protected administration area',loading:'Loading…',empty:'No data available',denied:'This account is not authorised.'},
 bn:{reserved:'সংরক্ষিত এলাকা',welcome:'অ্যাডমিন লগইন',email:'ইমেইল',password:'পাসওয়ার্ড',login:'লগইন',forgot:'পাসওয়ার্ড ভুলে গেছেন?',logout:'লগআউট',dashboard:'ড্যাশবোর্ড',menu:'মেনু ম্যানেজার',bookings:'বুকিং',customers:'কাস্টমার',coupons:'কুপন',games:'গেম ম্যানেজমেন্ট',staff:'স্টাফ',gallery:'গ্যালারি',reports:'রিপোর্ট',settings:'সেটিংস',visits:'ওয়েবসাইট ভিজিট',dishes:'মেনুর আইটেম',newBookings:'নতুন বুকিং',reviews:'রিভিউ',modules:'ম্যানেজমেন্ট মডিউল',welcomeBack:'NABABI-তে স্বাগতম',secure:'সুরক্ষিত অ্যাডমিন এলাকা',loading:'লোড হচ্ছে…',empty:'কোনো তথ্য নেই',denied:'এই অ্যাকাউন্ট অনুমোদিত নয়।'}
};
let lang='it',db=null,role='guest',permissions={},user=null,current='dashboard';
const modules=[
 ['dashboard','▦'],['menu_manager','🍛'],['categories','▤'],['bookings','▣'],['customers','♙'],['coupons','◇'],['games','🎮'],['staff','♟'],['gallery','▧'],['reports','▥'],['settings','⚙']
];
const labels={dashboard:'dashboard',menu_manager:'menu',categories:'menu',bookings:'bookings',customers:'customers',coupons:'coupons',games:'games',staff:'staff',gallery:'gallery',reports:'reports',settings:'settings'};
const tables={menu_manager:'menu_items',categories:'categories',bookings:'bookings',customers:'customers',coupons:'coupons',games:'nababi_games',staff:'staff',gallery:'gallery_items'};
const t=k=>i18n[lang][k]||k;
function msg(text){$('#loginMessage').textContent=text||''}
function can(id){return role==='admin'||(role==='staff'&&permissions[id]===true)||id==='dashboard'&&role==='staff'}
function setLanguage(value){lang=value;document.documentElement.lang=value;document.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.dataset.i18n;el.textContent=t(k)});if(user)render(current)}
function showLogin(){ $('#appView').hidden=true;$('#loginView').hidden=false }
function showApp(){ $('#loginView').hidden=true;$('#appView').hidden=false;$('#userLabel').textContent=(role==='admin'?'SUPER ADMIN · ':'STAFF · ')+(user.email||'');buildNav();render('dashboard') }
async function authorize(u){
 user=u;role='guest';permissions={};
 if(cfg.ADMIN_USER_ID&&u.id===cfg.ADMIN_USER_ID){role='admin';return}
 const a=await db.from('admin_users').select('user_id').eq('user_id',u.id).maybeSingle();
 if(a.error)throw a.error;
 if(a.data){role='admin';return}
 const s=await db.from('staff').select('permissions,is_active').eq('auth_user_id',u.id).maybeSingle();
 if(s.error)throw s.error;
 if(!s.data||s.data.is_active!==true)throw new Error(t('denied'));
 role='staff';permissions=s.data.permissions||{};
}
function buildNav(){
 $('#navigation').innerHTML=modules.filter(([id])=>can(id)).map(([id,ico])=>'<button class="nav-link '+(id===current?'active':'')+'" data-module="'+id+'"><span>'+ico+'</span>'+t(labels[id]||id)+'</button>').join('');
}
function stat(title,value){return '<article class="stat"><small>'+title+'</small><strong>'+value+'</strong></article>'}
async function safeCount(table){const r=await db.from(table).select('*',{count:'exact',head:true});if(r.error)return '—';return r.count??0}
async function dashboard(){
 const names=[['site_visits','visits'],['menu_items','dishes'],['bookings','bookings'],['reviews','reviews']];
 const values=await Promise.all(names.map(x=>safeCount(x[0])));
 const pending=await db.from('bookings').select('*',{count:'exact',head:true}).eq('status','pending');
 const cards=modules.filter(([id])=>id!=='dashboard'&&can(id)).map(([id,ico])=>'<button class="module-card" data-module="'+id+'"><b>'+ico+' '+t(labels[id]||id)+'</b><span>'+t('secure')+'</span></button>').join('');
 return '<section class="hero"><div><p class="eyebrow">♛ NABABI RISTORANTE</p><h2>'+t('welcomeBack')+'</h2><p>'+t('secure')+'</p></div><div class="hero-mark">♛</div></section><div class="stats">'+names.map((x,i)=>stat(t(x[1]),values[i])).join('')+stat(t('newBookings'),pending.error?'—':pending.count||0)+'</div><section class="panel"><h2>'+t('modules')+'</h2><div class="module-grid">'+cards+'</div></section>';
}
async function tablePage(id){
 const table=tables[id];if(!table)return '<section class="panel"><div class="empty">'+t('empty')+'</div></section>';
 const r=await db.from(table).select('*').limit(50);
 if(r.error)throw r.error;
 if(!r.data?.length)return '<section class="panel"><h2>'+t(labels[id]||id)+'</h2><div class="empty">'+t('empty')+'</div></section>';
 const cols=Object.keys(r.data[0]).slice(0,6);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return '<section class="panel"><h2>'+t(labels[id]||id)+'</h2><div class="table-wrap"><table class="data-table"><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+r.data.map(row=>'<tr>'+cols.map(c=>'<td>'+esc(typeof row[c]==='object'?JSON.stringify(row[c]):row[c])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>';
}
async function render(id){
 if(!can(id))return;current=id;buildNav();$('#pageTitle').textContent=t(labels[id]||id);$('#content').innerHTML='<div class="empty">'+t('loading')+'</div>';
 try{$('#content').innerHTML=id==='dashboard'?await dashboard():await tablePage(id)}catch(e){$('#content').innerHTML='<section class="panel"><p class="error">'+String(e.message||'Unable to load data').replace(/[&<>]/g,'')+'</p></section>'}
}
async function signIn(e){
 e.preventDefault();const button=$('#loginButton');button.disabled=true;button.textContent=t('loading');msg('');
 try{
  if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)throw new Error('Supabase configuration missing.');
  if(!db)db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  const result=await db.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});
  if(result.error)throw result.error;
  await authorize(result.data.user);showApp();
 }catch(err){try{await db?.auth.signOut()}catch(_){}role='guest';user=null;msg(err.message||'Login failed.')}
 finally{button.disabled=false;button.textContent=t('login')}
}
$('#loginForm').addEventListener('submit',signIn);
$('#forgotButton').addEventListener('click',async()=>{const email=$('#email').value.trim();if(!email){msg('Enter your email first.');return}try{if(!db)db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);const r=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(r.error)throw r.error;msg('Recovery email sent. Check your inbox.')}catch(e){msg(e.message)}});
$('#navigation').addEventListener('click',e=>{const b=e.target.closest('[data-module]');if(b)render(b.dataset.module)});
$('#content').addEventListener('click',e=>{const b=e.target.closest('[data-module]');if(b)render(b.dataset.module)});
$('#logoutButton').addEventListener('click',async()=>{await db?.auth.signOut();role='guest';permissions={};user=null;showLogin()});
$('#languageSelect').addEventListener('change',e=>setLanguage(e.target.value));
$('#menuButton').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
(async()=>{
 try{if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){msg('Supabase configuration missing.');return}db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);const r=await db.auth.getSession();if(r.data.session?.user){await authorize(r.data.session.user);showApp()}}
 catch(e){await db?.auth.signOut();msg(e.message||'Session validation failed.')}
})();
})();