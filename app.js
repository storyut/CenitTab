// ─── Storage ────────────────────────────────────────────────────────
const Store = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
};

// ─── Settings Migrations ────────────────────────────────────────────
const SETTINGS_VERSION = 2;

function migrateV1toV2() {
  const bms = Store.get('bookmarks') ?? [];
  const updated = bms.map(bm => bm.folderId ? bm : { ...bm, folderId: 'general' });
  if (updated.some((bm, i) => bm !== bms[i])) Store.set('bookmarks', updated);
}

function runMigrations() {
  const v = Store.get('settingsVersion') ?? 1;
  if (v < 2) migrateV1toV2();
  Store.set('settingsVersion', SETTINGS_VERSION);
}

runMigrations();

// ─── Theme Accent ───────────────────────────────────────────────────
const DEFAULT_ACCENT = '#c9a96e';

function normalizeHexColor(value, fallback = DEFAULT_ACCENT) {
  const raw = String(value ?? '').trim();
  const full = raw.match(/^#?([0-9a-f]{6})$/i);
  if (full) return `#${full[1].toLowerCase()}`;
  const short = raw.match(/^#?([0-9a-f]{3})$/i);
  if (short) return `#${short[1].split('').map(ch => ch + ch).join('').toLowerCase()}`;
  return fallback;
}

function hexToRgb(hex) {
  const clean = normalizeHexColor(hex).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function applyAccentColor(color, persist = false) {
  const accent = normalizeHexColor(color);
  const { r, g, b } = hexToRgb(accent);
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.25)`);
  if (persist) Store.set('accentColor', accent);
}

applyAccentColor(Store.get('accentColor') ?? DEFAULT_ACCENT);

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
const BG_IMAGE_DB_NAME = 'cenit-background-images';
const BG_IMAGE_DB_VERSION = 1;
const BG_IMAGE_STORE = 'images';
const BG_IMAGE_REF_KIND = 'indexedDBImage';
let activeBgObjectUrl = null;

function isLegacyDataImage(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}
function isBackgroundImageRef(value) {
  return value && typeof value === 'object' && value.kind === BG_IMAGE_REF_KIND && typeof value.key === 'string';
}
function makeBackgroundImageKey(prefix = 'background') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function setStoredValue(key, value) {
  try { Store.set(key, value); }
  catch (err) {
    localStorage.removeItem(key);
    Store.set(key, value);
  }
}
function openBackgroundImageDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(BG_IMAGE_DB_NAME, BG_IMAGE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BG_IMAGE_STORE)) db.createObjectStore(BG_IMAGE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open image storage'));
  });
}
function withBackgroundImageStore(mode, action) {
  return openBackgroundImageDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(BG_IMAGE_STORE, mode);
    const store = tx.objectStore(BG_IMAGE_STORE);
    let request;
    tx.oncomplete = () => { db.close(); resolve(request?.result); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Image storage failed')); };
    try { request = action(store); }
    catch (err) { db.close(); reject(err); }
  }));
}
function saveBackgroundImageBlob(key, blob) {
  return withBackgroundImageStore('readwrite', store => store.put(blob, key));
}
function getBackgroundImageBlob(key) {
  return withBackgroundImageStore('readonly', store => store.get(key));
}
function dataUrlToBlob(dataUrl) {
  const [header, data] = String(dataUrl).split(',');
  if (!header || !data) throw new Error('Invalid image data URL');
  const type = header.match(/^data:([^;]+)/)?.[1] || 'image/png';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read image asset'));
    reader.readAsDataURL(blob);
  });
}
function collectBackgroundImageRefs(value, refs = new Map(), seen = new Set()) {
  if (!value || typeof value !== 'object') return refs;
  if (seen.has(value)) return refs;
  seen.add(value);
  if (isBackgroundImageRef(value)) {
    refs.set(value.key, value);
    return refs;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectBackgroundImageRefs(item, refs, seen));
    return refs;
  }
  Object.values(value).forEach(item => collectBackgroundImageRefs(item, refs, seen));
  return refs;
}
async function collectBackgroundImageAssets(storage) {
  const refs = collectBackgroundImageRefs(storage);
  const images = {};
  for (const [key, ref] of refs) {
    const blob = await getBackgroundImageBlob(key);
    if (!blob) continue;
    images[key] = {
      ...ref,
      type: ref.type || blob.type,
      size: ref.size || blob.size,
      dataUrl: await blobToDataUrl(blob),
    };
  }
  return images;
}
async function saveImportedBackgroundAssets(assets) {
  const images = assets?.backgroundImages;
  if (!images || typeof images !== 'object') return;
  for (const [key, asset] of Object.entries(images)) {
    if (!asset?.dataUrl) continue;
    await saveBackgroundImageBlob(key, dataUrlToBlob(asset.dataUrl));
  }
}
async function prepareImportedBackgroundStorage(storage, assets) {
  await saveImportedBackgroundAssets(assets);
  const prepared = { ...storage };
  if (isLegacyDataImage(prepared.bgImage)) {
    prepared.bgImage = await persistDataUrlAsBackgroundImage(prepared.bgImage);
  }
  if (Array.isArray(prepared.customThemes)) {
    const themes = [];
    for (const theme of prepared.customThemes) {
      if (theme && isLegacyDataImage(theme.bgImage)) {
        themes.push({ ...theme, bgImage: await persistDataUrlAsBackgroundImage(theme.bgImage, theme.name || 'Theme background') });
      } else {
        themes.push(theme);
      }
    }
    prepared.customThemes = themes;
  }
  if (prepared.layoutProfiles && typeof prepared.layoutProfiles === 'object' && !Array.isArray(prepared.layoutProfiles)) {
    const profiles = {};
    for (const [name, profile] of Object.entries(prepared.layoutProfiles)) {
      const image = profile?.backgroundDetails?.bgImage;
      if (isLegacyDataImage(image)) {
        profiles[name] = {
          ...profile,
          backgroundDetails: {
            ...profile.backgroundDetails,
            bgImage: await persistDataUrlAsBackgroundImage(image, `${name} background`),
          },
        };
      } else {
        profiles[name] = profile;
      }
    }
    prepared.layoutProfiles = profiles;
  }
  return prepared;
}
async function persistDataUrlAsBackgroundImage(dataUrl, name = 'Background image') {
  const blob = dataUrlToBlob(dataUrl);
  const key = makeBackgroundImageKey('migrated-background');
  await saveBackgroundImageBlob(key, blob);
  return {
    kind: BG_IMAGE_REF_KIND,
    key,
    name,
    type: blob.type,
    size: blob.size,
    updatedAt: Date.now(),
  };
}
async function normalizeBackgroundImageValue(value, name) {
  if (isBackgroundImageRef(value)) return value;
  if (isLegacyDataImage(value)) return persistDataUrlAsBackgroundImage(value, name);
  return value || null;
}
async function resolveBackgroundImageUrl(value) {
  if (!value) return null;
  if (isLegacyDataImage(value)) return value;
  if (!isBackgroundImageRef(value)) return typeof value === 'string' ? value : null;
  const blob = await getBackgroundImageBlob(value.key);
  return blob ? URL.createObjectURL(blob) : null;
}
function setBackgroundImageUrl(url) {
  if (activeBgObjectUrl) URL.revokeObjectURL(activeBgObjectUrl);
  activeBgObjectUrl = url?.startsWith('blob:') ? url : null;
  bgLayer.style.backgroundImage    = `url(${url})`;
  bgLayer.style.backgroundSize     = 'cover';
  bgLayer.style.backgroundPosition = 'center';
}
async function applyStoredBackgroundImage(value, options = {}) {
  try {
    const normalized = await normalizeBackgroundImageValue(value, options.name);
    if (options.persist) setStoredValue('bgImage', normalized);
    const url = await resolveBackgroundImageUrl(normalized);
    if (!url) throw new Error('Saved image was not found');
    setBackgroundImageUrl(url);
    return true;
  } catch (err) {
    console.warn('Could not load background image', err);
    if (options.persist) setStoredValue('bgImage', null);
    return false;
  }
}
async function applyStoredBackgroundPreview(preview, value) {
  try {
    const url = await resolveBackgroundImageUrl(value);
    if (!url || !preview.isConnected) {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      return;
    }
    preview.style.backgroundImage = `url(${url})`;
    if (url.startsWith('blob:')) preview.dataset.objectUrl = url;
  } catch (err) {
    console.warn('Could not load theme preview image', err);
  }
}
async function migrateLegacyBackgroundImages() {
  try {
    const currentImage = Store.get('bgImage');
    if (isLegacyDataImage(currentImage)) {
      setStoredValue('bgImage', await persistDataUrlAsBackgroundImage(currentImage));
    }

    const themes = Store.get('customThemes');
    if (Array.isArray(themes)) {
      let changed = false;
      const migratedThemes = [];
      for (const theme of themes) {
        if (theme && isLegacyDataImage(theme.bgImage)) {
          migratedThemes.push({ ...theme, bgImage: await persistDataUrlAsBackgroundImage(theme.bgImage, theme.name || 'Theme background') });
          changed = true;
        } else {
          migratedThemes.push(theme);
        }
      }
      if (changed) setStoredValue('customThemes', migratedThemes);
    }

    const profiles = Store.get('layoutProfiles');
    if (profiles && typeof profiles === 'object' && !Array.isArray(profiles)) {
      let changed = false;
      const migratedProfiles = {};
      for (const [name, profile] of Object.entries(profiles)) {
        const image = profile?.backgroundDetails?.bgImage;
        if (isLegacyDataImage(image)) {
          migratedProfiles[name] = {
            ...profile,
            backgroundDetails: {
              ...profile.backgroundDetails,
              bgImage: await persistDataUrlAsBackgroundImage(image, `${name} background`),
            },
          };
          changed = true;
        } else {
          migratedProfiles[name] = profile;
        }
      }
      if (changed) setStoredValue('layoutProfiles', migratedProfiles);
    }
  } catch (err) {
    console.warn('Could not migrate saved background images', err);
  }
}

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
    setBackgroundImageUrl(value);
  } else {
    if (activeBgObjectUrl) URL.revokeObjectURL(activeBgObjectUrl);
    activeBgObjectUrl = null;
    bgLayer.style.backgroundImage = value;
  }
}

async function saveBackgroundImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const key = makeBackgroundImageKey('background');
  const imageRef = {
    kind: BG_IMAGE_REF_KIND,
    key,
    name: file.name,
    type: file.type,
    size: file.size,
    updatedAt: Date.now(),
  };
  try {
    await saveBackgroundImageBlob(key, file);
    setStoredValue('bgImage', imageRef);
    setBackgroundImageUrl(URL.createObjectURL(file));
    document.getElementById('upload-text').textContent = file.name;
    updateBackgroundPresetActive();
    clearActiveTheme();
  } catch (err) {
    console.error('Could not save background image', err);
    showToast('Image could not be saved');
  }
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
      updateBackgroundPresetActive();
      clearActiveTheme();
    });
    grid.appendChild(sw);
  });
}

function updateBackgroundPresetActive() {
  const saved = Store.get('bgPreset') ?? 0;
  const hasImage = !!Store.get('bgImage');
  document.querySelectorAll('.preset-swatch').forEach((sw, i) => {
    sw.classList.toggle('active', !hasImage && i === saved);
  });
}

const savedImage   = Store.get('bgImage');
const savedPreset  = Store.get('bgPreset') ?? 0;
const savedOverlay = Store.get('bgOverlay') ?? 35;
const savedBlur    = Store.get('bgBlur')    ?? 0;
overlayRange.value = savedOverlay; blurRange.value = savedBlur;
applyOverlay(savedOverlay); applyBlur(savedBlur);
applyBackground(PRESETS[savedPreset], false);

overlayRange.addEventListener('input', () => { applyOverlay(overlayRange.value); Store.set('bgOverlay', overlayRange.value); clearActiveTheme(); });
blurRange.addEventListener('input',    () => { applyBlur(blurRange.value);       Store.set('bgBlur',    blurRange.value);    clearActiveTheme(); });
document.getElementById('bg-upload').addEventListener('change', function() { saveBackgroundImage(this.files[0]); });

const uploadLabel = document.getElementById('upload-label');
['dragenter','dragover'].forEach(ev => uploadLabel.addEventListener(ev, (e) => { e.preventDefault(); uploadLabel.classList.add('drag-over'); }));
['dragleave','drop'].forEach(ev => uploadLabel.addEventListener(ev, (e) => { e.preventDefault(); uploadLabel.classList.remove('drag-over'); }));
uploadLabel.addEventListener('drop', (e) => { saveBackgroundImage(e.dataTransfer.files[0]); });
document.addEventListener('dragover', (e) => { if (!uploadLabel.contains(e.target)) e.preventDefault(); });
document.addEventListener('drop', (e) => {
  if (uploadLabel.contains(e.target)) return;
  e.preventDefault();
  const raw = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')).trim();
  if (!raw || !looksLikeUrl(raw)) return;
  const url = normalizeBookmarkUrl(normalizeUrl(raw));
  const hostname = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })();
  const bms = getBookmarks();
  bms.push({ name: hostname, url, folderId: getActiveBookmarkFolderId() });
  setBookmarks(bms);
  loadBookmarks();
  showToast(`Bookmarked: ${hostname}`);
});
buildPresetGrid();
if (savedImage) {
  applyStoredBackgroundImage(savedImage, { persist: true }).then(ok => {
    if (!ok) {
      applyBackground(PRESETS[Store.get('bgPreset') ?? 0], false);
      updateBackgroundPresetActive();
    }
  }).finally(migrateLegacyBackgroundImages);
} else {
  migrateLegacyBackgroundImages();
}

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

document.getElementById('clock-font-select').addEventListener('change', function() { Store.set('clockFontIdx', +this.value); applyClockFont(+this.value); clearActiveTheme(); });
document.getElementById('ui-font-select').addEventListener('change',    function() { Store.set('uiFontIdx',    +this.value); applyUIFont(+this.value);    clearActiveTheme(); });

document.getElementById('apply-custom-font-btn').addEventListener('click', () => {
  const urlInput  = document.getElementById('custom-font-url').value.trim();
  const nameInput = document.getElementById('custom-font-name').value.trim();
  if (!nameInput) { showToast('Enter a font family name'); return; }
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
const toggleWidgetSearch   = document.getElementById('toggle-widget-search');
const toggleWidgetBookmarks= document.getElementById('toggle-widget-bookmarks');
const toggleWidgetRecent   = document.getElementById('toggle-widget-recent');
const toggleWidgetMedia    = document.getElementById('toggle-widget-media');
const toggleWidgetNotes    = document.getElementById('toggle-widget-notes');
const recentCountInput     = document.getElementById('recent-count-input');
const searchEngineSelect   = document.getElementById('search-engine-select');
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
bindWidgetVisibilityToggle(toggleWidgetSearch,    'search');
bindWidgetVisibilityToggle(toggleWidgetBookmarks, 'bookmarks');
bindWidgetVisibilityToggle(toggleWidgetRecent,    'recent');
bindWidgetVisibilityToggle(toggleWidgetMedia,     'media');
bindWidgetVisibilityToggle(toggleWidgetNotes,     'notes');

function applyBrandVisibility() { brandEl.style.display = Store.get('hideBrand') ? 'none' : ''; }
toggleBrand.checked = !Store.get('hideBrand');
applyBrandVisibility();
toggleBrand.addEventListener('change', () => { Store.set('hideBrand', !toggleBrand.checked); applyBrandVisibility(); });

// ─── Search ─────────────────────────────────────────────────────────
const searchForm  = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

const SEARCH_ENGINES = {
  google:     { name: 'Google',     url: 'https://www.google.com/search?q=%s' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  bing:       { name: 'Bing',       url: 'https://www.bing.com/search?q=%s' },
  youtube:    { name: 'YouTube',    url: 'https://www.youtube.com/results?search_query=%s' },
  github:     { name: 'GitHub',     url: 'https://github.com/search?q=%s' },
  wikipedia:  { name: 'Wikipedia',  url: 'https://en.wikipedia.org/wiki/Special:Search?search=%s' },
};
const SEARCH_SHORTCUTS = {
  g: 'google', google: 'google',
  d: 'duckduckgo', ddg: 'duckduckgo', duck: 'duckduckgo',
  b: 'bing', bing: 'bing',
  y: 'youtube', yt: 'youtube', youtube: 'youtube',
  gh: 'github', git: 'github', github: 'github',
  w: 'wikipedia', wiki: 'wikipedia', wikipedia: 'wikipedia',
};

function getDefaultSearchEngine() {
  const saved = Store.get('searchEngine') ?? 'google';
  return SEARCH_ENGINES[saved] ? saved : 'google';
}
function buildSearchUrl(engineKey, query) {
  const engine = SEARCH_ENGINES[engineKey] ?? SEARCH_ENGINES.google;
  return engine.url.replace('%s', encodeURIComponent(query));
}
function looksLikeUrl(query) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(query)) return true;
  if (/^localhost(?::\d+)?(?:[/?#].*)?$/i.test(query)) return true;
  return /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(query);
}
function normalizeUrl(query) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(query)) return query;
  if (/^localhost(?::\d+)?(?:[/?#].*)?$/i.test(query)) return `http://${query}`;
  return `https://${query}`;
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
      const customBang = (Store.get('customBangs') ?? []).find(b => b.key === shortcut);
      if (customBang) return customBang.url.replace('%s', encodeURIComponent(rest));
      if (SEARCH_SHORTCUTS[shortcut]) return buildSearchUrl(SEARCH_SHORTCUTS[shortcut], rest);
    }
  }
  return buildSearchUrl(getDefaultSearchEngine(), value);
}

