/**
 * CenitTab — Main entry point.
 * Orchestrates feature modules and contains core widget/layout/theme logic.
 */
import { Store } from './shared/storage.js';
import { showToast, createPanelManager } from './shared/ui.js';
import { SETTINGS_VERSION, runMigrations } from './core/migrations.js';
import { validateBackup } from './core/import-validation.js';
import { applyWidgetStylePreset as applyWidgetStylePresetCore } from './core/widget-presets.js';
import { getCollapsedSections, toggleSection } from './core/settings-sections.js';
import { DEFAULT_ACTIONS, buildCmdItems as buildCmdItemsCore } from './core/command-palette.js';
import { getMinimizedWidgets as getMinimizedWidgetsState, minimizeWidget as minimizeWidgetState, restoreWidget as restoreWidgetState } from './core/widget-dock.js';
import { normalizeBookmarkUrl } from './core/url-normalization.js';
import { looksLikeUrl, normalizeUrl } from './features/search/search.js';
import { initClock } from './features/clock/clock.js';
import { initNotes } from './features/notes/notes.js';
import { initSearch } from './features/search/search.js';
import { initBackground } from './features/background/background.js';
import { initFonts } from './features/fonts/fonts.js';
import { initBookmarks } from './features/bookmarks/bookmarks.js';

// ─── Migrations ─────────────────────────────────────────────────────
runMigrations(Store);

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

// ─── Layout Mode State ──────────────────────────────────────────────
let layoutMode = false;
function isLayoutMode() { return layoutMode; }

// ─── Initialize Clock ───────────────────────────────────────────────
const clock = initClock({ store: Store });
const { updateClockScale, applyVisibility } = clock;

// ─── Widget System Constants ────────────────────────────────────────
const WIDGETS = ['clock', 'search', 'bookmarks', 'recent', 'media', 'notes'];

const WIDGET_APPEARANCE_DEFAULTS = {
  opacity: 100, radius: 8, background: true, border: true, title: true, accent: DEFAULT_ACCENT,
};
const WIDGET_LABELS = {
  clock: 'Clock', search: 'Search', bookmarks: 'Bookmarks',
  recent: 'Recently Visited', media: 'Media', notes: 'Notes',
};

function widgetAppearanceKey(id) { return `widgetAppearance_${id}`; }
function widgetHiddenKey(id) { return `widgetHidden_${id}`; }
function posKey(id) { return `widgetPos_${id}`; }
function sizeKey(id) { return `widgetSize_${id}`; }

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

function applyAllWidgetAppearances() { WIDGETS.forEach(applyWidgetAppearance); }
function collectWidgetAppearances() {
  const appearances = {};
  WIDGETS.forEach(id => { appearances[id] = getWidgetAppearance(id); });
  return appearances;
}

function applyWidgetStylePreset(widgetId, presetKey) {
  const applied = applyWidgetStylePresetCore(widgetId, presetKey, Store, widgetAppearanceKey);
  if (!applied) return;
  applyWidgetAppearance(widgetId);
  loadWidgetAppearanceControls();
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
  bindInput('widget-opacity-range', 'opacity', el => +el.value, el => { const v = document.getElementById('widget-opacity-val'); if (v) v.textContent = `${el.value}%`; });
  bindInput('widget-radius-range', 'radius', el => +el.value, el => { const v = document.getElementById('widget-radius-val'); if (v) v.textContent = `${el.value}px`; });
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

// ─── Widget Positions ───────────────────────────────────────────────
const DEFAULT_POSITIONS = {
  clock:     { x: 50, y: 42, anchor: 'free-center' },
  search:    { x: 50, y: 62, anchor: 'free-center' },
  bookmarks: { x: 50, y: 92, anchor: 'free-center' },
  recent:    { x: 16, y: 28, anchor: 'free-center' },
  media:     { x: 84, y: 28, anchor: 'free-center' },
  notes:     { x: 50, y: 78, anchor: 'free-center' },
};
const PIXEL_POSITION_WIDGETS = new Set(['search', 'bookmarks']);
const CLAMP_PAD = 8;
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
  return { x: clampPercent(((x + width / 2) / window.innerWidth) * 100), y: clampPercent(((y + height / 2) / window.innerHeight) * 100), anchor: 'free-center' };
}
function currentViewportBase() { return { vw: window.innerWidth, vh: window.innerHeight }; }
function viewportBaseFromPosition(pos) {
  const vw = Number(pos?.vw), vh = Number(pos?.vh);
  return { vw: Number.isFinite(vw) && vw > 0 ? vw : window.innerWidth, vh: Number.isFinite(vh) && vh > 0 ? vh : window.innerHeight };
}
function pixelPositionFromPixels(x, y, width = 0, height = 0, base = currentViewportBase()) {
  const maxX = Math.max(CLAMP_PAD, window.innerWidth - width - CLAMP_PAD);
  const maxY = Math.max(CLAMP_PAD, window.innerHeight - height - CLAMP_PAD);
  return { x: clampPixel(x, CLAMP_PAD, maxX, CLAMP_PAD), y: clampPixel(y, CLAMP_PAD, maxY, CLAMP_PAD), anchor: 'free', vw: base.vw, vh: base.vh, w: Math.max(0, Number(width) || 0), h: Math.max(0, Number(height) || 0) };
}
function responsivePixelPosition(pos, width = 0, height = 0) {
  const base = viewportBaseFromPosition(pos);
  const savedW = Number.isFinite(Number(pos?.w)) && Number(pos.w) > 0 ? Number(pos.w) : width;
  const savedH = Number.isFinite(Number(pos.h)) && Number(pos.h) > 0 ? Number(pos.h) : height;
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
  const w = Number(pos?.w), h = Number(pos?.h);
  return { ...pos, anchor: 'free', vw: base.vw, vh: base.vh, ...(Number.isFinite(w) && w > 0 ? { w } : {}), ...(Number.isFinite(h) && h > 0 ? { h } : {}) };
}
function centerPositionFromRect(rect) { return centerPositionFromPixels(rect.left, rect.top, rect.width, rect.height); }
function pixelPositionFromRect(rect) { return pixelPositionFromPixels(rect.left, rect.top, rect.width, rect.height); }

