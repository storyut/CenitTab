/* ── Lumina New Tab · app.js ── */

// ─── Storage ────────────────────────────────────────────────────────
const Store = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
};

// ─── Clock ──────────────────────────────────────────────────────────
const clockEl  = document.getElementById('clock');
const dateEl   = document.getElementById('date');
const greetEl  = document.getElementById('greeting');

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}
function greetingText(h) {
  if (h < 5)  return 'Burning the midnight oil.';
  if (h < 12) return 'Good morning.';
  if (h < 17) return 'Good afternoon.';
  if (h < 21) return 'Good evening.';
  return 'Good night.';
}
function updateClock() {
  const now = new Date();
  const h   = now.getHours();
  const m   = now.getMinutes().toString().padStart(2,'0');

  const use12 = Store.get('use12h');
  const showAmPm = Store.get('showAmPm') ?? true;

  const hh  = (use12 ? h % 12 || 12 : h).toString().padStart(2,'0');
  const ampm = (use12 && showAmPm) ? ` ${h < 12 ? 'AM' : 'PM'}` : '';

  clockEl.textContent = `${hh}:${m}${ampm}`;
  dateEl.textContent  = `${DAYS[now.getDay()]}, ${ordinal(now.getDate())} ${MONTHS[now.getMonth()]}`;
  greetEl.textContent = greetingText(h);
}
setInterval(updateClock, 1000);
updateClock();

// ─── Background ─────────────────────────────────────────────────────
const bgLayer      = document.getElementById('bg-layer');
const bgOverlay    = document.getElementById('bg-overlay');
const overlayRange = document.getElementById('overlay-range');
const blurRange    = document.getElementById('blur-range');
const blurVal      = document.getElementById('blur-val');

const PRESETS = [
  'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
  'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
  'linear-gradient(135deg,#0d1b2a,#1b4332,#081c15)',
  'linear-gradient(135deg,#2d1b69,#11998e,#38ef7d)',
  'linear-gradient(135deg,#1c1c1c,#3a3a3a,#1c1c1c)',
  'linear-gradient(135deg,#4a0000,#1a0000,#2d0000)',
  'linear-gradient(135deg,#0a192f,#112240,#020c1b)',
  'linear-gradient(135deg,#2c003e,#1a0533,#4a0080)',
  'linear-gradient(135deg,#141414,#2b2b2b,#0a0a0a)',
];

function applyBackground(value, isImage) {
  if (isImage) {
    bgLayer.style.backgroundImage    = `url(${value})`;
    bgLayer.style.backgroundSize     = 'cover';
    bgLayer.style.backgroundPosition = 'center';
  } else {
    bgLayer.style.backgroundImage = value;
  }
}

function saveBackgroundImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    Store.set('bgImage', e.target.result);
    applyBackground(e.target.result, true);
    document.getElementById('upload-text').textContent = file.name;
    document.querySelectorAll('.preset-swatch').forEach(s => s.classList.remove('active'));
  };
  reader.readAsDataURL(file);
}
function applyOverlay(pct) {
  bgOverlay.style.background = `rgba(0,0,0,${pct/100})`;
}
function applyBlur(px) {
  bgLayer.style.filter = px > 0 ? `blur(${px}px)` : '';
  // expand slightly so blurred edges don't show
  bgLayer.style.inset  = px > 0 ? `-${px*2}px` : '0';
  if (blurVal) blurVal.textContent = `${px}px`;
}