if (searchEngineSelect) {
  searchEngineSelect.value = getDefaultSearchEngine();
  searchEngineSelect.addEventListener('change', () => {
    Store.set('searchEngine', searchEngineSelect.value);
    searchInput?.focus();
  });
}
if (searchForm && searchInput) {
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const destination = resolveSearchDestination(searchInput.value);
    if (!destination) return;
    window.location.href = destination;
  });
  document.addEventListener('keydown', (e) => {
    if (layoutMode) return;
    const tag = document.activeElement?.tagName?.toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;
    if (e.key === '/' && !isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

// ─── Custom Search Bangs ─────────────────────────────────────────────
function renderCustomBangList() {
  const list = document.getElementById('custom-bang-list');
  if (!list) return;
  const bangs = Store.get('customBangs') ?? [];
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
      const b = Store.get('customBangs') ?? [];
      b.splice(i, 1);
      Store.set('customBangs', b);
      renderCustomBangList();
    });
    row.appendChild(key); row.appendChild(url); row.appendChild(del);
    list.appendChild(row);
  });
}
document.getElementById('add-bang-btn')?.addEventListener('click', () => {
  const keyEl = document.getElementById('bang-key-input');
  const urlEl = document.getElementById('bang-url-input');
  const key = (keyEl?.value ?? '').trim().toLowerCase().replace(/\s+/g, '');
  const url = (urlEl?.value ?? '').trim();
  if (!key || !url) { showToast('Key and URL required'); return; }
  if (!url.includes('%s')) { showToast('URL must contain %s'); return; }
  const bangs = Store.get('customBangs') ?? [];
  if (bangs.some(b => b.key === key)) { showToast(`Bang "${key}" already exists`); return; }
  bangs.push({ key, url });
  Store.set('customBangs', bangs);
  if (keyEl) keyEl.value = '';
  if (urlEl) urlEl.value = '';
  renderCustomBangList();
  showToast(`Bang "${key}" added`);
});
renderCustomBangList();

// ─── Bookmark Widget Context Menu ────────────────────────────────────
let bmCtxMenu = null;
function closeBmContextMenu() { bmCtxMenu?.remove(); bmCtxMenu = null; }
function showBmContextMenu(x, y, bm, idx) {
  closeBmContextMenu();
  const menu = document.createElement('div');
  menu.className = 'bm-ctx-menu';
  const items = [
    { label: 'Rename', action: () => {
      const newName = window.prompt('Rename bookmark', bm.name)?.trim();
      if (!newName) return;
      const list = getBookmarks(); list[idx] = { ...list[idx], name: newName };
      setBookmarks(list); loadBookmarks();
    }},
    { label: 'Edit URL', action: () => {
      const newUrl = window.prompt('Edit URL', bm.url)?.trim();
      if (!newUrl) return;
      const list = getBookmarks(); list[idx] = { ...list[idx], url: newUrl };
      setBookmarks(list); loadBookmarks();
    }},
    { label: 'Delete', danger: true, action: () => {
      const list = getBookmarks(); const removed = list[idx];
      list.splice(idx, 1); setBookmarks(list); loadBookmarks();
      showToast(`Deleted: ${removed.name}`, () => {
        const cur = getBookmarks(); cur.splice(idx, 0, removed); setBookmarks(cur); loadBookmarks();
      });
    }},
  ];
  items.forEach(({ label, action, danger }) => {
    const btn = document.createElement('button');
    btn.className = 'bm-ctx-item' + (danger ? ' danger' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => { closeBmContextMenu(); action(); });
    menu.appendChild(btn);
  });
  const vw = window.innerWidth, vh = window.innerHeight;
  menu.style.cssText = `left:${Math.min(x, vw - 140)}px;top:${Math.min(y, vh - 110)}px`;
  document.body.appendChild(menu);
  bmCtxMenu = menu;
}
document.addEventListener('click', () => closeBmContextMenu());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBmContextMenu(); });

// ─── Settings Search ─────────────────────────────────────────────────
function initSettingsSearch() {
  const input = document.getElementById('settings-search-input');
  const body = document.querySelector('#settings-panel .panel-body');
  if (!input || !body) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const all = [...body.children].filter(el => el !== input);
    if (!q) {
      all.forEach(el => el.style.display = '');
      document.querySelectorAll('.settings-section').forEach(s => s.style.display = '');
      return;
    }
    let sections = [], cur = null;
    all.forEach(el => {
      if (el.classList.contains('label')) {
        cur = { els: [el], text: el.textContent.toLowerCase() };
        sections.push(cur);
      } else if (el.classList.contains('divider')) {
        sections.push({ divider: true, el });
      } else {
        if (!cur) { cur = { els: [], text: '' }; sections.push(cur); }
        cur.els.push(el);
        cur.text += ' ' + el.textContent.toLowerCase();
      }
    });
    sections.forEach(sec => {
      if (sec.divider) return;
      sec.match = sec.text.includes(q);
      sec.els.forEach(el => el.style.display = sec.match ? '' : 'none');
    });
    sections.forEach((sec, i) => {
      if (!sec.divider) return;
      const before = sections.slice(0, i).filter(s => !s.divider);
      const after = sections.slice(i + 1).filter(s => !s.divider);
      sec.el.style.display = before.some(s => s.match) && after.some(s => s.match) ? '' : 'none';
    });
    // auto-expand sections that have matches
    document.querySelectorAll('.settings-section').forEach(section => {
      const sectionBody = section.querySelector('.settings-section-body');
      if (!sectionBody) return;
      const hasMatch = sectionBody.textContent.toLowerCase().includes(q);
      section.style.display = hasMatch ? '' : 'none';
      if (hasMatch) section.removeAttribute('data-collapsed');
    });
  });
}