function legacyAnchorRect(anchor, el, pos = {}) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = el?.offsetWidth || el?.getBoundingClientRect?.().width || 0;
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
  const w = rect?.width || el?.offsetWidth || 0;
  const h = rect?.height || el?.offsetHeight || 0;
  if (usesPixelPosition(id)) {
    if (p.anchor === 'free') return responsivePixelPosition(p, w, h);
    const legacyRect = legacyAnchorRect(p.anchor, el, p);
    if (legacyRect) return pixelPositionFromRect(legacyRect);
    const centerX = clampPercent(p.x, fallback.x ?? 50);
    const centerY = clampPercent(p.y, fallback.y ?? 50);
    return pixelPositionFromPixels((centerX / 100) * window.innerWidth - w / 2, (centerY / 100) * window.innerHeight - h / 2, w, h);
  }
  if (p.anchor === 'free-center' || p.anchor === 'center') return { x: clampPercent(p.x, fallback.x ?? 50), y: clampPercent(p.y, fallback.y ?? 50), anchor: 'free-center' };
  const legacyRect = legacyAnchorRect(p.anchor, el, p);
  if (legacyRect) return centerPositionFromRect(legacyRect);
  if (p.anchor === 'free' || Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 100 && p.y > 100) return centerPositionFromPixels(p.x ?? 0, p.y ?? 0, w, h);
  return { x: clampPercent(p.x, fallback.x ?? 50), y: clampPercent(p.y, fallback.y ?? 50), anchor: 'free-center' };
}

function applyWidgetPosition(id, pos) {
  const el = document.getElementById(`widget-${id}`);
  if (!el) return null;
  const normalizedPos = normalizeWidgetPosition(id, pos);
  el.style.right = ''; el.style.bottom = '';
  if (usesPixelPosition(id)) { el.style.left = `${normalizedPos.x}px`; el.style.top = `${normalizedPos.y}px`; el.style.transform = 'none'; }
  else { el.style.left = `${normalizedPos.x}%`; el.style.top = `${normalizedPos.y}%`; el.style.transform = 'translate(-50%, -50%)'; }
  return normalizedPos;
}

function currentWidgetPosition(id) {
  const el = document.getElementById(`widget-${id}`);
  if (!el) return normalizeWidgetPosition(id, Store.get(posKey(id)) ?? DEFAULT_POSITIONS[id]);
  const rect = el.getBoundingClientRect();
  return usesPixelPosition(id) ? pixelPositionFromRect(rect) : centerPositionFromRect(rect);
}

function clampWidget(id, persist = false) {
  const el = document.getElementById(`widget-${id}`);
  if (!el || el.hidden || getComputedStyle(el).display === 'none') return;
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  let dx = 0, dy = 0;
  if (rect.left < CLAMP_PAD) dx = CLAMP_PAD - rect.left;
  else if (rect.right > vw - CLAMP_PAD) dx = (vw - CLAMP_PAD) - rect.right;
  if (rect.top < CLAMP_PAD) dy = CLAMP_PAD - rect.top;
  else if (rect.bottom > vh - CLAMP_PAD) dy = (vh - CLAMP_PAD) - rect.bottom;
  if (dx !== 0 || dy !== 0) {
    const pos = usesPixelPosition(id) ? pixelPositionFromPixels(rect.left + dx, rect.top + dy, rect.width, rect.height) : centerPositionFromPixels(rect.left + dx, rect.top + dy, rect.width, rect.height);
    applyWidgetPosition(id, pos);
    if (persist) Store.set(posKey(id), pos);
  }
}
function clampAllWidgets(persist = false) { WIDGETS.forEach(id => clampWidget(id, persist)); }

