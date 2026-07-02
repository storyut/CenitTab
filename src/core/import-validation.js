import { SETTINGS_VERSION } from './migrations.js';

export const KNOWN_KEYS = new Set([
  'bookmarks', 'bookmarkFolders', 'activeBookmarkFolderId', 'legacyBookmarksMode', 'bmManagerViewMode',
  'notesList', 'notesMarkdown', 'activeNoteId',
  'accentColor', 'overlayDarkness', 'bgBlur', 'bgPreset', 'bgPresetIndex',
  'accentColorGlobal', 'clockFont', 'uiFont', 'customFonts',
  'use12h', 'showAmPm', 'showGreeting', 'showDate', 'hideBrand',
  'widgetPositions', 'widgetSizes', 'widgetVisibility', 'widgetAppearance',
  'layoutProfiles', 'activeLayoutProfile',
  'customThemes', 'activeThemeId',
  'searchEngine', 'customBangs',
  'recentCount', 'minimizedWidgets', 'widgetDockPosition',
  'settingsVersion',
]);

export function validateBackup(storage, { settingsVersion = SETTINGS_VERSION } = {}) {
  const errors = [];

  for (const key of Object.keys(storage)) {
    if (!KNOWN_KEYS.has(key)) errors.push(`Unknown key: "${key}"`);
  }

  if (storage.bookmarks !== undefined && !Array.isArray(storage.bookmarks)) {
    errors.push('bookmarks must be an array');
  }
  if (storage.bookmarkFolders !== undefined && !Array.isArray(storage.bookmarkFolders)) {
    errors.push('bookmarkFolders must be an array');
  }
  if (storage.notesList !== undefined && !Array.isArray(storage.notesList)) {
    errors.push('notesList must be an array');
  }
  if (storage.customThemes !== undefined && !Array.isArray(storage.customThemes)) {
    errors.push('customThemes must be an array');
  }
  if (storage.customFonts !== undefined && !Array.isArray(storage.customFonts)) {
    errors.push('customFonts must be an array');
  }

  const version = storage.settingsVersion ?? 1;
  const summary = {
    bookmarks: Array.isArray(storage.bookmarks) ? storage.bookmarks.length : 0,
    notes: Array.isArray(storage.notesList) ? storage.notesList.length : 0,
    themes: Array.isArray(storage.customThemes) ? storage.customThemes.length : 0,
    version,
    versionWarning: version > settingsVersion,
  };

  return {
    valid: errors.length === 0,
    errors,
    summary,
  };
}
