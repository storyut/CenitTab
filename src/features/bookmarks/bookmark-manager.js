/**
 * New Bookmark Manager: a large centered overlay (default bookmark UI) with a
 * sidebar (All Bookmarks / Favorites / folder tree / Trash) and a main pane
 * (search, refresh, list/grid views, per-item actions).
 */
import { normalizeBookmarkUrl, isValidBookmarkUrl, getFaviconUrl } from '../../core/url-normalization.js';
import {
  DEFAULT_BOOKMARK_FOLDER_ID,
  getBookmarkFolders, addBookmarkFolder, renameBookmarkFolder, deleteBookmarkFolder,
  getActiveBookmarkFolderId, setActiveBookmarkFolderId,
  getBookmarks, getFavoriteBookmarks, getTrashedBookmarks,
  addBookmark, updateBookmark, toggleFavorite,
  moveToTrash, restoreFromTrash, permanentlyDeleteBookmark, emptyTrash,
} from './bookmark-store.js';
import { openBookmarkEditDialog, openTextPromptDialog, openConfirmDialog, isBookmarkDialogOpen } from './bookmark-edit-dialog.js';

/**
 * Initialize the Bookmark Manager overlay.
 * @param {object} deps
 * @param {object} deps.store - The Store object
 * @param {Function} deps.showToast - Toast notification function
 * @param {Function} [deps.onChange] - Called whenever bookmark/folder data changes, so callers can refresh other UI (e.g. the on-page widget)
 * @returns {{open: Function, close: Function, isOpen: Function}}
 */
