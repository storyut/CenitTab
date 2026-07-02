import { describe, it, expect } from 'vitest';
import { makeStore } from '../helpers/storage.js';
import {
  DEFAULT_BOOKMARK_FOLDER_ID,
  getBookmarkFolders, addBookmarkFolder, renameBookmarkFolder, deleteBookmarkFolder,
  getBookmarks, getTrashedBookmarks, getFavoriteBookmarks,
  addBookmark, updateBookmark, toggleFavorite,
  moveToTrash, restoreFromTrash, permanentlyDeleteBookmark, emptyTrash, moveBookmark,
} from '../helpers/bookmark-store.js';

describe('getBookmarkFolders', () => {
  it('creates a default General folder when none exist', () => {
    const store = makeStore();
    const folders = getBookmarkFolders(store);
    expect(folders).toHaveLength(1);
    expect(folders[0].id).toBe(DEFAULT_BOOKMARK_FOLDER_ID);
    expect(folders[0].name).toBe('General');
  });

  it('re-adds the default folder if missing from stored folders', () => {
    const store = makeStore();
    store.set('bookmarkFolders', [{ id: 'folder_work', name: 'Work' }]);
    const folders = getBookmarkFolders(store);
    expect(folders.map(f => f.id)).toContain(DEFAULT_BOOKMARK_FOLDER_ID);
    expect(folders).toHaveLength(2);
  });
});

