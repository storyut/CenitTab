/**
 * Search feature: search engines, custom bangs, URL detection,
 * and search form handling.
 */

const SEARCH_ENGINES = {
  google:     { name: 'Google',     url: 'https://www.google.com/search?q=%s' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  bing:       { name: 'Bing',       url: 'https://www.bing.com/search?q=%s' },
  youtube:    { name: 'YouTube',    url: 'https://www.youtube.com/results?search_query=%s' },
  github:     { name: 'GitHub',     url: 'https://github.com/search?q=%s' },
  wikipedia:  { name: 'Wikipedia',  url: 'https://en.wikipedia.org/Special:Search?search=%s' },
};

const SEARCH_SHORTCUTS = {
  g: 'google', google: 'google',
  d: 'duckduckgo', ddg: 'duckduckgo', duck: 'duckduckgo',
  b: 'bing', bing: 'bing',
  y: 'youtube', yt: 'youtube', youtube: 'youtube',
  gh: 'github', git: 'github', github: 'github',
  w: 'wikipedia', wiki: 'wikipedia', wikipedia: 'wikipedia',
};

export function looksLikeUrl(query) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(query)) return true;
  if (/^localhost(?::\d+)?(?:[/?#].*)?$/i.test(query)) return true;
  return /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(query);
}

export function normalizeUrl(query) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(query)) return query;
  if (/^localhost(?::\d+)?(?:[/?#].*)?$/i.test(query)) return `http://${query}`;
  return `https://${query}`;
}

export function buildSearchUrl(engineKey, query) {
  const engine = SEARCH_ENGINES[engineKey] ?? SEARCH_ENGINES.google;
  return engine.url.replace('%s', encodeURIComponent(query));
}

/**
 * Initialize the search feature.
 * @param {object} deps - Dependencies
 * @param {object} deps.store - The Store object
 * @param {Function} deps.showToast - Toast notification function
 * @param {Function} deps.isLayoutMode - Returns true if layout mode is active
 * @returns {object} Search API: resolveSearchDestination, looksLikeUrl, normalizeUrl
 */
export function initSearch(deps) {
  const { store, showToast, isLayoutMode } = deps;
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const searchEngineSelect = document.getElementById('search-engine-select');

  function getDefaultSearchEngine() {
    const saved = store.get('searchEngine') ?? 'google';
    return SEARCH_ENGINES[saved] ? saved : 'google';
  }

  function resolveSearchDestination(rawValue) {
    const value = rawValue.trim();
    if (!value) return null;
    if (!value.includes(' ') && looksLikeUrl(value)) return normalizeUrl(value);

    const firstSpace = value.indexOf(' ');
    if (firstSpace > 0) {
      const shortcut = value.slice(0, firstSpace).toLowerCase();
      const rest = value.slice(firstSpace + 1).trim();
      if (rest) {
        const customBang = (store.get('customBangs') ?? []).find(b => b.key === shortcut);
        if (customBang) return customBang.url.replace('%s', encodeURIComponent(rest));
        if (SEARCH_SHORTCUTS[shortcut]) return buildSearchUrl(SEARCH_SHORTCUTS[shortcut], rest);
      }
    }
    return buildSearchUrl(getDefaultSearchEngine(), value);
  }

  function renderCustomBangList() {
    const list = document.getElementById('custom-bang-list');
    if (!list) return;
    const bangs = store.get('customBangs') ?? [];
    list.innerHTML = '';
    bangs.forEach((bang, i) => {
      const row = document.createElement('div');
      row.className = 'bang-row';
      const key = document.createElement('span');
      key.className = 'bang-key'; key.textContent = bang.key;
      const url = document.createElement('span');
      url.className = 'bang-url'; url.textContent = bang.url;
      const del = document.createElement('button');
      del.className = 'bm-del'; del.textContent = '✕'; del.title = 'Remove';
      del.addEventListener('click', () => {
        const b = store.get('customBangs') ?? [];
        b.splice(i, 1);
        store.set('customBangs', b);
        renderCustomBangList();
      });
      row.appendChild(key); row.appendChild(url); row.appendChild(del);
      list.appendChild(row);
    });
  }

  // Search engine select
  if (searchEngineSelect) {
    searchEngineSelect.value = getDefaultSearchEngine();
    searchEngineSelect.addEventListener('change', () => {
      store.set('searchEngine', searchEngineSelect.value);
      searchInput?.focus();
    });
  }

  // Search form submit
  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const destination = resolveSearchDestination(searchInput.value);
      if (!destination) return;
      window.location.href = destination;
    });
    document.addEventListener('keydown', (e) => {
      if (isLayoutMode()) return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;
      if (e.key === '/' && !isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });
  }

  // Auto-focus the search input so users can start typing immediately.
  if (searchInput && !isLayoutMode()) {
    requestAnimationFrame(() => searchInput.focus());
  }

  // Custom bangs
  document.getElementById('add-bang-btn')?.addEventListener('click', () => {
    const keyEl = document.getElementById('bang-key-input');
    const urlEl = document.getElementById('bang-url-input');
    const key = (keyEl?.value ?? '').trim().toLowerCase().replace(/\s+/g, '');
    const url = (urlEl?.value ?? '').trim();
    if (!key || !url) { showToast('Key and URL required'); return; }
    if (!url.includes('%s')) { showToast('URL must contain %s'); return; }
    const bangs = store.get('customBangs') ?? [];
    if (bangs.some(b => b.key === key)) { showToast(`Bang "${key}" already exists`); return; }
    bangs.push({ key, url });
    store.set('customBangs', bangs);
    if (keyEl) keyEl.value = '';
    if (urlEl) urlEl.value = '';
    renderCustomBangList();
    showToast(`Bang "${key}" added`);
  });
  renderCustomBangList();

  return { resolveSearchDestination, looksLikeUrl, normalizeUrl };
}