export function initBookmarkManager(deps) {
  const { store, showToast, onChange } = deps;

  const overlay = document.getElementById('bookmark-manager-overlay');
  if (!overlay) return { open: () => {}, close: () => {}, isOpen: () => false };

  const backdrop = document.getElementById('bm-manager-backdrop');
  const closeBtn = document.getElementById('bm-manager-close-btn');
  const navAll = document.getElementById('bm-manager-nav-all');
  const navFavorites = document.getElementById('bm-manager-nav-favorites');
  const navTrash = document.getElementById('bm-manager-nav-trash');
  const trashCountEl = document.getElementById('bm-manager-trash-count');
  const folderTreeEl = document.getElementById('bm-manager-folder-tree');
  const viewIconEl = document.getElementById('bm-manager-view-icon');
  const viewTitleEl = document.getElementById('bm-manager-view-title');
  const refreshBtn = document.getElementById('bm-manager-refresh-btn');
  const listBtn = document.getElementById('bm-manager-view-list-btn');
  const gridBtn = document.getElementById('bm-manager-view-grid-btn');
  const searchInput = document.getElementById('bm-manager-search-input');
  const overflowBtn = document.getElementById('bm-manager-overflow-btn');
  const countEl = document.getElementById('bm-manager-count');
  const contentEl = document.getElementById('bm-manager-content');

  let activeView = 'all'; // 'all' | 'favorites' | 'trash' | <folderId>
  let viewMode = store.get('bmManagerViewMode') === 'grid' ? 'grid' : 'list';
  let searchQuery = '';
  const expandedFolders = new Set();
  let openMenuEl = null;

  function notifyChange() { onChange?.(); }

  // ─── Dropdown menu (overflow + per-item actions) ───────────────────
  function closeDropdownMenu() { openMenuEl?.remove(); openMenuEl = null; }

  function openDropdownMenu(x, y, items) {
    closeDropdownMenu();
    const menu = document.createElement('div');
    menu.className = 'bm-manager-menu';
    items.forEach((item) => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'bm-manager-menu-sep';
        menu.appendChild(sep);
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `bm-manager-menu-item${item.danger ? ' danger' : ''}`;
      btn.textContent = item.label;
      btn.disabled = !!item.disabled;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDropdownMenu();
        item.action?.();
      });
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    menu.style.left = `${Math.max(8, Math.min(x, vw - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, vh - rect.height - 8))}px`;
    openMenuEl = menu;
  }

  document.addEventListener('click', () => closeDropdownMenu());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (openMenuEl) { closeDropdownMenu(); return; }
    if (isBookmarkDialogOpen()) return;
    if (isOpen()) close();
  });

  // ─── Dialog helpers ─────────────────────────────────────────────────
  function openAddBookmarkDialog() {
    const folders = getBookmarkFolders(store);
    const defaultFolderId = folders.some(f => f.id === activeView) ? activeView : getActiveBookmarkFolderId(store, folders);
    openBookmarkEditDialog({
      mode: 'add', folders, defaultFolderId,
      onSave: ({ name, url, folderId }) => {
        const normalizedUrl = normalizeBookmarkUrl(url);
        if (!isValidBookmarkUrl(normalizedUrl)) { showToast('Invalid URL'); return; }
        if (getBookmarks(store).some(b => normalizeBookmarkUrl(b.url) === normalizedUrl)) { showToast('Bookmark already exists'); return; }
        addBookmark(store, { name, url: normalizedUrl, folderId });
        setActiveBookmarkFolderId(store, folderId);
        showToast(`Bookmark added: ${name}`);
        render(); notifyChange();
      },
    });
  }

  function openEditDialogFor(bm) {
    const folders = getBookmarkFolders(store);
    openBookmarkEditDialog({
      mode: 'edit', bookmark: bm, folders,
      onSave: ({ name, url, folderId }) => {
        updateBookmark(store, bm.id, { name, url: normalizeBookmarkUrl(url), folderId });
        showToast('Bookmark updated');
        render(); notifyChange();
      },
    });
  }

  function openNewFolderDialog() {
    openTextPromptDialog({
      title: 'New Folder', placeholder: 'Folder name', confirmLabel: 'Create',
      onSave: (name) => {
        const folder = addBookmarkFolder(store, name);
        activeView = folder.id;
        showToast(`Folder created: ${folder.name}`);
        render(); notifyChange();
      },
    });
  }

  function openRenameFolderDialog(folderId) {
    const folder = getBookmarkFolders(store).find(f => f.id === folderId);
    if (!folder) return;
    openTextPromptDialog({
      title: 'Rename Folder', value: folder.name, confirmLabel: 'Save',
      onSave: (name) => {
        renameBookmarkFolder(store, folderId, name);
        showToast('Folder renamed');
        render(); notifyChange();
      },
    });
  }

  function openDeleteFolderConfirm(folderId) {
    const folder = getBookmarkFolders(store).find(f => f.id === folderId);
    if (!folder || folderId === DEFAULT_BOOKMARK_FOLDER_ID) return;
    openConfirmDialog({
      title: 'Delete Folder', confirmLabel: 'Delete', danger: true,
      message: `Delete "${folder.name}"? Bookmarks inside will move to General.`,
      onConfirm: () => {
        deleteBookmarkFolder(store, folderId);
        activeView = 'all';
        showToast(`Deleted folder: ${folder.name}`);
        render(); notifyChange();
      },
    });
  }

  function openEmptyTrashConfirm() {
    const count = getTrashedBookmarks(store).length;
    if (!count) return;
    openConfirmDialog({
      title: 'Empty Trash', confirmLabel: 'Empty Trash', danger: true,
      message: `Permanently delete ${count} bookmark${count !== 1 ? 's' : ''} in Trash? This cannot be undone.`,
      onConfirm: () => {
        emptyTrash(store);
        showToast('Trash emptied');
        render(); notifyChange();
      },
    });
  }

  // ─── Per-item action menu ───────────────────────────────────────────
  function buildItemMenuItems(bm, view, x, y) {
    if (view === 'trash') {
      return [
        { label: 'Restore', action: () => { restoreFromTrash(store, bm.id); showToast(`Restored: ${bm.name}`); render(); notifyChange(); } },
        { separator: true },
        { label: 'Delete Permanently', danger: true, action: () => {
          openConfirmDialog({
            title: 'Delete Permanently', confirmLabel: 'Delete', danger: true,
            message: `Permanently delete "${bm.name}"? This cannot be undone.`,
            onConfirm: () => { permanentlyDeleteBookmark(store, bm.id); showToast('Bookmark permanently deleted'); render(); notifyChange(); },
          });
        } },
      ];
    }
    const folders = getBookmarkFolders(store);
    return [
      { label: 'Edit', action: () => openEditDialogFor(bm) },
      { label: bm.favorite ? 'Remove from Favorites' : 'Add to Favorites', action: () => { toggleFavorite(store, bm.id); render(); notifyChange(); } },
      { label: 'Move to Folder', action: () => {
        openDropdownMenu(x, y, [
          ...folders.map(f => ({ label: `${f.name}${f.id === bm.folderId ? ' ✓' : ''}`, action: () => { updateBookmark(store, bm.id, { folderId: f.id }); showToast(`Moved to ${f.name}`); render(); notifyChange(); } })),
          { separator: true },
          { label: '← Back', action: () => openDropdownMenu(x, y, buildItemMenuItems(bm, view, x, y)) },
        ]);
      } },
      { separator: true },
      { label: 'Delete', danger: true, action: () => {
        moveToTrash(store, bm.id);
        showToast(`Moved to Trash: ${bm.name}`, () => { restoreFromTrash(store, bm.id); render(); notifyChange(); });
        render(); notifyChange();
      } },
    ];
  }

  // ─── Rendering ──────────────────────────────────────────────────────
  function currentFolders() { return getBookmarkFolders(store); }

  function itemsForView(view) {
    if (view === 'all') return getBookmarks(store);
    if (view === 'favorites') return getFavoriteBookmarks(store);
    if (view === 'trash') return getTrashedBookmarks(store);
    return getBookmarks(store).filter(bm => bm.folderId === view);
  }

  function filterBySearch(items) {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(bm => bm.name.toLowerCase().includes(q) || bm.url.toLowerCase().includes(q));
  }

  function renderSidebar() {
    navAll.classList.toggle('active', activeView === 'all');
    navFavorites.classList.toggle('active', activeView === 'favorites');
    navTrash.classList.toggle('active', activeView === 'trash');
    const trashCount = getTrashedBookmarks(store).length;
    trashCountEl.textContent = trashCount ? String(trashCount) : '';

    const folders = currentFolders();
    const allBookmarks = getBookmarks(store);
    folderTreeEl.innerHTML = '';
    folders.forEach((folder) => {
      const folderBookmarks = allBookmarks.filter(bm => bm.folderId === folder.id);
      const wrap = document.createElement('div');
      wrap.className = 'bm-manager-folder-row-wrap';

      const row = document.createElement('div');
      row.className = `bm-manager-folder-row${activeView === folder.id ? ' active' : ''}`;

      const toggle = document.createElement('button');
      toggle.type = 'button'; toggle.className = 'bm-manager-folder-toggle';
      toggle.textContent = expandedFolders.has(folder.id) ? '▾' : '▸';
      toggle.title = expandedFolders.has(folder.id) ? 'Collapse' : 'Expand';
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (expandedFolders.has(folder.id)) expandedFolders.delete(folder.id);
        else expandedFolders.add(folder.id);
        renderSidebar();
      });

      const icon = document.createElement('span'); icon.className = 'bm-manager-folder-icon'; icon.textContent = '📁';
      const name = document.createElement('span'); name.className = 'bm-manager-folder-name'; name.textContent = folder.name;
      const count = document.createElement('span'); count.className = 'bm-manager-folder-count'; count.textContent = String(folderBookmarks.length);

      row.append(toggle, icon, name, count);
      row.addEventListener('click', () => { activeView = folder.id; searchQuery = ''; searchInput.value = ''; render(); });
      wrap.appendChild(row);

      if (expandedFolders.has(folder.id)) {
        const preview = document.createElement('div');
        preview.className = 'bm-manager-folder-preview';
        if (!folderBookmarks.length) {
          const empty = document.createElement('div'); empty.className = 'bm-manager-folder-preview-empty'; empty.textContent = 'Empty';
          preview.appendChild(empty);
        } else {
          folderBookmarks.forEach((bm) => {
            const a = document.createElement('a');
            a.className = 'bm-manager-folder-preview-item'; a.href = bm.url; a.title = bm.url;
            const fav = getFaviconUrl(bm.url);
            if (fav) { const img = document.createElement('img'); img.src = fav; img.className = 'bm-manager-folder-preview-favicon'; img.onerror = () => img.remove(); a.appendChild(img); }
            a.appendChild(document.createTextNode(bm.name));
            preview.appendChild(a);
          });
        }
        wrap.appendChild(preview);
      }
      folderTreeEl.appendChild(wrap);
    });
  }

  function viewMeta(view, folders) {
    if (view === 'all') return { icon: '🗂', title: 'All Bookmarks' };
    if (view === 'favorites') return { icon: '♥', title: 'Favorites' };
    if (view === 'trash') return { icon: '🗑', title: 'Trash' };
    const folder = folders.find(f => f.id === view);
    return { icon: '📁', title: folder?.name ?? 'Folder' };
  }

  function renderItemNode(bm, view) {
    const el = document.createElement('div');
    el.className = 'bm-manager-item';

    const fav = getFaviconUrl(bm.url);
    const favicon = document.createElement('img');
    favicon.className = 'bm-manager-item-favicon';
    if (fav) { favicon.src = fav; favicon.onerror = () => favicon.classList.add('bm-manager-item-favicon-fallback'); }

    const text = document.createElement('div');
    text.className = 'bm-manager-item-text';
    const name = document.createElement('div'); name.className = 'bm-manager-item-name'; name.textContent = bm.name;
    const url = document.createElement('div'); url.className = 'bm-manager-item-url'; url.textContent = bm.url;
    text.append(name, url);

    el.append(favicon, text);

    if (view !== 'trash') {
      const star = document.createElement('button');
      star.type = 'button'; star.className = `bm-manager-item-star${bm.favorite ? ' active' : ''}`;
      star.title = bm.favorite ? 'Remove from Favorites' : 'Add to Favorites';
      star.textContent = bm.favorite ? '★' : '☆';
      star.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(store, bm.id); render(); notifyChange(); });
      el.appendChild(star);
    }

    const kebab = document.createElement('button');
    kebab.type = 'button'; kebab.className = 'bm-manager-item-kebab'; kebab.title = 'More actions'; kebab.textContent = '⋮';
    kebab.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = kebab.getBoundingClientRect();
      openDropdownMenu(rect.left, rect.bottom + 4, buildItemMenuItems(bm, view, rect.left, rect.bottom + 4));
    });
    el.appendChild(kebab);

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openDropdownMenu(e.clientX, e.clientY, buildItemMenuItems(bm, view, e.clientX, e.clientY));
    });

    if (view !== 'trash') {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.bm-manager-item-star') || e.target.closest('.bm-manager-item-kebab')) return;
        window.location.href = bm.url;
      });
    }
    return el;
  }

  function renderMain() {
    const folders = currentFolders();
    const meta = viewMeta(activeView, folders);
    viewIconEl.textContent = meta.icon;
    viewTitleEl.textContent = meta.title;
    listBtn.classList.toggle('active', viewMode === 'list');
    gridBtn.classList.toggle('active', viewMode === 'grid');

    const items = filterBySearch(itemsForView(activeView));
    countEl.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

    contentEl.className = `bm-manager-content bm-manager-content-${viewMode}`;
    contentEl.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'bm-manager-empty';
      if (searchQuery.trim()) empty.textContent = 'No bookmarks match your search';
      else if (activeView === 'favorites') empty.textContent = 'No favorites yet — star a bookmark to see it here';
      else if (activeView === 'trash') empty.textContent = 'Trash is empty';
      else empty.textContent = 'No bookmarks in this folder';
      contentEl.appendChild(empty);
      return;
    }
    items.forEach(bm => contentEl.appendChild(renderItemNode(bm, activeView)));
  }

  function render() { renderSidebar(); renderMain(); }

  // ─── Toolbar wiring ─────────────────────────────────────────────────
  [navAll, navFavorites, navTrash].forEach((btn) => {
    btn.addEventListener('click', () => { activeView = btn.dataset.view; searchQuery = ''; searchInput.value = ''; render(); });
  });
  refreshBtn.addEventListener('click', () => { render(); showToast('Refreshed'); });
  listBtn.addEventListener('click', () => { viewMode = 'list'; store.set('bmManagerViewMode', 'list'); renderMain(); });
  gridBtn.addEventListener('click', () => { viewMode = 'grid'; store.set('bmManagerViewMode', 'grid'); renderMain(); });
  searchInput.addEventListener('input', () => { searchQuery = searchInput.value; renderMain(); });
  overflowBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const folders = currentFolders();
    const isRealFolder = folders.some(f => f.id === activeView);
    const items = [{ label: 'Add Bookmark', action: openAddBookmarkDialog }];
    if (activeView !== 'trash') items.push({ label: 'New Folder', action: openNewFolderDialog });
    if (isRealFolder) {
      items.push({ separator: true });
      items.push({ label: 'Rename Folder', action: () => openRenameFolderDialog(activeView) });
      items.push({ label: 'Delete Folder', danger: true, disabled: activeView === DEFAULT_BOOKMARK_FOLDER_ID, action: () => openDeleteFolderConfirm(activeView) });
    }
    if (activeView === 'trash') {
      items.push({ label: 'Empty Trash', danger: true, disabled: !getTrashedBookmarks(store).length, action: openEmptyTrashConfirm });
    }
    const rect = overflowBtn.getBoundingClientRect();
    openDropdownMenu(Math.max(8, rect.right - 200), rect.bottom + 4, items);
  });

  folderTreeEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openDropdownMenu(e.clientX, e.clientY, [
      { label: 'New Folder', action: openNewFolderDialog },
    ]);
  });

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  function open(view) {
    if (view) activeView = view;
    searchQuery = ''; if (searchInput) searchInput.value = '';
    render();
    overlay.removeAttribute('hidden');
  }
  function close() {
    overlay.setAttribute('hidden', '');
    closeDropdownMenu();
  }
  function isOpen() { return !overlay.hasAttribute('hidden'); }

  return { open, close, isOpen };
}