describe('addBookmark / getBookmarks', () => {
  it('adds a bookmark with favorite=false and deletedAt=null by default', () => {
    const store = makeStore();
    const bm = addBookmark(store, { name: 'GitHub', url: 'https://github.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    expect(bm.favorite).toBe(false);
    expect(bm.deletedAt).toBeNull();
    expect(typeof bm.id).toBe('string');
    expect(bm.id.length).toBeGreaterThan(0);
    expect(getBookmarks(store)).toHaveLength(1);
  });

  it('assigns unknown folderId to the default folder', () => {
    const store = makeStore();
    const bm = addBookmark(store, { name: 'X', url: 'https://x.com', folderId: 'does-not-exist' });
    expect(bm.folderId).toBe(DEFAULT_BOOKMARK_FOLDER_ID);
  });

  it('filters bookmarks by folder', () => {
    const store = makeStore();
    const folder = addBookmarkFolder(store, 'Dev');
    addBookmark(store, { name: 'A', url: 'https://a.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    addBookmark(store, { name: 'B', url: 'https://b.com', folderId: folder.id });
    const inDev = getBookmarks(store).filter(bm => bm.folderId === folder.id);
    expect(inDev).toHaveLength(1);
    expect(inDev[0].name).toBe('B');
  });
});

describe('toggleFavorite / getFavoriteBookmarks', () => {
  it('toggles favorite on and off', () => {
    const store = makeStore();
    const bm = addBookmark(store, { name: 'A', url: 'https://a.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    expect(getFavoriteBookmarks(store)).toHaveLength(0);
    toggleFavorite(store, bm.id);
    expect(getFavoriteBookmarks(store)).toHaveLength(1);
    toggleFavorite(store, bm.id);
    expect(getFavoriteBookmarks(store)).toHaveLength(0);
  });

  it('favorites exclude trashed bookmarks', () => {
    const store = makeStore();
    const bm = addBookmark(store, { name: 'A', url: 'https://a.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    toggleFavorite(store, bm.id);
    moveToTrash(store, bm.id);
    expect(getFavoriteBookmarks(store)).toHaveLength(0);
  });
});

describe('trash lifecycle', () => {
  it('moveToTrash removes it from getBookmarks and adds it to getTrashedBookmarks', () => {
    const store = makeStore();
    const bm = addBookmark(store, { name: 'A', url: 'https://a.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    moveToTrash(store, bm.id);
    expect(getBookmarks(store)).toHaveLength(0);
    expect(getTrashedBookmarks(store)).toHaveLength(1);
    expect(getTrashedBookmarks(store)[0].deletedAt).not.toBeNull();
  });

  it('restoreFromTrash brings it back to getBookmarks', () => {
    const store = makeStore();
    const bm = addBookmark(store, { name: 'A', url: 'https://a.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    moveToTrash(store, bm.id);
    restoreFromTrash(store, bm.id);
    expect(getBookmarks(store)).toHaveLength(1);
    expect(getTrashedBookmarks(store)).toHaveLength(0);
  });

  it('permanentlyDeleteBookmark removes it entirely', () => {
    const store = makeStore();
    const bm = addBookmark(store, { name: 'A', url: 'https://a.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    moveToTrash(store, bm.id);
    permanentlyDeleteBookmark(store, bm.id);
    expect(getBookmarks(store)).toHaveLength(0);
    expect(getTrashedBookmarks(store)).toHaveLength(0);
  });

  it('emptyTrash removes all trashed bookmarks but keeps active ones', () => {
    const store = makeStore();
    const kept = addBookmark(store, { name: 'Keep', url: 'https://keep.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    const trashed1 = addBookmark(store, { name: 'T1', url: 'https://t1.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    const trashed2 = addBookmark(store, { name: 'T2', url: 'https://t2.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    moveToTrash(store, trashed1.id);
    moveToTrash(store, trashed2.id);
    emptyTrash(store);
    expect(getTrashedBookmarks(store)).toHaveLength(0);
    expect(getBookmarks(store)).toHaveLength(1);
    expect(getBookmarks(store)[0].id).toBe(kept.id);
  });
});

describe('updateBookmark', () => {
  it('updates name, url, and folderId', () => {
    const store = makeStore();
    const folder = addBookmarkFolder(store, 'Dev');
    const bm = addBookmark(store, { name: 'A', url: 'https://a.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    updateBookmark(store, bm.id, { name: 'A2', url: 'https://a2.com', folderId: folder.id });
    const updated = getBookmarks(store)[0];
    expect(updated.name).toBe('A2');
    expect(updated.url).toBe('https://a2.com');
    expect(updated.folderId).toBe(folder.id);
  });
});

describe('folders', () => {
  it('renameBookmarkFolder updates the name', () => {
    const store = makeStore();
    const folder = addBookmarkFolder(store, 'Dev');
    renameBookmarkFolder(store, folder.id, 'Development');
    expect(getBookmarkFolders(store).find(f => f.id === folder.id).name).toBe('Development');
  });

  it('deleteBookmarkFolder moves its bookmarks to General', () => {
    const store = makeStore();
    const folder = addBookmarkFolder(store, 'Dev');
    const bm = addBookmark(store, { name: 'A', url: 'https://a.com', folderId: folder.id });
    deleteBookmarkFolder(store, folder.id);
    expect(getBookmarkFolders(store).some(f => f.id === folder.id)).toBe(false);
    expect(getBookmarks(store).find(b => b.id === bm.id).folderId).toBe(DEFAULT_BOOKMARK_FOLDER_ID);
  });

  it('deleteBookmarkFolder refuses to delete the default folder', () => {
    const store = makeStore();
    deleteBookmarkFolder(store, DEFAULT_BOOKMARK_FOLDER_ID);
    expect(getBookmarkFolders(store).some(f => f.id === DEFAULT_BOOKMARK_FOLDER_ID)).toBe(true);
  });
});

describe('moveBookmark', () => {
  it('reorders bookmarks within the raw array', () => {
    const store = makeStore();
    const a = addBookmark(store, { name: 'A', url: 'https://a.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    const b = addBookmark(store, { name: 'B', url: 'https://b.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    const c = addBookmark(store, { name: 'C', url: 'https://c.com', folderId: DEFAULT_BOOKMARK_FOLDER_ID });
    moveBookmark(store, a.id, c.id);
    const order = getBookmarks(store).map(bm => bm.name);
    expect(order).toEqual(['B', 'C', 'A']);
  });
});