// ─── Notes ──────────────────────────────────────────────────────────
const notesInput            = document.getElementById('notes-input');
const notesPreview          = document.getElementById('notes-preview');
const notesClearBtn         = document.getElementById('notes-clear-btn');
const notesSelect           = document.getElementById('notes-select');
const notesAddBtn           = document.getElementById('notes-add-btn');
const notesPinBtn           = document.getElementById('notes-pin-btn');
const notesDeleteBtn        = document.getElementById('notes-delete-btn');
const notesPreviewToggleBtn = document.getElementById('notes-preview-toggle-btn');
const notesSaveStatus       = document.getElementById('notes-save-status');
let notesSaveTimer = null;

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
function renderInlineMarkdown(text) {
  let html = String(text ?? '');
  html = html.replace(/`([^`]+)`/g, (_m, p1) => `<code>${p1}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, (_m, p1) => `<strong>${p1}</strong>`);
  html = html.replace(/(^|\W)\*([^*]+)\*/g, (_m, p0, p1) => `${p0}<em>${p1}</em>`);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);
  return html;
}
function renderMarkdown(markdown) {
  const raw = String(markdown ?? '');
  if (!raw.trim()) return '<p class="notes-empty-preview">Nothing written yet.</p>';
  const lines = escapeHtml(raw).split('\n');
  return lines.map((line) => {
    const checklist = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/);
    if (checklist) {
      const checked = checklist[1].toLowerCase() === 'x';
      return `<label class="notes-check${checked ? ' checked' : ''}"><input type="checkbox" disabled ${checked ? 'checked' : ''}/><span>${renderInlineMarkdown(checklist[2])}</span></label>`;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) return `<div class="notes-bullet"><span>${renderInlineMarkdown(bullet[1])}</span></div>`;
    if (!line.trim()) return '<p>&nbsp;</p>';
    return `<p>${renderInlineMarkdown(line)}</p>`;
  }).join('');
}
function makeNote(body = '', pinned = false) {
  return {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: inferNoteTitle(body),
    body,
    pinned,
    updatedAt: Date.now(),
  };
}
function inferNoteTitle(body) {
  const firstLine = String(body ?? '').split('\n').find(line => line.trim())?.trim() ?? '';
  const cleaned = firstLine
    .replace(/^#+\s*/, '')
    .replace(/^[-*]\s+\[( |x|X)\]\s+/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/[`*_#\[\]()]/g, '')
    .trim();
  return (cleaned || 'Untitled Note').slice(0, 36);
}
function sortNotes(notes) {
  return [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}
function getNotes() {
  let notes = Store.get('notesList');
  if (!Array.isArray(notes) || !notes.length) {
    const legacy = Store.get('notesMarkdown') ?? '';
    notes = [makeNote(legacy)];
    Store.set('notesList', notes);
    Store.set('activeNoteId', notes[0].id);
  }
  return notes.map(note => ({
    id: note.id || `note_${Math.random().toString(36).slice(2, 10)}`,
    title: note.title || inferNoteTitle(note.body),
    body: note.body ?? '',
    pinned: !!note.pinned,
    updatedAt: note.updatedAt ?? Date.now(),
  }));
}
function setNotes(notes) {
  Store.set('notesList', notes);
  Store.set('notesMarkdown', getActiveNote(notes)?.body ?? '');
}
function getActiveNote(notes = getNotes()) {
  const activeId = Store.get('activeNoteId');
  return notes.find(note => note.id === activeId) ?? sortNotes(notes)[0] ?? null;
}
function setNotesSaveStatus(text, saving = false) {
  if (!notesSaveStatus) return;
  notesSaveStatus.textContent = text;
  notesSaveStatus.classList.toggle('saving', saving);
}
function flashNotesSaved() {
  setNotesSaveStatus('Saving...', true);
  if (notesSaveTimer) clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(() => setNotesSaveStatus('Saved'), 350);
}
function renderNotesSelect(notes, activeId) {
  if (!notesSelect) return;
  notesSelect.innerHTML = '';
  sortNotes(notes).forEach((note) => {
    const opt = document.createElement('option');
    opt.value = note.id;
    opt.textContent = `${note.pinned ? '★ ' : ''}${note.title || inferNoteTitle(note.body)}`;
    notesSelect.appendChild(opt);
  });
  notesSelect.value = activeId;
}
function renderActiveNote() {
  const notes = getNotes();
  const active = getActiveNote(notes);
  if (!active) return;
  Store.set('activeNoteId', active.id);
  if (notesInput) notesInput.value = active.body ?? '';
  if (notesPreview) notesPreview.innerHTML = renderMarkdown(active.body ?? '');
  if (notesPinBtn) {
    notesPinBtn.textContent = active.pinned ? '★' : '☆';
    notesPinBtn.classList.toggle('active', !!active.pinned);
    notesPinBtn.title = active.pinned ? 'Unpin note' : 'Pin note';
  }
  renderNotesSelect(notes, active.id);
  applyNotesPreviewVisibility();
  setNotesSaveStatus('Saved');
}
function updateActiveNoteBody(body) {
  const notes = getNotes();
  const activeId = Store.get('activeNoteId') || getActiveNote(notes)?.id;
  const next = notes.map(note => {
    if (note.id !== activeId) return note;
    return { ...note, body, title: inferNoteTitle(body), updatedAt: Date.now() };
  });
  setNotes(next);
  if (notesPreview) notesPreview.innerHTML = renderMarkdown(body);
  renderNotesSelect(next, activeId);
  if (notesSelect) notesSelect.value = activeId;
  flashNotesSaved();
}
function applyNotesPreviewVisibility() {
  const hidden = !!Store.get('notesPreviewHidden');
  if (notesPreview) notesPreview.classList.toggle('hidden', hidden);
  if (notesPreviewToggleBtn) notesPreviewToggleBtn.textContent = hidden ? 'Show Preview' : 'Hide Preview';
}
function loadNotes() { renderActiveNote(); }

if (notesInput) {
  notesInput.addEventListener('input', () => updateActiveNoteBody(notesInput.value));
}
if (notesSelect) {
  notesSelect.addEventListener('change', () => {
    Store.set('activeNoteId', notesSelect.value);
    renderActiveNote();
  });
}
if (notesAddBtn) {
  notesAddBtn.addEventListener('click', () => {
    const notes = getNotes();
    const note = makeNote('');
    const next = [...notes, note];
    setNotes(next);
    Store.set('activeNoteId', note.id);
    renderActiveNote();
    flashNotesSaved();
    notesInput?.focus();
  });
}
if (notesPinBtn) {
  notesPinBtn.addEventListener('click', () => {
    const notes = getNotes();
    const activeId = Store.get('activeNoteId') || getActiveNote(notes)?.id;
    const next = notes.map(note => note.id === activeId ? { ...note, pinned: !note.pinned, updatedAt: Date.now() } : note);
    setNotes(next);
    renderActiveNote();
    flashNotesSaved();
  });
}
if (notesDeleteBtn) {
  notesDeleteBtn.addEventListener('click', () => {
    const notes = getNotes();
    const activeId = Store.get('activeNoteId') || getActiveNote(notes)?.id;
    const removed = notes.find(note => note.id === activeId);
    let next = notes.filter(note => note.id !== activeId);
    if (!next.length) next = [makeNote('')];
    setNotes(next);
    Store.set('activeNoteId', sortNotes(next)[0].id);
    renderActiveNote();
    flashNotesSaved();
    if (removed) showToast(`Deleted: ${removed.title || 'Note'}`, () => {
      const cur = getNotes(); cur.push(removed); setNotes(cur);
      Store.set('activeNoteId', removed.id); renderActiveNote();
    });
  });
}
if (notesClearBtn) {
  notesClearBtn.addEventListener('click', () => {
    if (notesInput) notesInput.value = '';
    updateActiveNoteBody('');
  });
}
if (notesPreviewToggleBtn) {
  notesPreviewToggleBtn.addEventListener('click', () => {
    Store.set('notesPreviewHidden', !Store.get('notesPreviewHidden'));
    applyNotesPreviewVisibility();
  });
}
loadNotes();

// ─── Bookmarks ──────────────────────────────────────────────────────
const bookmarkList      = document.getElementById('bookmark-list');
const bmManageList      = document.getElementById('bm-manage-list');
const bmNameInput       = document.getElementById('bm-name');
const bmUrlInput        = document.getElementById('bm-url');
const bookmarkFolderTabs = document.getElementById('bookmark-folder-tabs');
const bmFolderSelect    = document.getElementById('bm-folder-select');
const bmFolderNameInput = document.getElementById('bm-folder-name');
const bmFolderList      = document.getElementById('bm-folder-list');
const DEFAULT_BOOKMARK_FOLDER_ID = 'folder_default';

function getFavicon(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return ''; }
}
function makeBookmarkFolder(name = 'General') {
  return {
    id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || 'General').trim() || 'General',
    createdAt: Date.now(),
  };
}
function normalizeBookmarkFolder(folder, fallbackName = 'General') {
  return {
    id: folder?.id || makeBookmarkFolder(fallbackName).id,
    name: String(folder?.name || fallbackName || 'General').trim() || 'General',
    createdAt: Number(folder?.createdAt) || Date.now(),
  };
}
function getBookmarkFolders() {
  let folders = Store.get('bookmarkFolders');
  if (!Array.isArray(folders) || !folders.length) {
    folders = [{ id: DEFAULT_BOOKMARK_FOLDER_ID, name: 'General', createdAt: Date.now() }];
    Store.set('bookmarkFolders', folders);
  }
  const seen = new Set();
  const normalized = folders.map((folder, index) => normalizeBookmarkFolder(folder, index === 0 ? 'General' : `Folder ${index + 1}`))
    .filter(folder => {
      if (seen.has(folder.id)) return false;
      seen.add(folder.id);
      return true;
    });
  if (!normalized.some(folder => folder.id === DEFAULT_BOOKMARK_FOLDER_ID)) {
    normalized.unshift({ id: DEFAULT_BOOKMARK_FOLDER_ID, name: 'General', createdAt: Date.now() });
  }
  Store.set('bookmarkFolders', normalized);
  return normalized;
}
function setBookmarkFolders(folders) {
  Store.set('bookmarkFolders', folders);
}
function getBookmarks() {
  const folders = getBookmarkFolders();
  const validFolderIds = new Set(folders.map(folder => folder.id));
  const bms = Store.get('bookmarks') ?? [];
  const normalized = (Array.isArray(bms) ? bms : []).map(bm => ({
    name: String(bm?.name ?? '').trim(),
    url: String(bm?.url ?? '').trim(),
    folderId: validFolderIds.has(bm?.folderId) ? bm.folderId : DEFAULT_BOOKMARK_FOLDER_ID,
  })).filter(bm => bm.name && bm.url);
  Store.set('bookmarks', normalized);
  return normalized;
}
function setBookmarks(bookmarks) {
  Store.set('bookmarks', bookmarks);
}
function moveBookmark(fromIndex, toIndex) {
  const list = getBookmarks();
  if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
  setBookmarks(list);
}
function folderNameById(folderId, folders = getBookmarkFolders()) {
  return folders.find(folder => folder.id === folderId)?.name ?? 'General';
}
function populateBookmarkFolderSelect(selectedId) {
  if (!bmFolderSelect) return;
  const folders = getBookmarkFolders();
  const current = selectedId || bmFolderSelect.value || Store.get('activeBookmarkFolderId') || DEFAULT_BOOKMARK_FOLDER_ID;
  bmFolderSelect.innerHTML = '';
  folders.forEach(folder => {
    const opt = document.createElement('option');
    opt.value = folder.id;
    opt.textContent = folder.name;
    bmFolderSelect.appendChild(opt);
  });
  bmFolderSelect.value = folders.some(folder => folder.id === current) ? current : folders[0].id;
}
function renderBookmarkFolders(folders, bookmarks) {
  if (!bmFolderList) return;
  bmFolderList.innerHTML = '';
  folders.forEach(folder => {
    const count = bookmarks.filter(bm => bm.folderId === folder.id).length;
    const row = document.createElement('div');
    row.className = 'bm-folder-row';

    const name = document.createElement('span');
    name.className = 'bm-folder-name';
    name.textContent = folder.name;

    const meta = document.createElement('span');
    meta.className = 'bm-folder-count';
    meta.textContent = `${count} ${count === 1 ? 'bookmark' : 'bookmarks'}`;

    const rename = document.createElement('button');
    rename.className = 'bm-folder-action';
    rename.type = 'button';
    rename.textContent = 'Rename';

    const del = document.createElement('button');
    del.className = 'bm-folder-action danger';
    del.type = 'button';
    del.textContent = 'Delete';
    del.disabled = folder.id === DEFAULT_BOOKMARK_FOLDER_ID;
    del.title = del.disabled ? 'The General folder cannot be deleted' : 'Delete folder';

    row.appendChild(name);
    row.appendChild(meta);
    row.appendChild(rename);
    row.appendChild(del);
    bmFolderList.appendChild(row);

    rename.addEventListener('click', () => {
      const nextName = window.prompt('Rename folder', folder.name)?.trim();
      if (!nextName) return;
      const nextFolders = getBookmarkFolders().map(item => item.id === folder.id ? { ...item, name: nextName } : item);
      setBookmarkFolders(nextFolders);
      loadBookmarks();
    });
    del.addEventListener('click', () => {
      if (folder.id === DEFAULT_BOOKMARK_FOLDER_ID) return;
      const ok = window.confirm(`Delete "${folder.name}"? Bookmarks in this folder will move to General.`);
      if (!ok) return;
      setBookmarkFolders(getBookmarkFolders().filter(item => item.id !== folder.id));
      setBookmarks(getBookmarks().map(bm => bm.folderId === folder.id ? { ...bm, folderId: DEFAULT_BOOKMARK_FOLDER_ID } : bm));
      loadBookmarks();
    });
  });
}

// Pencil SVG icon
const PENCIL_SVG = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z"/></svg>`;

function getActiveBookmarkFolderId(folders = getBookmarkFolders()) {
  const saved = Store.get('activeBookmarkFolderId');
  return folders.some(folder => folder.id === saved) ? saved : folders[0]?.id || DEFAULT_BOOKMARK_FOLDER_ID;
}

function renderBookmarkWidget(bookmarks, folders) {
  if (!bookmarkList) return;
  bookmarkList.innerHTML = '';
  if (bookmarkFolderTabs) bookmarkFolderTabs.innerHTML = '';
  const activeFolderId = getActiveBookmarkFolderId(folders);
  Store.set('activeBookmarkFolderId', activeFolderId);

  const folderBar = bookmarkFolderTabs || document.createElement('div');
  folderBar.className = 'bm-widget-folder-tabs';
  folders.forEach(folder => {
    const count = bookmarks.filter(bm => bm.folderId === folder.id).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bm-widget-folder-tab';
    button.classList.toggle('active', folder.id === activeFolderId);
    button.textContent = folder.name;
    button.title = `${folder.name} · ${count} ${count === 1 ? 'bookmark' : 'bookmarks'}`;
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      Store.set('activeBookmarkFolderId', folder.id);
      populateBookmarkFolderSelect(folder.id);
      renderBookmarkWidget(getBookmarks(), getBookmarkFolders());
    });
    folderBar.appendChild(button);
  });
  if (!bookmarkFolderTabs) bookmarkList.appendChild(folderBar);

  const selectedBookmarks = bookmarks.filter(bm => bm.folderId === activeFolderId);
  if (!selectedBookmarks.length) {
    const empty = document.createElement('div');
    empty.className = 'bm-widget-empty';
    empty.textContent = 'No bookmarks in this folder';
    bookmarkList.appendChild(empty);
    return;
  }

  selectedBookmarks.forEach((bm) => {
    const globalIdx = bookmarks.indexOf(bm);
    const a = document.createElement('a');
    a.className = 'bm-item'; a.href = bm.url; a.title = `${bm.name} · ${bm.url}`;
    const fav = getFavicon(bm.url);
    if (fav) {
      const img = document.createElement('img');
      img.className = 'bm-favicon'; img.src = fav; img.onerror = () => img.remove();
      a.appendChild(img);
    }
    a.appendChild(document.createTextNode(bm.name));
    a.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showBmContextMenu(e.clientX, e.clientY, bm, globalIdx);
    });
    bookmarkList.appendChild(a);
  });
}

