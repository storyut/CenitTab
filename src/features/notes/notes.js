/**
 * Notes feature: markdown-powered sticky notes with multi-note support,
 * pinning, and live preview.
 */

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function renderInlineMarkdown(text) {
  let html = String(text ?? '');
  html = html.replace(/`([^`]+)`/g, (_m, p1) => `<code>${p1}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, (_m, p1) => `<strong>${p1}</strong>`);
  html = html.replace(/(^|\W)\*([^*]+)\*/g, (_m, p0, p1) => `${p0}<em>${p1}</em>`);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);
  return html;
}

function renderMarkdown(markdown) {
  const raw = String(markdown ?? '');
  if (!raw.trim()) return '<p class="notes-empty-preview">Nothing written yet.</p>';
  const lines = escapeHtml(raw).split('\n');
  return lines.map((line) => {
    const checklist = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/);
    if (checklist) {
      const checked = checklist[1].toLowerCase() === 'x';
      return `<label class="notes-check${checked ? ' checked' : ''}"><input type="checkbox" disabled ${checked ? 'checked' : ''}/><span>${renderInlineMarkdown(checklist[2])}</span></label>`;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) return `<div class="notes-bullet"><span>${renderInlineMarkdown(bullet[1])}</span></div>`;
    if (!line.trim()) return '<p>&nbsp;</p>';
    return `<p>${renderInlineMarkdown(line)}</p>`;
  }).join('');
}

function makeNote(body = '', pinned = false) {
  return {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: inferNoteTitle(body),
    body,
    pinned,
    updatedAt: Date.now(),
  };
}

