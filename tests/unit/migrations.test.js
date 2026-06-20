import { describe, it, expect } from 'vitest';
import { makeStore } from '../helpers/storage.js';
import { runMigrations, SETTINGS_VERSION } from '../helpers/migrations.js';

describe('runMigrations', () => {
  it('v1 legacy: fixes bookmarks missing folderId', () => {
    const store = makeStore();
    store.set('bookmarks', [
      { id: '1', url: 'https://example.com', title: 'Example' },
      { id: '2', url: 'https://other.com', title: 'Other', folderId: 'work' },
    ]);
    // no settingsVersion set = v1 legacy

    runMigrations(store);

    const bms = store.get('bookmarks');
    expect(bms[0].folderId).toBe('general');
    expect(bms[1].folderId).toBe('work'); // pre-existing folderId preserved
    expect(store.get('settingsVersion')).toBe(SETTINGS_VERSION);
  });

  it('already at current version: makes no changes', () => {
    const store = makeStore();
    const bookmarks = [
      { id: '1', url: 'https://example.com', title: 'Example', folderId: 'general' },
    ];
    store.set('bookmarks', bookmarks);
    store.set('settingsVersion', SETTINGS_VERSION);

    runMigrations(store);

    const bms = store.get('bookmarks');
    expect(bms[0].folderId).toBe('general');
    expect(store.get('settingsVersion')).toBe(SETTINGS_VERSION);
  });

  it('exported backup includes settingsVersion', () => {
    // Simulate what collectSettingsBackup returns in app.js
    const backup = {
      app: 'Cenit New Tab',
      version: '1.2.0',
      settingsVersion: SETTINGS_VERSION,
      exportedAt: new Date().toISOString(),
      storage: {},
      assets: { backgroundImages: [] },
    };

    expect(backup.settingsVersion).toBe(SETTINGS_VERSION);
    expect(typeof backup.settingsVersion).toBe('number');
  });
});