function loadBookmarks() {
  const folders = getBookmarkFolders();
  const bms = getBookmarks();
  bookmarkList.innerHTML = '';
  bmManageList.innerHTML = '';
  populateBookmarkFolderSelect();
  renderBookmarkFolders(folders, bms);
  renderBookmarkWidget(bms, folders);

  bms.forEach((bm, i) => {
    // ── Manage panel row ──
    const row = document.createElement('div');
    row.className = 'bm-row';
    row.dataset.index = String(i);
    row.draggable = true;

    // Header line: [pencil] [number] [name] [folder] [delete]
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

    const collapsedFolder = document.createElement('span');
    collapsedFolder.className = 'bm-row-folder-name';
    collapsedFolder.textContent = folderNameById(bm.folderId, folders);

    const del = document.createElement('button');
    del.className = 'bm-del'; del.textContent = '✕'; del.title = 'Delete';

    header.appendChild(expandToggle);
    header.appendChild(orderBadge);
    header.appendChild(collapsedName);
    header.appendChild(collapsedFolder);
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

    const folderLabel = document.createElement('div');
    folderLabel.className = 'bm-field-label'; folderLabel.textContent = 'Folder';

    const folderSelect = document.createElement('select');
    folderSelect.className = 'input select-input';
    folders.forEach(folder => {
      const opt = document.createElement('option');
      opt.value = folder.id;
      opt.textContent = folder.name;
      folderSelect.appendChild(opt);
    });
    folderSelect.value = bm.folderId;

    const applyBtn = document.createElement('button');
    applyBtn.className = 'bm-apply-btn'; applyBtn.type = 'button'; applyBtn.textContent = 'Apply';

    expandedWrap.appendChild(nameLabel);
    expandedWrap.appendChild(nameInput);
    expandedWrap.appendChild(urlLabel);
    expandedWrap.appendChild(urlInput);
    expandedWrap.appendChild(folderLabel);
    expandedWrap.appendChild(folderSelect);
    expandedWrap.appendChild(applyBtn);

    row.appendChild(header);
    row.appendChild(expandedWrap);
    bmManageList.appendChild(row);

    // ── Expand/collapse ──
    function setExpanded(on) {
      row.classList.toggle('bm-row-expanded-state', on);
      if (on) {
        const idx = +row.dataset.index;
        const item = getBookmarks()[idx];
        nameInput.value = item?.name ?? bm.name;
        urlInput.value  = item?.url  ?? bm.url;
        folderSelect.value = item?.folderId ?? DEFAULT_BOOKMARK_FOLDER_ID;
      }
    }
    expandToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setExpanded(!row.classList.contains('bm-row-expanded-state'));
    });

    // ── Delete ──
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      const list = getBookmarks();
      const idx = +row.dataset.index;
      const removed = list[idx];
      list.splice(idx, 1);
      setBookmarks(list);
      loadBookmarks();
      showToast(`Deleted: ${removed.name}`, () => {
        const cur = getBookmarks(); cur.splice(idx, 0, removed); setBookmarks(cur); loadBookmarks();
      });
    });

    // ── Apply edits ──
    applyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = +row.dataset.index;
      const name = (nameInput.value || '').trim();
      let url = (urlInput.value || '').trim();
      const folderId = folderSelect.value || DEFAULT_BOOKMARK_FOLDER_ID;
      if (!name || !url) return;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      const list = getBookmarks();
      if (idx < 0 || idx >= list.length) return;
      list[idx] = { name, url, folderId };
      setBookmarks(list);
      Store.set('activeBookmarkFolderId', folderId);
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

const TRACKING_PARAMS = new Set([
  'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
  'utm_id','utm_source_platform','utm_creative_format','utm_marketing_tactic',
  'fbclid','gclid','dclid','msclkid','twclid','li_fat_id','mc_eid',
  '_ga','_gl','ref','source',
]);

function normalizeBookmarkUrl(raw) {
  let url;
  try { url = new URL(raw.startsWith('http') ? raw : 'https://' + raw); }
  catch { return raw; }
  const toDelete = [...url.searchParams.keys()].filter(k => TRACKING_PARAMS.has(k));
  toDelete.forEach(k => url.searchParams.delete(k));
  return url.toString();
}

function isValidBookmarkUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