function buildPresetGrid() {
  const grid  = document.getElementById('preset-grid');
  const saved = Store.get('bgPreset') ?? 0;
  PRESETS.forEach((g, i) => {
    const sw = document.createElement('div');
    sw.className = 'preset-swatch' + (i === saved && !Store.get('bgImage') ? ' active' : '');
    sw.style.backgroundImage = g;
    sw.addEventListener('click', () => {
      Store.set('bgPreset', i);
      Store.set('bgImage', null);
      applyBackground(g, false);
      document.querySelectorAll('.preset-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
    grid.appendChild(sw);
  });
}

// Restore
const savedImage   = Store.get('bgImage');
const savedPreset  = Store.get('bgPreset') ?? 0;
const savedOverlay = Store.get('bgOverlay') ?? 35;
const savedBlur    = Store.get('bgBlur')    ?? 0;
overlayRange.value = savedOverlay;
blurRange.value    = savedBlur;
applyOverlay(savedOverlay);
applyBlur(savedBlur);
savedImage ? applyBackground(savedImage, true) : applyBackground(PRESETS[savedPreset], false);

overlayRange.addEventListener('input', () => {
  applyOverlay(overlayRange.value);
  Store.set('bgOverlay', overlayRange.value);
});
blurRange.addEventListener('input', () => {
  applyBlur(blurRange.value);
  Store.set('bgBlur', blurRange.value);
});
document.getElementById('bg-upload').addEventListener('change', function() {
  saveBackgroundImage(this.files[0]);
});

const uploadLabel = document.getElementById('upload-label');
['dragenter', 'dragover'].forEach(eventName => {
  uploadLabel.addEventListener(eventName, (e) => {
    e.preventDefault();
    uploadLabel.classList.add('drag-over');
  });
});
['dragleave', 'drop'].forEach(eventName => {
  uploadLabel.addEventListener(eventName, (e) => {
    e.preventDefault();
    uploadLabel.classList.remove('drag-over');
  });
});
uploadLabel.addEventListener('drop', (e) => {
  saveBackgroundImage(e.dataTransfer.files[0]);
});
['dragover', 'drop'].forEach(eventName => {
  document.addEventListener(eventName, (e) => {
    if (!uploadLabel.contains(e.target)) e.preventDefault();
  });
});

buildPresetGrid();

// ─── Fonts ──────────────────────────────────────────────────────────
const BUILTIN_FONTS = [
  { name: 'Cormorant Garamond', css: "'Cormorant Garamond', serif",     url: null },
  { name: 'DM Mono',            css: "'DM Mono', monospace",             url: null },
  { name: 'Playfair Display',   css: "'Playfair Display', serif",
    url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300;400;700&display=swap' },
  { name: 'Space Mono',         css: "'Space Mono', monospace",
    url: 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap' },
  { name: 'Josefin Sans',       css: "'Josefin Sans', sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@100;300;400&display=swap' },
  { name: 'Cinzel',             css: "'Cinzel', serif",
    url: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&display=swap' },
  { name: 'Raleway',            css: "'Raleway', sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Raleway:wght@100;300;400&display=swap' },
  { name: 'IBM Plex Mono',      css: "'IBM Plex Mono', monospace",
    url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400&display=swap' },
];

// Dynamically inject a <link> for a font URL
function injectFontLink(url, id) {
  if (!url) return;
  let el = document.getElementById(id);
  if (!el) { el = document.createElement('link'); el.rel = 'stylesheet'; el.id = id; document.head.appendChild(el); }
  el.href = url;
}

// Pre-load all built-in fonts
BUILTIN_FONTS.forEach((f, i) => { if (f.url) injectFontLink(f.url, `builtin-font-${i}`); });

function getAllFonts() {
  const custom = Store.get('customFonts') ?? [];
  return [...BUILTIN_FONTS, ...custom];
}

function populateFontSelects() {
  const fonts = getAllFonts();
  ['clock-font-select','ui-font-select'].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = '';
    fonts.forEach((f, i) => {
      const opt = document.createElement('option');
      opt.value       = i;
      opt.textContent = f.name;
      sel.appendChild(opt);
    });
  });
  // Restore saved selections
  const savedClock = Store.get('clockFontIdx') ?? 0;
  const savedUI    = Store.get('uiFontIdx')    ?? 1;
  document.getElementById('clock-font-select').value = savedClock;
  document.getElementById('ui-font-select').value    = savedUI;
}

function applyClockFont(idx) {
  const f = getAllFonts()[idx];
  if (!f) return;
  document.documentElement.style.setProperty('--font-clock', f.css);
  updateFontPreview(f.css);
}
function applyUIFont(idx) {
  const f = getAllFonts()[idx];
  if (!f) return;
  document.documentElement.style.setProperty('--font-ui', f.css);
}
function updateFontPreview(css) {
  const el = document.getElementById('font-preview');
  if (el) el.style.fontFamily = css;
}

// Restore fonts on load
populateFontSelects();
applyClockFont(Store.get('clockFontIdx') ?? 0);
applyUIFont(Store.get('uiFontIdx') ?? 1);

document.getElementById('clock-font-select').addEventListener('change', function() {
  Store.set('clockFontIdx', +this.value);
  applyClockFont(+this.value);
});
document.getElementById('ui-font-select').addEventListener('change', function() {
  Store.set('uiFontIdx', +this.value);
  applyUIFont(+this.value);
});

// Custom font from Google Fonts URL
document.getElementById('apply-custom-font-btn').addEventListener('click', () => {
  const urlInput  = document.getElementById('custom-font-url').value.trim();
  const nameInput = document.getElementById('custom-font-name').value.trim();
  if (!nameInput) { alert('Please enter a font family name.'); return; }

  // Accept either @import URL or a direct CSS URL
  let cssUrl = urlInput;
  const importMatch = urlInput.match(/url\(['"]?([^'")\s]+)['"]?\)/);
  if (importMatch) cssUrl = importMatch[1];

  const cssVal = `'${nameInput}', sans-serif`;
  const id     = `custom-font-${Date.now()}`;
  injectFontLink(cssUrl, id);

  const customFonts = Store.get('customFonts') ?? [];
  customFonts.push({ name: nameInput, css: cssVal, url: cssUrl });
  Store.set('customFonts', customFonts);

  populateFontSelects();
  document.getElementById('custom-font-url').value  = '';
  document.getElementById('custom-font-name').value = '';
});

// ─── Settings — Clock Format & Visibility ───────────────────────────
const toggle12h       = document.getElementById('toggle-12h');
const toggleGreeting  = document.getElementById('toggle-greeting');
const toggleDate      = document.getElementById('toggle-date');
const toggleWidgetClock = document.getElementById('toggle-widget-clock');
const toggleWidgetBookmarks = document.getElementById('toggle-widget-bookmarks');
const toggleWidgetRecent = document.getElementById('toggle-widget-recent');
const toggleWidgetMedia = document.getElementById('toggle-widget-media');
const recentCountInput = document.getElementById('recent-count-input');
const toggleBrand = document.getElementById('toggle-brand');
const brandEl = document.querySelector('.brand');
const toggleAmPm = document.getElementById('toggle-ampm');

toggle12h.checked = !!Store.get('use12h');
toggle12h.addEventListener('change', () => { Store.set('use12h', toggle12h.checked); updateClock(); });
toggleAmPm.checked = Store.get('showAmPm') ?? true;

toggleAmPm.addEventListener('change', () => {
  Store.set('showAmPm', toggleAmPm.checked);
  updateClock();
});

function applyVisibility() {
  greetEl.style.display = Store.get('hideGreeting') ? 'none' : '';
  dateEl.style.display  = Store.get('hideDate')     ? 'none' : '';
}
toggleGreeting.checked = !Store.get('hideGreeting');
toggleDate.checked     = !Store.get('hideDate');
toggleGreeting.addEventListener('change', () => { Store.set('hideGreeting', !toggleGreeting.checked); applyVisibility(); });
toggleDate.addEventListener('change',     () => { Store.set('hideDate',     !toggleDate.checked);     applyVisibility(); });
applyVisibility();

function widgetHiddenKey(id) { return `widgetHidden_${id}`; }
function applyWidgetVisibility(id) {
  const el = document.getElementById(`widget-${id}`);
  if (!el) return;
  el.hidden = !!Store.get(widgetHiddenKey(id));
}
function bindWidgetVisibilityToggle(toggle, id) {
  if (!toggle) return;
  toggle.checked = !Store.get(widgetHiddenKey(id));
  toggle.addEventListener('change', () => {
    Store.set(widgetHiddenKey(id), !toggle.checked);
    applyWidgetVisibility(id);
    updateLayoutRows();
  });
  applyWidgetVisibility(id);
}
bindWidgetVisibilityToggle(toggleWidgetClock, 'clock');
bindWidgetVisibilityToggle(toggleWidgetBookmarks, 'bookmarks');
bindWidgetVisibilityToggle(toggleWidgetRecent, 'recent');
bindWidgetVisibilityToggle(toggleWidgetMedia, 'media');

function applyBrandVisibility() {
  const hidden = Store.get('hideBrand');
  brandEl.style.display = hidden ? 'none' : '';
}
// init state
toggleBrand.checked = !Store.get('hideBrand');
applyBrandVisibility();
// listener
toggleBrand.addEventListener('change', () => {
  Store.set('hideBrand', !toggleBrand.checked);
  applyBrandVisibility();
});

// ─── Notes (Markdown Sticky Note) ────────────────────────────────
const notesInput = document.getElementById('notes-input');
const notesPreview = document.getElementById('notes-preview');
const notesSaveBtn = document.getElementById('notes-save-btn');
const notesClearBtn = document.getElementById('notes-clear-btn');

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (ch) => ({'&':'&amp;','<':'<','>':'>','"':'"'}[ch]));
}

function renderMarkdown(markdown) {
  const md = String(markdown ?? '');

  // Minimal safe markdown subset:
  // - inline code `...`
  // - bold **...**
  // - italic *...*
  // - links [text](url)
  // - line breaks
  let html = escapeHtml(md);

  html = html.replace(/`([^`]+)`/g, (_m, p1) => `<code>${p1}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, (_m, p1) => `<strong>${p1}</strong>`);
  html = html.replace(/(^|\W)\*([^*]+)\*/g, (_m, p0, p1) => `${p0}<em>${p1}</em>`);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);

  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br/>');
  return html;
}

function loadNotes() {
  const saved = Store.get('notesMarkdown') ?? '';
  if (notesInput) notesInput.value = saved;
  if (notesPreview) notesPreview.innerHTML = renderMarkdown(saved);
}

if (notesInput) {
  notesInput.addEventListener('input', () => {
    if (notesPreview) notesPreview.innerHTML = renderMarkdown(notesInput.value);
  });
}

if (notesSaveBtn) {
  notesSaveBtn.addEventListener('click', () => {
    const val = notesInput?.value ?? '';
    Store.set('notesMarkdown', val);
    if (notesPreview) notesPreview.innerHTML = renderMarkdown(val);
  });
}

if (notesClearBtn) {
  notesClearBtn.addEventListener('click', () => {
    if (notesInput) notesInput.value = '';
    Store.set('notesMarkdown', '');
    if (notesPreview) notesPreview.innerHTML = '';
  });
}

loadNotes();

// ─── Bookmarks ──────────────────────────────────────────────────────
const bookmarkList = document.getElementById('bookmark-list');

const bmManageList = document.getElementById('bm-manage-list');
const bmNameInput  = document.getElementById('bm-name');
const bmUrlInput   = document.getElementById('bm-url');

function getFavicon(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; }
  catch { return ''; }
}

function moveBookmark(fromIndex, toIndex) {
  const list = Store.get('bookmarks') ?? [];
  if (fromIndex < 0 || fromIndex >= list.length) return;
  if (toIndex < 0 || toIndex >= list.length) return;
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
  Store.set('bookmarks', list);
}

function loadBookmarks() {
  const bms = Store.get('bookmarks') ?? [];
  bookmarkList.innerHTML = '';
  bmManageList.innerHTML = '';

  bms.forEach((bm, i) => {
    // Widget row

    const a = document.createElement('a');

    a.className = 'bm-item';
    a.href = bm.url;
    a.title = bm.url;
    const fav = getFavicon(bm.url);
    if (fav) {
      const img = document.createElement('img');
      img.className = 'bm-favicon';
      img.src = fav;
      img.onerror = () => img.remove();
      a.appendChild(img);
    }
    a.appendChild(document.createTextNode(bm.name));
    bookmarkList.appendChild(a);

    // Manage row (collapsed by default)
    const row = document.createElement('div');
    row.className = 'bm-row bm-row-collapsed';
    row.dataset.index = String(i);
    row.draggable = true;

    const collapsedName = document.createElement('span');
    collapsedName.className = 'bm-row-collapsed-name';
    collapsedName.textContent = bm.name;

    const orderBadge = document.createElement('span');
    orderBadge.className = 'bm-order';
    orderBadge.textContent = String(i + 1);

    const expandToggle = document.createElement('button');
    expandToggle.type = 'button';
    expandToggle.className = 'bm-expand-toggle';
    expandToggle.title = 'Edit';
    expandToggle.innerHTML = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="11" height="11"><path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;


    const del = document.createElement('button');
    del.className = 'bm-del';
    del.textContent = '✕';
    del.title = 'Delete';

    const expandedWrap = document.createElement('div');
    expandedWrap.className = 'bm-row-expanded';

    const nameInput = document.createElement('input');
    nameInput.className = 'input';
    nameInput.style.marginBottom = '0';
    nameInput.value = bm.name;
    nameInput.placeholder = 'Name';

    const urlInput = document.createElement('input');
    urlInput.className = 'input';
    urlInput.style.marginBottom = '0';
    urlInput.value = bm.url;
    urlInput.placeholder = 'https://...';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'action-btn';
    applyBtn.textContent = 'Apply';

    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const list = Store.get('bookmarks') ?? [];
      const idx = +row.dataset.index;
      list.splice(idx, 1);
      Store.set('bookmarks', list);
      loadBookmarks();
    });

    // Editing controls must use the latest index from dataset, not the captured loop index.
    // Keep this consistent after drag-reorder.


    applyBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const idx = +row.dataset.index;
      const name = (nameInput.value || '').trim();
      let url = (urlInput.value || '').trim();
      if (!name || !url) return;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      const list = Store.get('bookmarks') ?? [];
      if (idx < 0 || idx >= list.length) return;
      list[idx] = { name, url };
      Store.set('bookmarks', list);
      loadBookmarks();
    });


    function setRowExpanded(nextExpanded) {
      row.classList.toggle('bm-row-collapsed', !nextExpanded);
      row.classList.toggle('bm-row-expanded-state', nextExpanded);

      if (nextExpanded) {
        // When opening the row for editing, ensure inputs are the latest values
        // using the row's current index (so it stays correct after drag reorder).
        const idx = +row.dataset.index;
        const list = Store.get('bookmarks') ?? [];
        const item = list[idx];
        nameInput.value = item?.name ?? bm.name;
        urlInput.value = item?.url ?? bm.url;
      }
    }

    // Start collapsed
    row.classList.add('bm-row-collapsed');
    row.classList.remove('bm-row-expanded-state');


    // Expand/collapse is controlled ONLY via the icon next to the number
    expandToggle.addEventListener('click', (ev) => {
      ev.stopPropagation();
      // Don't expand/collapse while actively dragging
      if (row.classList.contains('bm-row-dragging')) return;
      const nextExpanded = !row.classList.contains('bm-row-expanded-state');
      setRowExpanded(nextExpanded);
    });




    // Drag reorder
    row.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', String(i));
      // prevent clicking selects
      row.style.opacity = '0.6';
    });
    row.addEventListener('dragend', () => {
      row.style.opacity = '';
    });
    row.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
    });
    row.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const fromIndex = +(ev.dataTransfer.getData('text/plain') || i);
      const toIndex = +row.dataset.index;
      moveBookmark(fromIndex, toIndex);
      loadBookmarks();
    });

    expandedWrap.appendChild(nameInput);
    expandedWrap.appendChild(urlInput);
    expandedWrap.appendChild(applyBtn);

    // Top row: [pencil] [number] [name] ... [del]
    const topRow = document.createElement('div');
    topRow.className = 'bm-row-top';
    topRow.appendChild(expandToggle);
    topRow.appendChild(orderBadge);
    topRow.appendChild(collapsedName);
    topRow.appendChild(del);

    row.appendChild(topRow);
    row.appendChild(expandedWrap);


    bmManageList.appendChild(row);
  });
}

