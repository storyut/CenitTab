/**
 * Shared custom dialogs for bookmarks: add/edit bookmark, folder name prompt,
 * and a generic confirm dialog. Used by both the legacy bookmark UI and the
 * new Bookmark Manager so there is a single, non-native (no window.prompt/
 * window.confirm) editing experience everywhere.
 */

let dialogEl = null;

function ensureDialogEl() {
  if (dialogEl) return dialogEl;
  dialogEl = document.createElement('div');
  dialogEl.className = 'bm-dialog-overlay';
  dialogEl.setAttribute('hidden', '');
  document.body.appendChild(dialogEl);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dialogEl.hasAttribute('hidden')) closeBookmarkDialog();
  });
  return dialogEl;
}

export function closeBookmarkDialog() {
  if (!dialogEl) return;
  dialogEl.setAttribute('hidden', '');
  dialogEl.innerHTML = '';
}

export function isBookmarkDialogOpen() {
  return !!dialogEl && !dialogEl.hasAttribute('hidden');
}

function buildShell(extraClass = '') {
  const el = ensureDialogEl();
  el.innerHTML = '';
  el.removeAttribute('hidden');
  const backdrop = document.createElement('div');
  backdrop.className = 'bm-dialog-backdrop';
  backdrop.addEventListener('click', closeBookmarkDialog);
  const modal = document.createElement('div');
  modal.className = `bm-dialog-modal${extraClass ? ` ${extraClass}` : ''}`;
  el.append(backdrop, modal);
  return { el, modal };
}

function makeField(labelText, inputEl) {
  const wrap = document.createElement('div');
  wrap.className = 'bm-dialog-field';
  const label = document.createElement('label');
  label.className = 'bm-dialog-label';
  label.textContent = labelText;
  wrap.append(label, inputEl);
  return wrap;
}

/**
 * Open the add/edit bookmark dialog.
 * @param {object} opts
 * @param {'add'|'edit'} [opts.mode]
 * @param {{name:string,url:string,folderId:string}} [opts.bookmark]
 * @param {Array<{id:string,name:string}>} opts.folders
 * @param {string} [opts.defaultFolderId]
 * @param {(values:{name:string,url:string,folderId:string}) => void} opts.onSave
 */
export function openBookmarkEditDialog({ mode = 'add', bookmark = null, folders = [], defaultFolderId, onSave }) {
  const { modal } = buildShell();
  const title = document.createElement('h3');
  title.className = 'bm-dialog-title';
  title.textContent = mode === 'edit' ? 'Edit Bookmark' : 'Add Bookmark';

  const nameInput = document.createElement('input');
  nameInput.className = 'input'; nameInput.placeholder = 'Name'; nameInput.value = bookmark?.name ?? '';

  const urlInput = document.createElement('input');
  urlInput.className = 'input'; urlInput.type = 'text'; urlInput.placeholder = 'https://...'; urlInput.value = bookmark?.url ?? '';

  const folderSelect = document.createElement('select');
  folderSelect.className = 'input select-input';
  folders.forEach((folder) => {
    const opt = document.createElement('option');
    opt.value = folder.id; opt.textContent = folder.name;
    folderSelect.appendChild(opt);
  });
  folderSelect.value = bookmark?.folderId ?? defaultFolderId ?? folders[0]?.id ?? '';

  const errorEl = document.createElement('div');
  errorEl.className = 'bm-dialog-error'; errorEl.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'bm-dialog-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'action-btn secondary-action'; cancelBtn.type = 'button'; cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeBookmarkDialog);
  const saveBtn = document.createElement('button');
  saveBtn.className = 'action-btn'; saveBtn.type = 'button';
  saveBtn.textContent = mode === 'edit' ? 'Save Changes' : 'Add Bookmark';
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    if (!name || !url) {
      errorEl.hidden = false;
      errorEl.textContent = 'Name and URL are required.';
      return;
    }
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    onSave({ name, url, folderId: folderSelect.value || defaultFolderId });
    closeBookmarkDialog();
  });
  actions.append(cancelBtn, saveBtn);

  modal.append(
    title,
    makeField('Name', nameInput),
    makeField('URL', urlInput),
    makeField('Folder', folderSelect),
    errorEl,
    actions,
  );
  requestAnimationFrame(() => nameInput.focus());
}

/**
 * Open a simple text-input dialog (used for folder create/rename).
 * @param {object} opts
 * @param {string} [opts.title]
 * @param {string} [opts.value]
 * @param {string} [opts.placeholder]
 * @param {string} [opts.confirmLabel]
 * @param {(value:string) => void} opts.onSave
 */
export function openTextPromptDialog({ title = 'Name', value = '', placeholder = 'Name', confirmLabel = 'Save', onSave }) {
  const { modal } = buildShell('bm-dialog-modal-sm');
  const titleEl = document.createElement('h3');
  titleEl.className = 'bm-dialog-title'; titleEl.textContent = title;

  const input = document.createElement('input');
  input.className = 'input'; input.placeholder = placeholder; input.value = value;

  const actions = document.createElement('div');
  actions.className = 'bm-dialog-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'action-btn secondary-action'; cancelBtn.type = 'button'; cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeBookmarkDialog);
  const saveBtn = document.createElement('button');
  saveBtn.className = 'action-btn'; saveBtn.type = 'button'; saveBtn.textContent = confirmLabel;
  const submit = () => {
    const trimmed = input.value.trim();
    if (!trimmed) return;
    onSave(trimmed);
    closeBookmarkDialog();
  };
  saveBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  actions.append(cancelBtn, saveBtn);

  modal.append(titleEl, input, actions);
  requestAnimationFrame(() => { input.focus(); input.select(); });
}

/**
 * Open a confirm dialog (replaces window.confirm).
 * @param {object} opts
 * @param {string} [opts.title]
 * @param {string} [opts.message]
 * @param {string} [opts.confirmLabel]
 * @param {boolean} [opts.danger]
 * @param {() => void} opts.onConfirm
 */
export function openConfirmDialog({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', danger = false, onConfirm }) {
  const { modal } = buildShell('bm-dialog-modal-sm');
  const titleEl = document.createElement('h3');
  titleEl.className = 'bm-dialog-title'; titleEl.textContent = title;
  const msgEl = document.createElement('p');
  msgEl.className = 'bm-dialog-message'; msgEl.textContent = message;

  const actions = document.createElement('div');
  actions.className = 'bm-dialog-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'action-btn secondary-action'; cancelBtn.type = 'button'; cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeBookmarkDialog);
  const confirmBtn = document.createElement('button');
  confirmBtn.className = `action-btn${danger ? ' danger-action' : ''}`; confirmBtn.type = 'button'; confirmBtn.textContent = confirmLabel;
  confirmBtn.addEventListener('click', () => { onConfirm(); closeBookmarkDialog(); });
  actions.append(cancelBtn, confirmBtn);

  modal.append(titleEl, msgEl, actions);
}