document.getElementById('save-bm-btn').addEventListener('click', () => {
  const name = bmNameInput.value.trim();
  let url = bmUrlInput.value.trim();
  const folderId = bmFolderSelect?.value || DEFAULT_BOOKMARK_FOLDER_ID;
  if (!name || !url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  url = normalizeBookmarkUrl(url);
  if (!isValidBookmarkUrl(url)) { showToast('Invalid URL'); return; }
  const bms = getBookmarks();
  if (bms.some(b => normalizeBookmarkUrl(b.url) === url)) { showToast('Bookmark already exists'); return; }
  bms.push({ name, url, folderId });
  setBookmarks(bms);
  Store.set('activeBookmarkFolderId', folderId);
  bmNameInput.value = ''; bmUrlInput.value = '';
  loadBookmarks();
});
document.getElementById('add-bm-folder-btn')?.addEventListener('click', () => {
  const name = bmFolderNameInput?.value.trim();
  if (!name) return;
  const folders = getBookmarkFolders();
  const folder = makeBookmarkFolder(name);
  folders.push(folder);
  setBookmarkFolders(folders);
  Store.set('activeBookmarkFolderId', folder.id);
  if (bmFolderNameInput) bmFolderNameInput.value = '';
  loadBookmarks();
});
bmFolderSelect?.addEventListener('change', () => { Store.set('activeBookmarkFolderId', bmFolderSelect.value); renderBookmarkWidget(getBookmarks(), getBookmarkFolders()); });
document.getElementById('add-bm-btn').addEventListener('click', () => openPanel('bookmark-panel'));

// One-time repair for builds that accidentally saved the bookmark widget as a
// very large transparent box. This only clears the bookmark widget dimensions;
// all bookmarks, folders, and other widget settings remain intact.
if (!Store.get('bookmarkFolderWidgetRepair_v5')) {
  Store.set('widgetSize_bookmarks', null);
  Store.set('bookmarkFolderWidgetRepair_v5', true);
}

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
const WIDGETS = ['clock','search','bookmarks','recent','media','notes'];

// ─── Widget Style Presets ──────────────────────────────────────────
const WIDGET_STYLE_PRESETS = {
  glass:    { opacity: 100, radius: 8,  background: true,  border: true  },
  compact:  { opacity: 85,  radius: 4,  background: true,  border: false },
  plain:    { opacity: 100, radius: 12, background: false, border: false },
  terminal: { opacity: 95,  radius: 0,  background: true,  border: true,  accent: '#00ff88' },
  cardless: { opacity: 100, radius: 0,  background: false, border: false },
};

function applyWidgetStylePreset(widgetId, presetKey) {
  const preset = WIDGET_STYLE_PRESETS[presetKey];
  if (!preset) return;
  const current = Store.get(widgetAppearanceKey(widgetId)) ?? {};
  const next = {
    ...current,
    opacity: preset.opacity,
    radius: preset.radius,
    background: preset.background,
    border: preset.border,
    ...(preset.accent ? { accent: preset.accent } : {}),
  };
  Store.set(widgetAppearanceKey(widgetId), next);
  applyWidgetAppearance(widgetId);
  loadWidgetAppearanceControls();
}

// ─── Per-widget Appearance ─────────────────────────────────────────
const WIDGET_APPEARANCE_DEFAULTS = {
  opacity: 100,
  radius: 8,
  background: true,
  border: true,
  title: true,
  accent: DEFAULT_ACCENT,
};
const WIDGET_LABELS = {
  clock: 'Clock',
  search: 'Search',
  bookmarks: 'Bookmarks',
  recent: 'Recently Visited',
  media: 'Media',
  notes: 'Notes',
};
function widgetAppearanceKey(id) { return `widgetAppearance_${id}`; }
function getWidgetAppearance(id) {
  return { ...WIDGET_APPEARANCE_DEFAULTS, ...(Store.get(widgetAppearanceKey(id)) ?? {}) };
}
function setWidgetAppearance(id, settings) {
  const next = { ...getWidgetAppearance(id), ...settings };
  next.opacity = Math.min(100, Math.max(20, Number(next.opacity) || WIDGET_APPEARANCE_DEFAULTS.opacity));
  next.radius = Math.min(40, Math.max(0, Number(next.radius) || 0));
  next.accent = normalizeHexColor(next.accent, DEFAULT_ACCENT);
  Store.set(widgetAppearanceKey(id), next);
  applyWidgetAppearance(id);
}
function applyWidgetAppearance(id) {
  const el = document.getElementById(`widget-${id}`);
  if (!el) return;
  const settings = getWidgetAppearance(id);
  el.style.opacity = String(settings.opacity / 100);
  el.style.setProperty('--widget-radius', `${settings.radius}px`);
  el.style.setProperty('--widget-accent', normalizeHexColor(settings.accent, DEFAULT_ACCENT));
  el.style.setProperty('--accent', normalizeHexColor(settings.accent, DEFAULT_ACCENT));
  el.classList.toggle('widget-no-bg', !settings.background);
  el.classList.toggle('widget-no-border', !settings.border);
  el.classList.toggle('widget-no-title', !settings.title);
  el.classList.toggle('widget-appearance-bg', !!settings.background);
}
function applyAllWidgetAppearances() {
  WIDGETS.forEach(applyWidgetAppearance);
}
function collectWidgetAppearances() {
  const appearances = {};
  WIDGETS.forEach(id => { appearances[id] = getWidgetAppearance(id); });
  return appearances;
}
function loadWidgetAppearanceControls() {
  const select = document.getElementById('widget-custom-select');
  if (!select) return;
  const id = WIDGETS.includes(select.value) ? select.value : WIDGETS[0];
  select.value = id;
  const settings = getWidgetAppearance(id);
  const opacityRange = document.getElementById('widget-opacity-range');
  const opacityVal = document.getElementById('widget-opacity-val');
  const radiusRange = document.getElementById('widget-radius-range');
  const radiusVal = document.getElementById('widget-radius-val');
  const accentColor = document.getElementById('widget-accent-color');
  const bgToggle = document.getElementById('widget-bg-toggle');
  const borderToggle = document.getElementById('widget-border-toggle');
  const titleToggle = document.getElementById('widget-title-toggle');
  if (opacityRange) opacityRange.value = settings.opacity;
  if (opacityVal) opacityVal.textContent = `${settings.opacity}%`;
  if (radiusRange) radiusRange.value = settings.radius;
  if (radiusVal) radiusVal.textContent = `${settings.radius}px`;
  if (accentColor) accentColor.value = normalizeHexColor(settings.accent, DEFAULT_ACCENT);
  if (bgToggle) bgToggle.checked = !!settings.background;
  if (borderToggle) borderToggle.checked = !!settings.border;
  if (titleToggle) titleToggle.checked = !!settings.title;
}
function bindWidgetAppearanceControls() {
  const select = document.getElementById('widget-custom-select');
  if (!select) return;
  const activeId = () => WIDGETS.includes(select.value) ? select.value : WIDGETS[0];
  const bindInput = (id, key, read, after) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => { setWidgetAppearance(activeId(), { [key]: read(el) }); if (after) after(el); });
    el.addEventListener('change', () => { setWidgetAppearance(activeId(), { [key]: read(el) }); if (after) after(el); });
  };
  select.addEventListener('change', loadWidgetAppearanceControls);
  bindInput('widget-opacity-range', 'opacity', el => +el.value, el => {
    const val = document.getElementById('widget-opacity-val');
    if (val) val.textContent = `${el.value}%`;
  });
  bindInput('widget-radius-range', 'radius', el => +el.value, el => {
    const val = document.getElementById('widget-radius-val');
    if (val) val.textContent = `${el.value}px`;
  });
  bindInput('widget-accent-color', 'accent', el => el.value);
  bindInput('widget-bg-toggle', 'background', el => el.checked);
  bindInput('widget-border-toggle', 'border', el => el.checked);
  bindInput('widget-title-toggle', 'title', el => el.checked);
  document.getElementById('widget-reset-appearance-btn')?.addEventListener('click', () => {
    Store.set(widgetAppearanceKey(activeId()), WIDGET_APPEARANCE_DEFAULTS);
    applyWidgetAppearance(activeId());
    loadWidgetAppearanceControls();
    showToast(`${WIDGET_LABELS[activeId()] ?? 'Widget'} appearance reset`);
  });
  loadWidgetAppearanceControls();
}

let layoutMode = false;

const DEFAULT_POSITIONS = {
  clock:     { x: 50, y: 42, anchor: 'free-center' },
  search:    { x: 50, y: 62, anchor: 'free-center' },
  bookmarks: { x: 50, y: 92, anchor: 'free-center' },
  recent:    { x: 16, y: 28, anchor: 'free-center' },
  media:     { x: 84, y: 28, anchor: 'free-center' },
  notes:     { x: 50, y: 78, anchor: 'free-center' },
};

function posKey(id)  { return `widgetPos_${id}`; }
function sizeKey(id) { return `widgetSize_${id}`; }

const PIXEL_POSITION_WIDGETS = new Set(['search', 'bookmarks']);
function usesPixelPosition(id) { return PIXEL_POSITION_WIDGETS.has(id); }

function clampPercent(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

function clampPixel(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function centerPositionFromPixels(x, y, width, height) {
  return {
    x: clampPercent(((x + width / 2) / window.innerWidth) * 100),
    y: clampPercent(((y + height / 2) / window.innerHeight) * 100),
    anchor: 'free-center'
  };
}

function currentViewportBase() {
  return { vw: window.innerWidth, vh: window.innerHeight };
}

function viewportBaseFromPosition(pos) {
  const vw = Number(pos?.vw);
  const vh = Number(pos?.vh);
  return {
    vw: Number.isFinite(vw) && vw > 0 ? vw : window.innerWidth,
    vh: Number.isFinite(vh) && vh > 0 ? vh : window.innerHeight,
  };
}

function pixelPositionFromPixels(x, y, width = 0, height = 0, base = currentViewportBase()) {
  const maxX = Math.max(CLAMP_PAD, window.innerWidth  - width  - CLAMP_PAD);
  const maxY = Math.max(CLAMP_PAD, window.innerHeight - height - CLAMP_PAD);
  return {
    x: clampPixel(x, CLAMP_PAD, maxX, CLAMP_PAD),
    y: clampPixel(y, CLAMP_PAD, maxY, CLAMP_PAD),
    anchor: 'free',
    vw: base.vw,
    vh: base.vh,
    w: Math.max(0, Number(width) || 0),
    h: Math.max(0, Number(height) || 0),
  };
}

function responsivePixelPosition(pos, width = 0, height = 0) {
  const base = viewportBaseFromPosition(pos);
  const savedW = Number.isFinite(Number(pos?.w)) && Number(pos.w) > 0 ? Number(pos.w) : width;
  const savedH = Number.isFinite(Number(pos?.h)) && Number(pos.h) > 0 ? Number(pos.h) : height;
  const savedCenterX = (Number(pos?.x) || 0) + savedW / 2;
  const savedCenterY = (Number(pos?.y) || 0) + savedH / 2;
  const scaledCenterX = savedCenterX * (window.innerWidth / base.vw);
  const scaledCenterY = savedCenterY * (window.innerHeight / base.vh);
  return pixelPositionFromPixels(scaledCenterX - width / 2, scaledCenterY - height / 2, width, height, base);
}

function ensureStoredPosition(id, pos) {
  if (!pos) return pos;
  if (!usesPixelPosition(id) || pos.anchor !== 'free') return pos;
  const base = viewportBaseFromPosition(pos);
  const w = Number(pos?.w);
  const h = Number(pos?.h);
  return {
    ...pos,
    anchor: 'free',
    vw: base.vw,
    vh: base.vh,
    ...(Number.isFinite(w) && w > 0 ? { w } : {}),
    ...(Number.isFinite(h) && h > 0 ? { h } : {}),
  };
}

function centerPositionFromRect(rect) {
  return centerPositionFromPixels(rect.left, rect.top, rect.width, rect.height);
}

function pixelPositionFromRect(rect) {
  return pixelPositionFromPixels(rect.left, rect.top, rect.width, rect.height);
}

function legacyAnchorRect(anchor, el, pos = {}) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el?.offsetWidth  || el?.getBoundingClientRect?.().width  || 0;
  const h = el?.offsetHeight || el?.getBoundingClientRect?.().height || 0;
  const bottom = pos.bottom ?? 36;

  switch (anchor) {
    case 'bottom-center': return { left: ((pos.x ?? 50) / 100) * vw - w / 2, top: vh - bottom - h, width: w, height: h };
    case 'snap-center': return { left: vw / 2 - w / 2, top: vh / 2 - h / 2, width: w, height: h };
    case 'snap-top-left': return { left: 40, top: 40, width: w, height: h };
    case 'snap-top-center': return { left: vw / 2 - w / 2, top: 40, width: w, height: h };
    case 'snap-top-right': return { left: vw - w - 40, top: 40, width: w, height: h };
    case 'snap-mid-left': return { left: 40, top: vh / 2 - h / 2, width: w, height: h };
    case 'snap-mid-right': return { left: vw - w - 40, top: vh / 2 - h / 2, width: w, height: h };
    case 'snap-bottom-left': return { left: 40, top: vh - h - 40, width: w, height: h };
    case 'snap-bottom-center': return { left: vw / 2 - w / 2, top: vh - h - 40, width: w, height: h };
    case 'snap-bottom-right': return { left: vw - w - 40, top: vh - h - 40, width: w, height: h };
    default: return null;
  }
}

function normalizeWidgetPosition(id, pos) {
  const fallback = DEFAULT_POSITIONS[id] ?? { x: 50, y: 50, anchor: 'free-center' };
  const p = pos ?? fallback;
  const el = document.getElementById(`widget-${id}`);
  const rect = el?.getBoundingClientRect?.();
  const w = rect?.width  || el?.offsetWidth  || 0;
  const h = rect?.height || el?.offsetHeight || 0;

  if (usesPixelPosition(id)) {
    if (p.anchor === 'free') {
      return responsivePixelPosition(p, w, h);
    }

    const legacyRect = legacyAnchorRect(p.anchor, el, p);
    if (legacyRect) return pixelPositionFromRect(legacyRect);

    const centerX = clampPercent(p.x, fallback.x ?? 50);
    const centerY = clampPercent(p.y, fallback.y ?? 50);
    return pixelPositionFromPixels(
      (centerX / 100) * window.innerWidth - w / 2,
      (centerY / 100) * window.innerHeight - h / 2,
      w,
      h
    );
  }

  if (p.anchor === 'free-center' || p.anchor === 'center') {
    return {
      x: clampPercent(p.x, fallback.x ?? 50),
      y: clampPercent(p.y, fallback.y ?? 50),
      anchor: 'free-center'
    };
  }

  const legacyRect = legacyAnchorRect(p.anchor, el, p);
  if (legacyRect) return centerPositionFromRect(legacyRect);

  if (p.anchor === 'free' || Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 100 && p.y > 100) {
    return centerPositionFromPixels(p.x ?? 0, p.y ?? 0, w, h);
  }

  return {
    x: clampPercent(p.x, fallback.x ?? 50),
    y: clampPercent(p.y, fallback.y ?? 50),
    anchor: 'free-center'
  };
}

function positionsMatch(a, b) {
  return a && b && a.anchor === b.anchor && Math.round(a.x * 1000) === Math.round(b.x * 1000) && Math.round(a.y * 1000) === Math.round(b.y * 1000);
}

function applyWidgetPosition(id, pos) {
  const el = document.getElementById(`widget-${id}`);
  if (!el) return null;
  const normalizedPos = normalizeWidgetPosition(id, pos);
  el.style.right = '';
  el.style.bottom = '';

  if (usesPixelPosition(id)) {
    el.style.left = `${normalizedPos.x}px`;
    el.style.top = `${normalizedPos.y}px`;
    el.style.transform = 'none';
  } else {
    el.style.left = `${normalizedPos.x}%`;
    el.style.top = `${normalizedPos.y}%`;
    el.style.transform = 'translate(-50%, -50%)';
  }

  return normalizedPos;
}

function currentWidgetPosition(id) {
  const el = document.getElementById(`widget-${id}`);
  if (!el) return normalizeWidgetPosition(id, Store.get(posKey(id)) ?? DEFAULT_POSITIONS[id]);
  const rect = el.getBoundingClientRect();
  return usesPixelPosition(id) ? pixelPositionFromRect(rect) : centerPositionFromRect(rect);
}

const CLAMP_PAD = 8;
function clampWidget(id, persist = false) {
  const el = document.getElementById(`widget-${id}`);
  if (!el || el.hidden || getComputedStyle(el).display === 'none') return;
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  let dx = 0, dy = 0;
  if (rect.left < CLAMP_PAD)             dx = CLAMP_PAD - rect.left;
  else if (rect.right > vw - CLAMP_PAD)  dx = (vw - CLAMP_PAD) - rect.right;
  if (rect.top < CLAMP_PAD)              dy = CLAMP_PAD - rect.top;
  else if (rect.bottom > vh - CLAMP_PAD) dy = (vh - CLAMP_PAD) - rect.bottom;
  if (dx !== 0 || dy !== 0) {
    const pos = usesPixelPosition(id)
      ? pixelPositionFromPixels(rect.left + dx, rect.top + dy, rect.width, rect.height)
      : centerPositionFromPixels(rect.left + dx, rect.top + dy, rect.width, rect.height);
    applyWidgetPosition(id, pos);
    if (persist) Store.set(posKey(id), pos);
  }
}
function clampAllWidgets(persist = false) { WIDGETS.forEach(id => clampWidget(id, persist)); }

// ─── Widget Sizes ───────────────────────────────────────────────────
const WIDGET_MIN = { clock:[160,60], search:[260,48], bookmarks:[120,36], recent:[180,80], media:[160,60], notes:[180,100] };
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
  loadWidgetSizes();
  WIDGETS.forEach(id => {
    const saved = ensureStoredPosition(id, Store.get(posKey(id)));
    if (saved) Store.set(posKey(id), saved);
    applyWidgetPosition(id, saved ?? DEFAULT_POSITIONS[id]);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => clampAllWidgets(false)));
}
loadWidgetPositions();
updateClockScale();
window.addEventListener('resize', () => {
  WIDGETS.forEach(id => {
    const saved = ensureStoredPosition(id, Store.get(posKey(id)));
    applyWidgetPosition(id, saved ?? DEFAULT_POSITIONS[id]);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => clampAllWidgets(false)));
});

