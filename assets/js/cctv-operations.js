(() => {
'use strict';
// Isolated CCTV Operations module. It does not modify the Admin login bundle.
const cfg = window.NABABI_CONFIG || {};
if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const $ = (s, root=document) => root.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy = false;
async function addNav() {
  const nav = $('#navigation');
  if (!nav || $('#cctvOperationsNav')) return;
  try {
    const {data} = await client.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return;
    const admin = await client.from('admin_users').select('user_id').eq('user_id',uid).maybeSingle();
    if (admin.error || !admin.data || !nav.isConnected || $('#cctvOperationsNav')) return;
    const btn = document.createElement('button');
    btn.id = 'cctvOperationsNav'; btn.type = 'button'; btn.className = 'nav-link';
    btn.dataset.cctvOperations = 'true'; btn.innerHTML = '<span>🧹</span>CCTV Operations';
    nav.appendChild(btn);
  } catch (_) {}
}
const observer = new MutationObserver(addNav);
function watchNav() {
  const nav = $('#navigation');
  if (nav) { observer.observe(nav, {childList:true, subtree:true}); addNav(); }
}
watchNav();
document.addEventListener('DOMContentLoaded', watchNav);
document.addEventListener('click', async e => {
  const nav = e.target.closest('[data-cctv-operations]');
  if (nav) { e.preventDefault(); e.stopImmediatePropagation(); await openPage(); return; }
  const root = $('#cctvOperationsRoot');
  if (!root) return;
  const voice = e.target.closest('[data-cctv-voice]');
  if (voice) { speak(Number(voice.dataset.cctvVoice), voice.dataset.kind); return; }
  const removeTask = e.target.closest('[data-cctv-delete]');
  if (removeTask) { await deleteTask(removeTask.dataset.cctvDelete); return; }
  const ack = e.target.closest('[data-cctv-ack]');
  if (ack) { await updateAlert(ack.dataset.cctvAck); return; }
  if (e.target.closest('#cctvRefresh')) await openPage();
}, true);
document.addEventListener('change', async e => {
  if (e.target.matches('[data-cctv-status]')) await updateTask(e.target.dataset.cctvStatus, e.target.value);
});
document.addEventListener('submit', async e => {
  if (e.target.id === 'cctvSettingsForm') { e.preventDefault(); await saveSettings(e.target); }
  if (e.target.id === 'cctvTaskForm') { e.preventDefault(); await createTask(e.target); }
});
async function requireSession() {
  const {data, error} = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('Sessione admin non disponibile. Effettua nuovamente l’accesso.');
  const admin = await client.from('admin_users').select('user_id').eq('user_id',data.session.user.id).maybeSingle();
  if (admin.error) throw admin.error;
  if (!admin.data) throw new Error('Accesso riservato agli amministratori.');
}
async function openPage() {
  if (busy) return; busy = true;
  const content = $('#content'), title = $('#pageTitle');
  if (!content) { busy=false; return; }
  if (title) title.textContent = 'CCTV Operations';
  content.innerHTML = '<section class="panel"><p>Caricamento CCTV Operations…</p></section>';
  try {
    await requireSession();
    const [sr,tr,ar,staffResult] = await Promise.all([
      client.from('cctv_monitoring_settings').select('*').eq('id',true).maybeSingle(),
      client.from('cctv_table_tasks').select('*').order('created_at',{ascending:false}).limit(100),
      client.from('cctv_alerts').select('*').order('occurred_at',{ascending:false}).limit(50),
      client.from('staff').select('id,full_name').eq('is_active',true).order('full_name')
    ]);
    for (const r of [sr,tr,ar,staffResult]) if (r.error) throw r.error;
    const setting = sr.data || {cleaning_delay_minutes:2,italian_voice_enabled:true};
    const tasks = tr.data || [], alerts = ar.data || [], staff = staffResult.data || [];
    const today = new Date().toLocaleDateString('en-CA');
    const todays = tasks.filter(x => String(x.created_at||'').slice(0,10) === today);
    const completed = todays.filter(x=>x.status==='completed').length;
    const pending = tasks.filter(x=>x.status==='pending').length;
    const active = tasks.filter(x=>x.status==='in_progress').length;
    const overdue = tasks.filter(x=>['pending','in_progress'].includes(x.status) && x.due_at && new Date(x.due_at).getTime() <= Date.now()).length;
    const names = {cleaning:'Pulizia',water:'Acqua',waiter:'Cameriere'};
    const statuses = {pending:'In attesa',in_progress:'In corso',completed:'Completato',cancelled:'Annullato'};
    const staffOptions = staff.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.full_name)+'</option>').join('');
    const rows = tasks.length ? tasks.map(x=>'<tr><td>'+esc(x.room_key)+' · '+Number(x.table_number)+'</td><td>'+esc(names[x.task_type]||x.task_type)+'</td><td>'+esc(x.source==='manual'?'Manuale':'AI camera')+'</td><td>'+esc(x.assigned_staff_name||staff.find(s=>s.id===x.assigned_staff_id)?.full_name||'—')+'</td><td><select data-cctv-status="'+esc(x.id)+'">'+Object.entries(statuses).map(([k,v])=>'<option value="'+k+'" '+(x.status===k?'selected':'')+'>'+v+'</option>').join('')+'</select></td><td>'+esc(new Date(x.created_at).toLocaleString('it-IT'))+'</td><td>'+esc(x.due_at?new Date(x.due_at).toLocaleString('it-IT'):'—')+'</td><td><button class="secondary-button" type="button" data-cctv-voice="'+Number(x.table_number)+'" data-kind="'+esc(x.task_type)+'">Voce IT</button></td><td><button class="secondary-button" type="button" data-cctv-delete="'+esc(x.id)+'">Rimuovi</button></td></tr>').join('') : '<tr><td colspan="9">Nessuna attività.</td></tr>';
    const alertRows = alerts.length ? alerts.map(x=>'<tr><td>'+esc(x.alert_type)+'</td><td>'+esc(x.message)+'</td><td>'+esc(new Date(x.occurred_at).toLocaleString('it-IT'))+'</td><td>'+(x.acknowledged_at?'Confermato':'<button class="secondary-button" type="button" data-cctv-ack="'+esc(x.id)+'">Conferma</button>')+'</td></tr>').join('') : '<tr><td colspan="4">Nessun avviso.</td></tr>';
    content.innerHTML = '<div id="cctvOperationsRoot">'+
      '<section class="panel camera-page-head"><div><p class="eyebrow">NABABI · OPERAZIONI</p><h2>Gestione attività CCTV</h2><p class="help">Gestione manuale delle attività dei tavoli. Il rilevamento automatico delle telecamere non è ancora collegato.</p></div><span class="status-pill status-pending">AI / NVR non collegato</span></section>'+
      '<section class="ai-monitor-stats"><article class="ai-stat-card"><div><strong>'+todays.length+'</strong><small>Attività create oggi</small></div></article><article class="ai-stat-card"><div><strong>'+pending+'</strong><small>In attesa</small></div></article><article class="ai-stat-card"><div><strong>'+completed+'</strong><small>Completate oggi</small></div></article><article class="ai-stat-card"><div><strong>'+overdue+'</strong><small>Fuori tempo</small></div></article></section>'+
      '<section class="panel"><h2>Impostazioni</h2><form id="cctvSettingsForm" class="cctv-ops-form"><label class="field">Ritardo pulizia<select name="cleaning_delay_minutes"><option value="2" '+(Number(setting.cleaning_delay_minutes)===2?'selected':'')+'>2 minuti</option><option value="3" '+(Number(setting.cleaning_delay_minutes)===3?'selected':'')+'>3 minuti</option></select></label><label class="check-label"><input type="checkbox" name="italian_voice_enabled" '+(setting.italian_voice_enabled?'checked':'')+'> Abilita test vocali italiani</label><p class="cctv-ops-warning">Gli annunci automatici restano disattivati fino alla verifica del sistema NVR/AI.</p><button class="gold-button" type="submit">Salva impostazioni</button><p id="cctvSettingsStatus" class="camera-save-status" role="status"></p></form></section>'+
      '<section class="panel"><h2>Nuova attività</h2><form id="cctvTaskForm" class="cctv-ops-form"><label class="field">Sala<select name="room_key"><option value="dining-1">Dining Room 1</option><option value="dining-2">Dining Room 2</option></select></label><label class="field">Tavolo<select name="table_number">'+Array.from({length:10},(_,i)=>'<option value="'+(i+1)+'">Tavolo '+(i+1)+'</option>').join('')+'</select></label><label class="field">Attività<select name="task_type"><option value="cleaning">Pulizia</option><option value="water">Acqua</option><option value="waiter">Cameriere</option></select></label><label class="field">Assegna allo staff<select name="assigned_staff_id"><option value="">Non assegnato</option>'+staffOptions+'</select></label><button class="gold-button" type="submit">Crea attività</button><p id="cctvTaskStatus" class="camera-save-status" role="status"></p></form></section>'+
      '<section class="panel"><div class="ai-section-heading"><div><h2>Attività recenti</h2><p class="help">Le attività restano manuali finché il sistema AI non viene collegato.</p></div><span class="status-pill status-pending">'+active+' in corso</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Tavolo</th><th>Attività</th><th>Origine</th><th>Staff</th><th>Stato</th><th>Creata</th><th>Scadenza</th><th>Voce</th><th>Azioni</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>'+
      '<section class="panel"><h2>Storico avvisi</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Tipo</th><th>Messaggio</th><th>Data</th><th>Stato</th></tr></thead><tbody>'+alertRows+'</tbody></table></div></section>'+
      '<section class="panel"><h2>Rapporto giornaliero</h2><p>'+esc(today)+' · Attività: '+todays.length+' · Completate: '+completed+' · In attesa: '+todays.filter(x=>x.status==='pending').length+'</p><button class="secondary-button" type="button" id="cctvRefresh">Aggiorna</button></section></div>';
    const tableSelect = $('#cctvTaskForm select[name="table_number"]');
    $('#cctvTaskForm select[name="room_key"]').addEventListener('change', e => {
      const max = e.target.value === 'dining-1' ? 3 : 7;
      tableSelect.innerHTML = Array.from({length:max},(_,i)=>'<option value="'+(i+1)+'">Tavolo '+(i+1)+'</option>').join('');
    });
  } catch (err) {
    content.innerHTML = '<section class="panel"><h2>CCTV Operations</h2><p role="alert">'+esc(err.message||'Errore di caricamento.')+'</p><p>Verifica i permessi amministratore e le tabelle CCTV.</p></section>';
  } finally { busy = false; }
}
async function saveSettings(form) {
  const status=$('#cctvSettingsStatus'), button=form.querySelector('button[type=submit]'); button.disabled=true;
  try { const r=await client.from('cctv_monitoring_settings').upsert({id:true,cleaning_delay_minutes:Number(form.elements.cleaning_delay_minutes.value),italian_voice_enabled:form.elements.italian_voice_enabled.checked,automatic_announcements_enabled:false,updated_at:new Date().toISOString()},{onConflict:'id'}); if(r.error)throw r.error; status.textContent='Impostazioni salvate. Annunci automatici disattivati.'; }
  catch(e){status.textContent=e.message||'Errore di salvataggio.';} finally{button.disabled=false;}
}
async function createTask(form) {
  const status=$('#cctvTaskStatus'), button=form.querySelector('button[type=submit]'); button.disabled=true;
  try { const room=form.elements.room_key.value, table=Number(form.elements.table_number.value), type=form.elements.task_type.value, staffId=form.elements.assigned_staff_id.value||null; let person=null; if(staffId){const p=await client.from('staff').select('full_name').eq('id',staffId).maybeSingle();if(p.error)throw p.error;person=p.data;} let dueAt=null; if(type==='cleaning'){const setting=await client.from('cctv_monitoring_settings').select('cleaning_delay_minutes').eq('id',true).maybeSingle();if(setting.error)throw setting.error;const delay=[2,3].includes(Number(setting.data?.cleaning_delay_minutes))?Number(setting.data.cleaning_delay_minutes):2;dueAt=new Date(Date.now()+delay*60000).toISOString();} const r=await client.from('cctv_table_tasks').insert({room_key:room,table_number:table,task_type:type,status:'pending',source:'manual',assigned_staff_id:staffId,assigned_staff_name:person?.full_name||null,due_at:dueAt});if(r.error)throw r.error;await openPage(); }
  catch(e){status.textContent=e.message||'Impossibile creare l’attività.';} finally{button.disabled=false;}
}
async function updateTask(id,status) {
  try {const patch={status,updated_at:new Date().toISOString()};patch.completed_at=status==='completed'?new Date().toISOString():null;const r=await client.from('cctv_table_tasks').update(patch).eq('id',id);if(r.error)throw r.error;if(status==='completed'){const q=await client.from('cctv_table_tasks').select('room_key,table_number,task_type').eq('id',id).maybeSingle();if(q.error)throw q.error;if(q.data){const labels={cleaning:'Pulizia completata',water:'Acqua consegnata',waiter:'Cameriere arrivato'};const a=await client.from('cctv_alerts').insert({alert_type:'task_completed',severity:'info',task_id:id,message:(labels[q.data.task_type]||'Attività completata')+' · '+q.data.room_key+' · tavolo '+q.data.table_number});if(a.error)throw a.error;}}await openPage();}
  catch(e){window.alert(e.message||'Aggiornamento non riuscito.');await openPage();}
}
async function deleteTask(id) {
  if (!window.confirm('Vuoi rimuovere definitivamente questa attività? Gli avvisi già registrati resteranno nello storico.')) return;
  try {
    const result = await client.from('cctv_table_tasks').delete().eq('id', id);
    if (result.error) throw result.error;
    await openPage();
  } catch (e) {
    window.alert(e.message || 'Rimozione non riuscita.');
  }
}
async function updateAlert(id) {try{const r=await client.from('cctv_alerts').update({acknowledged_at:new Date().toISOString()}).eq('id',id).is('acknowledged_at',null);if(r.error)throw r.error;await openPage();}catch(e){window.alert(e.message||'Conferma non riuscita.');}}
function speak(table,kind) {if(!('speechSynthesis'in window)||typeof SpeechSynthesisUtterance!=='function'){window.alert('Sintesi vocale non disponibile.');return;}const phrase=kind==='water'?'Per favore, portate dell’acqua al tavolo numero '+table+'.':kind==='waiter'?'Per favore, mandate un cameriere al tavolo numero '+table+'.':'Per favore, pulite il tavolo numero '+table+'.';const u=new SpeechSynthesisUtterance(phrase);u.lang='it-IT';u.rate=.9;const voice=speechSynthesis.getVoices().find(v=>/^it[-_]it$/i.test(v.lang))||speechSynthesis.getVoices().find(v=>/^it([_-]|$)/i.test(v.lang));if(voice)u.voice=voice;speechSynthesis.cancel();speechSynthesis.speak(u);}
})();