// ─── Widget Sizes ───────────────────────────────────────────────────
const WIDGET_MIN = { clock: [160, 60], search: [260, 48], bookmarks: [120, 36], recent: [180, 80], media: [160, 60], notes: [180, 100] };
function applyWidgetSize(id, size) {
  const el = document.getElementById(`widget-${id}`); if (!el) return;
  if (size) { el.style.width = size.w + 'px'; el.style.height = size.h + 'px'; el.classList.add('widget-sized'); if (id === 'clock') requestAnimationFrame(updateClockScale); }
  else { el.style.width = ''; el.style.height = ''; el.classList.remove('widget-sized'); if (id === 'clock') requestAnimationFrame(updateClockScale); }
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
  const start = (cx, cy) => { rsX = cx; rsY = cy; rsW = el.offsetWidth; el.style.bottom = 'auto'; rsH = el.offsetHeight; el.style.bottom = ''; resizing = widgetId; };
  handle.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); start(e.clientX, e.clientY); });
  handle.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
}
function onResizeMove(cx, cy) {
  if (!resizing) return;
  const el = document.getElementById(`widget-${resizing}`);
  const [minW, minH] = WIDGET_MIN[resizing] ?? [100, 40];
  const rect = el.getBoundingClientRect();
  const newW = Math.min(window.innerWidth - rect.left - CLAMP_PAD, Math.max(minW, rsW + (cx - rsX)));
  const newH = Math.min(window.innerHeight - rect.top - CLAMP_PAD, Math.max(minH, rsH + (cy - rsY)));
  el.style.width = newW + 'px'; el.style.height = newH + 'px';
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
document.addEventListener('touchmove', (e) => { if (resizing) { e.preventDefault(); onResizeMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
document.addEventListener('mouseup', endResize);
document.addEventListener('touchend', endResize);

function loadWidgetPositions() {
  loadWidgetSizes();
  WIDGETS.forEach(id => { const saved = ensureStoredPosition(id, Store.get(posKey(id))); if (saved) Store.set(posKey(id), saved); applyWidgetPosition(id, saved ?? DEFAULT_POSITIONS[id]); });
  requestAnimationFrame(() => requestAnimationFrame(() => clampAllWidgets(false)));
}

function resetWidgetPositions() {
  WIDGETS.forEach(id => { Store.set(posKey(id), null); Store.set(sizeKey(id), null); applyWidgetSize(id, null); applyWidgetPosition(id, DEFAULT_POSITIONS[id]); });
  requestAnimationFrame(() => requestAnimationFrame(() => clampAllWidgets(false)));
  updateLayoutRows();
}
document.getElementById('reset-layout-btn')?.addEventListener('click', resetWidgetPositions);

// ─── Snap Zones ─────────────────────────────────────────────────────
const SNAP_ZONES = [
  { name: 'top-left', xPct: 0, yPct: 0, padX: 40, padY: 40, label: 'Top Left' },
  { name: 'top-center', xPct: 50, yPct: 0, padX: 0, padY: 40, label: 'Top Center' },
  { name: 'top-right', xPct: 100, yPct: 0, padX: 40, padY: 40, label: 'Top Right' },
  { name: 'mid-left', xPct: 0, yPct: 50, padX: 40, padY: 0, label: 'Left' },
  { name: 'center', xPct: 50, yPct: 50, padX: 0, padY: 0, label: 'Center' },
  { name: 'mid-right', xPct: 100, yPct: 50, padX: 40, padY: 0, label: 'Right' },
  { name: 'bot-left', xPct: 0, yPct: 100, padX: 40, padY: 40, label: 'Bottom Left' },
  { name: 'bot-center', xPct: 50, yPct: 100, padX: 0, padY: 40, label: 'Bottom' },
  { name: 'bot-right', xPct: 100, yPct: 100, padX: 40, padY: 40, label: 'Bottom Right' },
];
const SNAP_RADIUS = 90;
const snapZoneOverlay = document.createElement('div');
snapZoneOverlay.id = 'snap-zone-overlay';
const snapZoneCells = {};
SNAP_ZONES.forEach(zone => { const cell = document.createElement('div'); cell.className = 'snap-zone-cell'; const lbl = document.createElement('span'); lbl.className = 'snap-zone-label'; lbl.textContent = zone.label; cell.appendChild(lbl); snapZoneOverlay.appendChild(cell); snapZoneCells[zone.name] = cell; });
document.body.appendChild(snapZoneOverlay);

function getSnapPosition(elCenterX, elCenterY, elW, elH) {
  const vw = window.innerWidth, vh = window.innerHeight;
  for (const zone of SNAP_ZONES) {
    let snapX, snapY;
    if (zone.xPct === 0) snapX = zone.padX; else if (zone.xPct === 100) snapX = vw - elW - zone.padX; else snapX = vw / 2 - elW / 2;
    if (zone.yPct === 0) snapY = zone.padY; else if (zone.yPct === 100) snapY = vh - elH - zone.padY; else snapY = vh / 2 - elH / 2;
    const snappedCx = snapX + elW / 2, snappedCy = snapY + elH / 2;
    if (Math.hypot(elCenterX - snappedCx, elCenterY - snappedCy) < SNAP_RADIUS) return { zone, snapX, snapY };
  }
  return null;
}
function showSnapOverlay() { snapZoneOverlay.classList.add('visible'); }
function hideSnapOverlay() { snapZoneOverlay.classList.remove('visible'); Object.values(snapZoneCells).forEach(c => c.classList.remove('snap-active')); }
function highlightSnapZone(zoneName) { Object.entries(snapZoneCells).forEach(([name, cell]) => { cell.classList.toggle('snap-active', name === zoneName); }); }
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
  el.addEventListener('mousedown', onDown);
  el.addEventListener('touchstart', onDown, { passive: false });
}
function onDragMove(cx, cy) {
  if (!dragging) return;
  const el = document.getElementById(`widget-${dragging}`);
  el.style.transform = 'none'; el.style.bottom = ''; el.style.right = '';
  el.style.left = (cx - dragOffX) + 'px'; el.style.top = (cy - dragOffY) + 'px';
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
  const curX = parseFloat(el.style.left) || 0, curY = parseFloat(el.style.top) || 0;
  const elW = el.offsetWidth;
  el.style.bottom = 'auto'; const elH = el.offsetHeight; el.style.bottom = '';
  const snap = getSnapPosition(curX + elW / 2, curY + elH / 2, elW, elH);
  let pos;
  if (usesPixelPosition(draggedId)) pos = snap ? pixelPositionFromPixels(snap.snapX, snap.snapY, elW, elH) : pixelPositionFromPixels(curX, curY, elW, elH);
  else if (snap) pos = centerPositionFromPixels(snap.snapX, snap.snapY, elW, elH);
  else pos = centerPositionFromPixels(curX, curY, elW, elH);
  applyWidgetPosition(draggedId, pos);
  Store.set(posKey(draggedId), pos);
  updateLayoutRows();
}
document.addEventListener('mouseup', endDrag);
document.addEventListener('touchend', endDrag);
WIDGETS.forEach(enableDrag);
WIDGETS.forEach(enableResize);

// ─── Layout Mode ────────────────────────────────────────────────────
const layoutBanner = document.getElementById('layout-banner');
function setLayoutMode(on) {
  layoutMode = on;
  document.body.classList.toggle('layout-mode', on);
  layoutBanner?.classList.toggle('visible', on);
  document.getElementById('layout-btn')?.classList.toggle('active', on);
  if (on && document.activeElement?.closest?.('.widget')) document.activeElement.blur();
}
document.getElementById('layout-done-btn')?.addEventListener('click', () => { setLayoutMode(false); panels.closePanel('layout-panel'); });

function blockWidgetInteractionInLayoutMode(e) {
  if (!layoutMode) return;
  const target = e.target;
  const widget = target?.closest?.('.widget');
  if (!widget) return;
  if (target.closest?.('.widget-resize-handle') || target.closest?.('.widget-drag-handle')) return;
  e.preventDefault(); e.stopPropagation();
}
document.addEventListener('click', blockWidgetInteractionInLayoutMode, true);
document.addEventListener('submit', blockWidgetInteractionInLayoutMode, true);

function updateLayoutRows() {
  const container = document.getElementById('layout-widget-rows'); if (!container) return;
  container.innerHTML = '';
  WIDGETS.forEach(id => {
    const saved = Store.get(posKey(id));
    const pos = normalizeWidgetPosition(id, saved ?? DEFAULT_POSITIONS[id]);
    const row = document.createElement('div'); row.className = 'layout-row';
    const nm = document.createElement('span'); nm.className = 'layout-row-name'; nm.textContent = id.charAt(0).toUpperCase() + id.slice(1);
    const ps = document.createElement('span'); ps.className = 'layout-row-pos';
    if (Store.get(widgetHiddenKey(id))) ps.textContent = 'Hidden';
    else if (usesPixelPosition(id)) ps.textContent = `${Math.round(pos.x)}px / ${Math.round(pos.y)}px`;
    else ps.textContent = `${Math.round(pos.x)}% / ${Math.round(pos.y)}%`;
    row.appendChild(nm); row.appendChild(ps); container.appendChild(row);
  });
}

// ─── Widget Visibility ──────────────────────────────────────────────
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
bindWidgetVisibilityToggle(document.getElementById('toggle-widget-clock'), 'clock');
bindWidgetVisibilityToggle(document.getElementById('toggle-widget-search'), 'search');
bindWidgetVisibilityToggle(document.getElementById('toggle-widget-bookmarks'), 'bookmarks');
bindWidgetVisibilityToggle(document.getElementById('toggle-widget-recent'), 'recent');
bindWidgetVisibilityToggle(document.getElementById('toggle-widget-media'), 'media');
bindWidgetVisibilityToggle(document.getElementById('toggle-widget-notes'), 'notes');

// ─── Brand Visibility ───────────────────────────────────────────────
const brandEl = document.querySelector('.brand');
const toggleBrand = document.getElementById('toggle-brand');
function applyBrandVisibility() { if (brandEl) brandEl.style.display = Store.get('hideBrand') ? 'none' : ''; }
if (toggleBrand) { toggleBrand.checked = !Store.get('hideBrand'); applyBrandVisibility(); toggleBrand.addEventListener('change', () => { Store.set('hideBrand', !toggleBrand.checked); applyBrandVisibility(); }); }

// ─── Initialize Features (order matters for dependencies) ───────────
loadWidgetPositions();
updateClockScale();
window.addEventListener('resize', () => {
  WIDGETS.forEach(id => { const saved = ensureStoredPosition(id, Store.get(posKey(id))); applyWidgetPosition(id, saved ?? DEFAULT_POSITIONS[id]); });
  requestAnimationFrame(() => requestAnimationFrame(() => clampAllWidgets(false)));
});

// Panel manager (needs layout mode + widget appearance controls)
const panels = createPanelManager({
  updateLayoutRows, setLayoutMode, isLayoutMode,
  loadWidgetAppearanceControls,
  onBookmarkButtonClick: () => {
    if (bookmarksApi.isLegacyMode()) {
      panels.getActivePanel() === 'bookmark-panel' ? panels.closePanel('bookmark-panel') : panels.openPanel('bookmark-panel');
    } else {
      bookmarksApi.openBookmarkManager();
    }
  },
});

// Background needs clearActiveTheme (defined later in themes) and URL drop handler.
// We use a mutable ref so themes can register clearActiveTheme after background init.
const themeApi = { clearActiveTheme: null };

const bg = initBackground({
  store: Store, showToast,
  clearActiveTheme: () => themeApi.clearActiveTheme?.(),
  onDropUrl: (dataTransfer) => {
    const raw = (dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain')).trim();
    if (!raw || !looksLikeUrl(raw)) return;
    const url = normalizeBookmarkUrl(normalizeUrl(raw));
    const hostname = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })();
    bookmarksApi.addBookmark({ name: hostname, url, folderId: bookmarksApi.getActiveBookmarkFolderId() });
    showToast(`Bookmarked: ${hostname}`);
  },
});

// Fonts needs clearActiveTheme too
const fontsApi = initFonts({ store: Store, showToast, clearActiveTheme: () => themeApi.clearActiveTheme?.() });

// Notes
const notesApi = initNotes({ store: Store, showToast });

// Search
const searchApi = initSearch({ store: Store, showToast, isLayoutMode });

// Bookmarks
const bookmarksApi = initBookmarks({ store: Store, showToast, openPanel: panels.openPanel });

const toggleLegacyBookmarks = document.getElementById('toggle-legacy-bookmarks');
if (toggleLegacyBookmarks) {
  toggleLegacyBookmarks.checked = bookmarksApi.isLegacyMode();
  toggleLegacyBookmarks.addEventListener('change', () => {
    bookmarksApi.setLegacyMode(toggleLegacyBookmarks.checked);
    if (!toggleLegacyBookmarks.checked && panels.getActivePanel() === 'bookmark-panel') panels.closePanel('bookmark-panel');
  });
}

// ─── Recently Visited Widget ────────────────────────────────────────
const recentList = document.getElementById('recent-list');
const recentCountInput = document.getElementById('recent-count-input');
function hostnameLabel(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } }
function renderRecentItems(items) {
  if (!recentList) return;
  recentList.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div'); empty.className = 'recent-empty';
    empty.textContent = globalThis.chrome?.history ? 'No recent visits yet' : 'History permission unavailable';
    recentList.appendChild(empty); return;
  }
  items.forEach(item => {
    const a = document.createElement('a'); a.className = 'recent-item'; a.href = item.url; a.title = item.url;
    const title = document.createElement('div'); title.className = 'recent-title'; title.textContent = item.title || hostnameLabel(item.url);
    const url = document.createElement('div'); url.className = 'recent-url'; url.textContent = hostnameLabel(item.url);
    a.appendChild(title); a.appendChild(url); recentList.appendChild(a);
  });
}
function loadRecentVisits() {
  const count = Math.min(12, Math.max(1, +(Store.get('recentCount') ?? 5)));
  if (recentCountInput) recentCountInput.value = count;
  if (!globalThis.chrome?.history?.search) { renderRecentItems([]); return; }
  chrome.history.search({ text: '', maxResults: count, startTime: 0 }, (items) => { renderRecentItems((items ?? []).filter(item => item.url)); });
}
if (recentCountInput) {
  recentCountInput.value = Store.get('recentCount') ?? 5;
  recentCountInput.addEventListener('change', () => { const count = Math.min(12, Math.max(1, +recentCountInput.value || 5)); recentCountInput.value = count; Store.set('recentCount', count); loadRecentVisits(); });
}
loadRecentVisits();

