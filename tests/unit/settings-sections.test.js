import { describe, it, expect } from 'vitest';
import { makeStore } from '../helpers/storage.js';
import { getCollapsedSections, toggleSection } from '../helpers/settings-sections.js';

describe('settings sections collapse state', () => {
  it('initially no sections collapsed (empty object)', () => {
    const store = makeStore();
    const collapsed = getCollapsedSections(store);
    expect(collapsed).toEqual({});
  });

  it('toggle collapses a section (returns true)', () => {
    const store = makeStore();
    const result = toggleSection(store, 'appearance');
    expect(result).toBe(true);
    expect(getCollapsedSections(store).appearance).toBe(true);
  });

  it('toggle twice restores open state (returns false)', () => {
    const store = makeStore();
    toggleSection(store, 'widgets');
    const result = toggleSection(store, 'widgets');
    expect(result).toBe(false);
    expect(getCollapsedSections(store).widgets).toBe(false);
  });

  it('multiple sections track independently', () => {
    const store = makeStore();
    toggleSection(store, 'appearance');
    toggleSection(store, 'search');
    toggleSection(store, 'layout');
    toggleSection(store, 'layout'); // toggle back
    const collapsed = getCollapsedSections(store);
    expect(collapsed.appearance).toBe(true);
    expect(collapsed.search).toBe(true);
    expect(collapsed.layout).toBe(false);
    expect(collapsed.widgets).toBeUndefined();
  });
});
