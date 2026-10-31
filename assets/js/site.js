
(() => {
  'use strict';

  const cfg = window.NABABI_CONFIG || {};
  const NEWS_TABLE = 'breaking_news';
  const REFRESH_MS = 30000;

  document.documentElement.lang = 'it';

  const escapeHTML = value =>
    String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));

  function createNewsBar() {
    let bar = document.getElementById('breakingNewsBar');

    if (!bar) {
      bar = document.createElement('section');
      bar.id = 'breakingNewsBar';
      bar.className = 'breaking-news-bar';
      bar.setAttribute('aria-live', 'polite');

      const header = document.querySelector('.site-header');

      if (header) {
        header.insertAdjacentElement('afterend', bar);
      } else {
        document.body.prepend(bar);
      }
    }

    return bar;
  }

  function validNews(item, now) {
    if (!item || item.is_active !== true) return false;

    const start = Date.parse(item.starts_at);
    const end = Date.parse(item.ends_at);

    return Number.isFinite(start) &&
      Number.isFinite(end) &&
      start <= now &&
      now < end;
  }

  function renderNews(items) {
    const bar = createNewsBar();
    const now = Date.now();

    const active = (items || [])
      .filter(item => validNews(item, now))
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

    if (!active.length) {
      bar.hidden = true;
      bar.innerHTML = '';
      return;
    }

    bar.hidden = false;

    bar.innerHTML = active.map(item => {
      const image = item.image_url
        ? `<img class="breaking-news-image"
             src="${escapeHTML(item.image_url)}"
             alt=""
             loading="lazy">`
        : '';

      const video = item.youtube_url
        ? `<a class="breaking-news-video"
             href="${escapeHTML(item.youtube_url)}"
             target="_blank"
             rel="noopener noreferrer">Guarda il video</a>`
        : '';

      return `
        <article class="breaking-news-item">
          <div class="breaking-news-content">
            <span class="breaking-news-label">ULTIME NOTIZIE</span>
            <div>
              <h2>${escapeHTML(item.title)}</h2>
              <p>${escapeHTML(item.body)}</p>
              ${video}
            </div>
          </div>
          ${image}
        </article>
      `;
    }).join('');
  }

  async function loadBreakingNews(client) {
    const bar = createNewsBar();

    try {
      const { data, error } = await client
        .from(NEWS_TABLE)
        .select('id,title,body,image_url,youtube_url,starts_at,ends_at,is_active')
        .eq('is_active', true)
        .lte('starts_at', new Date().toISOString())
        .gt('ends_at', new Date().toISOString())
        .order('starts_at', { ascending: true });

      if (error) throw error;

      renderNews(data || []);
    } catch (error) {
      console.error('Breaking News:', error.message);
      bar.hidden = true;
      bar.innerHTML = '';
    }
  }

  function startNews() {
    if (
      !window.supabase ||
      !cfg.SUPABASE_URL ||
      !cfg.SUPABASE_ANON_KEY
    ) {
      console.warn('Supabase public configuration not available for Breaking News.');
      return;
    }

    const client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY
    );

    loadBreakingNews(client);

    window.setInterval(() => {
      loadBreakingNews(client);
    }, REFRESH_MS);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) loadBreakingNews(client);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startNews);
  } else {
    startNews();
  }
})();
