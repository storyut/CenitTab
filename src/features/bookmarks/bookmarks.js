/**
 * Bookmarks feature: folders, management UI, context menu, drag reorder.
 */
import { normalizeBookmarkUrl, isValidBookmarkUrl } from '../../core/url-normalization.js';

const DEFAULT_BOOKMARK_FOLDER_ID = 'folder_default';
const PENCIL_SVG = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z"/></svg>`;

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

/**
 * Initialize the bookmarks feature.
 * @param {object} deps - Dependencies
 * @param {object} deps.store - The Store object
 * @param {Function} deps.showToast - Toast notification function
 * @param {Function} deps.openPanel - Open panel callback
 * @returns {object} Bookmarks API: getBookmarks, setBookmarks, loadBookmarks, getActiveBookmarkFolderId
 */
export function initBookmarks(deps) {
  const { store, showToast, openPanel } = deps;
  const bookmarkList = document.getElementById('bookmark-list');
  const bmManageList = document.getElementById('bm-manage-list');
  const bmNameInput = document.getElementById('bm-name');
  const bmUrlInput = document.getElementById('bm-url');
  const bookmarkFolderTabs = document.getElementById('bookmark-folder-tabs');
  const bmFolderSelect = document.getElementById('bm-folder-select');
  const bmFolderNameInput = document.getElementById('bm-folder-name');
  const bmFolderList = document.getElementById('bm-folder-list');
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

  function getBookmarkFolders() {
    let folders = store.get('bookmarkFolders');
    if (!Array.isArray(folders) || !folders.length) {
      folders = [{ id: DEFAULT_BOOKMARK_FOLDER_ID, name: 'General', createdAt: Date.now() }];
      store.set('bookmarkFolders', folders);
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
    store.set('bookmarkFolders', normalized);
    return normalized;
  }

  function setBookmarkFolders(folders) { store.set('bookmarkFolders', folders); }

  function getBookmarks() {
    const folders = getBookmarkFolders();
    const validFolderIds = new Set(folders.map(folder => folder.id));
    const bms = store.get('bookmarks') ?? [];
    const normalized = (Array.isArray(bms) ? bms : []).map(bm => ({
      name: String(bm?.name ?? '').trim(),
      url: String(bm?.url ?? '').trim(),
      folderId: validFolderIds.has(bm?.folderId) ? bm.folderId : DEFAULT_BOOKMARK_FOLDER_ID,
    })).filter(bm => bm.name && bm.url);
    store.set('bookmarks', normalized);
    return normalized;
  }

  function setBookmarks(bookmarks) { store.set('bookmarks', bookmarks); }

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

  function getActiveBookmarkFolderId(folders = getBookmarkFolders()) {
    const saved = store.get('activeBookmarkFolderId');
    return folders.some(folder => folder.id === saved) ? saved : folders[0]?.id || DEFAULT_BOOKMARK_FOLDER_ID;
  }

  function populateBookmarkFolderSelect(selectedId) {
    if (!bmFolderSelect) return;
    const folders = getBookmarkFolders();
    const current = selectedId || bmFolderSelect.value || store.get('activeBookmarkFolderId') || DEFAULT_BOOKMARK_FOLDER_ID;
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
      const name = document.createElement('span'); name.className = 'bm-folder-name'; name.textContent = folder.name;
      const meta = document.createElement('span'); meta.className = 'bm-folder-count';
      meta.textContent = `${count} ${count === 1 ? 'bookmark' : 'bookmarks'}`;
      const rename = document.createElement('button'); rename.className = 'bm-folder-action'; rename.type = 'button'; rename.textContent = 'Rename';
      const del = document.createElement('button'); del.className = 'bm-folder-action danger'; del.type = 'button'; del.textContent = 'Delete';
      del.disabled = folder.id === DEFAULT_BOOKMARK_FOLDER_ID;
      del.title = del.disabled ? 'The General folder cannot be deleted' : 'Delete folder';
      row.appendChild(name); row.appendChild(meta); row.appendChild(rename); row.appendChild(del);
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

  function renderBookmarkWidget(bookmarks, folders) {
    if (!bookmarkList) return;
    bookmarkList.innerHTML = '';
    if (bookmarkFolderTabs) bookmarkFolderTabs.innerHTML = '';
    const activeFolderId = getActiveBookmarkFolderId(folders);
    store.set('activeBookmarkFolderId', activeFolderId);
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
        e.preventDefault(); e.stopPropagation();
        store.set('activeBookmarkFolderId', folder.id);
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
    if (bookmarkList) bookmarkList.innerHTML = '';
    if (bmManageList) bmManageList.innerHTML = '';
    populateBookmarkFolderSelect();
    renderBookmarkFolders(folders, bms);
    renderBookmarkWidget(bms, folders);
    bms.forEach((bm, i) => {
      if (!bmManageList) return;
      const row = document.createElement('div');
      row.className = 'bm-row';
      row.dataset.index = String(i);
      row.draggable = true;
      const header = document.createElement('div');
      header.className = 'bm-row-header';
      const expandToggle = document.createElement('button');
      expandToggle.type = 'button'; expandToggle.className = 'bm-expand-toggle'; expandToggle.title = 'Edit'; expandToggle.innerHTML = PENCIL_SVG;
      const orderBadge = document.createElement('span');
      orderBadge.className = 'bm-order'; orderBadge.textContent = String(i + 1);
      const collapsedName = document.createElement('span');
      collapsedName.className = 'bm-row-collapsed-name'; collapsedName.textContent = bm.name;
      const collapsedFolder = document.createElement('span');
      collapsedFolder.className = 'bm-row-folder-name'; collapsedFolder.textContent = folderNameById(bm.folderId, folders);
      const del = document.createElement('button');
      del.className = 'bm-del'; del.textContent = '✕'; del.title = 'Delete';
      header.appendChild(expandToggle); header.appendChild(orderBadge); header.appendChild(collapsedName); header.appendChild(collapsedFolder); header.appendChild(del);
      const expandedWrap = document.createElement('div');
      expandedWrap.className = 'bm-row-expanded';
      const nameLabel = document.createElement('div'); nameLabel.className = 'bm-field-label'; nameLabel.textContent = 'Name';
      const nameInput = document.createElement('input'); nameInput.className = 'input'; nameInput.value = bm.name; nameInput.placeholder = 'Name';
      const urlLabel = document.createElement('div'); urlLabel.className = 'bm-field-label'; urlLabel.textContent = 'URL';
      const urlInput = document.createElement('input'); urlInput.className = 'input'; urlInput.value = bm.url; urlInput.placeholder = 'https://...';
      const folderLabel = document.createElement('div'); folderLabel.className = 'bm-field-label'; folderLabel.textContent = 'Folder';
      const folderSelect = document.createElement('select'); folderSelect.className = 'input select-input';
      folders.forEach(folder => { const opt = document.createElement('option'); opt.value = folder.id; opt.textContent = folder.name; folderSelect.appendChild(opt); });
      folderSelect.value = bm.folderId;
      const applyBtn = document.createElement('button'); applyBtn.className = 'bm-apply-btn'; applyBtn.type = 'button'; applyBtn.textContent = 'Apply';
      expandedWrap.appendChild(nameLabel); expandedWrap.appendChild(nameInput); expandedWrap.appendChild(urlLabel); expandedWrap.appendChild(urlInput); expandedWrap.appendChild(folderLabel); expandedWrap.appendChild(folderSelect); expandedWrap.appendChild(applyBtn);
      row.appendChild(header); row.appendChild(expandedWrap);
      bmManageList.appendChild(row);

      function setExpanded(on) {
        row.classList.toggle('bm-row-expanded-state', on);
        if (on) {
          const idx = +row.dataset.index;
          const item = getBookmarks()[idx];
          nameInput.value = item?.name ?? bm.name;
          urlInput.value = item?.url ?? bm.url;
          folderSelect.value = item?.folderId ?? DEFAULT_BOOKMARK_FOLDER_ID;
        }
      }
      expandToggle.addEventListener('click', (e) => { e.stopPropagation(); setExpanded(!row.classList.contains('bm-row-expanded-state')); });
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        const list = getBookmarks(); const idx = +row.dataset.index; const removed = list[idx];
        list.splice(idx, 1); setBookmarks(list); loadBookmarks();
        showToast(`Deleted: ${removed.name}`, () => { const cur = getBookmarks(); cur.splice(idx, 0, removed); setBookmarks(cur); loadBookmarks(); });
      });
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
        store.set('activeBookmarkFolderId', folderId);
        loadBookmarks();
      });
      row.addEventListener('dragstart', (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); row.classList.add('bm-row-dragging'); });
      row.addEventListener('dragend', () => row.classList.remove('bm-row-dragging'));
      row.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      row.addEventListener('drop', (e) => { e.preventDefault(); const fromIndex = +(e.dataTransfer.getData('text/plain') || i); moveBookmark(fromIndex, +row.dataset.index); loadBookmarks(); });
    });
  }

  // Context menu dismiss
  document.addEventListener('click', () => closeBmContextMenu());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBmContextMenu(); });

  // Save bookmark button
  document.getElementById('save-bm-btn')?.addEventListener('click', () => {
    const name = bmNameInput?.value.trim();
    let url = bmUrlInput?.value.trim();
    const folderId = bmFolderSelect?.value || DEFAULT_BOOKMARK_FOLDER_ID;
    if (!name || !url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    url = normalizeBookmarkUrl(url);
    if (!isValidBookmarkUrl(url)) { showToast('Invalid URL'); return; }
    const bms = getBookmarks();
    if (bms.some(b => normalizeBookmarkUrl(b.url) === url)) { showToast('Bookmark already exists'); return; }
    bms.push({ name, url, folderId });
    setBookmarks(bms);
    store.set('activeBookmarkFolderId', folderId);
    if (bmNameInput) bmNameInput.value = '';
    if (bmUrlInput) bmUrlInput.value = '';
    loadBookmarks();
  });

  document.getElementById('add-bm-folder-btn')?.addEventListener('click', () => {
    const name = bmFolderNameInput?.value.trim();
    if (!name) return;
    const folders = getBookmarkFolders();
    const folder = makeBookmarkFolder(name);
    folders.push(folder);
    setBookmarkFolders(folders);
    store.set('activeBookmarkFolderId', folder.id);
    if (bmFolderNameInput) bmFolderNameInput.value = '';
    loadBookmarks();
  });

  bmFolderSelect?.addEventListener('change', () => { store.set('activeBookmarkFolderId', bmFolderSelect.value); renderBookmarkWidget(getBookmarks(), getBookmarkFolders()); });
  document.getElementById('add-bm-btn')?.addEventListener('click', () => openPanel?.('bookmark-panel'));

  // One-time repair
  if (!store.get('bookmarkFolderWidgetRepair_v5')) {
    store.set('widgetSize_bookmarks', null);
    store.set('bookmarkFolderWidgetRepair_v5', true);
  }

  loadBookmarks();

  return { getBookmarks, setBookmarks, loadBookmarks, getActiveBookmarkFolderId, getBookmarkFolders };
}