function resetWidgetPositions() {
  WIDGETS.forEach(id => {
    Store.set(posKey(id), null); Store.set(sizeKey(id), null);
    applyWidgetSize(id, null);
    applyWidgetPosition(id, DEFAULT_POSITIONS[id]);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => clampAllWidgets(false)));
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
  if (usesPixelPosition(draggedId)) {
    pos = snap
      ? pixelPositionFromPixels(snap.snapX, snap.snapY, elW, elH)
      : pixelPositionFromPixels(curX, curY, elW, elH);
  } else if (snap) {
    pos = centerPositionFromPixels(snap.snapX, snap.snapY, elW, elH);
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
  if (on && document.activeElement?.closest?.('.widget')) document.activeElement.blur();
}
document.getElementById('layout-done-btn').addEventListener('click', () => { setLayoutMode(false); closePanel('layout-panel'); });

function blockWidgetInteractionInLayoutMode(e) {
  if (!layoutMode) return;
  const target = e.target;
  const widget = target?.closest?.('.widget');
  if (!widget) return;
  if (target.closest?.('.widget-resize-handle') || target.closest?.('.widget-drag-handle')) return;
  e.preventDefault();
  e.stopPropagation();
}
document.addEventListener('click', blockWidgetInteractionInLayoutMode, true);
document.addEventListener('submit', blockWidgetInteractionInLayoutMode, true);

function updateLayoutRows() {
  const container = document.getElementById('layout-widget-rows'); if (!container) return;
  container.innerHTML = '';
  WIDGETS.forEach(id => {
    const saved = Store.get(posKey(id));
    const pos   = normalizeWidgetPosition(id, saved ?? DEFAULT_POSITIONS[id]);
    const row   = document.createElement('div'); row.className = 'layout-row';
    const nm    = document.createElement('span'); nm.className = 'layout-row-name';
    nm.textContent = id.charAt(0).toUpperCase() + id.slice(1);
    const ps    = document.createElement('span'); ps.className = 'layout-row-pos';
    if (Store.get(widgetHiddenKey(id))) {
      ps.textContent = 'Hidden';
    } else if (usesPixelPosition(id)) {
      ps.textContent = `${Math.round(pos.x)}px / ${Math.round(pos.y)}px`;
    } else {
      ps.textContent = `${Math.round(pos.x)}% / ${Math.round(pos.y)}%`;
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
  const positions = {}, hidden = {}, sizes = {}, appearances = {};
  WIDGETS.forEach(id => {
    positions[id] = currentWidgetPosition(id);
    hidden[id]    = !!Store.get(widgetHiddenKey(id));
    sizes[id]     = Store.get(sizeKey(id));
    appearances[id] = getWidgetAppearance(id);
  });
  return {
    positions, hidden, sizes, appearances,
    backgroundDetails: { bgImage: Store.get('bgImage'), bgPreset: Store.get('bgPreset') ?? 0, bgOverlay: Store.get('bgOverlay') ?? 35, bgBlur: Store.get('bgBlur') ?? 0 },
    clockDetails:      { hideGreeting: !!Store.get('hideGreeting'), hideDate: !!Store.get('hideDate') },
    notesMarkdown:     Store.get('notesMarkdown') ?? '',
    notesList:         Store.get('notesList') ?? [],
    activeNoteId:      Store.get('activeNoteId'),
    notesPreviewHidden: !!Store.get('notesPreviewHidden')
  };
}

function applyLayoutProfile(profile) {
  if (!profile) return;
  WIDGETS.forEach(id => {
    const size = profile.sizes?.[id]; Store.set(sizeKey(id), size); applyWidgetSize(id, size || null);
    const pos = ensureStoredPosition(id, profile.positions?.[id] ?? DEFAULT_POSITIONS[id]);
    applyWidgetPosition(id, pos);
    Store.set(posKey(id), pos);
    if (profile.notesList !== undefined) Store.set('notesList', profile.notesList);
    if (profile.activeNoteId !== undefined) Store.set('activeNoteId', profile.activeNoteId);
    if (profile.notesPreviewHidden !== undefined) Store.set('notesPreviewHidden', !!profile.notesPreviewHidden);
    if (profile.notesMarkdown !== undefined && profile.notesList === undefined) {
      Store.set('notesMarkdown', profile.notesMarkdown);
      Store.set('notesList', [makeNote(profile.notesMarkdown)]);
    }
    if (profile.appearances?.[id]) { Store.set(widgetAppearanceKey(id), profile.appearances[id]); applyWidgetAppearance(id); }
    Store.set(widgetHiddenKey(id), !!profile.hidden?.[id]); applyWidgetVisibility(id);
  });
  if (profile.backgroundDetails) {
    const d = profile.backgroundDetails;
    if (d.bgPreset !== undefined) Store.set('bgPreset', d.bgPreset);
    if (d.bgOverlay !== undefined) { Store.set('bgOverlay', d.bgOverlay); if (overlayRange) overlayRange.value = d.bgOverlay; applyOverlay(d.bgOverlay); }
    if (d.bgBlur    !== undefined) { Store.set('bgBlur',    d.bgBlur);    if (blurRange)    blurRange.value    = d.bgBlur;    applyBlur(d.bgBlur);       }
    if (d.bgImage) {
      applyStoredBackgroundImage(d.bgImage, { persist: true, name: `${Store.get('activeLayoutProfile') || 'Layout'} background` }).then(ok => {
        if (!ok) applyBackground(PRESETS[d.bgPreset ?? (Store.get('bgPreset') ?? 0)], false);
      });
    } else {
      Store.set('bgImage', null);
      applyBackground(PRESETS[d.bgPreset ?? (Store.get('bgPreset') ?? 0)], false);
    }
  }
  Store.set('hideGreeting', !!profile.clockDetails?.hideGreeting);
  Store.set('hideDate',     !!profile.clockDetails?.hideDate);
  toggleGreeting.checked       = !Store.get('hideGreeting');
  toggleDate.checked           = !Store.get('hideDate');
  toggleWidgetClock.checked    = !Store.get(widgetHiddenKey('clock'));
  toggleWidgetSearch.checked   = !Store.get(widgetHiddenKey('search'));
  toggleWidgetBookmarks.checked= !Store.get(widgetHiddenKey('bookmarks'));
  toggleWidgetRecent.checked   = !Store.get(widgetHiddenKey('recent'));
  toggleWidgetMedia.checked    = !Store.get(widgetHiddenKey('media'));
  toggleWidgetNotes.checked    = !Store.get(widgetHiddenKey('notes'));
  loadNotes();
  applyVisibility(); updateLayoutRows();
  requestAnimationFrame(() => requestAnimationFrame(() => clampAllWidgets(false)));
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
  const profiles = getProfiles();
  const snapshot = profiles[name];
  delete profiles[name]; setProfiles(profiles);
  if (Store.get('activeLayoutProfile') === name) Store.set('activeLayoutProfile', null);
  renderProfileOptions();
  showToast(`Deleted layout: ${name}`, () => {
    const cur = getProfiles(); cur[name] = snapshot; setProfiles(cur);
    Store.set('activeLayoutProfile', name); renderProfileOptions();
  });
});
renderProfileOptions();

// ─── Import / Export Settings ──────────────────────────────────────
const exportSettingsBtn = document.getElementById('export-settings-btn');
const importSettingsBtn = document.getElementById('import-settings-btn');
const importSettingsFile = document.getElementById('import-settings-file');

async function collectSettingsBackup() {
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    try { storage[key] = JSON.parse(localStorage.getItem(key)); }
    catch { storage[key] = localStorage.getItem(key); }
  }
  return {
    app: 'Cenit New Tab',
    version: '1.2.0',
    settingsVersion: SETTINGS_VERSION,
    exportedAt: new Date().toISOString(),
    storage,
    assets: {
      backgroundImages: await collectBackgroundImageAssets(storage),
    },
  };
}
async function downloadSettingsBackup() {
  try {
    const backup = await collectSettingsBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `cenit-settings-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Settings exported');
  } catch (err) {
    console.error('Export failed', err);
    showToast('Export failed');
  }
}
const KNOWN_KEYS = new Set([
  'bookmarks','bookmarkFolders','activeBookmarkFolderId',
  'notesList','notesMarkdown','activeNoteId',
  'accentColor','overlayDarkness','bgBlur','bgPreset','bgPresetIndex',
  'accentColorGlobal','clockFont','uiFont','customFonts',
  'use12h','showAmPm','showGreeting','showDate','hideBrand',
  'widgetPositions','widgetSizes','widgetVisibility','widgetAppearance',
  'layoutProfiles','activeLayoutProfile',
  'customThemes','activeThemeId',
  'searchEngine','customBangs',
  'recentCount','minimizedWidgets','widgetDockPosition',
  'settingsVersion',
]);

function validateBackup(storage) {
  const errors = [];
  // Reject keys not in KNOWN_KEYS
  for (const key of Object.keys(storage)) {
    if (!KNOWN_KEYS.has(key)) errors.push(`Unknown key: "${key}"`);
  }
  // Shape checks
  if (storage.bookmarks !== undefined && !Array.isArray(storage.bookmarks))
    errors.push('bookmarks must be an array');
  if (storage.bookmarkFolders !== undefined && !Array.isArray(storage.bookmarkFolders))
    errors.push('bookmarkFolders must be an array');
  if (storage.notesList !== undefined && !Array.isArray(storage.notesList))
    errors.push('notesList must be an array');
  if (storage.customThemes !== undefined && !Array.isArray(storage.customThemes))
    errors.push('customThemes must be an array');
  if (storage.customFonts !== undefined && !Array.isArray(storage.customFonts))
    errors.push('customFonts must be an array');

  const version = storage.settingsVersion ?? 1;
  const SETTINGS_VERSION = 2; // current
  const summary = {
    bookmarks: Array.isArray(storage.bookmarks) ? storage.bookmarks.length : 0,
    notes: Array.isArray(storage.notesList) ? storage.notesList.length : 0,
    themes: Array.isArray(storage.customThemes) ? storage.customThemes.length : 0,
    version,
    versionWarning: version > SETTINGS_VERSION,
  };
  return { valid: errors.length === 0, errors, summary };
}

let pendingImportStorage = null;
let pendingImportAssets = null;

function showImportPreview(storage, summary) {
  pendingImportStorage = storage;
  const body = document.getElementById('import-preview-body');
  const overlay = document.getElementById('import-preview-overlay');
  if (!body || !overlay) return;
  const lines = [
    `${summary.bookmarks} bookmark${summary.bookmarks !== 1 ? 's' : ''}`,
    `${summary.notes} note${summary.notes !== 1 ? 's' : ''}`,
    `${summary.themes} custom theme${summary.themes !== 1 ? 's' : ''}`,
    `Backup version: ${summary.version}`,
  ];
  body.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
  if (summary.versionWarning) {
    body.innerHTML += `<div class="warn">&#9888; This backup is from a newer version — some data may not import correctly.</div>`;
  }
  overlay.removeAttribute('hidden');
}

async function applyImportStorage(storage) {
  let preparedStorage;
  try {
    preparedStorage = await prepareImportedBackgroundStorage(storage, pendingImportAssets);
  } catch (err) {
    console.error('Import failed', err);
    showToast('Import failed');
    return;
  }
  localStorage.clear();
  Object.entries(preparedStorage).forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  });
  showToast('Settings imported');
  setTimeout(() => window.location.reload(), 350);
}