document.getElementById('save-bm-btn').addEventListener('click', () => {

  const name = bmNameInput.value.trim();

  let url = bmUrlInput.value.trim();
  if (!name || !url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const bms = Store.get('bookmarks') ?? [];
  bms.push({ name, url });
  Store.set('bookmarks', bms);
  bmNameInput.value = ''; bmUrlInput.value = '';
  loadBookmarks();
});
document.getElementById('add-bm-btn').addEventListener('click', () => openPanel('bookmark-panel'));
loadBookmarks();

// ─── Widget Dragging ────────────────────────────────────────────────
// Recently Visited
const recentList = document.getElementById('recent-list');

function hostnameLabel(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function renderRecentItems(items) {
  recentList.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'recent-empty';
    empty.textContent = globalThis.chrome?.history ? 'No recent visits yet' : 'History permission unavailable';
    recentList.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const a = document.createElement('a');
    a.className = 'recent-item';
    a.href = item.url;
    a.title = item.url;

    const title = document.createElement('div');
    title.className = 'recent-title';
    title.textContent = item.title || hostnameLabel(item.url);

    const url = document.createElement('div');
    url.className = 'recent-url';
    url.textContent = hostnameLabel(item.url);

    a.appendChild(title);
    a.appendChild(url);
    recentList.appendChild(a);
  });
}

