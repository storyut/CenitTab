/**
 * Shared UI utilities: toast notifications and panel management.
 */

let toastEl = null;
let toastTimer = null;

function ensureToastElement() {
  if (toastEl) return toastEl;
  toastEl = document.createElement('div');
  toastEl.className = 'profile-toast hide';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastEl);
  return toastEl;
}

/**
 * Show a toast notification with optional undo action.
 * @param {string} text - The message to display
 * @param {Function} [undoFn] - Optional undo callback
 */
export function showToast(text, undoFn) {
  const el = ensureToastElement();
  el.innerHTML = '';
  const msg = document.createElement('span');
  msg.textContent = text;
  el.appendChild(msg);
  el.classList.toggle('has-undo', !!undoFn);
  if (undoFn) {
    const btn = document.createElement('button');
    btn.className = 'toast-undo-btn';
    btn.textContent = 'Undo';
    btn.addEventListener('click', () => {
      undoFn();
      el.classList.remove('show');
      el.classList.add('hide');
    });
    el.appendChild(btn);
  }
  el.classList.remove('hide');
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
  }, undoFn ? 4000 : 1400);
}

/**
 * Panel management state and functions.
 * @param {object} deps - Dependencies from the app context
 */
export function createPanelManager(deps) {
  let activePanel = null;
  const backdrop = document.getElementById('backdrop');

  function openPanel(id) {
    if (activePanel && activePanel !== id) closePanel(activePanel);
    if (id === 'layout-panel') {
      deps.updateLayoutRows?.();
      deps.setLayoutMode?.(true);
    }
    const panel = document.getElementById(id);
    if (panel) panel.classList.add('open');
    if (id === 'layout-panel') {
      const lp = document.getElementById('layout-panel');
      lp?.classList.remove('collapsed');
      const btn = document.getElementById('layout-collapse-btn');
      if (btn) btn.textContent = '◀';
    }
    if (!deps.isLayoutMode?.()) backdrop?.classList.add('active');
    activePanel = id;
  }

  function closePanel(id) {
    const el = document.getElementById(id);
    if (el) {
      el.style.right = '';
      el.style.transition = '';
      el.classList.remove('open');
      if (id === 'layout-panel') el.classList.remove('collapsed');
    }
    backdrop?.classList.remove('active');
    activePanel = null;
    if (id === 'layout-panel') deps.setLayoutMode?.(false);
  }

  function getActivePanel() { return activePanel; }

  function initPanelButtons() {
    document.getElementById('bg-btn')?.addEventListener('click', () =>
      activePanel === 'bg-panel' ? closePanel('bg-panel') : openPanel('bg-panel'));
    document.getElementById('bookmark-btn')?.addEventListener('click', () => {
      if (deps.onBookmarkButtonClick) { deps.onBookmarkButtonClick(); return; }
      activePanel === 'bookmark-panel' ? closePanel('bookmark-panel') : openPanel('bookmark-panel');
    });
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      if (activePanel === 'settings-panel') closePanel('settings-panel');
      else { openPanel('settings-panel'); deps.loadWidgetAppearanceControls?.(); }
    });
    document.getElementById('layout-btn')?.addEventListener('click', () =>
      activePanel === 'layout-panel' ? closePanel('layout-panel') : openPanel('layout-panel'));

    const layoutCollapseBtn = document.getElementById('layout-collapse-btn');
    layoutCollapseBtn?.addEventListener('click', () => {
      const panel = document.getElementById('layout-panel');
      panel?.classList.toggle('collapsed');
      layoutCollapseBtn.textContent = panel?.classList.contains('collapsed') ? '▶' : '◀';
    });

    document.querySelectorAll('.close-btn').forEach(btn =>
      btn.addEventListener('click', () => closePanel(btn.dataset.target)));
    backdrop?.addEventListener('click', () => { if (activePanel) closePanel(activePanel); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && activePanel) closePanel(activePanel); });
  }

  return { openPanel, closePanel, getActivePanel, initPanelButtons };
}