document.getElementById('import-confirm-btn')?.addEventListener('click', () => {
  document.getElementById('import-preview-overlay')?.setAttribute('hidden', '');
  if (!pendingImportStorage) return;
  const storage = pendingImportStorage;
  pendingImportStorage = null;
  applyImportStorage(storage);
});
document.getElementById('import-cancel-btn')?.addEventListener('click', () => {
  document.getElementById('import-preview-overlay')?.setAttribute('hidden', '');
  pendingImportStorage = null;
  pendingImportAssets = null;
  showToast('Import cancelled');
});

async function restoreSettingsBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { showToast('Invalid backup file — not valid JSON'); return; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    showToast('Invalid backup file — unexpected format'); return;
  }
  const storage = parsed?.storage && typeof parsed.storage === 'object' ? parsed.storage : parsed;
  if (!storage || typeof storage !== 'object' || Array.isArray(storage)) {
    showToast('Invalid backup file — unexpected format'); return;
  }
  const { valid, errors, summary } = validateBackup(storage);
  if (!valid) {
    showToast(errors.length === 1 ? errors[0] : `Import failed: ${errors.length} validation errors — ${errors[0]}${errors.length > 1 ? ' (and more)' : ''}`);
    return;
  }
  pendingImportAssets = parsed?.assets ?? null;
  showImportPreview(storage, summary);
}
if (exportSettingsBtn) exportSettingsBtn.addEventListener('click', downloadSettingsBackup);
if (importSettingsBtn && importSettingsFile) {
  importSettingsBtn.addEventListener('click', () => importSettingsFile.click());
  importSettingsFile.addEventListener('change', () => {
    const file = importSettingsFile.files?.[0];
    importSettingsFile.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => restoreSettingsBackup(String(reader.result ?? ''));
    reader.onerror = () => showToast('Import failed');
    reader.readAsText(file);
  });
}

// ─── Toast ──────────────────────────────────────────────────────────
const toastEl = document.createElement('div');
toastEl.className = 'profile-toast hide'; toastEl.setAttribute('role','status'); toastEl.setAttribute('aria-live','polite');
document.body.appendChild(toastEl);
let toastTimer = null;
function showToast(text, undoFn) {
  toastEl.innerHTML = '';
  const msg = document.createElement('span');
  msg.textContent = text;
  toastEl.appendChild(msg);
  toastEl.classList.toggle('has-undo', !!undoFn);
  if (undoFn) {
    const btn = document.createElement('button');
    btn.className = 'toast-undo-btn';
    btn.textContent = 'Undo';
    btn.addEventListener('click', () => {
      undoFn();
      toastEl.classList.remove('show'); toastEl.classList.add('hide');
    });
    toastEl.appendChild(btn);
  }
  toastEl.classList.remove('hide'); toastEl.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.classList.remove('show'); toastEl.classList.add('hide'); }, undoFn ? 4000 : 1400);
}

// ─── Theme Presets ─────────────────────────────────────────────────
const BUILTIN_THEME_PRESETS = [
  {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    description: 'Elegant dark violet with warm gold.',
    bgPreset: 0,
    bgOverlay: 35,
    bgBlur: 0,
    accent: '#c9a96e',
    clockFontName: 'Cormorant Garamond',
    uiFontName: 'DM Mono',
  },
  {
    id: 'forest-glass',
    name: 'Forest Glass',
    description: 'Deep green, soft glow, quiet focus.',
    bgPreset: 2,
    bgOverlay: 32,
    bgBlur: 0,
    accent: '#7bd88f',
    clockFontName: 'Raleway',
    uiFontName: 'IBM Plex Mono',
  },
  {
    id: 'minimal-mono',
    name: 'Minimal Mono',
    description: 'Clean grayscale with crisp mono text.',
    bgPreset: 4,
    bgOverlay: 42,
    bgBlur: 0,
    accent: '#d8d8d8',
    clockFontName: 'Space Mono',
    uiFontName: 'DM Mono',
  },
  {
    id: 'cyber-purple',
    name: 'Cyber Purple',
    description: 'Neon violet with a futuristic feel.',
    bgPreset: 7,
    bgOverlay: 30,
    bgBlur: 1,
    accent: '#c084fc',
    clockFontName: 'Cinzel',
    uiFontName: 'IBM Plex Mono',
  },
  {
    id: 'ember-night',
    name: 'Ember Night',
    description: 'Dark red warmth for late sessions.',
    bgPreset: 5,
    bgOverlay: 38,
    bgBlur: 0,
    accent: '#ff9f68',
    clockFontName: 'Playfair Display',
    uiFontName: 'DM Mono',
  },
  {
    id: 'ocean-depths',
    name: 'Ocean Depths',
    description: 'Blue glass with calm contrast.',
    bgPreset: 6,
    bgOverlay: 34,
    bgBlur: 0,
    accent: '#64d2ff',
    clockFontName: 'Josefin Sans',
    uiFontName: 'Space Mono',
  },
];

function getCustomThemes() {
  return (Store.get('customThemes') ?? []).filter(theme => theme && theme.id && theme.name);
}

function setCustomThemes(themes) {
  Store.set('customThemes', themes);
}

function getAllThemes() {
  return [...BUILTIN_THEME_PRESETS, ...getCustomThemes()];
}

function findFontIndexByName(name, fallback = 0) {
  const fonts = getAllFonts();
  const idx = fonts.findIndex(font => font.name === name);
  return idx >= 0 ? idx : fallback;
}

function makeThemeId(name) {
  return `custom-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme'}-${Date.now()}`;
}

function setThemeControls(theme) {
  const overlay = theme.bgOverlay ?? 35;
  const blur = theme.bgBlur ?? 0;
  Store.set('bgOverlay', overlay);
  Store.set('bgBlur', blur);
  if (overlayRange) overlayRange.value = overlay;
  if (blurRange) blurRange.value = blur;
  applyOverlay(overlay);
  applyBlur(blur);

  if (theme.bgImage) {
    applyStoredBackgroundImage(theme.bgImage, { persist: true, name: theme.name || 'Theme background' });
    const uploadText = document.getElementById('upload-text');
    if (uploadText) uploadText.textContent = 'Custom theme image';
  } else {
    const preset = Number.isInteger(theme.bgPreset) ? theme.bgPreset : 0;
    Store.set('bgImage', null);
    Store.set('bgPreset', preset);
    applyBackground(PRESETS[preset] ?? PRESETS[0], false);
    const uploadText = document.getElementById('upload-text');
    if (uploadText) uploadText.textContent = 'Click or drop an image';
  }
  updateBackgroundPresetActive();

  if (theme.accent) applyAccentColor(theme.accent, true);

  const clockIdx = Number.isInteger(theme.clockFontIdx) ? theme.clockFontIdx : findFontIndexByName(theme.clockFontName, Store.get('clockFontIdx') ?? 0);
  const uiIdx    = Number.isInteger(theme.uiFontIdx)    ? theme.uiFontIdx    : findFontIndexByName(theme.uiFontName,    Store.get('uiFontIdx')    ?? 1);
  if (getAllFonts()[clockIdx]) {
    Store.set('clockFontIdx', clockIdx);
    const sel = document.getElementById('clock-font-select');
    if (sel) sel.value = clockIdx;
    applyClockFont(clockIdx);
  }
  if (getAllFonts()[uiIdx]) {
    Store.set('uiFontIdx', uiIdx);
    const sel = document.getElementById('ui-font-select');
    if (sel) sel.value = uiIdx;
    applyUIFont(uiIdx);
  }
}

function applyThemePreset(theme) {
  if (!theme) return;
  setThemeControls(theme);
  Store.set('activeThemeId', theme.id);
  renderThemePresets();
  showToast(`Theme applied: ${theme.name}`);
}

function captureThemePreset(name) {
  const clockIdx = Store.get('clockFontIdx') ?? 0;
  const uiIdx = Store.get('uiFontIdx') ?? 1;
  return {
    id: makeThemeId(name),
    name,
    description: 'Custom saved theme.',
    bgImage: Store.get('bgImage'),
    bgPreset: Store.get('bgPreset') ?? 0,
    bgOverlay: +(Store.get('bgOverlay') ?? 35),
    bgBlur: +(Store.get('bgBlur') ?? 0),
    accent: Store.get('accentColor') ?? DEFAULT_ACCENT,
    clockFontIdx,
    uiFontIdx,
    clockFontName: getAllFonts()[clockIdx]?.name,
    uiFontName: getAllFonts()[uiIdx]?.name,
    custom: true,
    createdAt: Date.now(),
  };
}

function renderThemePresets() {
  const grid = document.getElementById('theme-preset-grid');
  if (!grid) return;
  const activeId = Store.get('activeThemeId');
  grid.querySelectorAll('[data-object-url]').forEach(el => URL.revokeObjectURL(el.dataset.objectUrl));
  grid.innerHTML = '';
  getAllThemes().forEach(theme => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `theme-preset-card${theme.id === activeId ? ' active' : ''}${theme.custom ? ' custom' : ''}`;
    card.title = theme.description || theme.name;
    card.addEventListener('click', () => applyThemePreset(theme));

    const preview = document.createElement('div');
    preview.className = 'theme-preset-preview';
    preview.style.backgroundImage = PRESETS[theme.bgPreset] ?? PRESETS[0];
    if (theme.bgImage) applyStoredBackgroundPreview(preview, theme.bgImage);

    const shade = document.createElement('span');
    shade.className = 'theme-preset-shade';
    shade.style.background = `rgba(0,0,0,${(theme.bgOverlay ?? 35) / 100})`;

    const accent = document.createElement('span');
    accent.className = 'theme-preset-accent';
    accent.style.background = normalizeHexColor(theme.accent ?? DEFAULT_ACCENT);

    preview.appendChild(shade);
    preview.appendChild(accent);

    const name = document.createElement('span');
    name.className = 'theme-preset-name';
    name.textContent = theme.name;

    const desc = document.createElement('span');
    desc.className = 'theme-preset-desc';
    desc.textContent = theme.custom ? 'Custom' : (theme.description || 'Preset theme');

    card.appendChild(preview);
    card.appendChild(name);
    card.appendChild(desc);
    grid.appendChild(card);
  });
}