function loadRecentVisits() {
  const count = Math.min(12, Math.max(1, +(Store.get('recentCount') ?? 5)));
  if (recentCountInput) recentCountInput.value = count;

  if (!globalThis.chrome?.history?.search) {
    renderRecentItems([]);
    return;
  }

  chrome.history.search({ text: '', maxResults: count, startTime: 0 }, (items) => {
    renderRecentItems((items ?? []).filter(item => item.url));
  });
}

if (recentCountInput) {
  recentCountInput.value = Store.get('recentCount') ?? 5;
  recentCountInput.addEventListener('change', () => {
    const count = Math.min(12, Math.max(1, +recentCountInput.value || 5));
    recentCountInput.value = count;
    Store.set('recentCount', count);
    loadRecentVisits();
  });
}
loadRecentVisits();

// Media
const mediaStatus = document.getElementById('media-status');
const mediaSource = document.getElementById('media-source');

function renderMediaTab(tab) {
  if (!mediaStatus || !mediaSource) return;
  if (!tab) {
    mediaStatus.textContent = 'No media playing';
    mediaSource.textContent = '';
    return;
  }
  mediaStatus.textContent = tab.title || 'Media playing';
  mediaSource.textContent = tab.url ? hostnameLabel(tab.url) : '';
}

function loadMediaStatus() {
  if (!globalThis.chrome?.tabs?.query) {
    renderMediaTab(null);
    return;
  }

  chrome.tabs.query({ audible: true }, (tabs) => {
    renderMediaTab((tabs ?? []).find(tab => tab.id));
  });
}
loadMediaStatus();
setInterval(loadMediaStatus, 5000);

