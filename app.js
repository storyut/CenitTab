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

function updateClockScale() {
  const widget = document.getElementById('widget-clock');
  const clock = document.getElementById('clock');
  if (!widget || !clock) return;
  const width = widget.offsetWidth;
  const height = widget.offsetHeight;
  const size = Math.max(40, Math.min(140, Math.min(width * 0.35, height * 0.75)));
  document.documentElement.style.setProperty('--clock-widget-size', `${size}px`);
}

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
function applyOverlay(pct) { bgOverlay.style.background = `rgba(0,0,0,${pct/100})`; }
function applyBlur(px) {
  bgLayer.style.filter = px > 0 ? `blur(${px}px)` : '';
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
      Store.set('bgPreset', i); Store.set('bgImage', null);
      applyBackground(g, false);
      document.querySelectorAll('.preset-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
    grid.appendChild(sw);
  });
}

const savedImage   = Store.get('bgImage');
const savedPreset  = Store.get('bgPreset') ?? 0;
const savedOverlay = Store.get('bgOverlay') ?? 35;
const savedBlur    = Store.get('bgBlur')    ?? 0;
overlayRange.value = savedOverlay; blurRange.value = savedBlur;
applyOverlay(savedOverlay); applyBlur(savedBlur);
savedImage ? applyBackground(savedImage, true) : applyBackground(PRESETS[savedPreset], false);

overlayRange.addEventListener('input', () => { applyOverlay(overlayRange.value); Store.set('bgOverlay', overlayRange.value); });
blurRange.addEventListener('input',    () => { applyBlur(blurRange.value);       Store.set('bgBlur',    blurRange.value);    });
document.getElementById('bg-upload').addEventListener('change', function() { saveBackgroundImage(this.files[0]); });

const uploadLabel = document.getElementById('upload-label');
['dragenter','dragover'].forEach(ev => uploadLabel.addEventListener(ev, (e) => { e.preventDefault(); uploadLabel.classList.add('drag-over'); }));
['dragleave','drop'].forEach(ev => uploadLabel.addEventListener(ev, (e) => { e.preventDefault(); uploadLabel.classList.remove('drag-over'); }));
uploadLabel.addEventListener('drop', (e) => { saveBackgroundImage(e.dataTransfer.files[0]); });
['dragover','drop'].forEach(ev => document.addEventListener(ev, (e) => { if (!uploadLabel.contains(e.target)) e.preventDefault(); }));
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

function injectFontLink(url, id) {
  if (!url) return;
  let el = document.getElementById(id);
  if (!el) { el = document.createElement('link'); el.rel = 'stylesheet'; el.id = id; document.head.appendChild(el); }
  el.href = url;
}
BUILTIN_FONTS.forEach((f, i) => { if (f.url) injectFontLink(f.url, `builtin-font-${i}`); });
loadCustomFonts();

function getAllFonts() { return [...BUILTIN_FONTS, ...(Store.get('customFonts') ?? [])]; }

function populateFontSelects() {
  const fonts = getAllFonts();
  ['clock-font-select','ui-font-select'].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = '';
    fonts.forEach((f, i) => {
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = f.name; sel.appendChild(opt);
    });
  });
  document.getElementById('clock-font-select').value = Store.get('clockFontIdx') ?? 0;
  document.getElementById('ui-font-select').value    = Store.get('uiFontIdx')    ?? 1;
}

function loadCustomFonts() {
  (Store.get('customFonts') ?? []).forEach((font, i) => { if (font.url) injectFontLink(font.url, `saved-custom-font-${i}`); });
}

function renderCustomFontList() {
  const container = document.getElementById('custom-font-list');
  if (!container) return;
  const customFonts = Store.get('customFonts') ?? [];
  container.innerHTML = '';
  customFonts.forEach((font, index) => {
    const row = document.createElement('div'); row.className = 'custom-font-row';
    const name = document.createElement('span'); name.className = 'custom-font-name'; name.textContent = font.name;
    const del = document.createElement('button'); del.className = 'custom-font-delete'; del.textContent = '✕';
    del.addEventListener('click', () => deleteCustomFont(index));
    row.appendChild(name); row.appendChild(del); container.appendChild(row);
  });
}

function deleteCustomFont(index) {
  const customFonts = Store.get('customFonts') ?? [];
  customFonts.splice(index, 1);
  Store.set('customFonts', customFonts);
  populateFontSelects(); renderCustomFontList();
  const allFonts = getAllFonts();
  if ((Store.get('clockFontIdx') ?? 0) >= allFonts.length) { Store.set('clockFontIdx', 0); applyClockFont(0); }
  if ((Store.get('uiFontIdx')    ?? 1) >= allFonts.length) { Store.set('uiFontIdx',    1); applyUIFont(1);    }
}

function applyClockFont(idx) {
  const f = getAllFonts()[idx]; if (!f) return;
  document.documentElement.style.setProperty('--font-clock', f.css);
  updateFontPreview(f.css);
}
function applyUIFont(idx) {
  const f = getAllFonts()[idx]; if (!f) return;
  document.documentElement.style.setProperty('--font-ui', f.css);
}
function updateFontPreview(css) {
  const el = document.getElementById('font-preview'); if (el) el.style.fontFamily = css;
}

