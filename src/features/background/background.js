/**
 * Background feature: preset gradients, custom images (IndexedDB),
 * overlay darkness, and blur controls.
 */
import { setStoredValue } from '../../shared/storage.js';

const BG_IMAGE_DB_NAME = 'cenit-background-images';
const BG_IMAGE_DB_VERSION = 1;
const BG_IMAGE_STORE = 'images';
const BG_IMAGE_REF_KIND = 'indexedDBImage';

export const PRESETS = [
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

function isLegacyDataImage(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function isBackgroundImageRef(value) {
  return value && typeof value === 'object' && value.kind === BG_IMAGE_REF_KIND && typeof value.key === 'string';
}

function makeBackgroundImageKey(prefix = 'background') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

/**
 * Initialize the background feature.
 * @param {object} deps - Dependencies
 * @param {object} deps.store - The Store object
 * @param {Function} deps.showToast - Toast notification function
 * @param {Function} deps.clearActiveTheme - Clear active theme callback
 * @param {Function} deps.onDropUrl - Handle URL dropped outside upload area
 * @returns {object} Background API
 */
export function initBackground(deps) {
  const { store, showToast, clearActiveTheme, onDropUrl } = deps;
  const bgLayer = document.getElementById('bg-layer');
  const bgOverlay = document.getElementById('bg-overlay');
  const overlayRange = document.getElementById('overlay-range');
  const blurRange = document.getElementById('blur-range');
  const blurVal = document.getElementById('blur-val');
  let activeBgObjectUrl = null;

  function setBackgroundImageUrl(url) {
    if (activeBgObjectUrl) URL.revokeObjectURL(activeBgObjectUrl);
    activeBgObjectUrl = url?.startsWith('blob:') ? url : null;
    if (bgLayer) {
      bgLayer.style.backgroundImage = `url(${url})`;
      bgLayer.style.backgroundSize = 'cover';
      bgLayer.style.backgroundPosition = 'center';
    }
  }

  function applyBackground(value, isImage) {
    if (isImage) {
      setBackgroundImageUrl(value);
    } else {
      if (activeBgObjectUrl) URL.revokeObjectURL(activeBgObjectUrl);
      activeBgObjectUrl = null;
      if (bgLayer) bgLayer.style.backgroundImage = value;
    }
  }

  function applyOverlay(pct) { if (bgOverlay) bgOverlay.style.background = `rgba(0,0,0,${pct / 100})`; }
  function applyBlur(px) {
    if (bgLayer) {
      bgLayer.style.filter = px > 0 ? `blur(${px}px)` : '';
      bgLayer.style.inset = px > 0 ? `-${px * 2}px` : '0';
    }
    if (blurVal) blurVal.textContent = `${px}px`;
  }

  function updateBackgroundPresetActive() {
    const saved = store.get('bgPreset') ?? 0;
    const hasImage = !!store.get('bgImage');
    document.querySelectorAll('.preset-swatch').forEach((sw, i) => {
      sw.classList.toggle('active', !hasImage && i === saved);
    });
  }

  function buildPresetGrid() {
    const grid = document.getElementById('preset-grid');
    if (!grid) return;
    const saved = store.get('bgPreset') ?? 0;
    PRESETS.forEach((g, i) => {
      const sw = document.createElement('div');
      sw.className = 'preset-swatch' + (i === saved && !store.get('bgImage') ? ' active' : '');
      sw.style.backgroundImage = g;
      sw.addEventListener('click', () => {
        store.set('bgPreset', i); store.set('bgImage', null);
        applyBackground(g, false);
        updateBackgroundPresetActive();
        clearActiveTheme?.();
      });
      grid.appendChild(sw);
    });
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
      const uploadText = document.getElementById('upload-text');
      if (uploadText) uploadText.textContent = file.name;
      updateBackgroundPresetActive();
      clearActiveTheme?.();
    } catch (err) {
      console.error('Could not save background image', err);
      showToast('Image could not be saved');
    }
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
      const currentImage = store.get('bgImage');
      if (isLegacyDataImage(currentImage)) {
        setStoredValue('bgImage', await persistDataUrlAsBackgroundImage(currentImage));
      }

      const themes = store.get('customThemes');
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

      const profiles = store.get('layoutProfiles');
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

  // Initialize saved state
  const savedImage = store.get('bgImage');
  const savedPreset = store.get('bgPreset') ?? 0;
  const savedOverlay = store.get('bgOverlay') ?? 35;
  const savedBlur = store.get('bgBlur') ?? 0;
  if (overlayRange) overlayRange.value = savedOverlay;
  if (blurRange) blurRange.value = savedBlur;
  applyOverlay(savedOverlay);
  applyBlur(savedBlur);
  applyBackground(PRESETS[savedPreset], false);

  if (overlayRange) overlayRange.addEventListener('input', () => { applyOverlay(overlayRange.value); store.set('bgOverlay', overlayRange.value); clearActiveTheme?.(); });
  if (blurRange) blurRange.addEventListener('input', () => { applyBlur(blurRange.value); store.set('bgBlur', blurRange.value); clearActiveTheme?.(); });
  document.getElementById('bg-upload')?.addEventListener('change', function () { saveBackgroundImage(this.files[0]); });

  const uploadLabel = document.getElementById('upload-label');
  if (uploadLabel) {
    ['dragenter', 'dragover'].forEach(ev => uploadLabel.addEventListener(ev, (e) => { e.preventDefault(); uploadLabel.classList.add('drag-over'); }));
    ['dragleave', 'drop'].forEach(ev => uploadLabel.addEventListener(ev, (e) => { e.preventDefault(); uploadLabel.classList.remove('drag-over'); }));
    uploadLabel.addEventListener('drop', (e) => { saveBackgroundImage(e.dataTransfer.files[0]); });
  }
  document.addEventListener('dragover', (e) => { if (uploadLabel && !uploadLabel.contains(e.target)) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    if (uploadLabel && uploadLabel.contains(e.target)) return;
    e.preventDefault();
    onDropUrl?.(e.dataTransfer);
  });

  buildPresetGrid();
  if (savedImage) {
    applyStoredBackgroundImage(savedImage, { persist: true }).then(ok => {
      if (!ok) {
        applyBackground(PRESETS[store.get('bgPreset') ?? 0], false);
        updateBackgroundPresetActive();
      }
    }).finally(migrateLegacyBackgroundImages);
  } else {
    migrateLegacyBackgroundImages();
  }

  return {
    PRESETS, applyBackground, applyOverlay, applyBlur,
    applyStoredBackgroundImage, applyStoredBackgroundPreview,
    updateBackgroundPresetActive, migrateLegacyBackgroundImages,
    collectBackgroundImageAssets, prepareImportedBackgroundStorage,
    overlayRange, blurRange,
  };
}