const WIDGETS = ['clock','bookmarks','recent','media','notes'];
let layoutMode = false;

// Defaults use stable anchors; dragged widgets are saved by center percentage.
const DEFAULT_POSITIONS = {
  clock:     { x: 50, y: 50, anchor: 'center' },
  bookmarks: { x: 50, y: null, bottom: 36, anchor: 'bottom-center' },
  recent:    { x: 16, y: 28, anchor: 'free-center' },
  media:     { x: 84, y: 28, anchor: 'free-center' },
  notes:     { x: 50, y: 78, anchor: 'free-center' },
};


function posKey(id) { return `widgetPos_${id}`; }

function applyWidgetPosition(id, pos) {
  const el = document.getElementById(`widget-${id}`);
  if (!el) return;
  // Clear all positional styles first
  el.style.left = ''; el.style.right = ''; el.style.top = ''; el.style.bottom = '';
  el.style.transform = '';

  if (pos.anchor === 'center') {
    el.style.left      = pos.x + '%';
    el.style.top       = pos.y + '%';
    el.style.transform = 'translate(-50%, -50%)';
  } else if (pos.anchor === 'bottom-center') {
    el.style.left      = pos.x + '%';
    el.style.bottom    = (pos.bottom ?? 36) + 'px';
    el.style.transform = 'translateX(-50%)';
  } else if (pos.anchor === 'free-center') {
    el.style.left      = pos.x + '%';
    el.style.top       = pos.y + '%';
    el.style.transform = 'translate(-50%, -50%)';
  } else {
    // free absolute
    el.style.left = pos.x + 'px';
    el.style.top  = pos.y + 'px';
  }
}

function centerPositionFromRect(rect) {
  return {
    x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
    y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
    anchor: 'free-center',
  };
}

function centerPositionFromPixels(x, y, width, height) {
  return {
    x: ((x + width / 2) / window.innerWidth) * 100,
    y: ((y + height / 2) / window.innerHeight) * 100,
    anchor: 'free-center',
  };
}

function readCurrentWidgetPosition(id) {
  const el = document.getElementById(`widget-${id}`);
  if (!el) return DEFAULT_POSITIONS[id];
  const rect = el.getBoundingClientRect();
  return centerPositionFromRect(rect);
}

function loadWidgetPositions() {
  WIDGETS.forEach(id => {
    const saved = Store.get(posKey(id));
    const pos = saved ?? DEFAULT_POSITIONS[id];
    applyWidgetPosition(id, pos);
    if (pos.anchor === 'free') {
      requestAnimationFrame(() => {
        const normalized = readCurrentWidgetPosition(id);
        Store.set(posKey(id), normalized);
        applyWidgetPosition(id, normalized);
        updateLayoutRows();
      });
    }
  });
}
loadWidgetPositions();

function resetWidgetPositions() {
  WIDGETS.forEach(id => {
    Store.set(posKey(id), null);
    applyWidgetPosition(id, DEFAULT_POSITIONS[id]);
  });
  updateLayoutRows();
}
document.getElementById('reset-layout-btn').addEventListener('click', resetWidgetPositions);

document.getElementById('reset-layout-default-btn').addEventListener('click', () => {
  // Reset everything: widget positions + widget visibility + bookmark list? (leave bookmarks as-is)
  resetWidgetPositions();

  // Reset widget visibility toggles
  WIDGETS.forEach(id => {
    Store.set(widgetHiddenKey(id), false);
    applyWidgetVisibility(id);
  });

  // Reset background settings
  Store.set('bgImage', null);
  Store.set('bgPreset', 0);
  Store.set('bgOverlay', 35);
  Store.set('bgBlur', 0);
  if (overlayRange) { overlayRange.value = 35; }
  if (blurRange) { blurRange.value = 0; }
  applyOverlay(35);
  applyBlur(0);
  applyBackground(PRESETS[0], false);


  // Reset clock details (keep default clock/date visible)
  Store.set('hideGreeting', false);
  Store.set('hideDate', false);
  toggleGreeting.checked = true;
  toggleDate.checked = true;
  applyVisibility();

  // Keep brand visibility as-is (default: on). Do not change hideBrand.

  // Reset layout profile selection
  Store.set('activeLayoutProfile', null);
  renderProfileOptions();

  updateLayoutRows();
});

// Drag logic
let dragging = null, dragOffX = 0, dragOffY = 0;

