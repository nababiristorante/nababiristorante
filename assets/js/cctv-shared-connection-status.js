(() => {
  'use strict';

  // Shared Hik-Connect status indicator for existing Admin Panel modules.
  // This is intentionally a truthful readiness notice, not a simulated connection.
  const targetPages = new Set([
    'ai monitoring',
    'table monitoring',
    'camera management',
    'recording center',
    'fire & smoke monitoring',
    'cctv operations'
  ]);
  const styleId = 'cctvSharedStatusStyles';
  const bannerId = 'cctvSharedConnectionStatus';

  function addStyles() {
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      #${bannerId} {
        display:flex; align-items:flex-start; justify-content:space-between;
        gap:16px; flex-wrap:wrap; margin:0 0 18px; padding:16px 18px;
        border:1px solid rgba(190,145,68,.42); border-radius:14px;
        background:linear-gradient(135deg,rgba(190,145,68,.10),rgba(16,35,27,.06));
      }
      #${bannerId} .cctv-shared-copy { min-width:220px; flex:1; }
      #${bannerId} h2 { margin:0 0 6px; font-size:1rem; }
      #${bannerId} p { margin:4px 0; line-height:1.5; }
      #${bannerId} .cctv-shared-state {
        display:inline-flex; align-items:center; gap:8px; font-weight:700;
        white-space:nowrap; color:var(--text-color,#f1e7d2);
      }
      #${bannerId} .cctv-shared-dot {
        width:9px; height:9px; border-radius:50%; background:#c18a36;
        box-shadow:0 0 0 3px rgba(193,138,54,.16);
      }
      #${bannerId} .cctv-shared-muted { opacity:.82; font-size:.9rem; }
      @media(max-width:600px) {
        #${bannerId} { padding:14px; }
        #${bannerId} .cctv-shared-state { white-space:normal; }
      }
    `;
    document.head.appendChild(style);
  }

  function activeCctvPage() {
    const title = (document.getElementById('pageTitle')?.textContent || '')
      .trim().toLocaleLowerCase('en');
    return targetPages.has(title);
  }

  function renderStatus() {
    const content = document.getElementById('content');
    if (!content || !activeCctvPage()) {
      document.getElementById(bannerId)?.remove();
      return;
    }
    if (document.getElementById(bannerId)) return;
    addStyles();

    const banner = document.createElement('section');
    banner.id = bannerId;
    banner.className = 'panel';
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
      <div class="cctv-shared-copy">
        <h2>Stato unico connessione Hik-Connect / NVR</h2>
        <p class="cctv-shared-muted">Questo stato è condiviso tra i moduli CCTV del pannello NABABI.</p>
        <p><strong>Hik-Connect OpenAPI:</strong> Integrazione non ancora configurata · <strong>NVR:</strong> Non verificato tramite API</p>
        <p class="cctv-shared-muted">Il modello e l'indirizzo LAN salvati non dimostrano da soli che il servizio OpenAPI possa accedere al dispositivo. La connessione P2P deve essere verificata tramite l'account/API autorizzato.</p>
        <p class="cctv-shared-muted">Live View, Playback e rilevamenti automatici restano disattivati finché API, dispositivo, canali e flussi video non superano i test reali.</p>
      </div>
      <div class="cctv-shared-state"><span class="cctv-shared-dot" aria-hidden="true"></span><span>Non configurato</span></div>
    `;
    content.prepend(banner);
  }

  const content = document.getElementById('content');
  const title = document.getElementById('pageTitle');
  if (!content || !title) return;
  const observer = new MutationObserver(renderStatus);
  observer.observe(content, { childList: true, subtree: false });
  observer.observe(title, { childList: true, characterData: true, subtree: true });
  renderStatus();
})();
