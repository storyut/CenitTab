export function buildCmdItems(query, { bookmarks = [], notes = [], themes = [], profiles = {} } = {}) {
  const q = query.trim().toLowerCase();
  const items = [];
  const actions = [
    { icon: '✦', label: 'Open Settings',    category: 'action' },
    { icon: '⊞', label: 'Open Layout',      category: 'action' },
    { icon: '⌁', label: 'Open Background',  category: 'action' },
    { icon: '☆', label: 'Open Bookmarks',   category: 'action' },
    { icon: '＋', label: 'New Note',         category: 'action' },
    { icon: '⟳', label: 'Reset Layout',     category: 'action' },
  ];
  actions.forEach(a => { if (!q || a.label.toLowerCase().includes(q)) items.push(a); });
  bookmarks.forEach(bm => {
    if (!q || bm.name.toLowerCase().includes(q) || bm.url.toLowerCase().includes(q))
      items.push({ icon: '⌕', label: bm.name, category: 'bookmark' });
  });
  notes.forEach(note => {
    const label = note.title || 'Untitled note';
    if (!q || label.toLowerCase().includes(q))
      items.push({ icon: '✎', label, category: 'note' });
  });
  themes.forEach(t => {
    if (!q || t.name.toLowerCase().includes(q))
      items.push({ icon: '◐', label: t.name, category: 'theme' });
  });
  Object.keys(profiles).forEach(name => {
    if (!q || name.toLowerCase().includes(q))
      items.push({ icon: '▤', label: name, category: 'layout' });
  });
  if (q) items.push({ icon: '⌕', label: `Search web for "${query.trim()}"`, category: 'search' });
  return items.slice(0, 12);
}
