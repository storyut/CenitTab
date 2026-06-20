import { describe, it, expect } from 'vitest';
import { makeStore } from '../helpers/storage.js';
import { validateBackup, SETTINGS_VERSION } from '../helpers/import-validation.js';

describe('validateBackup', () => {
  it('valid backup passes validation', () => {
    const storage = {
      bookmarks: [{ id: '1', url: 'https://example.com', title: 'Example', folderId: 'general' }],
      notesList: [{ id: 'n1', title: 'My Note' }],
      customThemes: [],
      accentColor: '#c9a96e',
      settingsVersion: 2,
    };
    const { valid, errors } = validateBackup(storage);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('unknown key fails validation', () => {
    const storage = {
      bookmarks: [],
      unknownField: 'bad data',
    };
    const { valid, errors } = validateBackup(storage);
    expect(valid).toBe(false);
    expect(errors).toContain('Unknown key: "unknownField"');
  });

  it('bookmarks as non-array fails validation', () => {
    const storage = {
      bookmarks: { id: '1', url: 'https://example.com' },
    };
    const { valid, errors } = validateBackup(storage);
    expect(valid).toBe(false);
    expect(errors).toContain('bookmarks must be an array');
  });

  it('notesList as non-array fails validation', () => {
    const storage = {
      notesList: 'not an array',
    };
    const { valid, errors } = validateBackup(storage);
    expect(valid).toBe(false);
    expect(errors).toContain('notesList must be an array');
  });

  it('customThemes as non-array fails validation', () => {
    const storage = {
      customThemes: { name: 'bad' },
    };
    const { valid, errors } = validateBackup(storage);
    expect(valid).toBe(false);
    expect(errors).toContain('customThemes must be an array');
  });

  it('summary counts are correct', () => {
    const storage = {
      bookmarks: [
        { id: '1', url: 'https://a.com', title: 'A', folderId: 'general' },
        { id: '2', url: 'https://b.com', title: 'B', folderId: 'general' },
        { id: '3', url: 'https://c.com', title: 'C', folderId: 'general' },
      ],
      notesList: [
        { id: 'n1', title: 'Note 1' },
        { id: 'n2', title: 'Note 2' },
      ],
      customThemes: [{ id: 't1', name: 'Dark' }],
      settingsVersion: 2,
    };
    const { valid, summary } = validateBackup(storage);
    expect(valid).toBe(true);
    expect(summary.bookmarks).toBe(3);
    expect(summary.notes).toBe(2);
    expect(summary.themes).toBe(1);
    expect(summary.version).toBe(2);
  });

  it('summary counts default to 0 when keys absent', () => {
    const storage = { accentColor: '#abc' };
    const { summary } = validateBackup(storage);
    expect(summary.bookmarks).toBe(0);
    expect(summary.notes).toBe(0);
    expect(summary.themes).toBe(0);
  });

  it('version defaults to 1 when settingsVersion absent', () => {
    const storage = { bookmarks: [] };
    const { summary } = validateBackup(storage);
    expect(summary.version).toBe(1);
  });

  it('version warning set when backup version > current', () => {
    const storage = {
      settingsVersion: SETTINGS_VERSION + 1,
      bookmarks: [],
    };
    const { valid, summary } = validateBackup(storage);
    expect(valid).toBe(true);
    expect(summary.versionWarning).toBe(true);
  });

  it('no version warning when backup version equals current', () => {
    const storage = {
      settingsVersion: SETTINGS_VERSION,
      bookmarks: [],
    };
    const { summary } = validateBackup(storage);
    expect(summary.versionWarning).toBe(false);
  });

  it('no version warning when backup version is older', () => {
    const storage = {
      settingsVersion: 1,
      bookmarks: [],
    };
    const { summary } = validateBackup(storage);
    expect(summary.versionWarning).toBe(false);
  });

  it('makeStore can hold backup storage data', () => {
    const store = makeStore();
    store.set('bookmarks', [{ id: '1', url: 'https://example.com', title: 'Test', folderId: 'general' }]);
    store.set('settingsVersion', SETTINGS_VERSION);

    const storage = {
      bookmarks: store.get('bookmarks'),
      settingsVersion: store.get('settingsVersion'),
    };
    const { valid, summary } = validateBackup(storage);
    expect(valid).toBe(true);
    expect(summary.bookmarks).toBe(1);
    expect(summary.version).toBe(SETTINGS_VERSION);
  });
});