populateFontSelects(); renderCustomFontList();
applyClockFont(Store.get('clockFontIdx') ?? 0);
applyUIFont(Store.get('uiFontIdx') ?? 1);

document.getElementById('clock-font-select').addEventListener('change', function() { Store.set('clockFontIdx', +this.value); applyClockFont(+this.value); });
document.getElementById('ui-font-select').addEventListener('change',    function() { Store.set('uiFontIdx',    +this.value); applyUIFont(+this.value);    });

document.getElementById('apply-custom-font-btn').addEventListener('click', () => {
  const urlInput  = document.getElementById('custom-font-url').value.trim();
  const nameInput = document.getElementById('custom-font-name').value.trim();
  if (!nameInput) { alert('Please enter a font family name.'); return; }
  let cssUrl = urlInput;
  const importMatch = urlInput.match(/url\(['"]?([^'")\s]+)['"]?\)/);
  if (importMatch) cssUrl = importMatch[1];
  const cssVal = `'${nameInput}', sans-serif`;
  const id = `custom-font-${Date.now()}`;
  injectFontLink(cssUrl, id);
  const customFonts = Store.get('customFonts') ?? [];
  customFonts.push({ name: nameInput, css: cssVal, url: cssUrl });
  Store.set('customFonts', customFonts);
  populateFontSelects(); renderCustomFontList();
  document.getElementById('custom-font-url').value  = '';
  document.getElementById('custom-font-name').value = '';
});

// ─── Settings ───────────────────────────────────────────────────────
const toggle12h            = document.getElementById('toggle-12h');
const toggleGreeting       = document.getElementById('toggle-greeting');
const toggleDate           = document.getElementById('toggle-date');
const toggleWidgetClock    = document.getElementById('toggle-widget-clock');
const toggleWidgetBookmarks= document.getElementById('toggle-widget-bookmarks');
const toggleWidgetRecent   = document.getElementById('toggle-widget-recent');
const toggleWidgetMedia    = document.getElementById('toggle-widget-media');
const toggleWidgetNotes    = document.getElementById('toggle-widget-notes');
const recentCountInput     = document.getElementById('recent-count-input');
const toggleBrand          = document.getElementById('toggle-brand');
const brandEl              = document.querySelector('.brand');
const toggleAmPm           = document.getElementById('toggle-ampm');

toggle12h.checked  = !!Store.get('use12h');
toggle12h.addEventListener('change', () => { Store.set('use12h', toggle12h.checked); updateClock(); });
toggleAmPm.checked = Store.get('showAmPm') ?? true;
toggleAmPm.addEventListener('change', () => { Store.set('showAmPm', toggleAmPm.checked); updateClock(); });

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
  el.style.display = Store.get(widgetHiddenKey(id)) ? 'none' : '';
}
function bindWidgetVisibilityToggle(toggle, id) {
  if (!toggle) return;
  toggle.checked = !Store.get(widgetHiddenKey(id));
  toggle.addEventListener('change', () => { Store.set(widgetHiddenKey(id), !toggle.checked); applyWidgetVisibility(id); updateLayoutRows(); });
  applyWidgetVisibility(id);
}
bindWidgetVisibilityToggle(toggleWidgetClock,     'clock');
bindWidgetVisibilityToggle(toggleWidgetBookmarks, 'bookmarks');
bindWidgetVisibilityToggle(toggleWidgetRecent,    'recent');
bindWidgetVisibilityToggle(toggleWidgetMedia,     'media');
bindWidgetVisibilityToggle(toggleWidgetNotes,     'notes');

function applyBrandVisibility() { brandEl.style.display = Store.get('hideBrand') ? 'none' : ''; }
toggleBrand.checked = !Store.get('hideBrand');
applyBrandVisibility();
toggleBrand.addEventListener('change', () => { Store.set('hideBrand', !toggleBrand.checked); applyBrandVisibility(); });

// ─── Notes ──────────────────────────────────────────────────────────
const notesInput    = document.getElementById('notes-input');
const notesPreview  = document.getElementById('notes-preview');
const notesClearBtn = document.getElementById('notes-clear-btn');

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
function renderMarkdown(markdown) {
  let html = escapeHtml(String(markdown ?? ''));
  html = html.replace(/`([^`]+)`/g, (_m, p1) => `<code>${p1}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, (_m, p1) => `<strong>${p1}</strong>`);
  html = html.replace(/(^|\W)\*([^*]+)\*/g, (_m, p0, p1) => `${p0}<em>${p1}</em>`);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);
  html = html.replace(/\n/g, '<br/>');
  return html;
}
function loadNotes() {
  const saved = Store.get('notesMarkdown') ?? '';
  if (notesInput)   notesInput.value = saved;
  if (notesPreview) notesPreview.innerHTML = renderMarkdown(saved);
}
if (notesInput) {
  notesInput.addEventListener('input', () => {
    if (notesPreview) notesPreview.innerHTML = renderMarkdown(notesInput.value);
    Store.set('notesMarkdown', notesInput.value);
  });
}
if (notesClearBtn) {
  notesClearBtn.addEventListener('click', () => {
    if (notesInput)   notesInput.value = '';
    if (notesPreview) notesPreview.innerHTML = '';
    Store.set('notesMarkdown', '');
  });
}
loadNotes();