// ─── Media Widget ───────────────────────────────────────────────────
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

// ─── Theme Presets ──────────────────────────────────────────────────
const BUILTIN_THEME_PRESETS = [
  { id: 'midnight-gold', name: 'Midnight Gold', description: 'Elegant dark violet with warm gold.', bgPreset: 0, bgOverlay: 35, bgBlur: 0, accent: '#c9a96e', clockFontName: 'Cormorant Garamond', uiFontName: 'DM Mono' },
  { id: 'forest-glass', name: 'Forest Glass', description: 'Deep green, soft glow, quiet focus.', bgPreset: 2, bgOverlay: 32, bgBlur: 0, accent: '#7bd88f', clockFontName: 'Raleway', uiFontName: 'IBM Plex Mono' },
  { id: 'minimal-mono', name: 'Minimal Mono', description: 'Clean grayscale with crisp mono text.', bgPreset: 4, bgOverlay: 42, bgBlur: 0, accent: '#d8d8d8', clockFontName: 'Space Mono', uiFontName: 'DM Mono' },
  { id: 'cyber-purple', name: 'Cyber Purple', description: 'Neon violet with a futuristic feel.', bgPreset: 7, bgOverlay: 30, bgBlur: 1, accent: '#c084fc', clockFontName: 'Cinzel', uiFontName: 'IBM Plex Mono' },
  { id: 'ember-night', name: 'Ember Night', description: 'Dark red warmth for late sessions.', bgPreset: 5, bgOverlay: 38, bgBlur: 0, accent: '#ff9f68', clockFontName: 'Playfair Display', uiFontName: 'DM Mono' },
  { id: 'ocean-depths', name: 'Ocean Depths', description: 'Blue glass with calm contrast.', bgPreset: 6, bgOverlay: 34, bgBlur: 0, accent: '#64d2ff', clockFontName: 'Josefin Sans', uiFontName: 'Space Mono' },
];

function getCustomThemes() { return (Store.get('customThemes') ?? []).filter(theme => theme && theme.id && theme.name); }
function setCustomThemes(themes) { Store.set('customThemes', themes); }
function getAllThemes() { return [...BUILTIN_THEME_PRESETS, ...getCustomThemes()]; }
function makeThemeId(name) { return `custom-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme'}-${Date.now()}`; }

