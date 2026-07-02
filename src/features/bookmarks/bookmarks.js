/**
 * Bookmarks feature: legacy on-page widget + side panel, the new compact
 * on-page launcher, and the new Bookmark Manager overlay. Legacy vs. new
 * mode is controlled by the `legacyBookmarksMode` store flag (new is default).
 */
import { normalizeBookmarkUrl, isValidBookmarkUrl, getFaviconUrl } from '../../core/url-normalization.js';
import {
  DEFAULT_BOOKMARK_FOLDER_ID,
  getBookmarkFolders, addBookmarkFolder, renameBookmarkFolder, deleteBookmarkFolder,
  folderNameById, getActiveBookmarkFolderId, setActiveBookmarkFolderId,
  getBookmarks, setBookmarks, addBookmark, updateBookmark,
  moveToTrash, restoreFromTrash, moveBookmark,
} from './bookmark-store.js';
import { openBookmarkEditDialog, openTextPromptDialog, openConfirmDialog } from './bookmark-edit-dialog.js';
import { initBookmarkManager } from './bookmark-manager.js';

const PENCIL_SVG = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 1.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L11.5 1.5z"/></svg>`;

/**
 * Initialize the bookmarks feature.
 * @param {object} deps - Dependencies
 * @param {object} deps.store - The Store object
 * @param {Function} deps.showToast - Toast notification function
 * @param {Function} deps.openPanel - Open panel callback (legacy side panel)
 * @returns {object} Bookmarks API
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

  function isLegacyMode() { return !!store.get('legacyBookmarksMode'); }

  function closeBmContextMenu() { bmCtxMenu?.remove(); bmCtxMenu = null; }

  function showBmContextMenu(x, y, bm) {
    closeBmContextMenu();
    const menu = document.createElement('div');
    menu.className = 'bm-ctx-menu';
    const items = [
      { label: 'Edit', action: () => {
        openBookmarkEditDialog({
          mode: 'edit', bookmark: bm, folders: getBookmarkFolders(store),
          onSave: ({ name, url, folderId }) => {
            updateBookmark(store, bm.id, { name, url: normalizeBookmarkUrl(url), folderId });
            loadBookmarks();
          },
        });
      } },
      { label: 'Delete', danger: true, action: () => {
        moveToTrash(store, bm.id);
        loadBookmarks();
        showToast(`Deleted: ${bm.name}`, () => { restoreFromTrash(store, bm.id); loadBookmarks(); });
      } },
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

  function populateBookmarkFolderSelect(selectedId) {
    if (!bmFolderSelect) return;
    const folders = getBookmarkFolders(store);
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
        openTextPromptDialog({
          title: 'Rename Folder', value: folder.name, confirmLabel: 'Save',
          onSave: (name) => { renameBookmarkFolder(store, folder.id, name); loadBookmarks(); },
        });
      });
      del.addEventListener('click', () => {
        if (folder.id === DEFAULT_BOOKMARK_FOLDER_ID) return;
        openConfirmDialog({
          title: 'Delete Folder', confirmLabel: 'Delete', danger: true,
          message: `Delete "${folder.name}"? Bookmarks in this folder will move to General.`,
          onConfirm: () => { deleteBookmarkFolder(store, folder.id); loadBookmarks(); },
        });
      });
    });
  }

  function renderBmPill(bm) {
    const a = document.createElement('a');
    a.className = 'bm-item'; a.href = bm.url; a.title = `${bm.name} · ${bm.url}`;
    const fav = getFaviconUrl(bm.url);
    if (fav) {
      const img = document.createElement('img');
      img.className = 'bm-favicon'; img.src = fav; img.onerror = () => img.remove();
      a.appendChild(img);
    }
    a.appendChild(document.createTextNode(bm.name));
    a.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showBmContextMenu(e.clientX, e.clientY, bm);
    });
    return a;
  }

  function renderBookmarkWidgetLegacy(bookmarks, folders) {
    const activeFolderId = getActiveBookmarkFolderId(store, folders);
    setActiveBookmarkFolderId(store, activeFolderId);
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
        setActiveBookmarkFolderId(store, folder.id);
        populateBookmarkFolderSelect(folder.id);
        renderBookmarkWidget(getBookmarks(store), getBookmarkFolders(store));
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
    selectedBookmarks.forEach((bm) => bookmarkList.appendChild(renderBmPill(bm)));
  }

  function renderBookmarkLauncher(bookmarks, folders) {
    const launcherBar = bookmarkFolderTabs || document.createElement('div');
    launcherBar.className = 'bm-widget-folder-tabs';
    const launcherBtn = document.createElement('button');
    launcherBtn.type = 'button'; launcherBtn.className = 'bm-launcher-btn';
    launcherBtn.title = 'Open Bookmark Manager';
    launcherBtn.innerHTML = '<span class="bm-launcher-icon">\u2606</span><span>Bookmarks</span>';
    launcherBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openBookmarkManager(); });
    launcherBar.appendChild(launcherBtn);
    if (!bookmarkFolderTabs) bookmarkList.appendChild(launcherBar);

    let pills = bookmarks.filter(bm => bm.favorite);
    if (!pills.length) {
      const activeFolderId = getActiveBookmarkFolderId(store, folders);
      pills = bookmarks.filter(bm => bm.folderId === activeFolderId).slice(0, 6);
    }
    if (!pills.length) {
      const empty = document.createElement('div');
      empty.className = 'bm-widget-empty';
      empty.textContent = 'Star a bookmark in Manager to pin it here';
      bookmarkList.appendChild(empty);
      return;
    }
    pills.forEach((bm) => bookmarkList.appendChild(renderBmPill(bm)));
  }

  function renderBookmarkWidget(bookmarks, folders) {
    if (!bookmarkList) return;
    bookmarkList.innerHTML = '';
    if (bookmarkFolderTabs) bookmarkFolderTabs.innerHTML = '';
    if (isLegacyMode()) renderBookmarkWidgetLegacy(bookmarks, folders);
    else renderBookmarkLauncher(bookmarks, folders);
  }

  function renderManageList(bookmarks, folders) {
    if (!bmManageList) return;
    bmManageList.innerHTML = '';
    bookmarks.forEach((bm, i) => {
      const row = document.createElement('div');
      row.className = 'bm-row';
      row.dataset.id = bm.id;
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
      collapsedFolder.className = 'bm-row-folder-name'; collapsedFolder.textContent = folderNameById(store, bm.folderId, folders);
      const del = document.createElement('button');
      del.className = 'bm-del'; del.textContent = '✕'; del.title = 'Delete';
      header.append(expandToggle, orderBadge, collapsedName, collapsedFolder, del);
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
      expandedWrap.append(nameLabel, nameInput, urlLabel, urlInput, folderLabel, folderSelect, applyBtn);
      row.append(header, expandedWrap);
      bmManageList.appendChild(row);

      function setExpanded(on) {
        row.classList.toggle('bm-row-expanded-state', on);
        if (on) {
          const item = getBookmarks(store).find(x => x.id === bm.id);
          nameInput.value = item?.name ?? bm.name;
          urlInput.value = item?.url ?? bm.url;
          folderSelect.value = item?.folderId ?? DEFAULT_BOOKMARK_FOLDER_ID;
        }
      }
      expandToggle.addEventListener('click', (e) => { e.stopPropagation(); setExpanded(!row.classList.contains('bm-row-expanded-state')); });
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        moveToTrash(store, bm.id);
        loadBookmarks();
        showToast(`Deleted: ${bm.name}`, () => { restoreFromTrash(store, bm.id); loadBookmarks(); });
      });
      applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = (nameInput.value || '').trim();
        let url = (urlInput.value || '').trim();
        const folderId = folderSelect.value || DEFAULT_BOOKMARK_FOLDER_ID;
        if (!name || !url) return;
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        updateBookmark(store, bm.id, { name, url, folderId });
        setActiveBookmarkFolderId(store, folderId);
        loadBookmarks();
      });
      row.addEventListener('dragstart', (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', bm.id); row.classList.add('bm-row-dragging'); });
      row.addEventListener('dragend', () => row.classList.remove('bm-row-dragging'));
      row.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData('text/plain') || bm.id;
        moveBookmark(store, fromId, bm.id);
        loadBookmarks();
      });
    });
  }

  function loadBookmarks() {
    const folders = getBookmarkFolders(store);
    const bms = getBookmarks(store);
    if (bookmarkList) bookmarkList.innerHTML = '';
    if (bmManageList) bmManageList.innerHTML = '';
    populateBookmarkFolderSelect();
    renderBookmarkFolders(folders, bms);
    renderBookmarkWidget(bms, folders);
    renderManageList(bms, folders);
  }

  // Context menu dismiss
  document.addEventListener('click', () => closeBmContextMenu());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBmContextMenu(); });

  // Save bookmark button (legacy side panel add form)
  document.getElementById('save-bm-btn')?.addEventListener('click', () => {
    const name = bmNameInput?.value.trim();
    let url = bmUrlInput?.value.trim();
    const folderId = bmFolderSelect?.value || DEFAULT_BOOKMARK_FOLDER_ID;
    if (!name || !url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    url = normalizeBookmarkUrl(url);
    if (!isValidBookmarkUrl(url)) { showToast('Invalid URL'); return; }
    if (getBookmarks(store).some(b => normalizeBookmarkUrl(b.url) === url)) { showToast('Bookmark already exists'); return; }
    addBookmark(store, { name, url, folderId });
    setActiveBookmarkFolderId(store, folderId);
    if (bmNameInput) bmNameInput.value = '';
    if (bmUrlInput) bmUrlInput.value = '';
    loadBookmarks();
  });

  document.getElementById('add-bm-folder-btn')?.addEventListener('click', () => {
    const name = bmFolderNameInput?.value.trim();
    if (!name) return;
    const folder = addBookmarkFolder(store, name);
    setActiveBookmarkFolderId(store, folder.id);
    if (bmFolderNameInput) bmFolderNameInput.value = '';
    loadBookmarks();
  });

  bmFolderSelect?.addEventListener('change', () => {
    setActiveBookmarkFolderId(store, bmFolderSelect.value);
    renderBookmarkWidget(getBookmarks(store), getBookmarkFolders(store));
  });

  document.getElementById('add-bm-btn')?.addEventListener('click', () => {
    if (isLegacyMode()) openPanel?.('bookmark-panel');
    else openBookmarkManager();
  });

  // New Bookmark Manager overlay (default UI)
  const manager = initBookmarkManager({ store, showToast, onChange: loadBookmarks });
  function openBookmarkManager(view) { manager.open(view); }

  // One-time repair
  if (!store.get('bookmarkFolderWidgetRepair_v5')) {
    store.set('widgetSize_bookmarks', null);
    store.set('bookmarkFolderWidgetRepair_v5', true);
  }

  loadBookmarks();

  return {
    getBookmarks: () => getBookmarks(store),
    setBookmarks: (bookmarks) => setBookmarks(store, bookmarks),
    addBookmark: (bookmark) => { const added = addBookmark(store, bookmark); loadBookmarks(); return added; },
    loadBookmarks,
    getActiveBookmarkFolderId: () => getActiveBookmarkFolderId(store),
    getBookmarkFolders: () => getBookmarkFolders(store),
    openBookmarkManager,
    isLegacyMode,
    setLegacyMode: (on) => { store.set('legacyBookmarksMode', !!on); loadBookmarks(); },
  };
}