// ─── Bookmarks ──────────────────────────────────────────────────────
const bookmarkList = document.getElementById('bookmark-list');
const bmManageList = document.getElementById('bm-manage-list');
const bmNameInput  = document.getElementById('bm-name');
const bmUrlInput   = document.getElementById('bm-url');

function getFavicon(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return ''; }
}
function moveBookmark(fromIndex, toIndex) {
  const list = Store.get('bookmarks') ?? [];
  if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
  Store.set('bookmarks', list);
}

// Pencil SVG icon
const PENCIL_SVG = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z"/></svg>`;

function loadBookmarks() {
  const bms = Store.get('bookmarks') ?? [];
  bookmarkList.innerHTML = '';
  bmManageList.innerHTML = '';

  bms.forEach((bm, i) => {
    // ── Widget bar item ──
    const a = document.createElement('a');
    a.className = 'bm-item'; a.href = bm.url; a.title = bm.url;
    const fav = getFavicon(bm.url);
    if (fav) {
      const img = document.createElement('img');
      img.className = 'bm-favicon'; img.src = fav; img.onerror = () => img.remove();
      a.appendChild(img);
    }
    a.appendChild(document.createTextNode(bm.name));
    bookmarkList.appendChild(a);

    // ── Manage panel row ──
    const row = document.createElement('div');
    row.className = 'bm-row';
    row.dataset.index = String(i);
    row.draggable = true;

    // Header line: [pencil] [number] [name] [delete]
    const header = document.createElement('div');
    header.className = 'bm-row-header';

    const expandToggle = document.createElement('button');
    expandToggle.type = 'button';
    expandToggle.className = 'bm-expand-toggle';
    expandToggle.title = 'Edit';
    expandToggle.innerHTML = PENCIL_SVG;

    const orderBadge = document.createElement('span');
    orderBadge.className = 'bm-order';
    orderBadge.textContent = String(i + 1);

    const collapsedName = document.createElement('span');
    collapsedName.className = 'bm-row-collapsed-name';
    collapsedName.textContent = bm.name;

    const del = document.createElement('button');
    del.className = 'bm-del'; del.textContent = '✕'; del.title = 'Delete';

    header.appendChild(expandToggle);
    header.appendChild(orderBadge);
    header.appendChild(collapsedName);
    header.appendChild(del);

    // Expanded edit section
    const expandedWrap = document.createElement('div');
    expandedWrap.className = 'bm-row-expanded';

    const nameLabel = document.createElement('div');
    nameLabel.className = 'bm-field-label'; nameLabel.textContent = 'Name';

    const nameInput = document.createElement('input');
    nameInput.className = 'input'; nameInput.value = bm.name; nameInput.placeholder = 'Name';

    const urlLabel = document.createElement('div');
    urlLabel.className = 'bm-field-label'; urlLabel.textContent = 'URL';

    const urlInput = document.createElement('input');
    urlInput.className = 'input'; urlInput.value = bm.url; urlInput.placeholder = 'https://...';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'bm-apply-btn'; applyBtn.type = 'button'; applyBtn.textContent = 'Apply';

    expandedWrap.appendChild(nameLabel);
    expandedWrap.appendChild(nameInput);
    expandedWrap.appendChild(urlLabel);
    expandedWrap.appendChild(urlInput);
    expandedWrap.appendChild(applyBtn);

    row.appendChild(header);
    row.appendChild(expandedWrap);
    bmManageList.appendChild(row);

    // ── Expand/collapse ──
    function setExpanded(on) {
      row.classList.toggle('bm-row-expanded-state', on);
      if (on) {
        const idx = +row.dataset.index;
        const item = (Store.get('bookmarks') ?? [])[idx];
        nameInput.value = item?.name ?? bm.name;
        urlInput.value  = item?.url  ?? bm.url;
      }
    }
    expandToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setExpanded(!row.classList.contains('bm-row-expanded-state'));
    });

    // ── Delete ──
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      const list = Store.get('bookmarks') ?? [];
      list.splice(+row.dataset.index, 1);
      Store.set('bookmarks', list);
      loadBookmarks();
    });

    // ── Apply edits ──
    applyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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

    // ── Drag reorder ──
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
      row.classList.add('bm-row-dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('bm-row-dragging'));
    row.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = +(e.dataTransfer.getData('text/plain') || i);
      moveBookmark(fromIndex, +row.dataset.index);
      loadBookmarks();
    });
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