function setThemeControls(theme) {
  const overlay = theme.bgOverlay ?? 35, blur = theme.bgBlur ?? 0;
  Store.set('bgOverlay', overlay); Store.set('bgBlur', blur);
  if (bg.overlayRange) bg.overlayRange.value = overlay;
  if (bg.blurRange) bg.blurRange.value = blur;
  bg.applyOverlay(overlay); bg.applyBlur(blur);
  if (theme.bgImage) {
    bg.applyStoredBackgroundImage(theme.bgImage, { persist: true, name: theme.name || 'Theme background' });
    const uploadText = document.getElementById('upload-text'); if (uploadText) uploadText.textContent = 'Custom theme image';
  } else {
    const preset = Number.isInteger(theme.bgPreset) ? theme.bgPreset : 0;
    Store.set('bgImage', null); Store.set('bgPreset', preset);
    bg.applyBackground(bg.PRESETS[preset] ?? bg.PRESETS[0], false);
    const uploadText = document.getElementById('upload-text'); if (uploadText) uploadText.textContent = 'Click or drop an image';
  }
  bg.updateBackgroundPresetActive();
  if (theme.accent) applyAccentColor(theme.accent, true);
  const clockIdx = Number.isInteger(theme.clockFontIdx) ? theme.clockFontIdx : fontsApi.findFontIndexByName(theme.clockFontName, Store.get('clockFontIdx') ?? 0);
  const uiIdx = Number.isInteger(theme.uiFontIdx) ? theme.uiFontIdx : fontsApi.findFontIndexByName(theme.uiFontName, Store.get('uiFontIdx') ?? 1);
  if (fontsApi.getAllFonts()[clockIdx]) { Store.set('clockFontIdx', clockIdx); const sel = document.getElementById('clock-font-select'); if (sel) sel.value = clockIdx; fontsApi.applyClockFont(clockIdx); }
  if (fontsApi.getAllFonts()[uiIdx]) { Store.set('uiFontIdx', uiIdx); const sel = document.getElementById('ui-font-select'); if (sel) sel.value = uiIdx; fontsApi.applyUIFont(uiIdx); }
}

function applyThemePreset(theme) {
  if (!theme) return;
  setThemeControls(theme);
  Store.set('activeThemeId', theme.id);
  renderThemePresets();
  showToast(`Theme applied: ${theme.name}`);
}

function captureThemePreset(name) {
  const clockIdx = Store.get('clockFontIdx') ?? 0, uiIdx = Store.get('uiFontIdx') ?? 1;
  return {
    id: makeThemeId(name), name, description: 'Custom saved theme.',
    bgImage: Store.get('bgImage'), bgPreset: Store.get('bgPreset') ?? 0,
    bgOverlay: +(Store.get('bgOverlay') ?? 35), bgBlur: +(Store.get('bgBlur') ?? 0),
    accent: Store.get('accentColor') ?? DEFAULT_ACCENT,
    clockFontIdx, uiFontIdx,
    clockFontName: fontsApi.getAllFonts()[clockIdx]?.name, uiFontName: fontsApi.getAllFonts()[uiIdx]?.name,
    custom: true, createdAt: Date.now(),
  };
}

function renderThemePresets() {
  const grid = document.getElementById('theme-preset-grid'); if (!grid) return;
  const activeId = Store.get('activeThemeId');
  grid.querySelectorAll('[data-object-url]').forEach(el => URL.revokeObjectURL(el.dataset.objectUrl));
  grid.innerHTML = '';
  getAllThemes().forEach(theme => {
    const card = document.createElement('button'); card.type = 'button';
    card.className = `theme-preset-card${theme.id === activeId ? ' active' : ''}${theme.custom ? ' custom' : ''}`;
    card.title = theme.description || theme.name;
    card.addEventListener('click', () => applyThemePreset(theme));
    const preview = document.createElement('div'); preview.className = 'theme-preset-preview';
    preview.style.backgroundImage = bg.PRESETS[theme.bgPreset] ?? bg.PRESETS[0];
    if (theme.bgImage) bg.applyStoredBackgroundPreview(preview, theme.bgImage);
    const shade = document.createElement('span'); shade.className = 'theme-preset-shade'; shade.style.background = `rgba(0,0,0,${(theme.bgOverlay ?? 35) / 100})`;
    const accent = document.createElement('span'); accent.className = 'theme-preset-accent'; accent.style.background = normalizeHexColor(theme.accent ?? DEFAULT_ACCENT);
    preview.appendChild(shade); preview.appendChild(accent);
    const nameEl = document.createElement('span'); nameEl.className = 'theme-preset-name'; nameEl.textContent = theme.name;
    const desc = document.createElement('span'); desc.className = 'theme-preset-desc'; desc.textContent = theme.custom ? 'Custom' : (theme.description || 'Preset theme');
    card.appendChild(preview); card.appendChild(nameEl); card.appendChild(desc);
    grid.appendChild(card);
  });
}

function clearActiveTheme() {
  if (!Store.get('activeThemeId')) return;
  Store.set('activeThemeId', null);
  renderThemePresets();
}
// Register clearActiveTheme for background/fonts to use
themeApi.clearActiveTheme = clearActiveTheme;

