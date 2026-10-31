(()=>{
 'use strict'; const cfg=window.NABABI_CONFIG||{}; let db=null, rows=[];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 try{if(window.supabase?.createClient&&cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY)db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);}catch(e){console.error('Supabase init:',e);}
 function render(cat){const target=document.querySelector('#menu-list');if(!target)return;const a=cat==='all'?rows:rows.filter(x=>x.category===cat);target.innerHTML=a.length?a.map(x=>`<article class="food"><div>🍛</div><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><b>${x.price==null?'':Number(x.price).toFixed(2)+' €'}</b></article>`).join(''):'<p>Menu non ancora disponibile.</p>';}
 async function load(){if(!db)return;try{const r=await db.from('menu_items').select('id,name,description,price,category,is_available').eq('is_available',true);if(!r.error){rows=r.data||[];render('all');}else console.warn('Menu non disponibile:',r.error.message);}catch(e){console.warn('Menu:',e);}
 try{const n=await db.from('breaking_news').select('title,content,starts_at,ends_at,is_active').eq('is_active',true).limit(1).maybeSingle();if(n.data){const now=Date.now(),start=n.data.starts_at?Date.parse(n.data.starts_at):0,end=n.data.ends_at?Date.parse(n.data.ends_at):Infinity;if(now>=start&&now<=end){const el=document.querySelector('#announcement');if(el){el.hidden=false;el.textContent='✦ '+n.data.title+' — '+(n.data.content||'');}}}}catch(e){console.warn('Breaking news:',e);}}
 document.querySelector('#filters')?.addEventListener('click',e=>{const b=e.target.closest('button[data-cat]');if(!b)return;document.querySelectorAll('#filters button').forEach(x=>x.classList.remove('chosen'));b.classList.add('chosen');render(b.dataset.cat);});
 document.querySelector('#offers')?.addEventListener('click',()=>{const m=document.querySelector('#offer-msg');if(m)m.textContent='Per conoscere le offerte attive, contattaci su WhatsApp.';});
 load();
})();