// ─── Recently Visited ────────────────────────────────────────────────
const recentList = document.getElementById('recent-list');
function hostnameLabel(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } }
function renderRecentItems(items) {
  recentList.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'recent-empty';
    empty.textContent = globalThis.chrome?.history ? 'No recent visits yet' : 'History permission unavailable';
    recentList.appendChild(empty); return;
  }
  items.forEach(item => {
    const a = document.createElement('a'); a.className = 'recent-item'; a.href = item.url; a.title = item.url;
    const title = document.createElement('div'); title.className = 'recent-title'; title.textContent = item.title || hostnameLabel(item.url);
    const url   = document.createElement('div'); url.className   = 'recent-url';   url.textContent   = hostnameLabel(item.url);
    a.appendChild(title); a.appendChild(url); recentList.appendChild(a);
  });
}
function loadRecentVisits() {
  const count = Math.min(12, Math.max(1, +(Store.get('recentCount') ?? 5)));
  if (recentCountInput) recentCountInput.value = count;
  if (!globalThis.chrome?.history?.search) { renderRecentItems([]); return; }
  chrome.history.search({ text: '', maxResults: count, startTime: 0 }, (items) => {
    renderRecentItems((items ?? []).filter(item => item.url));
  });
}
if (recentCountInput) {
  recentCountInput.value = Store.get('recentCount') ?? 5;
  recentCountInput.addEventListener('change', () => {
    const count = Math.min(12, Math.max(1, +recentCountInput.value || 5));
    recentCountInput.value = count; Store.set('recentCount', count); loadRecentVisits();
  });
}
loadRecentVisits();

// ─── Media ──────────────────────────────────────────────────────────
const mediaStatus = document.getElementById('media-status');
const mediaSource = document.getElementById('media-source');
function renderMediaTab(tab) {
  if (!mediaStatus || !mediaSource) return;
  if (!tab) { mediaStatus.textContent = 'No media playing'; mediaSource.textContent = ''; return; }
  mediaStatus.textContent = tab.title || 'Media playing';
  mediaSource.textContent = tab.url ? hostnameLabel(tab.url) : '';
}
function loadMediaStatus() {
  if (!globalThis.chrome?.tabs?.query) { renderMediaTab(null); return; }
  chrome.tabs.query({ audible: true }, (tabs) => { renderMediaTab((tabs ?? []).find(tab => tab.id)); });
}
loadMediaStatus();
setInterval(loadMediaStatus, 5000);

// ─── Widget System ──────────────────────────────────────────────────
const WIDGETS = ['clock','bookmarks','recent','media','notes'];
let layoutMode = false;

const DEFAULT_POSITIONS = {
  clock:     { x: 50, y: 50, anchor: 'center' },
  bookmarks: { x: 50, y: null, bottom: 36, anchor: 'bottom-center' },
  recent:    { x: 16, y: 28, anchor: 'free-center' },
  media:     { x: 84, y: 28, anchor: 'free-center' },
  notes:     { x: 50, y: 78, anchor: 'free-center' },
};

function posKey(id)  { return `widgetPos_${id}`; }
function sizeKey(id) { return `widgetSize_${id}`; }

function applyWidgetPosition(id, pos) {
  const el = document.getElementById(`widget-${id}`);
  if (!el) return;
  el.style.left = ''; el.style.right = ''; el.style.top = ''; el.style.bottom = ''; el.style.transform = '';
  switch (pos.anchor) {
    case 'center':
      el.style.left = pos.x + '%'; el.style.top = pos.y + '%'; el.style.transform = 'translate(-50%, -50%)'; break;
    case 'bottom-center':
      el.style.left = pos.x + '%'; el.style.bottom = (pos.bottom ?? 36) + 'px'; el.style.transform = 'translateX(-50%)'; break;
    case 'snap-center':
      el.style.left = '50%'; el.style.top = '50%'; el.style.transform = 'translate(-50%, -50%)'; break;
    case 'snap-top-left':     el.style.left = '40px';  el.style.top = '40px'; break;
    case 'snap-top-center':   el.style.left = '50%';   el.style.top = '40px'; el.style.transform = 'translateX(-50%)'; break;
    case 'snap-top-right':    el.style.right = '40px'; el.style.top = '40px'; break;
    case 'snap-mid-left':     el.style.left = '40px';  el.style.top = '50%'; el.style.transform = 'translateY(-50%)'; break;
    case 'snap-mid-right':    el.style.right = '40px'; el.style.top = '50%'; el.style.transform = 'translateY(-50%)'; break;
    case 'snap-bottom-left':  el.style.left = '40px';  el.style.bottom = '40px'; break;
    case 'snap-bottom-center':el.style.left = '50%';   el.style.bottom = '40px'; el.style.transform = 'translateX(-50%)'; break;
    case 'snap-bottom-right': el.style.right = '40px'; el.style.bottom = '40px'; break;
    case 'free-center':
      el.style.left = pos.x + '%'; el.style.top = pos.y + '%'; el.style.transform = 'translate(-50%, -50%)'; break;
    default:
      el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px';
  }
}

function snapZoneToAnchor(zoneName) {
  return {
    'center':     'snap-center',
    'top-left':   'snap-top-left',
    'top-center': 'snap-top-center',
    'top-right':  'snap-top-right',
    'mid-left':   'snap-mid-left',
    'mid-right':  'snap-mid-right',
    'bot-left':   'snap-bottom-left',
    'bot-center': 'snap-bottom-center',
    'bot-right':  'snap-bottom-right',
  }[zoneName];
}

function centerPositionFromRect(rect) {
  return { x: ((rect.left + rect.width / 2) / window.innerWidth) * 100, y: ((rect.top + rect.height / 2) / window.innerHeight) * 100, anchor: 'free-center' };
}
function centerPositionFromPixels(x, y, width, height) {
  return { x: ((x + width / 2) / window.innerWidth) * 100, y: ((y + height / 2) / window.innerHeight) * 100, anchor: 'free-center' };
}