// ── Snap zones ───────────────────────────────────────────────────────
// Each zone: { xPct, yPct, pad } where pad is px inset from edge for corners.
// Center uses translate(-50%,-50%), edges use their respective anchors.
const SNAP_ZONES = [
  { name: 'center',       xPct: 50,  yPct: 50,  padX: 0,  padY: 0  },
  { name: 'top-left',     xPct: 0,   yPct: 0,   padX: 40, padY: 40 },
  { name: 'top-center',   xPct: 50,  yPct: 0,   padX: 0,  padY: 40 },
  { name: 'top-right',    xPct: 100, yPct: 0,   padX: 40, padY: 40 },
  { name: 'mid-left',     xPct: 0,   yPct: 50,  padX: 40, padY: 0  },
  { name: 'mid-right',    xPct: 100, yPct: 50,  padX: 40, padY: 0  },
  { name: 'bot-left',     xPct: 0,   yPct: 100, padX: 40, padY: 40 },
  { name: 'bot-center',   xPct: 50,  yPct: 100, padX: 0,  padY: 40 },
  { name: 'bot-right',    xPct: 100, yPct: 100, padX: 40, padY: 40 },
];
const SNAP_RADIUS = 90; // px — how close the widget centre must be to snap

function getSnapPosition(elCenterX, elCenterY, elW, elH) {
  const vw = window.innerWidth, vh = window.innerHeight;

  for (const zone of SNAP_ZONES) {
    // Absolute px position of this zone's anchor point on screen
    const zx = (zone.xPct / 100) * vw;
    const zy = (zone.yPct / 100) * vh;

    // Where the widget's top-left would land if snapped to this zone,
    // accounting for corner padding
    let snapX, snapY;
    if (zone.xPct === 0)   snapX = zone.padX;
    else if (zone.xPct === 100) snapX = vw - elW - zone.padX;
    else                   snapX = vw / 2 - elW / 2;

    if (zone.yPct === 0)   snapY = zone.padY;
    else if (zone.yPct === 100) snapY = vh - elH - zone.padY;
    else                   snapY = vh / 2 - elH / 2;

    // Widget centre if snapped here
    const snappedCx = snapX + elW / 2;
    const snappedCy = snapY + elH / 2;

    const dist = Math.hypot(elCenterX - snappedCx, elCenterY - snappedCy);
    if (dist < SNAP_RADIUS) {
      return { zone, snapX, snapY };
    }
  }
  return null;
}

// Snap indicator element
const snapIndicator = document.createElement('div');
snapIndicator.id = 'snap-indicator';
snapIndicator.style.cssText = `
  position:fixed; z-index:25; pointer-events:none;
  border:2px solid rgba(201,169,110,0.7); border-radius:10px;
  background:rgba(201,169,110,0.08);
  transition:all 0.12s ease; opacity:0;
`;
document.body.appendChild(snapIndicator);

function showSnapIndicator(x, y, w, h) {
  Object.assign(snapIndicator.style, {
    left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', opacity: '1'
  });
}
function hideSnapIndicator() { snapIndicator.style.opacity = '0'; }

function enableDrag(widgetId) {
  const el = document.getElementById(`widget-${widgetId}`);
  if (!el) return;

  function onDown(e) {
    if (!layoutMode) return;
    e.preventDefault();
    e.stopPropagation();

    // 1. Read true screen rect BEFORE any style changes.
    const rect = el.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;

    // 2. Offset = where inside the widget the pointer landed.
    dragOffX = cx - rect.left;
    dragOffY = cy - rect.top;

    dragging = widgetId;
    el.classList.add('dragging');

    // 3. Kill transform first, then place via px so top-left lands exactly
    //    at rect.left/top — the transform:none removes any translate(-50%,-50%)
    //    so the element won't double-offset on the next paint.
    el.style.transform = 'none';
    el.style.bottom    = '';
    el.style.right     = '';
    el.style.left      = rect.left + 'px';
    el.style.top       = rect.top  + 'px';

    // 4. Slide the layout panel away while dragging.
    slidePanelForDrag(true);
  }

  el.addEventListener('mousedown',  onDown);
  el.addEventListener('touchstart', onDown, { passive: false });
}

function onDragMove(cx, cy) {
  if (!dragging) return;
  const el   = document.getElementById(`widget-${dragging}`);

  // Keep widget in a pure px-positioned state while dragging.
  // This prevents any translate() scaling/jitter from default anchors.
  el.style.transform = 'none';
  el.style.bottom = '';
  el.style.right = '';

  const newX = cx - dragOffX;
  const newY = cy - dragOffY;
  el.style.left = newX + 'px';
  el.style.top  = newY + 'px';
  hideSnapIndicator();
}