const saveThemeBtn = document.getElementById('save-theme-btn');
const deleteThemeBtn = document.getElementById('delete-theme-btn');
const themeNameInput = document.getElementById('theme-name');
if (saveThemeBtn && themeNameInput) {
  saveThemeBtn.addEventListener('click', () => {
    const name = themeNameInput.value.trim() || `Theme ${getCustomThemes().length + 1}`;
    const themes = getCustomThemes(); const theme = captureThemePreset(name);
    themes.push(theme); setCustomThemes(themes);
    Store.set('activeThemeId', theme.id); themeNameInput.value = '';
    renderThemePresets(); showToast(`Theme saved: ${name}`);
  });
}
if (deleteThemeBtn) {
  deleteThemeBtn.addEventListener('click', () => {
    const activeId = Store.get('activeThemeId');
    if (!activeId || !String(activeId).startsWith('custom-')) { showToast('Select a custom theme first'); return; }
    const before = getCustomThemes(); const theme = before.find(item => item.id === activeId);
    setCustomThemes(before.filter(item => item.id !== activeId));
    Store.set('activeThemeId', null); renderThemePresets();
    showToast(`Deleted theme: ${theme?.name ?? 'Custom'}`, () => { if (!theme) return; setCustomThemes([...getCustomThemes(), theme]); Store.set('activeThemeId', theme.id); renderThemePresets(); });
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

// ─── Init Panel Buttons ─────────────────────────────────────────────
panels.initPanelButtons();

document.getElementById('reset-layout-default-btn')?.addEventListener('click', () => {
  const snapshot = JSON.parse(JSON.stringify(Store.get('widgetPositions') ?? {}));
  resetWidgetPositions();
  showToast('Layout reset to defaults', () => { Store.set('widgetPositions', snapshot); loadWidgetPositions(); });
});

// ─── Layout Profiles ────────────────────────────────────────────────
const profileSelect = document.getElementById('profile-select');
const profileNameInput = document.getElementById('profile-name');
const saveProfileBtn = document.getElementById('save-profile-btn');
const loadProfileBtn = document.getElementById('load-profile-btn');
const deleteProfileBtn = document.getElementById('delete-profile-btn');

function getProfiles() { return Store.get('layoutProfiles') ?? {}; }
function setProfiles(profiles) { Store.set('layoutProfiles', profiles); }

function captureLayoutProfile() {
  const positions = {}, hidden = {}, sizes = {}, appearances = {};
  WIDGETS.forEach(id => { positions[id] = currentWidgetPosition(id); hidden[id] = !!Store.get(widgetHiddenKey(id)); sizes[id] = Store.get(sizeKey(id)); appearances[id] = getWidgetAppearance(id); });
  return {
    positions, hidden, sizes, appearances,
    backgroundDetails: { bgImage: Store.get('bgImage'), bgPreset: Store.get('bgPreset') ?? 0, bgOverlay: Store.get('bgOverlay') ?? 35, bgBlur: Store.get('bgBlur') ?? 0 },
    clockDetails: { hideGreeting: !!Store.get('hideGreeting'), hideDate: !!Store.get('hideDate') },
    notesMarkdown: Store.get('notesMarkdown') ?? '', notesList: Store.get('notesList') ?? [],
    activeNoteId: Store.get('activeNoteId'), notesPreviewHidden: !!Store.get('notesPreviewHidden'),
  };
}

function applyLayoutProfile(profile) {
  if (!profile) return;
  WIDGETS.forEach(id => {
    const size = profile.sizes?.[id]; Store.set(sizeKey(id), size); applyWidgetSize(id, size || null);
    const pos = ensureStoredPosition(id, profile.positions?.[id] ?? DEFAULT_POSITIONS[id]);
    applyWidgetPosition(id, pos); Store.set(posKey(id), pos);
    if (profile.notesList !== undefined) Store.set('notesList', profile.notesList);
    if (profile.activeNoteId !== undefined) Store.set('activeNoteId', profile.activeNoteId);
    if (profile.notesPreviewHidden !== undefined) Store.set('notesPreviewHidden', !!profile.notesPreviewHidden);
    if (profile.notesMarkdown !== undefined && profile.notesList === undefined) { Store.set('notesMarkdown', profile.notesMarkdown); Store.set('notesList', [notesApi.makeNote(profile.notesMarkdown)]); }
    if (profile.appearances?.[id]) { Store.set(widgetAppearanceKey(id), profile.appearances[id]); applyWidgetAppearance(id); }
    Store.set(widgetHiddenKey(id), !!profile.hidden?.[id]); applyWidgetVisibility(id);
  });
  if (profile.backgroundDetails) {
    const d = profile.backgroundDetails;
    if (d.bgPreset !== undefined) Store.set('bgPreset', d.bgPreset);
    if (d.bgOverlay !== undefined) { Store.set('bgOverlay', d.bgOverlay); if (bg.overlayRange) bg.overlayRange.value = d.bgOverlay; bg.applyOverlay(d.bgOverlay); }
    if (d.bgBlur !== undefined) { Store.set('bgBlur', d.bgBlur); if (bg.blurRange) bg.blurRange.value = d.bgBlur; bg.applyBlur(d.bgBlur); }
    if (d.bgImage) { bg.applyStoredBackgroundImage(d.bgImage, { persist: true, name: `${Store.get('activeLayoutProfile') || 'Layout'} background` }).then(ok => { if (!ok) bg.applyBackground(bg.PRESETS[d.bgPreset ?? (Store.get('bgPreset') ?? 0)], false); }); }
    else { Store.set('bgImage', null); bg.applyBackground(bg.PRESETS[d.bgPreset ?? (Store.get('bgPreset') ?? 0)], false); }
  }
  Store.set('hideGreeting', !!profile.clockDetails?.hideGreeting);
  Store.set('hideDate', !!profile.clockDetails?.hideDate);
  const toggleGreeting = document.getElementById('toggle-greeting');
  const toggleDate = document.getElementById('toggle-date');
  if (toggleGreeting) toggleGreeting.checked = !Store.get('hideGreeting');
  if (toggleDate) toggleDate.checked = !Store.get('hideDate');
  WIDGETS.forEach(id => { const t = document.getElementById(`toggle-widget-${id}`); if (t) t.checked = !Store.get(widgetHiddenKey(id)); });
  notesApi.loadNotes();
  applyVisibility(); updateLayoutRows();
  requestAnimationFrame(() => requestAnimationFrame(() => clampAllWidgets(false)));
}

function renderProfileOptions(selectedName = Store.get('activeLayoutProfile')) {
  if (!profileSelect) return;
  const profiles = getProfiles();
  const names = Object.keys(profiles).sort((a, b) => a.localeCompare(b));
  profileSelect.innerHTML = '';
  if (!names.length) { const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'No saved profiles'; profileSelect.appendChild(opt); return; }
  names.forEach(name => { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; profileSelect.appendChild(opt); });
  profileSelect.value = names.includes(selectedName) ? selectedName : names[0];
}

saveProfileBtn?.addEventListener('click', () => {
  const name = profileNameInput?.value.trim() || profileSelect?.value || 'Default';
  const profiles = getProfiles(); profiles[name] = captureLayoutProfile(); setProfiles(profiles);
  Store.set('activeLayoutProfile', name); if (profileNameInput) profileNameInput.value = ''; renderProfileOptions(name);
  showToast(`Layout saved: ${name}`);
});
loadProfileBtn?.addEventListener('click', () => {
  const name = profileSelect?.value; const profile = getProfiles()[name]; if (!profile) return;
  Store.set('activeLayoutProfile', name); applyLayoutProfile(profile); showToast(`Layout loaded: ${name}`);
});
profileSelect?.addEventListener('change', () => {
  const name = profileSelect.value; const profile = getProfiles()[name]; if (!profile) return;
  Store.set('activeLayoutProfile', name); applyLayoutProfile(profile); showToast(`Layout loaded: ${name}`);
});
deleteProfileBtn?.addEventListener('click', () => {
  const name = profileSelect?.value; if (!name) return;
  const profiles = getProfiles(); const snapshot = profiles[name];
  delete profiles[name]; setProfiles(profiles);
  if (Store.get('activeLayoutProfile') === name) Store.set('activeLayoutProfile', null);
  renderProfileOptions();
  showToast(`Deleted layout: ${name}`, () => { const cur = getProfiles(); cur[name] = snapshot; setProfiles(cur); Store.set('activeLayoutProfile', name); renderProfileOptions(); });
});
renderProfileOptions();

// ─── Settings Search ────────────────────────────────────────────────
function initSettingsSearch() {
  const input = document.getElementById('settings-search-input');
  const body = document.querySelector('#settings-panel .panel-body');
  if (!input || !body) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const all = [...body.children].filter(el => el !== input);
    if (!q) { all.forEach(el => el.style.display = ''); document.querySelectorAll('.settings-section').forEach(s => s.style.display = ''); return; }
    let sections = [], cur = null;
    all.forEach(el => {
      if (el.classList.contains('label')) { cur = { els: [el], text: el.textContent.toLowerCase() }; sections.push(cur); }
      else if (el.classList.contains('divider')) { sections.push({ divider: true, el }); }
      else { if (!cur) { cur = { els: [], text: '' }; sections.push(cur); } cur.els.push(el); cur.text += ' ' + el.textContent.toLowerCase(); }
    });
    sections.forEach(sec => { if (sec.divider) return; sec.match = sec.text.includes(q); sec.els.forEach(el => el.style.display = sec.match ? '' : 'none'); });
    sections.forEach((sec, i) => { if (!sec.divider) return; const before = sections.slice(0, i).filter(s => !s.divider); const after = sections.slice(i + 1).filter(s => !s.divider); sec.el.style.display = before.some(s => s.match) && after.some(s => s.match) ? '' : 'none'; });
    document.querySelectorAll('.settings-section').forEach(section => {
      const sectionBody = section.querySelector('.settings-section-body'); if (!sectionBody) return;
      const hasMatch = sectionBody.textContent.toLowerCase().includes(q);
      section.style.display = hasMatch ? '' : 'none';
      if (hasMatch) section.removeAttribute('data-collapsed');
    });
  });
}
initSettingsSearch();

// ─── Settings Sections ──────────────────────────────────────────────
function initSettingsSections() {
  const collapsed = getCollapsedSections(Store);
  document.querySelectorAll('.settings-section').forEach(section => {
    const key = section.dataset.section;
    if (collapsed[key]) section.setAttribute('data-collapsed', '');
    const header = section.querySelector('.settings-section-header');
    header?.addEventListener('click', () => {
      const isCollapsed = section.hasAttribute('data-collapsed');
      if (isCollapsed) section.removeAttribute('data-collapsed'); else section.setAttribute('data-collapsed', '');
      toggleSection(Store, key);
    });
  });
}
initSettingsSections();

// ─── Import / Export Settings ───────────────────────────────────────
const exportSettingsBtn = document.getElementById('export-settings-btn');
const importSettingsBtn = document.getElementById('import-settings-btn');
const importSettingsFile = document.getElementById('import-settings-file');
let pendingImportStorage = null;
let pendingImportAssets = null;

async function collectSettingsBackup() {
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i); if (!key) continue;
    try { storage[key] = JSON.parse(localStorage.getItem(key)); } catch { storage[key] = localStorage.getItem(key); }
  }
  return { app: 'Cenit New Tab', version: '1.2.0', settingsVersion: SETTINGS_VERSION, exportedAt: new Date().toISOString(), storage, assets: { backgroundImages: await bg.collectBackgroundImageAssets(storage) } };
}
async function downloadSettingsBackup() {
  try {
    const backup = await collectSettingsBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `cenit-settings-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast('Settings exported');
  } catch (err) { console.error('Export failed', err); showToast('Export failed'); }
}
function showImportPreview(storage, summary) {
  pendingImportStorage = storage;
  const body = document.getElementById('import-preview-body');
  const overlay = document.getElementById('import-preview-overlay');
  if (!body || !overlay) return;
  const lines = [`${summary.bookmarks} bookmark${summary.bookmarks !== 1 ? 's' : ''}`, `${summary.notes} note${summary.notes !== 1 ? 's' : ''}`, `${summary.themes} custom theme${summary.themes !== 1 ? 's' : ''}`, `Backup version: ${summary.version}`];
  body.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
  if (summary.versionWarning) body.innerHTML += `<div class="warn">&#9888; This backup is from a newer version — some data may not import correctly.</div>`;
  overlay.removeAttribute('hidden');
}
async function applyImportStorage(storage) {
  let preparedStorage;
  try { preparedStorage = await bg.prepareImportedBackgroundStorage(storage, pendingImportAssets); }
  catch (err) { console.error('Import failed', err); showToast('Import failed'); return; }
  localStorage.clear();
  Object.entries(preparedStorage).forEach(([key, value]) => { localStorage.setItem(key, JSON.stringify(value)); });
  showToast('Settings imported');
  setTimeout(() => window.location.reload(), 350);
}
document.getElementById('import-confirm-btn')?.addEventListener('click', () => {
  document.getElementById('import-preview-overlay')?.setAttribute('hidden', '');
  if (!pendingImportStorage) return;
  const storage = pendingImportStorage; pendingImportStorage = null;
  applyImportStorage(storage);
});
document.getElementById('import-cancel-btn')?.addEventListener('click', () => {
  document.getElementById('import-preview-overlay')?.setAttribute('hidden', '');
  pendingImportStorage = null; pendingImportAssets = null; showToast('Import cancelled');
});
async function restoreSettingsBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { showToast('Invalid backup file — not valid JSON'); return; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { showToast('Invalid backup file — unexpected format'); return; }
  const storage = parsed?.storage && typeof parsed.storage === 'object' ? parsed.storage : parsed;
  if (!storage || typeof storage !== 'object' || Array.isArray(storage)) { showToast('Invalid backup file — unexpected format'); return; }
  const { valid, errors, summary } = validateBackup(storage);
  if (!valid) { showToast(errors.length === 1 ? errors[0] : `Import failed: ${errors.length} validation errors — ${errors[0]}${errors.length > 1 ? ' (and more)' : ''}`); return; }
  pendingImportAssets = parsed?.assets ?? null;
  showImportPreview(storage, summary);
}
if (exportSettingsBtn) exportSettingsBtn.addEventListener('click', downloadSettingsBackup);
if (importSettingsBtn && importSettingsFile) {
  importSettingsBtn.addEventListener('click', () => importSettingsFile.click());
  importSettingsFile.addEventListener('change', () => {
    const file = importSettingsFile.files?.[0]; importSettingsFile.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => restoreSettingsBackup(String(reader.result ?? ''));
    reader.onerror = () => showToast('Import failed');
    reader.readAsText(file);
  });
}

// ─── Command Palette ────────────────────────────────────────────────
let cmdOpen = false;
const cmdPalette = document.getElementById('cmd-palette');
const cmdInput = document.getElementById('cmd-input');
const cmdResults = document.getElementById('cmd-results');
let cmdActiveIdx = -1;

function openCmdPalette() {
  if (!cmdPalette) return;
  cmdPalette.removeAttribute('hidden'); cmdOpen = true; cmdInput.value = '';
  renderCmdResults(''); requestAnimationFrame(() => cmdInput.focus());
}
function closeCmdPalette() {
  if (!cmdPalette) return;
  cmdPalette.setAttribute('hidden', ''); cmdOpen = false; cmdActiveIdx = -1;
}
function buildCmdItems(query) {
  const actionByLabel = {
    'Open Settings': () => panels.openPanel('settings-panel'),
    'Open Layout': () => panels.openPanel('layout-panel'),
    'Open Background': () => panels.openPanel('bg-panel'),
    'Open Bookmarks': () => { bookmarksApi.isLegacyMode() ? panels.openPanel('bookmark-panel') : bookmarksApi.openBookmarkManager(); },
    'New Note': () => { panels.openPanel('settings-panel'); notesApi.notesAddBtn?.click(); },
    'Reset Layout': () => { resetWidgetPositions(); showToast('Layout reset'); },
  };
  const actionItems = DEFAULT_ACTIONS.map((item) => ({ ...item, action: actionByLabel[item.label] }));
  const items = buildCmdItemsCore(query, {
    actions: actionItems,
    bookmarks: bookmarksApi.getBookmarks(),
    notes: notesApi.getNotes(),
    themes: [...BUILTIN_THEME_PRESETS, ...getCustomThemes()],
    profiles: getProfiles(),
  });
  return items.map((item) => {
    if (item.action) return item;
    if (item.category === 'bookmark') { const url = item.payload?.url; return { ...item, action: () => { if (url) window.location.href = url; } }; }
    if (item.category === 'note') { const noteId = item.payload?.id; return { ...item, action: () => { if (!noteId) return; Store.set('activeNoteId', noteId); notesApi.renderActiveNote(); } }; }
    if (item.category === 'theme') { const theme = item.payload; return { ...item, action: () => { if (!theme) return; applyThemePreset(theme); Store.set('activeThemeId', theme.id); renderThemePresets(); showToast(`Theme: ${theme.name}`); } }; }
    if (item.category === 'layout') { const name = item.payload?.name ?? item.label; return { ...item, action: () => { const profile = getProfiles()[name]; if (!profile) return; Store.set('activeLayoutProfile', name); applyLayoutProfile(profile); showToast(`Layout loaded: ${name}`); } }; }
    if (item.category === 'search') { const searchQuery = item.payload?.query ?? query.trim(); return { ...item, action: () => { window.location.href = searchApi.resolveSearchDestination(searchQuery); } }; }
    return item;
  });
}
function renderCmdResults(query) {
  if (!cmdResults) return;
  cmdActiveIdx = -1;
  const items = buildCmdItems(query);
  cmdResults.innerHTML = '';
  if (!items.length) { cmdResults.innerHTML = '<div class="cmd-empty">No results</div>'; return; }
  items.forEach((item, i) => {
    const el = document.createElement('div'); el.className = 'cmd-item'; el.setAttribute('role', 'option');
    const iconEl = document.createElement('span'); iconEl.className = 'cmd-item-icon'; iconEl.textContent = item.icon;
    const labelEl = document.createElement('span'); labelEl.className = 'cmd-item-label'; labelEl.textContent = item.label;
    const catEl = document.createElement('span'); catEl.className = 'cmd-item-category'; catEl.textContent = item.category;
    el.append(iconEl, labelEl, catEl);
    el.addEventListener('click', () => { item.action(); closeCmdPalette(); });
    el.addEventListener('mouseenter', () => setCmdActive(i));
    cmdResults.appendChild(el);
  });
}
function setCmdActive(idx) { const items = cmdResults.querySelectorAll('.cmd-item'); items.forEach((el, i) => el.classList.toggle('active', i === idx)); cmdActiveIdx = idx; }
function moveCmdActive(dir) { const items = cmdResults.querySelectorAll('.cmd-item'); if (!items.length) return; cmdActiveIdx = (cmdActiveIdx + dir + items.length) % items.length; setCmdActive(cmdActiveIdx); items[cmdActiveIdx]?.scrollIntoView({ block: 'nearest' }); }
if (cmdInput) {
  cmdInput.addEventListener('input', () => renderCmdResults(cmdInput.value));
  cmdInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCmdActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCmdActive(-1); }
    else if (e.key === 'Enter') { const items = buildCmdItems(cmdInput.value); const active = cmdActiveIdx >= 0 ? items[cmdActiveIdx] : items[0]; if (active) { active.action(); closeCmdPalette(); } }
    else if (e.key === 'Escape') { closeCmdPalette(); }
  });
}
document.getElementById('cmd-palette')?.querySelector('.cmd-backdrop')?.addEventListener('click', closeCmdPalette);
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); if (cmdOpen) closeCmdPalette(); else openCmdPalette(); } });