const CLAMP_PAD = 8;
function clampWidget(id) {
  const el = document.getElementById(`widget-${id}`);
  if (!el || el.hidden) return;
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  let dx = 0, dy = 0;
  if (rect.left < CLAMP_PAD)             dx = CLAMP_PAD - rect.left;
  else if (rect.right > vw - CLAMP_PAD)  dx = (vw - CLAMP_PAD) - rect.right;
  if (rect.top < CLAMP_PAD)              dy = CLAMP_PAD - rect.top;
  else if (rect.bottom > vh - CLAMP_PAD) dy = (vh - CLAMP_PAD) - rect.bottom;
  if (dx !== 0 || dy !== 0) {
    const pos = centerPositionFromPixels(rect.left + dx, rect.top + dy, rect.width, rect.height);
    applyWidgetPosition(id, pos);
  }
}
function clampAllWidgets() { WIDGETS.forEach(id => clampWidget(id)); }

// ─── Widget Sizes ───────────────────────────────────────────────────
const WIDGET_MIN = { clock:[160,60], bookmarks:[120,36], recent:[180,80], media:[160,60], notes:[180,100] };
function applyWidgetSize(id, size) {
  const el = document.getElementById(`widget-${id}`); if (!el) return;
  if (size) {
    el.style.width = size.w+'px'; el.style.height = size.h+'px'; el.classList.add('widget-sized');
    if (id === 'clock') requestAnimationFrame(updateClockScale);
  } else {
    el.style.width = ''; el.style.height = ''; el.classList.remove('widget-sized');
    if (id === 'clock') requestAnimationFrame(updateClockScale);
  }
}
function loadWidgetSizes() { WIDGETS.forEach(id => applyWidgetSize(id, Store.get(sizeKey(id)))); }

