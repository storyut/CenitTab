/**
 * Fonts feature: built-in fonts, custom Google Fonts, clock/UI font selection.
 */

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

/**
 * Initialize the fonts feature.
 * @param {object} deps - Dependencies
 * @param {object} deps.store - The Store object
 * @param {Function} deps.showToast - Toast notification function
 * @param {Function} deps.clearActiveTheme - Clear active theme callback
 * @returns {object} Fonts API: getAllFonts, findFontIndexByName, applyClockFont, applyUIFont
 */
export function initFonts(deps) {
  const { store, showToast, clearActiveTheme } = deps;

  function getAllFonts() { return [...BUILTIN_FONTS, ...(store.get('customFonts') ?? [])]; }

  function loadCustomFonts() {
    (store.get('customFonts') ?? []).forEach((font, i) => { if (font.url) injectFontLink(font.url, `saved-custom-font-${i}`); });
  }

  function populateFontSelects() {
    const fonts = getAllFonts();
    ['clock-font-select', 'ui-font-select'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '';
      fonts.forEach((f, i) => {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = f.name; sel.appendChild(opt);
      });
    });
    const clockSel = document.getElementById('clock-font-select');
    const uiSel = document.getElementById('ui-font-select');
    if (clockSel) clockSel.value = store.get('clockFontIdx') ?? 0;
    if (uiSel) uiSel.value = store.get('uiFontIdx') ?? 1;
  }

  function renderCustomFontList() {
    const container = document.getElementById('custom-font-list');
    if (!container) return;
    const customFonts = store.get('customFonts') ?? [];
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
    const customFonts = store.get('customFonts') ?? [];
    customFonts.splice(index, 1);
    store.set('customFonts', customFonts);
    populateFontSelects(); renderCustomFontList();
    const allFonts = getAllFonts();
    if ((store.get('clockFontIdx') ?? 0) >= allFonts.length) { store.set('clockFontIdx', 0); applyClockFont(0); }
    if ((store.get('uiFontIdx') ?? 1) >= allFonts.length) { store.set('uiFontIdx', 1); applyUIFont(1); }
  }

  function updateFontPreview(css) {
    const el = document.getElementById('font-preview'); if (el) el.style.fontFamily = css;
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

  function findFontIndexByName(name, fallback = 0) {
    const fonts = getAllFonts();
    const idx = fonts.findIndex(font => font.name === name);
    return idx >= 0 ? idx : fallback;
  }

  // Inject built-in font links
  BUILTIN_FONTS.forEach((f, i) => { if (f.url) injectFontLink(f.url, `builtin-font-${i}`); });
  loadCustomFonts();
  populateFontSelects();
  renderCustomFontList();
  applyClockFont(store.get('clockFontIdx') ?? 0);
  applyUIFont(store.get('uiFontIdx') ?? 1);

  // Event handlers
  document.getElementById('clock-font-select')?.addEventListener('change', function () { store.set('clockFontIdx', +this.value); applyClockFont(+this.value); clearActiveTheme?.(); });
  document.getElementById('ui-font-select')?.addEventListener('change', function () { store.set('uiFontIdx', +this.value); applyUIFont(+this.value); clearActiveTheme?.(); });

  document.getElementById('apply-custom-font-btn')?.addEventListener('click', () => {
    const urlInput = document.getElementById('custom-font-url').value.trim();
    const nameInput = document.getElementById('custom-font-name').value.trim();
    if (!nameInput) { showToast('Enter a font family name'); return; }
    let cssUrl = urlInput;
    const importMatch = urlInput.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (importMatch) cssUrl = importMatch[1];
    const cssVal = `'${nameInput}', sans-serif`;
    const id = `custom-font-${Date.now()}`;
    injectFontLink(cssUrl, id);
    const customFonts = store.get('customFonts') ?? [];
    customFonts.push({ name: nameInput, css: cssVal, url: cssUrl });
    store.set('customFonts', customFonts);
    populateFontSelects(); renderCustomFontList();
    document.getElementById('custom-font-url').value = '';
    document.getElementById('custom-font-name').value = '';
  });

  return { getAllFonts, findFontIndexByName, applyClockFont, applyUIFont };
}
