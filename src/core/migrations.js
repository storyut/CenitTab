export const SETTINGS_VERSION = 2;

export function runMigrations(store) {
  const version = store.get('settingsVersion') ?? 1;
  if (version < 2) migrateV1toV2(store);
  store.set('settingsVersion', SETTINGS_VERSION);
}

export function migrateV1toV2(store) {
  const bookmarks = store.get('bookmarks') ?? [];
  const updated = bookmarks.map((bookmark) => (
    bookmark.folderId ? bookmark : { ...bookmark, folderId: 'general' }
  ));
  if (updated.some((bookmark, index) => bookmark !== bookmarks[index])) {
    store.set('bookmarks', updated);
  }
}