// ─── Resize ─────────────────────────────────────────────────────────
let resizing = null, rsX = 0, rsY = 0, rsW = 0, rsH = 0;
function enableResize(widgetId) {
  const el = document.getElementById(`widget-${widgetId}`); if (!el) return;
  const handle = document.createElement('div');
  handle.className = 'widget-resize-handle'; handle.title = 'Resize';
  handle.innerHTML = `<svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 8L8 1M4.5 8L8 4.5M8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  el.appendChild(handle);
  const start = (cx, cy) => {
    rsX = cx; rsY = cy; rsW = el.offsetWidth;
    el.style.bottom = 'auto'; rsH = el.offsetHeight; el.style.bottom = '';
    resizing = widgetId;
  };
  handle.addEventListener('mousedown',  (e) => { e.preventDefault(); e.stopPropagation(); start(e.clientX, e.clientY); });
  handle.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
}
function onResizeMove(cx, cy) {
  if (!resizing) return;
  const el = document.getElementById(`widget-${resizing}`);
  const [minW, minH] = WIDGET_MIN[resizing] ?? [100,40];
  const rect = el.getBoundingClientRect();
  const newW = Math.min(window.innerWidth  - rect.left - CLAMP_PAD, Math.max(minW, rsW + (cx - rsX)));
  const newH = Math.min(window.innerHeight - rect.top  - CLAMP_PAD, Math.max(minH, rsH + (cy - rsY)));
  el.style.width = newW+'px'; el.style.height = newH+'px';
  if (resizing === 'clock') updateClockScale();
  el.classList.add('widget-sized');
}
function endResize() {
  if (!resizing) return;
  const el = document.getElementById(`widget-${resizing}`);
  Store.set(sizeKey(resizing), { w: el.offsetWidth, h: el.offsetHeight });
  if (resizing === 'clock') updateClockScale();
  resizing = null;
}
document.addEventListener('mousemove', (e) => { if (resizing) onResizeMove(e.clientX, e.clientY); });
document.addEventListener('touchmove', (e) => { if (resizing) { e.preventDefault(); onResizeMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive:false });
document.addEventListener('mouseup',  endResize);
document.addEventListener('touchend', endResize);

function loadWidgetPositions() {
  WIDGETS.forEach(id => { const pos = Store.get(posKey(id)) ?? DEFAULT_POSITIONS[id]; applyWidgetPosition(id, pos); });
  loadWidgetSizes();
  requestAnimationFrame(() => requestAnimationFrame(clampAllWidgets));
}
loadWidgetPositions();
updateClockScale();
window.addEventListener('resize', () => {
  WIDGETS.forEach(id => { const pos = Store.get(posKey(id)) ?? DEFAULT_POSITIONS[id]; applyWidgetPosition(id, pos); });
  requestAnimationFrame(() => requestAnimationFrame(clampAllWidgets));
});

function resetWidgetPositions() {
  WIDGETS.forEach(id => {
    Store.set(posKey(id), null); Store.set(sizeKey(id), null);
    applyWidgetPosition(id, DEFAULT_POSITIONS[id]); applyWidgetSize(id, null);
  });
  requestAnimationFrame(() => requestAnimationFrame(clampAllWidgets));
  updateLayoutRows();
}
document.getElementById('reset-layout-btn').addEventListener('click', resetWidgetPositions);

// ─── Snap Zones ─────────────────────────────────────────────────────
const SNAP_ZONES = [
  { name: 'top-left',   xPct: 0,   yPct: 0,   padX: 40, padY: 40, label: 'Top Left'    },
  { name: 'top-center', xPct: 50,  yPct: 0,   padX: 0,  padY: 40, label: 'Top Center'  },
  { name: 'top-right',  xPct: 100, yPct: 0,   padX: 40, padY: 40, label: 'Top Right'   },
  { name: 'mid-left',   xPct: 0,   yPct: 50,  padX: 40, padY: 0,  label: 'Left'        },
  { name: 'center',     xPct: 50,  yPct: 50,  padX: 0,  padY: 0,  label: 'Center'      },
  { name: 'mid-right',  xPct: 100, yPct: 50,  padX: 40, padY: 0,  label: 'Right'       },
  { name: 'bot-left',   xPct: 0,   yPct: 100, padX: 40, padY: 40, label: 'Bottom Left' },
  { name: 'bot-center', xPct: 50,  yPct: 100, padX: 0,  padY: 40, label: 'Bottom'      },
  { name: 'bot-right',  xPct: 100, yPct: 100, padX: 40, padY: 40, label: 'Bottom Right'},
];
const SNAP_RADIUS = 90;

// Build 9-cell snap zone overlay
const snapZoneOverlay = document.createElement('div');
snapZoneOverlay.id = 'snap-zone-overlay';
const snapZoneCells = {};
SNAP_ZONES.forEach(zone => {
  const cell = document.createElement('div');
  cell.className = 'snap-zone-cell';
  const lbl = document.createElement('span');
  lbl.className = 'snap-zone-label';
  lbl.textContent = zone.label;
  cell.appendChild(lbl);
  snapZoneOverlay.appendChild(cell);
  snapZoneCells[zone.name] = cell;
});
document.body.appendChild(snapZoneOverlay);

function getSnapPosition(elCenterX, elCenterY, elW, elH) {
  const vw = window.innerWidth, vh = window.innerHeight;
  for (const zone of SNAP_ZONES) {
    let snapX, snapY;
    if (zone.xPct === 0)        snapX = zone.padX;
    else if (zone.xPct === 100) snapX = vw - elW - zone.padX;
    else                        snapX = vw / 2 - elW / 2;
    if (zone.yPct === 0)        snapY = zone.padY;
    else if (zone.yPct === 100) snapY = vh - elH - zone.padY;
    else                        snapY = vh / 2 - elH / 2;
    const snappedCx = snapX + elW / 2;
    const snappedCy = snapY + elH / 2;
    if (Math.hypot(elCenterX - snappedCx, elCenterY - snappedCy) < SNAP_RADIUS) {
      return { zone, snapX, snapY };
    }
  }
  return null;
}

function showSnapOverlay() { snapZoneOverlay.classList.add('visible'); }
function hideSnapOverlay() {
  snapZoneOverlay.classList.remove('visible');
  Object.values(snapZoneCells).forEach(c => c.classList.remove('snap-active'));
}
function highlightSnapZone(zoneName) {
  Object.entries(snapZoneCells).forEach(([name, cell]) => {
    cell.classList.toggle('snap-active', name === zoneName);
  });
}

// Legacy snap indicator (kept for compatibility but now hidden — overlay replaces it)
const snapIndicator = document.createElement('div');
snapIndicator.id = 'snap-indicator';
snapIndicator.style.cssText = 'position:fixed;z-index:25;pointer-events:none;opacity:0;';
document.body.appendChild(snapIndicator);

// ─── Drag ───────────────────────────────────────────────────────────
let dragging = null, dragOffX = 0, dragOffY = 0;

function enableDrag(widgetId) {
  const el = document.getElementById(`widget-${widgetId}`); if (!el) return;
  function onDown(e) {
    if (!layoutMode) return;
    e.preventDefault(); e.stopPropagation();
    const rect = el.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    dragOffX = cx - rect.left; dragOffY = cy - rect.top;
    dragging = widgetId; el.classList.add('dragging');
    el.style.transform = 'none'; el.style.bottom = ''; el.style.right = '';
    el.style.left = rect.left + 'px'; el.style.top = rect.top + 'px';
    showSnapOverlay();
  }
  el.addEventListener('mousedown',  onDown);
  el.addEventListener('touchstart', onDown, { passive: false });
}

function onDragMove(cx, cy) {
  if (!dragging) return;
  const el = document.getElementById(`widget-${dragging}`);
  el.style.transform = 'none'; el.style.bottom = ''; el.style.right = '';
  el.style.left = (cx - dragOffX) + 'px';
  el.style.top  = (cy - dragOffY) + 'px';
  const rect = el.getBoundingClientRect();
  const snap = getSnapPosition(rect.left + rect.width / 2, rect.top + rect.height / 2, rect.width, rect.height);
  highlightSnapZone(snap ? snap.zone.name : null);
}

document.addEventListener('mousemove', (e) => onDragMove(e.clientX, e.clientY));
document.addEventListener('touchmove', (e) => { if (!dragging) return; e.preventDefault(); onDragMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });

function endDrag(e) {
  if (!dragging) return;
  if (e) e.stopPropagation();
  hideSnapOverlay();
  const draggedId = dragging; dragging = null;
  const el = document.getElementById(`widget-${draggedId}`);
  el.classList.remove('dragging');
  const curX = parseFloat(el.style.left) || 0;
  const curY = parseFloat(el.style.top)  || 0;
  const elW  = el.offsetWidth;
  el.style.bottom = 'auto'; const elH = el.offsetHeight; el.style.bottom = '';
  const snap = getSnapPosition(curX + elW / 2, curY + elH / 2, elW, elH);
  let pos;
  if (snap) {
    pos = { anchor: snapZoneToAnchor(snap.zone.name) };
  } else {
    pos = centerPositionFromPixels(curX, curY, elW, elH);
  }
  applyWidgetPosition(draggedId, pos);
  Store.set(posKey(draggedId), pos);
  updateLayoutRows();
}
document.addEventListener('mouseup',  endDrag);
document.addEventListener('touchend', endDrag);

WIDGETS.forEach(enableDrag);
WIDGETS.forEach(enableResize);

// ─── Layout Mode ────────────────────────────────────────────────────
const layoutBanner = document.getElementById('layout-banner');
function setLayoutMode(on) {
  layoutMode = on;
  document.body.classList.toggle('layout-mode', on);
  layoutBanner.classList.toggle('visible', on);
  document.getElementById('layout-btn').classList.toggle('active', on);
}
document.getElementById('layout-done-btn').addEventListener('click', () => { setLayoutMode(false); closePanel('layout-panel'); });

function updateLayoutRows() {
  const container = document.getElementById('layout-widget-rows'); if (!container) return;
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
    row.appendChild(nm); row.appendChild(ps); container.appendChild(row);
  });
}

// ─── Panels ─────────────────────────────────────────────────────────
const profileSelect    = document.getElementById('profile-select');
const profileNameInput = document.getElementById('profile-name');
const saveProfileBtn   = document.getElementById('save-profile-btn');
const loadProfileBtn   = document.getElementById('load-profile-btn');
const deleteProfileBtn = document.getElementById('delete-profile-btn');

function getProfiles()        { return Store.get('layoutProfiles') ?? {}; }
function setProfiles(profiles){ Store.set('layoutProfiles', profiles); }

function captureLayoutProfile() {
  const positions = {}, hidden = {}, sizes = {};
  WIDGETS.forEach(id => {
    positions[id] = Store.get(posKey(id)) ?? DEFAULT_POSITIONS[id];
    hidden[id]    = !!Store.get(widgetHiddenKey(id));
    sizes[id]     = Store.get(sizeKey(id));
  });
  return {
    positions, hidden, sizes,
    backgroundDetails: { bgImage: Store.get('bgImage'), bgPreset: Store.get('bgPreset') ?? 0, bgOverlay: Store.get('bgOverlay') ?? 35, bgBlur: Store.get('bgBlur') ?? 0 },
    clockDetails:      { hideGreeting: !!Store.get('hideGreeting'), hideDate: !!Store.get('hideDate') },
    notesMarkdown:     Store.get('notesMarkdown') ?? ''
  };
}

function applyLayoutProfile(profile) {
  if (!profile) return;
  WIDGETS.forEach(id => {
    const pos = profile.positions?.[id] ?? DEFAULT_POSITIONS[id];
    Store.set(posKey(id), pos); applyWidgetPosition(id, pos);
    const size = profile.sizes?.[id]; Store.set(sizeKey(id), size); applyWidgetSize(id, size || null);
    if (profile.notesMarkdown !== undefined) {
      Store.set('notesMarkdown', profile.notesMarkdown);
      if (notesInput)   notesInput.value = profile.notesMarkdown;
      if (notesPreview) notesPreview.innerHTML = renderMarkdown(profile.notesMarkdown);
    }
    Store.set(widgetHiddenKey(id), !!profile.hidden?.[id]); applyWidgetVisibility(id);
  });
  if (profile.backgroundDetails) {
    const d = profile.backgroundDetails;
    if (d.bgImage  !== undefined) Store.set('bgImage',  d.bgImage);
    if (d.bgPreset !== undefined) Store.set('bgPreset', d.bgPreset);
    if (d.bgOverlay !== undefined) { Store.set('bgOverlay', d.bgOverlay); if (overlayRange) overlayRange.value = d.bgOverlay; applyOverlay(d.bgOverlay); }
    if (d.bgBlur    !== undefined) { Store.set('bgBlur',    d.bgBlur);    if (blurRange)    blurRange.value    = d.bgBlur;    applyBlur(d.bgBlur);       }
    d.bgImage ? applyBackground(d.bgImage, true) : applyBackground(PRESETS[d.bgPreset ?? (Store.get('bgPreset') ?? 0)], false);
  }
  Store.set('hideGreeting', !!profile.clockDetails?.hideGreeting);
  Store.set('hideDate',     !!profile.clockDetails?.hideDate);
  toggleGreeting.checked       = !Store.get('hideGreeting');
  toggleDate.checked           = !Store.get('hideDate');
  toggleWidgetClock.checked    = !Store.get(widgetHiddenKey('clock'));
  toggleWidgetBookmarks.checked= !Store.get(widgetHiddenKey('bookmarks'));
  toggleWidgetRecent.checked   = !Store.get(widgetHiddenKey('recent'));
  toggleWidgetMedia.checked    = !Store.get(widgetHiddenKey('media'));
  toggleWidgetNotes.checked    = !Store.get(widgetHiddenKey('notes'));
  applyVisibility(); updateLayoutRows();
  requestAnimationFrame(() => requestAnimationFrame(clampAllWidgets));
}

function renderProfileOptions(selectedName = Store.get('activeLayoutProfile')) {
  if (!profileSelect) return;
  const profiles = getProfiles();
  const names = Object.keys(profiles).sort((a, b) => a.localeCompare(b));
  profileSelect.innerHTML = '';
  if (!names.length) {
    const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'No saved profiles';
    profileSelect.appendChild(opt); return;
  }
  names.forEach(name => {
    const opt = document.createElement('option'); opt.value = name; opt.textContent = name; profileSelect.appendChild(opt);
  });
  profileSelect.value = names.includes(selectedName) ? selectedName : names[0];
}

saveProfileBtn.addEventListener('click', () => {
  const name = profileNameInput.value.trim() || profileSelect.value || 'Default';
  const profiles = getProfiles(); profiles[name] = captureLayoutProfile(); setProfiles(profiles);
  Store.set('activeLayoutProfile', name); profileNameInput.value = ''; renderProfileOptions(name);
  showToast(`Layout saved: ${name}`);
});
loadProfileBtn.addEventListener('click', () => {
  const name = profileSelect.value; const profile = getProfiles()[name]; if (!profile) return;
  Store.set('activeLayoutProfile', name); applyLayoutProfile(profile); showToast(`Layout loaded: ${name}`);
});
profileSelect.addEventListener('change', () => {
  const name = profileSelect.value; const profile = getProfiles()[name]; if (!profile) return;
  Store.set('activeLayoutProfile', name); applyLayoutProfile(profile); showToast(`Layout loaded: ${name}`);
});
deleteProfileBtn.addEventListener('click', () => {
  const name = profileSelect.value; if (!name) return;
  const profiles = getProfiles(); delete profiles[name]; setProfiles(profiles);
  if (Store.get('activeLayoutProfile') === name) Store.set('activeLayoutProfile', null);
  renderProfileOptions(); showToast(`Deleted layout: ${name}`);
});
renderProfileOptions();

// ─── Toast ──────────────────────────────────────────────────────────
const toastEl = document.createElement('div');
toastEl.className = 'profile-toast hide'; toastEl.setAttribute('role','status'); toastEl.setAttribute('aria-live','polite');
document.body.appendChild(toastEl);
let toastTimer = null;
function showToast(text) {
  toastEl.textContent = text; toastEl.classList.remove('hide'); toastEl.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.classList.remove('show'); toastEl.classList.add('hide'); }, 1400);
}

const backdrop = document.getElementById('backdrop');
let activePanel = null;

function openPanel(id) {
  if (activePanel && activePanel !== id) closePanel(activePanel);
  if (id === 'layout-panel') { updateLayoutRows(); setLayoutMode(true); }
  document.getElementById(id).classList.add('open');
  if (id === 'layout-panel') {
    const panel = document.getElementById('layout-panel');
    panel.classList.remove('collapsed');
    const btn = document.getElementById('layout-collapse-btn');
    if (btn) btn.textContent = '◀';
  }
  if (!layoutMode) backdrop.classList.add('active');
  activePanel = id;
}
function closePanel(id) {
  const el = document.getElementById(id);
  if (el) { el.style.right = ''; el.style.transition = ''; el.classList.remove('open'); if (id === 'layout-panel') el.classList.remove('collapsed'); }
  backdrop.classList.remove('active'); activePanel = null;
  if (id === 'layout-panel') setLayoutMode(false);
}

document.getElementById('bg-btn').addEventListener('click',       () => activePanel === 'bg-panel'       ? closePanel('bg-panel')       : openPanel('bg-panel'));
document.getElementById('bookmark-btn').addEventListener('click', () => activePanel === 'bookmark-panel' ? closePanel('bookmark-panel') : openPanel('bookmark-panel'));
document.getElementById('settings-btn').addEventListener('click', () => activePanel === 'settings-panel' ? closePanel('settings-panel') : openPanel('settings-panel'));
document.getElementById('layout-btn').addEventListener('click',   () => activePanel === 'layout-panel'   ? closePanel('layout-panel')   : openPanel('layout-panel'));

const layoutCollapseBtn = document.getElementById('layout-collapse-btn');
layoutCollapseBtn?.addEventListener('click', () => {
  const panel = document.getElementById('layout-panel');
  panel.classList.toggle('collapsed');
  layoutCollapseBtn.textContent = panel.classList.contains('collapsed') ? '▶' : '◀';
});

document.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', () => closePanel(btn.dataset.target)));
backdrop.addEventListener('click', () => { if (activePanel) closePanel(activePanel); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && activePanel) closePanel(activePanel); });

document.getElementById('reset-layout-default-btn')?.addEventListener('click', () => {
  resetWidgetPositions();
  showToast('Layout reset to defaults');
});