// ─── Widget Dock ────────────────────────────────────────────────────
const widgetDock = document.getElementById('widget-dock');
const DOCK_ICONS = { clock: '◷', search: '⌕', bookmarks: '☆', recent: '⟳', media: '♫', notes: '✎' };
function getMinimizedWidgets() { return getMinimizedWidgetsState(Store); }
function minimizeWidget(widgetId) {
  const widget = document.getElementById(`widget-${widgetId}`); if (!widget) return;
  minimizeWidgetState(Store, widgetId); widget.style.display = 'none'; renderWidgetDock();
}
function restoreWidget(widgetId) {
  const widget = document.getElementById(`widget-${widgetId}`);
  restoreWidgetState(Store, widgetId); if (widget) widget.style.display = ''; renderWidgetDock();
}
function renderWidgetDock() {
  if (!widgetDock) return;
  const minimized = getMinimizedWidgets();
  widgetDock.innerHTML = '';
  if (!minimized.size) { widgetDock.setAttribute('hidden', ''); return; }
  widgetDock.removeAttribute('hidden');
  minimized.forEach(id => {
    const btn = document.createElement('button'); btn.className = 'dock-icon'; btn.title = `Restore ${id}`;
    btn.textContent = DOCK_ICONS[id] ?? '⊞';
    btn.addEventListener('click', () => restoreWidget(id));
    widgetDock.appendChild(btn);
  });
}
function addMinimizeButtons() {
  document.querySelectorAll('.widget[data-widget]').forEach(widget => {
    if (widget.querySelector('.widget-minimize-btn')) return;
    const id = widget.dataset.widget;
    const btn = document.createElement('button'); btn.className = 'widget-minimize-btn'; btn.title = 'Minimize';
    btn.setAttribute('aria-label', `Minimize ${id} widget`); btn.textContent = '−';
    btn.addEventListener('click', (e) => { e.stopPropagation(); minimizeWidget(id); });
    widget.appendChild(btn);
  });
}
globalThis.minimizeWidget = minimizeWidget;
globalThis.restoreWidget = restoreWidget;
const savedDockPosition = Store.get('widgetDockPosition') ?? 'bottom-center';
if (!Store.get('widgetDockPosition')) Store.set('widgetDockPosition', 'bottom-center');
if (widgetDock) widgetDock.dataset.position = savedDockPosition;
renderWidgetDock();
getMinimizedWidgets().forEach(id => { const widget = document.getElementById(`widget-${id}`); if (widget) widget.style.display = 'none'; });
addMinimizeButtons();