document.addEventListener('mousemove', (e) => onDragMove(e.clientX, e.clientY));
document.addEventListener('touchmove', (e) => {
  if (!dragging) return;
  e.preventDefault();
  onDragMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

function endDrag(e) {
  if (!dragging) return;
  if (e) e.stopPropagation();
  hideSnapIndicator();

  const draggedId = dragging;
  const el  = document.getElementById(`widget-${draggedId}`);
  el.classList.remove('dragging');

  // Compute final position from actual rendered pixels.
  // This avoids mismatches caused by the bookmark widget's default anchor styles
  // (e.g. bottom: 36px + transforms) when drag ended.
  const rect = el.getBoundingClientRect();
  const elW = rect.width, elH = rect.height;
  const curX = rect.left;
  const curY = rect.top;
  const pos = centerPositionFromPixels(curX, curY, elW, elH);

  // Ensure we end up in the px/absolute coordinate system consistently.
  el.style.transform = 'none';

  applyWidgetPosition(draggedId, pos);

  Store.set(posKey(draggedId), pos);
  updateLayoutRows();
  dragging = null;
  slidePanelForDrag(false);
}
document.addEventListener('mouseup',  endDrag);
document.addEventListener('touchend', endDrag);


// ─── Layout Panel Slide-away During Drag ──────────────────────────────
// Hides the panel while dragging; hover near right edge to peek it back.
let panelPeeking = false;

function slidePanelForDrag(hide) {
  const panel = document.getElementById('layout-panel');
  if (!panel.classList.contains('open')) return;
  if (hide) {
    panel.style.transition = 'right 0.25s cubic-bezier(.4,0,.2,1)';
    panel.style.right = '-320px'; // push almost fully off, no peek tab
    // peek listener added separately — only fires when NOT dragging
  } else {
    document.removeEventListener('mousemove', onPeekCheck);
    panel.style.transition = 'right 0.25s cubic-bezier(.4,0,.2,1)';
    panel.style.right = '0px';
    panelPeeking = false;
    // Clear inline style after transition so CSS .open class takes over again
    setTimeout(() => { panel.style.right = ''; panel.style.transition = ''; }, 260);
    // Re-attach peek listener now that drag is done
    document.addEventListener('mousemove', onPeekCheck);
  }
}

function onPeekCheck(e) {
  // Never peek while actively dragging a widget
  if (dragging) return;
  const panel = document.getElementById('layout-panel');
  if (!panel.classList.contains('open')) return;
  const nearRight = e.clientX > window.innerWidth - 60;
  if (nearRight && !panelPeeking) {
    panelPeeking = true;
    panel.style.transition = 'right 0.2s ease';
    panel.style.right = '0px';
  } else if (!nearRight && panelPeeking) {
    panelPeeking = false;
    panel.style.transition = 'right 0.2s ease';
    panel.style.right = '-320px';
  }
}

WIDGETS.forEach(enableDrag);

// ─── Layout Mode ────────────────────────────────────────────────────
const layoutBanner = document.getElementById('layout-banner');

function setLayoutMode(on) {
  layoutMode = on;
  document.body.classList.toggle('layout-mode', on);
  layoutBanner.classList.toggle('visible', on);
  document.getElementById('layout-btn').classList.toggle('active', on);
}

document.getElementById('layout-done-btn').addEventListener('click', () => {
  setLayoutMode(false);
  closePanel('layout-panel');
});

function updateLayoutRows() {
  const container = document.getElementById('layout-widget-rows');
  if (!container) return;
  container.innerHTML = '';
  WIDGETS.forEach(id => {
    const saved = Store.get(posKey(id));
    const pos   = saved ?? DEFAULT_POSITIONS[id];
    const row   = document.createElement('div'); row.className = 'layout-row';
    const nm    = document.createElement('span'); nm.className = 'layout-row-name';
    nm.textContent = id.charAt(0).toUpperCase() + id.slice(1);
    const ps    = document.createElement('span'); ps.className = 'layout-row-pos';
    if (Store.get(widgetHiddenKey(id))) {
      ps.textContent = 'Hidden';
    } else if (pos.anchor === 'free-center') {
      ps.textContent = `${Math.round(pos.x)}% / ${Math.round(pos.y)}%`;
    } else if (pos.anchor === 'free') {
      ps.textContent = `${Math.round(pos.x)}px, ${Math.round(pos.y)}px`;
    } else if (pos.anchor === 'center') {
      ps.textContent = `${Math.round(pos.x)}% / ${Math.round(pos.y)}% (center)`;
    } else {
      ps.textContent = `${Math.round(pos.x)}% / bottom ${pos.bottom ?? 36}px`;
    }
    row.appendChild(nm); row.appendChild(ps);
    container.appendChild(row);
  });
}

// ─── Panel Toggle ───────────────────────────────────────────────────
// Profiles
const profileSelect = document.getElementById('profile-select');
const profileNameInput = document.getElementById('profile-name');
const saveProfileBtn = document.getElementById('save-profile-btn');
const loadProfileBtn = document.getElementById('load-profile-btn');
const deleteProfileBtn = document.getElementById('delete-profile-btn');

function getProfiles() {
  return Store.get('layoutProfiles') ?? {};
}

function setProfiles(profiles) {
  Store.set('layoutProfiles', profiles);
}

function captureLayoutProfile() {
  const positions = {};
  const hidden = {};
  WIDGETS.forEach(id => {
    positions[id] = Store.get(posKey(id)) ?? DEFAULT_POSITIONS[id];
    hidden[id] = !!Store.get(widgetHiddenKey(id));
  });

  return {
    positions,
    hidden,

    // Include background settings so users get the same look per profile.
    backgroundDetails: {
      bgImage: Store.get('bgImage'),
      bgPreset: Store.get('bgPreset') ?? 0,
      bgOverlay: Store.get('bgOverlay') ?? 35,
      bgBlur: Store.get('bgBlur') ?? 0,
    },

    clockDetails: {
      hideGreeting: !!Store.get('hideGreeting'),
      hideDate: !!Store.get('hideDate'),
    },
  };
}


function applyLayoutProfile(profile) {
  if (!profile) return;

  // Apply widget positions + visibility
  WIDGETS.forEach(id => {
    const pos = profile.positions?.[id] ?? DEFAULT_POSITIONS[id];
    Store.set(posKey(id), pos);
    applyWidgetPosition(id, pos);

    Store.set(widgetHiddenKey(id), !!profile.hidden?.[id]);
    applyWidgetVisibility(id);
  });

  // Apply background settings so profiles fully match the user's theme.
  if (profile.backgroundDetails) {
    const d = profile.backgroundDetails;
    if (d.bgImage !== undefined) {
      Store.set('bgImage', d.bgImage);
    }
    if (d.bgPreset !== undefined) {
      Store.set('bgPreset', d.bgPreset);
    }
    if (d.bgOverlay !== undefined) {
      Store.set('bgOverlay', d.bgOverlay);
      if (overlayRange) overlayRange.value = d.bgOverlay;
      applyOverlay(d.bgOverlay);
    }
    if (d.bgBlur !== undefined) {
      Store.set('bgBlur', d.bgBlur);
      if (blurRange) blurRange.value = d.bgBlur;
      applyBlur(d.bgBlur);
    }

    // Apply the actual background layer (preset vs image).
    if (d.bgImage) {
      applyBackground(d.bgImage, true);
    } else {
      applyBackground(PRESETS[d.bgPreset ?? (Store.get('bgPreset') ?? 0)], false);
    }
  }

  // Apply clock details
  Store.set('hideGreeting', !!profile.clockDetails?.hideGreeting);
  Store.set('hideDate', !!profile.clockDetails?.hideDate);
  toggleGreeting.checked = !Store.get('hideGreeting');
  toggleDate.checked = !Store.get('hideDate');
  toggleWidgetClock.checked = !Store.get(widgetHiddenKey('clock'));
  toggleWidgetBookmarks.checked = !Store.get(widgetHiddenKey('bookmarks'));
  toggleWidgetRecent.checked = !Store.get(widgetHiddenKey('recent'));
  toggleWidgetMedia.checked = !Store.get(widgetHiddenKey('media'));
  applyVisibility();
  updateLayoutRows();
}


function renderProfileOptions(selectedName = Store.get('activeLayoutProfile')) {
  if (!profileSelect) return;
  const profiles = getProfiles();
  const names = Object.keys(profiles).sort((a, b) => a.localeCompare(b));
  profileSelect.innerHTML = '';

  if (!names.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No saved profiles';
    profileSelect.appendChild(opt);
    return;
  }

  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    profileSelect.appendChild(opt);
  });
  profileSelect.value = names.includes(selectedName) ? selectedName : names[0];
}