function inferNoteTitle(body) {
  const firstLine = String(body ?? '').split('\n').find(line => line.trim())?.trim() ?? '';
  const cleaned = firstLine
    .replace(/^#+\s*/, '')
    .replace(/^[-*]\s+\[( |x|X)\]\s+/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/[`*_#\[\]()]/g, '')
    .trim();
  return (cleaned || 'Untitled Note').slice(0, 36);
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/**
 * Initialize the notes feature.
 * @param {object} deps - Dependencies
 * @param {object} deps.store - The Store object
 * @param {Function} deps.showToast - Toast notification function
 * @returns {object} Notes API: getNotes, loadNotes, renderActiveNote
 */
export function initNotes(deps) {
  const { store, showToast } = deps;
  const notesInput = document.getElementById('notes-input');
  const notesPreview = document.getElementById('notes-preview');
  const notesClearBtn = document.getElementById('notes-clear-btn');
  const notesSelect = document.getElementById('notes-select');
  const notesAddBtn = document.getElementById('notes-add-btn');
  const notesPinBtn = document.getElementById('notes-pin-btn');
  const notesDeleteBtn = document.getElementById('notes-delete-btn');
  const notesPreviewToggleBtn = document.getElementById('notes-preview-toggle-btn');
  const notesSaveStatus = document.getElementById('notes-save-status');
  let notesSaveTimer = null;

  function getNotes() {
    let notes = store.get('notesList');
    if (!Array.isArray(notes) || !notes.length) {
      const legacy = store.get('notesMarkdown') ?? '';
      notes = [makeNote(legacy)];
      store.set('notesList', notes);
      store.set('activeNoteId', notes[0].id);
    }
    return notes.map(note => ({
      id: note.id || `note_${Math.random().toString(36).slice(2, 10)}`,
      title: note.title || inferNoteTitle(note.body),
      body: note.body ?? '',
      pinned: !!note.pinned,
      updatedAt: note.updatedAt ?? Date.now(),
    }));
  }

  function setNotes(notes) {
    store.set('notesList', notes);
    store.set('notesMarkdown', getActiveNote(notes)?.body ?? '');
  }

  function getActiveNote(notes = getNotes()) {
    const activeId = store.get('activeNoteId');
    return notes.find(note => note.id === activeId) ?? sortNotes(notes)[0] ?? null;
  }

  function setNotesSaveStatus(text, saving = false) {
    if (!notesSaveStatus) return;
    notesSaveStatus.textContent = text;
    notesSaveStatus.classList.toggle('saving', saving);
  }

  function flashNotesSaved() {
    setNotesSaveStatus('Saving...', true);
    if (notesSaveTimer) clearTimeout(notesSaveTimer);
    notesSaveTimer = setTimeout(() => setNotesSaveStatus('Saved'), 350);
  }

  function renderNotesSelect(notes, activeId) {
    if (!notesSelect) return;
    notesSelect.innerHTML = '';
    sortNotes(notes).forEach((note) => {
      const opt = document.createElement('option');
      opt.value = note.id;
      opt.textContent = `${note.pinned ? '★ ' : ''}${note.title || inferNoteTitle(note.body)}`;
      notesSelect.appendChild(opt);
    });
    notesSelect.value = activeId;
  }

  function applyNotesPreviewVisibility() {
    const hidden = !!store.get('notesPreviewHidden');
    if (notesPreview) notesPreview.classList.toggle('hidden', hidden);
    if (notesPreviewToggleBtn) notesPreviewToggleBtn.textContent = hidden ? 'Show Preview' : 'Hide Preview';
  }

  function renderActiveNote() {
    const notes = getNotes();
    const active = getActiveNote(notes);
    if (!active) return;
    store.set('activeNoteId', active.id);
    if (notesInput) notesInput.value = active.body ?? '';
    if (notesPreview) notesPreview.innerHTML = renderMarkdown(active.body ?? '');
    if (notesPinBtn) {
      notesPinBtn.textContent = active.pinned ? '★' : '☆';
      notesPinBtn.classList.toggle('active', !!active.pinned);
      notesPinBtn.title = active.pinned ? 'Unpin note' : 'Pin note';
    }
    renderNotesSelect(notes, active.id);
    applyNotesPreviewVisibility();
    setNotesSaveStatus('Saved');
  }

  function updateActiveNoteBody(body) {
    const notes = getNotes();
    const activeId = store.get('activeNoteId') || getActiveNote(notes)?.id;
    const next = notes.map(note => {
      if (note.id !== activeId) return note;
      return { ...note, body, title: inferNoteTitle(body), updatedAt: Date.now() };
    });
    setNotes(next);
    if (notesPreview) notesPreview.innerHTML = renderMarkdown(body);
    renderNotesSelect(next, activeId);
    if (notesSelect) notesSelect.value = activeId;
    flashNotesSaved();
  }

  function loadNotes() { renderActiveNote(); }

  // Wire up event handlers
  if (notesInput) {
    notesInput.addEventListener('input', () => updateActiveNoteBody(notesInput.value));
  }
  if (notesSelect) {
    notesSelect.addEventListener('change', () => {
      store.set('activeNoteId', notesSelect.value);
      renderActiveNote();
    });
  }
  if (notesAddBtn) {
    notesAddBtn.addEventListener('click', () => {
      const notes = getNotes();
      const note = makeNote('');
      const next = [...notes, note];
      setNotes(next);
      store.set('activeNoteId', note.id);
      renderActiveNote();
      flashNotesSaved();
      notesInput?.focus();
    });
  }
  if (notesPinBtn) {
    notesPinBtn.addEventListener('click', () => {
      const notes = getNotes();
      const activeId = store.get('activeNoteId') || getActiveNote(notes)?.id;
      const next = notes.map(note => note.id === activeId ? { ...note, pinned: !note.pinned, updatedAt: Date.now() } : note);
      setNotes(next);
      renderActiveNote();
      flashNotesSaved();
    });
  }
  if (notesDeleteBtn) {
    notesDeleteBtn.addEventListener('click', () => {
      const notes = getNotes();
      const activeId = store.get('activeNoteId') || getActiveNote(notes)?.id;
      const removed = notes.find(note => note.id === activeId);
      let next = notes.filter(note => note.id !== activeId);
      if (!next.length) next = [makeNote('')];
      setNotes(next);
      store.set('activeNoteId', sortNotes(next)[0].id);
      renderActiveNote();
      flashNotesSaved();
      if (removed) showToast(`Deleted: ${removed.title || 'Note'}`, () => {
        const cur = getNotes(); cur.push(removed); setNotes(cur);
        store.set('activeNoteId', removed.id); renderActiveNote();
      });
    });
  }
  if (notesClearBtn) {
    notesClearBtn.addEventListener('click', () => {
      if (notesInput) notesInput.value = '';
      updateActiveNoteBody('');
    });
  }
  if (notesPreviewToggleBtn) {
    notesPreviewToggleBtn.addEventListener('click', () => {
      store.set('notesPreviewHidden', !store.get('notesPreviewHidden'));
      applyNotesPreviewVisibility();
    });
  }

  loadNotes();

  return { getNotes, loadNotes, renderActiveNote, makeNote, notesAddBtn };
}
