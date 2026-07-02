/**
 * Bookmark data layer: folders, bookmarks, favorites, and trash (soft-delete).
 * Pure functions operating on a passed-in `store` (get/set). No DOM access here,
 * so this module is shared by both the legacy bookmark UI and the new
 * Bookmark Manager, and is directly unit-testable.
 */

export const DEFAULT_BOOKMARK_FOLDER_ID = 'folder_default';

function randomId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeBookmarkFolder(name = 'General') {
  return {
    id: randomId('folder'),
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

function normalizeBookmark(bm, validFolderIds) {
  return {
    id: typeof bm?.id === 'string' && bm.id ? bm.id : randomId('bm'),
    name: String(bm?.name ?? '').trim(),
    url: String(bm?.url ?? '').trim(),
    folderId: validFolderIds.has(bm?.folderId) ? bm.folderId : DEFAULT_BOOKMARK_FOLDER_ID,
    favorite: !!bm?.favorite,
    deletedAt: Number.isFinite(bm?.deletedAt) ? bm.deletedAt : null,
  };
}

// ─── Folders ────────────────────────────────────────────────────────
export function getBookmarkFolders(store) {
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

export function setBookmarkFolders(store, folders) { store.set('bookmarkFolders', folders); }

export function addBookmarkFolder(store, name) {
  const folders = getBookmarkFolders(store);
  const folder = makeBookmarkFolder(name);
  setBookmarkFolders(store, [...folders, folder]);
  return folder;
}

export function renameBookmarkFolder(store, folderId, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return;
  setBookmarkFolders(store, getBookmarkFolders(store).map(f => (f.id === folderId ? { ...f, name: trimmed } : f)));
}

export function deleteBookmarkFolder(store, folderId) {
  if (folderId === DEFAULT_BOOKMARK_FOLDER_ID) return;
  setBookmarkFolders(store, getBookmarkFolders(store).filter(f => f.id !== folderId));
  const raw = getAllBookmarksRaw(store).map(bm => (bm.folderId === folderId ? { ...bm, folderId: DEFAULT_BOOKMARK_FOLDER_ID } : bm));
  store.set('bookmarks', raw);
}

export function folderNameById(store, folderId, folders = getBookmarkFolders(store)) {
  return folders.find(folder => folder.id === folderId)?.name ?? 'General';
}

export function getActiveBookmarkFolderId(store, folders = getBookmarkFolders(store)) {
  const saved = store.get('activeBookmarkFolderId');
  return folders.some(folder => folder.id === saved) ? saved : folders[0]?.id || DEFAULT_BOOKMARK_FOLDER_ID;
}

export function setActiveBookmarkFolderId(store, folderId) { store.set('activeBookmarkFolderId', folderId); }

// ─── Bookmarks ──────────────────────────────────────────────────────
export function getAllBookmarksRaw(store) {
  const folders = getBookmarkFolders(store);
  const validFolderIds = new Set(folders.map(folder => folder.id));
  const bms = store.get('bookmarks') ?? [];
  const normalized = (Array.isArray(bms) ? bms : [])
    .map(bm => normalizeBookmark(bm, validFolderIds))
    .filter(bm => bm.name && bm.url);
  store.set('bookmarks', normalized);
  return normalized;
}

/** Active (non-trashed) bookmarks — the default view used almost everywhere. */
export function getBookmarks(store) {
  return getAllBookmarksRaw(store).filter(bm => !bm.deletedAt);
}

export function getTrashedBookmarks(store) {
  return getAllBookmarksRaw(store).filter(bm => !!bm.deletedAt);
}

export function getFavoriteBookmarks(store) {
  return getBookmarks(store).filter(bm => bm.favorite);
}

/** Raw setter — expects the FULL array (including trashed items). */
export function setBookmarks(store, bookmarks) { store.set('bookmarks', bookmarks); }

export function addBookmark(store, { name, url, folderId }) {
  const folders = getBookmarkFolders(store);
  const validFolderIds = new Set(folders.map(folder => folder.id));
  const raw = getAllBookmarksRaw(store);
  const bookmark = normalizeBookmark({ name, url, folderId, favorite: false, deletedAt: null }, validFolderIds);
  setBookmarks(store, [...raw, bookmark]);
  return bookmark;
}

export function updateBookmark(store, id, updates) {
  const raw = getAllBookmarksRaw(store);
  setBookmarks(store, raw.map(bm => (bm.id === id ? { ...bm, ...updates } : bm)));
}

export function toggleFavorite(store, id) {
  const raw = getAllBookmarksRaw(store);
  setBookmarks(store, raw.map(bm => (bm.id === id ? { ...bm, favorite: !bm.favorite } : bm)));
}

export function moveToTrash(store, id) { updateBookmark(store, id, { deletedAt: Date.now() }); }
export function restoreFromTrash(store, id) { updateBookmark(store, id, { deletedAt: null }); }

export function permanentlyDeleteBookmark(store, id) {
  const raw = getAllBookmarksRaw(store);
  setBookmarks(store, raw.filter(bm => bm.id !== id));
}

export function emptyTrash(store) {
  const raw = getAllBookmarksRaw(store);
  setBookmarks(store, raw.filter(bm => !bm.deletedAt));
}

/** Reorder within the raw array (drag-reorder in the legacy manage list). */
export function moveBookmark(store, fromId, toId) {
  const raw = getAllBookmarksRaw(store);
  const fromIndex = raw.findIndex(bm => bm.id === fromId);
  const toIndex = raw.findIndex(bm => bm.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
  const next = [...raw];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  setBookmarks(store, next);
}
