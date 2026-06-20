export const SETTINGS_VERSION = 2;

export function runMigrations(store) {
  const v = store.get('settingsVersion') ?? 1;
  if (v < 2) migrateV1toV2(store);
  store.set('settingsVersion', SETTINGS_VERSION);
}

function migrateV1toV2(store) {
  const bms = store.get('bookmarks') ?? [];
  const updated = bms.map(bm => bm.folderId ? bm : { ...bm, folderId: 'general' });
  if (updated.some((bm, i) => bm !== bms[i])) store.set('bookmarks', updated);
}
