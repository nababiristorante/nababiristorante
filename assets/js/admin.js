(()=>{
 'use strict';
 const $=s=>document.querySelector(s);
 const login=$('#login'), app=$('#app'), form=$('#loginForm'), errorBox=$('#error'), loginButton=$('#loginButton'), view=$('#view'), status=$('#status');
 const cfg=window.NABABI_CONFIG||{};
 let db=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const msg=e=>e?.message||String(e||'Errore sconosciuto');
 function setError(t){errorBox.textContent=t||'';}
 function setBusy(on){loginButton.disabled=on;loginButton.textContent=on?'Accesso in corso…':'Accedi';}
 function init(){
   if(!window.supabase?.createClient){setError('Libreria Supabase non caricata. Controlla la connessione e ricarica la pagina.');return;}
   if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){setError('Configurazione Supabase incompleta in assets/js/config.js.');return;}
   try{db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});}
   catch(e){setError('Impossibile inizializzare Supabase: '+msg(e));}
 }
 async function isAdmin(user){
   // Uses the existing admin_users table and the authenticated user's UID.
   const r=await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
   if(r.error) throw new Error('Accesso verificato, ma controllo admin_users non riuscito: '+r.error.message);
   if(!r.data) throw new Error('Questo account non è autorizzato come amministratore. Controlla la riga admin_users.user_id.');
 }
 async function enter(user){
   await isAdmin(user);
   login.hidden=true; app.hidden=false;
   await showPage('dashboard');
 }
 form.addEventListener('submit',async e=>{
   e.preventDefault(); setError('');
   if(!db){setError('Supabase non è pronto. Controlla la configurazione e ricarica.');return;}
   const email=$('#email').value.trim(), password=$('#password').value;
   if(!email||!password){setError('Inserisci email e password.');return;}
   setBusy(true);
   try{
     const {data,error}=await db.auth.signInWithPassword({email,password});
     if(error) throw error;
     if(!data.user) throw new Error('Login non ha restituito un utente.');
     await enter(data.user);
   }catch(err){
     setError(msg(err));
     try{await db.auth.signOut();}catch(_){}
   }finally{setBusy(false);}
 });
 async function count(table){
   try{const r=await db.from(table).select('*',{count:'exact',head:true});return r.error?'—':(r.count??0);}
   catch(_){return '—';}
 }
 async function showPage(p){
   const names={dashboard:'Dashboard',categories:'Categorie',bookings:'Prenotazioni',menu:'Menu Manager',coupons:'Coupon',news:'Breaking News'};
   $('#title').textContent=names[p]||'Dashboard'; view.innerHTML=''; status.textContent='Caricamento…';
   try{
     if(p==='dashboard'){
       const [a,b,c]=await Promise.all([count('categories'),count('menu_items'),count('bookings')]);
       view.innerHTML=`<div class="stats"><div class="box">Categorie<h2>${a}</h2></div><div class="box">Piatti menu<h2>${b}</h2></div><div class="box">Prenotazioni<h2>${c}</h2></div></div><section class="box"><h2>Benvenuto nel pannello Nababi</h2><p>Seleziona una sezione dal menu. Se un contatore mostra —, controlla che la tabella esista e che le policy RLS consentano la lettura.</p></section>`;
     }else{
       const tables={categories:'categories',bookings:'bookings',menu:'menu_items',coupons:'coupons',news:'breaking_news'};
       const table=tables[p]; const r=await db.from(table).select('*').limit(100);
       if(r.error) throw new Error(`Tabella ${table}: ${r.error.message}`);
       const rows=r.data||[];
       if(p==='categories'){
         view.innerHTML=`<section class="box"><h2>Gestione categorie</h2><form id="addCategory"><label>Nuova categoria<input name="name" maxlength="80" required placeholder="Es. Antipasti"></label><button class="btn" type="submit">Aggiungi categoria</button></form><div>${rows.map(x=>`<p class="row"><span>${esc(x.name)}</span><button type="button" data-delete="${esc(x.id)}">Elimina</button></p>`).join('')||'<p>Nessuna categoria presente.</p>'}</div></section>`;
         $('#addCategory').addEventListener('submit',async ev=>{ev.preventDefault();const name=new FormData(ev.currentTarget).get('name').trim();if(!name)return;const q=await db.from('categories').insert({name});if(q.error){alert(q.error.message);return;}await showPage('categories');});
         view.addEventListener('click',async ev=>{const id=ev.target?.dataset?.delete;if(!id)return;if(!confirm('Vuoi eliminare questa categoria?'))return;const q=await db.from('categories').delete().eq('id',id);if(q.error)alert(q.error.message);else await showPage('categories');});
       }else{
         const label=x=>x.name||x.title||x.customer_name||x.code||x.id||'Record';
         view.innerHTML=`<section class="box"><h2>${names[p]}</h2><p>${rows.length} record caricati (massimo 100).</p>${rows.map(x=>`<p class="row"><span>${esc(label(x))}</span><small>${esc(x.status||x.created_at||'')}</small></p>`).join('')||'<p>Nessun record presente.</p>'}</section>`;
       }
     }
     status.textContent='';
   }catch(err){status.textContent='';view.innerHTML=`<section class="box error"><b>Errore:</b> ${esc(msg(err))}<p>Controlla nome tabella, colonne e policy RLS in Supabase.</p></section>`;}
 }
 app.addEventListener('click',e=>{const p=e.target?.dataset?.page;if(p)showPage(p);});
 $('#logout').addEventListener('click',async()=>{try{await db?.auth.signOut();}catch(err){status.textContent=msg(err);}app.hidden=true;login.hidden=false;form.reset();setError('');});
 async function restore(){if(!db)return;try{const {data,error}=await db.auth.getSession();if(error)throw error;if(data.session?.user){try{await enter(data.session.user);}catch(err){await db.auth.signOut();setError(msg(err));}}}catch(err){setError('Sessione non verificabile: '+msg(err));}}
 init(); restore();
})();
