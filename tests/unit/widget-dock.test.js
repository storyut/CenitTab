import { describe, it, expect } from 'vitest';
import { makeStore } from '../helpers/storage.js';
import { getMinimizedWidgets, setMinimizedWidgets, minimizeWidget, restoreWidget } from '../helpers/widget-dock.js';

describe('Widget Dock - minimized state', () => {
  it('initially no minimized widgets', () => {
    const store = makeStore();
    const m = getMinimizedWidgets(store);
    expect(m.size).toBe(0);
  });

  it('minimizeWidget adds widget id to set', () => {
    const store = makeStore();
    minimizeWidget(store, 'clock');
    const m = getMinimizedWidgets(store);
    expect(m.has('clock')).toBe(true);
    expect(m.size).toBe(1);
  });

  it('restoreWidget removes widget id from set', () => {
    const store = makeStore();
    minimizeWidget(store, 'clock');
    restoreWidget(store, 'clock');
    const m = getMinimizedWidgets(store);
    expect(m.has('clock')).toBe(false);
    expect(m.size).toBe(0);
  });

  it('minimizing same widget twice does not duplicate', () => {
    const store = makeStore();
    minimizeWidget(store, 'notes');
    minimizeWidget(store, 'notes');
    const m = getMinimizedWidgets(store);
    expect(m.size).toBe(1);
    expect(m.has('notes')).toBe(true);
  });

  it('multiple independent widgets track correctly', () => {
    const store = makeStore();
    minimizeWidget(store, 'clock');
    minimizeWidget(store, 'search');
    minimizeWidget(store, 'bookmarks');
    const m = getMinimizedWidgets(store);
    expect(m.size).toBe(3);
    expect(m.has('clock')).toBe(true);
    expect(m.has('search')).toBe(true);
    expect(m.has('bookmarks')).toBe(true);
  });

  it('restoring non-minimized widget is a no-op (set unchanged)', () => {
    const store = makeStore();
    minimizeWidget(store, 'clock');
    restoreWidget(store, 'media'); // not minimized
    const m = getMinimizedWidgets(store);
    expect(m.size).toBe(1);
    expect(m.has('clock')).toBe(true);
    expect(m.has('media')).toBe(false);
  });
});