saveProfileBtn.addEventListener('click', () => {
  const name = profileNameInput.value.trim() || profileSelect.value || 'Default';
  const profiles = getProfiles();
  profiles[name] = captureLayoutProfile();
  setProfiles(profiles);
  Store.set('activeLayoutProfile', name);
  profileNameInput.value = '';
  renderProfileOptions(name);
  showToast(`Layout saved: ${name}`);
});


loadProfileBtn.addEventListener('click', () => {
  const name = profileSelect.value;
  const profile = getProfiles()[name];
  if (!profile) return;
  Store.set('activeLayoutProfile', name);
  applyLayoutProfile(profile);
  showToast(`Layout loaded: ${name}`);
});

profileSelect.addEventListener('change', () => {
  const name = profileSelect.value;
  const profile = getProfiles()[name];
  if (!profile) return;
  Store.set('activeLayoutProfile', name);
  applyLayoutProfile(profile);
  showToast(`Layout loaded: ${name}`);
});


deleteProfileBtn.addEventListener('click', () => {
  const name = profileSelect.value;
  if (!name) return;
  const profiles = getProfiles();
  delete profiles[name];
  setProfiles(profiles);
  if (Store.get('activeLayoutProfile') === name) Store.set('activeLayoutProfile', null);
  renderProfileOptions();
  showToast(`Deleted layout: ${name}`);
});


renderProfileOptions();

// ─── Profile Save/Load Toast ─────────────────────────────────────
const toastEl = document.createElement('div');
toastEl.className = 'profile-toast hide';
toastEl.setAttribute('role', 'status');
toastEl.setAttribute('aria-live', 'polite');
document.body.appendChild(toastEl);

let toastTimer = null;
function showToast(text) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.remove('hide');
  toastEl.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    toastEl.classList.add('hide');
  }, 1400);
}

const backdrop = document.getElementById('backdrop');



let activePanel = null;

function openPanel(id) {
  if (activePanel && activePanel !== id) closePanel(activePanel);
  if (id === 'layout-panel') { updateLayoutRows(); setLayoutMode(true); }
  document.getElementById(id).classList.add('open');
  // Don't activate backdrop in layout mode — it would intercept widget drags
  if (!layoutMode) backdrop.classList.add('active');
  activePanel = id;
}
function closePanel(id) {
  const el = document.getElementById(id);
  if (el) {
    // Clear any inline right override from slidePanelForDrag so CSS handles the slide-out
    el.style.right = '';
    el.style.transition = '';
    el.classList.remove('open');
  }
  backdrop.classList.remove('active');
  activePanel = null;
  if (id === 'layout-panel') {
    setLayoutMode(false);
    document.removeEventListener('mousemove', onPeekCheck);
    panelPeeking = false;
  }
}

document.getElementById('bg-btn').addEventListener('click', () =>
  activePanel === 'bg-panel' ? closePanel('bg-panel') : openPanel('bg-panel'));
document.getElementById('bookmark-btn').addEventListener('click', () =>
  activePanel === 'bookmark-panel' ? closePanel('bookmark-panel') : openPanel('bookmark-panel'));
document.getElementById('settings-btn').addEventListener('click', () =>
  activePanel === 'settings-panel' ? closePanel('settings-panel') : openPanel('settings-panel'));
document.getElementById('layout-btn').addEventListener('click', () =>
  activePanel === 'layout-panel' ? closePanel('layout-panel') : openPanel('layout-panel'));

document.querySelectorAll('.close-btn').forEach(btn =>
  btn.addEventListener('click', () => closePanel(btn.dataset.target)));
backdrop.addEventListener('click', () => { if (activePanel) closePanel(activePanel); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && activePanel) closePanel(activePanel); });
