export const DEFAULT_ACTIONS = [
  { icon: '✦', label: 'Open Settings', category: 'action' },
  { icon: '⊞', label: 'Open Layout', category: 'action' },
  { icon: '⌁', label: 'Open Background', category: 'action' },
  { icon: '☆', label: 'Open Bookmarks', category: 'action' },
  { icon: '＋', label: 'New Note', category: 'action' },
  { icon: '⟳', label: 'Reset Layout', category: 'action' },
];

export function buildCmdItems(
  query,
  {
    bookmarks = [],
    notes = [],
    themes = [],
    profiles = {},
    actions = DEFAULT_ACTIONS,
    maxItems = 12,
  } = {},
) {
  const q = query.trim().toLowerCase();
  const items = [];

  actions.forEach((action) => {
    if (!q || action.label.toLowerCase().includes(q)) items.push(action);
  });

  bookmarks.forEach((bookmark) => {
    const name = bookmark?.name ?? '';
    const url = bookmark?.url ?? '';
    if (!q || name.toLowerCase().includes(q) || url.toLowerCase().includes(q)) {
      items.push({ icon: '⌕', label: name, category: 'bookmark', payload: bookmark });
    }
  });

  notes.forEach((note) => {
    const label = note?.title || 'Untitled note';
    const body = note?.body ?? '';
    if (!q || label.toLowerCase().includes(q) || body.toLowerCase().includes(q)) {
      items.push({ icon: '✎', label, category: 'note', payload: note });
    }
  });

  themes.forEach((theme) => {
    const name = theme?.name ?? '';
    if (!q || name.toLowerCase().includes(q)) {
      items.push({ icon: '◐', label: name, category: 'theme', payload: theme });
    }
  });

  Object.keys(profiles).forEach((name) => {
    if (!q || name.toLowerCase().includes(q)) {
      items.push({ icon: '▤', label: name, category: 'layout', payload: { name } });
    }
  });

  if (q) {
    items.push({
      icon: '⌕',
      label: `Search web for "${query.trim()}"`,
      category: 'search',
      payload: { query: query.trim() },
    });
  }

  return items.slice(0, maxItems);
}