function clearActiveTheme() {
  if (!Store.get('activeThemeId')) return;
  Store.set('activeThemeId', null);
  renderThemePresets();
}

const saveThemeBtn = document.getElementById('save-theme-btn');
const deleteThemeBtn = document.getElementById('delete-theme-btn');
const themeNameInput = document.getElementById('theme-name');

if (saveThemeBtn && themeNameInput) {
  saveThemeBtn.addEventListener('click', () => {
    const name = themeNameInput.value.trim() || `Theme ${getCustomThemes().length + 1}`;
    const themes = getCustomThemes();
    const theme = captureThemePreset(name);
    themes.push(theme);
    setCustomThemes(themes);
    Store.set('activeThemeId', theme.id);
    themeNameInput.value = '';
    renderThemePresets();
    showToast(`Theme saved: ${name}`);
  });
}

if (deleteThemeBtn) {
  deleteThemeBtn.addEventListener('click', () => {
    const activeId = Store.get('activeThemeId');
    if (!activeId || !String(activeId).startsWith('custom-')) {
      showToast('Select a custom theme first');
      return;
    }
    const before = getCustomThemes();
    const theme = before.find(item => item.id === activeId);
    setCustomThemes(before.filter(item => item.id !== activeId));
    Store.set('activeThemeId', null);
    renderThemePresets();
    showToast(`Deleted theme: ${theme?.name ?? 'Custom'}`, () => {
      if (!theme) return;
      setCustomThemes([...getCustomThemes(), theme]);
      Store.set('activeThemeId', theme.id);
      renderThemePresets();
    });
  });
}

renderThemePresets();
applyAllWidgetAppearances();
bindWidgetAppearanceControls();

// ─── Preset Buttons ────────────────────────────────────────────────
document.getElementById('widget-preset-row')?.querySelectorAll('.widget-preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.widget-preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const widgetId = document.getElementById('widget-custom-select')?.value;
    if (!widgetId) return;
    applyWidgetStylePreset(widgetId, btn.dataset.preset);
    showToast(`Applied ${btn.dataset.preset} preset`);
  });
});

document.getElementById('apply-preset-all-btn')?.addEventListener('click', () => {
  const presetKey = document.querySelector('.widget-preset-btn.active')?.dataset.preset;
  if (!presetKey) { showToast('Select a preset first'); return; }
  WIDGETS.forEach(id => applyWidgetStylePreset(id, presetKey));
  showToast(`Applied ${presetKey} to all widgets`);
});

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
document.getElementById('settings-btn').addEventListener('click', () => {
  if (activePanel === 'settings-panel') closePanel('settings-panel');
  else { openPanel('settings-panel'); loadWidgetAppearanceControls(); }
});
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
  const snapshot = JSON.parse(JSON.stringify(Store.get('widgetPositions') ?? {}));
  resetWidgetPositions();
  showToast('Layout reset to defaults', () => {
    Store.set('widgetPositions', snapshot);
    loadWidgetPositions();
  });
});

initSettingsSearch();

function initSettingsSections() {
  const collapsed = Store.get('settingsCollapsed') ?? {};
  document.querySelectorAll('.settings-section').forEach(section => {
    const key = section.dataset.section;
    if (collapsed[key]) section.setAttribute('data-collapsed', '');
    const header = section.querySelector('.settings-section-header');
    header?.addEventListener('click', () => {
      const isCollapsed = section.hasAttribute('data-collapsed');
      if (isCollapsed) section.removeAttribute('data-collapsed');
      else section.setAttribute('data-collapsed', '');
      const state = Store.get('settingsCollapsed') ?? {};
      state[key] = !isCollapsed;
      Store.set('settingsCollapsed', state);
    });
  });
}
initSettingsSections();

// ─── Command Palette ─────────────────────────────────────────────────
let cmdOpen = false;
const cmdPalette = document.getElementById('cmd-palette');
const cmdInput   = document.getElementById('cmd-input');
const cmdResults = document.getElementById('cmd-results');
let cmdActiveIdx = -1;

function openCmdPalette() {
  if (!cmdPalette) return;
  cmdPalette.removeAttribute('hidden');
  cmdOpen = true;
  cmdInput.value = '';
  renderCmdResults('');
  requestAnimationFrame(() => cmdInput.focus());
}
function closeCmdPalette() {
  if (!cmdPalette) return;
  cmdPalette.setAttribute('hidden', '');
  cmdOpen = false;
  cmdActiveIdx = -1;
}
function buildCmdItems(query) {
  const q = query.trim().toLowerCase();
  const items = [];
  // Static actions
  const actions = [
    { icon: '✦', label: 'Open Settings',    category: 'action', action: () => openPanel('settings-panel') },
    { icon: '⊞', label: 'Open Layout',      category: 'action', action: () => openPanel('layout-panel') },
    { icon: '⌁', label: 'Open Background',  category: 'action', action: () => openPanel('bg-panel') },
    { icon: '☆', label: 'Open Bookmarks',   category: 'action', action: () => openPanel('bookmark-panel') },
    { icon: '＋', label: 'New Note',         category: 'action', action: () => { openPanel('settings-panel'); notesAddBtn?.click(); } },
    { icon: '⟳', label: 'Reset Layout',     category: 'action', action: () => { resetWidgetPositions(); showToast('Layout reset'); } },
  ];
  actions.forEach(a => { if (!q || a.label.toLowerCase().includes(q)) items.push(a); });
  // Bookmarks
  getBookmarks().forEach(bm => {
    if (!q || bm.name.toLowerCase().includes(q) || bm.url.toLowerCase().includes(q)) {
      items.push({ icon: '⌕', label: bm.name, category: 'bookmark', action: () => { window.location.href = bm.url; } });
    }
  });
  // Notes
  getNotes().forEach(note => {
    const noteLabel = note.title || 'Untitled note';
    if (!q || noteLabel.toLowerCase().includes(q) || (note.body || '').toLowerCase().includes(q)) {
      items.push({ icon: '✎', label: noteLabel, category: 'note', action: () => {
        Store.set('activeNoteId', note.id); renderActiveNote?.();
      }});
    }
  });
  // Themes
  [...(typeof BUILTIN_THEME_PRESETS !== 'undefined' ? BUILTIN_THEME_PRESETS : []), ...getCustomThemes()].forEach(theme => {
    if (!q || theme.name.toLowerCase().includes(q)) {
      items.push({ icon: '◐', label: theme.name, category: 'theme', action: () => {
        applyThemePreset?.(theme); Store.set('activeThemeId', theme.id); renderThemePresets?.();
        showToast(`Theme: ${theme.name}`);
      }});
    }
  });
  // Layout profiles
  Object.keys(getProfiles()).forEach(name => {
    if (!q || name.toLowerCase().includes(q)) {
      items.push({ icon: '▤', label: name, category: 'layout', action: () => {
        const profile = getProfiles()[name];
        Store.set('activeLayoutProfile', name); applyLayoutProfile?.(profile);
        showToast(`Layout loaded: ${name}`);
      }});
    }
  });
  // "Search web for …" always at end when there's a query
  if (q) {
    items.push({ icon: '⌕', label: `Search web for "${query.trim()}"`, category: 'search', action: () => {
      window.location.href = resolveSearchDestination(query.trim());
    }});
  }
  return items.slice(0, 12);
}
function renderCmdResults(query) {
  if (!cmdResults) return;
  cmdActiveIdx = -1;
  const items = buildCmdItems(query);
  cmdResults.innerHTML = '';
  if (!items.length) {
    cmdResults.innerHTML = '<div class="cmd-empty">No results</div>';
    return;
  }
  items.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'cmd-item'; el.setAttribute('role', 'option');
    el.innerHTML = `<span class="cmd-item-icon">${item.icon}</span><span class="cmd-item-label">${item.label}</span><span class="cmd-item-category">${item.category}</span>`;
    el.addEventListener('click', () => { item.action(); closeCmdPalette(); });
    el.addEventListener('mouseenter', () => setCmdActive(i));
    cmdResults.appendChild(el);
  });
}
function setCmdActive(idx) {
  const items = cmdResults.querySelectorAll('.cmd-item');
  items.forEach((el, i) => el.classList.toggle('active', i === idx));
  cmdActiveIdx = idx;
}
function moveCmdActive(dir) {
  const items = cmdResults.querySelectorAll('.cmd-item');
  if (!items.length) return;
  cmdActiveIdx = (cmdActiveIdx + dir + items.length) % items.length;
  setCmdActive(cmdActiveIdx);
  items[cmdActiveIdx]?.scrollIntoView({ block: 'nearest' });
}

// Wire up
if (cmdInput) {
  cmdInput.addEventListener('input', () => renderCmdResults(cmdInput.value));
  cmdInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCmdActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCmdActive(-1); }
    else if (e.key === 'Enter') {
      const items = buildCmdItems(cmdInput.value);
      const active = cmdActiveIdx >= 0 ? items[cmdActiveIdx] : items[0];
      if (active) { active.action(); closeCmdPalette(); }
    } else if (e.key === 'Escape') { closeCmdPalette(); }
  });
}
document.getElementById('cmd-palette')?.querySelector('.cmd-backdrop')?.addEventListener('click', closeCmdPalette);
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (cmdOpen) closeCmdPalette(); else openCmdPalette();
  }
});

// ─── Widget Dock ─────────────────────────────────────────────────────
const widgetDock = document.getElementById('widget-dock');
const WIDGET_LABELS = { clock: '◷', search: '⌕', bookmarks: '☆', recent: '⟳', media: '♫', notes: '✎' };

function getMinimizedWidgets() { return new Set(Store.get('minimizedWidgets') ?? []); }
function setMinimizedWidgets(set) { Store.set('minimizedWidgets', [...set]); }

function minimizeWidget(widgetId) {
  const widget = document.getElementById(`widget-${widgetId}`);
  if (!widget) return;
  const minimized = getMinimizedWidgets();
  minimized.add(widgetId);
  setMinimizedWidgets(minimized);
  widget.style.display = 'none';
  renderWidgetDock();
}

function restoreWidget(widgetId) {
  const widget = document.getElementById(`widget-${widgetId}`);
  const minimized = getMinimizedWidgets();
  minimized.delete(widgetId);
  setMinimizedWidgets(minimized);
  if (widget) widget.style.display = '';
  renderWidgetDock();
}

function renderWidgetDock() {
  if (!widgetDock) return;
  const minimized = getMinimizedWidgets();
  widgetDock.innerHTML = '';
  if (!minimized.size) { widgetDock.setAttribute('hidden', ''); return; }
  widgetDock.removeAttribute('hidden');
  minimized.forEach(id => {
    const btn = document.createElement('button');
    btn.className = 'dock-icon';
    btn.title = `Restore ${id}`;
    btn.textContent = WIDGET_LABELS[id] ?? '⊞';
    btn.addEventListener('click', () => restoreWidget(id));
    widgetDock.appendChild(btn);
  });
}

function addMinimizeButtons() {
  document.querySelectorAll('.widget[data-widget]').forEach(widget => {
    if (widget.querySelector('.widget-minimize-btn')) return;
    const id = widget.dataset.widget;
    const btn = document.createElement('button');
    btn.className = 'widget-minimize-btn';
    btn.title = 'Minimize';
    btn.setAttribute('aria-label', `Minimize ${id} widget`);
    btn.textContent = '−';
    btn.addEventListener('click', (e) => { e.stopPropagation(); minimizeWidget(id); });
    widget.appendChild(btn);
  });
}

// Init: restore minimized state from storage
renderWidgetDock();
getMinimizedWidgets().forEach(id => {
  const widget = document.getElementById(`widget-${id}`);
  if (widget) widget.style.display = 'none';
});
addMinimizeButtons();
