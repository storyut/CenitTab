import { describe, it, expect } from 'vitest';
import { buildCmdItems } from '../helpers/command-palette.js';

describe('buildCmdItems – empty query', () => {
  it('returns all 6 static actions and no "search web" item', () => {
    const items = buildCmdItems('');
    const actions = items.filter(i => i.category === 'action');
    const search  = items.filter(i => i.category === 'search');
    expect(actions).toHaveLength(6);
    expect(search).toHaveLength(0);
  });

  it('includes Open Settings, Open Layout, Open Background, Open Bookmarks, New Note, Reset Layout', () => {
    const labels = buildCmdItems('').map(i => i.label);
    expect(labels).toContain('Open Settings');
    expect(labels).toContain('Open Layout');
    expect(labels).toContain('Open Background');
    expect(labels).toContain('Open Bookmarks');
    expect(labels).toContain('New Note');
    expect(labels).toContain('Reset Layout');
  });
});

describe('buildCmdItems – static action filtering', () => {
  it('query "settings" returns only the Settings action', () => {
    const items = buildCmdItems('settings');
    expect(items).toHaveLength(2); // 1 action + 1 "search web"
    expect(items[0].label).toBe('Open Settings');
    expect(items[0].category).toBe('action');
  });

  it('query "layout" returns Open Layout and Reset Layout actions', () => {
    const items = buildCmdItems('layout');
    const actions = items.filter(i => i.category === 'action');
    const labels = actions.map(i => i.label);
    expect(labels).toContain('Open Layout');
    expect(labels).toContain('Reset Layout');
  });
});

describe('buildCmdItems – notes', () => {
  it('query "note" returns matching note titles', () => {
    const notes = [
      { title: 'My Note', body: 'content' },
      { title: 'Shopping list', body: 'apples' },
      { title: 'Another note', body: 'stuff' },
    ];
    const items = buildCmdItems('note', { notes });
    const noteItems = items.filter(i => i.category === 'note');
    expect(noteItems).toHaveLength(2);
    const labels = noteItems.map(i => i.label);
    expect(labels).toContain('My Note');
    expect(labels).toContain('Another note');
  });

  it('note without title shows "Untitled note"', () => {
    const notes = [{ title: '', body: 'something' }];
    const items = buildCmdItems('untitled', { notes });
    const noteItems = items.filter(i => i.category === 'note');
    expect(noteItems).toHaveLength(1);
    expect(noteItems[0].label).toBe('Untitled note');
  });

  it('note without title is included in empty query results', () => {
    const notes = [{ title: '', body: 'something' }];
    const items = buildCmdItems('', { notes });
    const noteItems = items.filter(i => i.category === 'note');
    expect(noteItems).toHaveLength(1);
    expect(noteItems[0].label).toBe('Untitled note');
  });
});

describe('buildCmdItems – bookmarks', () => {
  it('query "github" returns matching bookmark by name', () => {
    const bookmarks = [
      { name: 'GitHub', url: 'https://github.com' },
      { name: 'Google', url: 'https://google.com' },
    ];
    const items = buildCmdItems('github', { bookmarks });
    const bmItems = items.filter(i => i.category === 'bookmark');
    expect(bmItems).toHaveLength(1);
    expect(bmItems[0].label).toBe('GitHub');
  });

  it('bookmark URL matching – query matches URL not just name', () => {
    const bookmarks = [
      { name: 'My Repo', url: 'https://github.com/user/repo' },
      { name: 'Work site', url: 'https://work.example.com' },
    ];
    const items = buildCmdItems('github', { bookmarks });
    const bmItems = items.filter(i => i.category === 'bookmark');
    expect(bmItems).toHaveLength(1);
    expect(bmItems[0].label).toBe('My Repo');
  });

  it('bookmark URL matching – partial URL segment matches', () => {
    const bookmarks = [
      { name: 'Docs', url: 'https://docs.example.com/api/v2' },
      { name: 'Home', url: 'https://example.com' },
    ];
    const items = buildCmdItems('api/v2', { bookmarks });
    const bmItems = items.filter(i => i.category === 'bookmark');
    expect(bmItems).toHaveLength(1);
    expect(bmItems[0].label).toBe('Docs');
  });
});

describe('buildCmdItems – "Search web for …" item', () => {
  it('non-empty query always includes "Search web for …" item last', () => {
    const items = buildCmdItems('hello');
    expect(items.length).toBeGreaterThan(0);
    const last = items[items.length - 1];
    expect(last.category).toBe('search');
    expect(last.label).toBe('Search web for "hello"');
  });

  it('search item label uses trimmed query text', () => {
    const items = buildCmdItems('  spaces  ');
    const last = items[items.length - 1];
    expect(last.label).toBe('Search web for "spaces"');
  });

  it('empty query has no search item', () => {
    const items = buildCmdItems('');
    expect(items.every(i => i.category !== 'search')).toBe(true);
  });
});

describe('buildCmdItems – result cap', () => {
  it('results are capped at 12 items', () => {
    const bookmarks = Array.from({ length: 20 }, (_, i) => ({
      name: `Bookmark ${i}`,
      url: `https://example.com/${i}`,
    }));
    const items = buildCmdItems('', { bookmarks });
    expect(items).toHaveLength(12);
  });

  it('cap applies across mixed categories', () => {
    const bookmarks = Array.from({ length: 5 }, (_, i) => ({ name: `BM ${i}`, url: `https://x.com/${i}` }));
    const notes     = Array.from({ length: 5 }, (_, i) => ({ title: `Note ${i}`, body: '' }));
    const themes    = Array.from({ length: 5 }, (_, i) => ({ name: `Theme ${i}` }));
    const items = buildCmdItems('', { bookmarks, notes, themes });
    expect(items).toHaveLength(12);
  });
});

describe('buildCmdItems – themes and profiles', () => {
  it('returns matching themes', () => {
    const themes = [{ name: 'Dark Ocean' }, { name: 'Bright Day' }];
    const items = buildCmdItems('ocean', { themes });
    const themeItems = items.filter(i => i.category === 'theme');
    expect(themeItems).toHaveLength(1);
    expect(themeItems[0].label).toBe('Dark Ocean');
  });

  it('returns matching layout profiles', () => {
    const profiles = { 'Work Setup': {}, 'Gaming': {}, 'Reading': {} };
    const items = buildCmdItems('work', { profiles });
    const layoutItems = items.filter(i => i.category === 'layout');
    expect(layoutItems).toHaveLength(1);
    expect(layoutItems[0].label).toBe('Work Setup');
  });
});
