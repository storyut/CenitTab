import { describe, it, expect } from 'vitest';
import { makeStore } from '../helpers/storage.js';
import { WIDGET_STYLE_PRESETS, applyWidgetStylePreset } from '../helpers/widget-presets.js';

describe('WIDGET_STYLE_PRESETS', () => {
  it('glass preset has correct values', () => {
    const p = WIDGET_STYLE_PRESETS.glass;
    expect(p.opacity).toBe(100);
    expect(p.radius).toBe(8);
    expect(p.background).toBe(true);
    expect(p.border).toBe(true);
  });

  it('compact preset sets opacity 85 and border false', () => {
    const p = WIDGET_STYLE_PRESETS.compact;
    expect(p.opacity).toBe(85);
    expect(p.border).toBe(false);
  });

  it('terminal preset sets accent #00ff88', () => {
    const p = WIDGET_STYLE_PRESETS.terminal;
    expect(p.accent).toBe('#00ff88');
  });

  it('glass preset has no accent key', () => {
    expect(WIDGET_STYLE_PRESETS.glass).not.toHaveProperty('accent');
  });
});

describe('applyWidgetStylePreset', () => {
  it('glass preset stores correct values for widget', () => {
    const store = makeStore();
    applyWidgetStylePreset('clock', 'glass', store);
    const result = store.get('widgetAppearance_clock');
    expect(result.opacity).toBe(100);
    expect(result.radius).toBe(8);
    expect(result.background).toBe(true);
    expect(result.border).toBe(true);
  });

  it('compact preset stores opacity 85 and border false', () => {
    const store = makeStore();
    applyWidgetStylePreset('search', 'compact', store);
    const result = store.get('widgetAppearance_search');
    expect(result.opacity).toBe(85);
    expect(result.border).toBe(false);
  });

  it('terminal preset stores accent #00ff88', () => {
    const store = makeStore();
    applyWidgetStylePreset('notes', 'terminal', store);
    const result = store.get('widgetAppearance_notes');
    expect(result.accent).toBe('#00ff88');
  });

  it('glass preset does NOT override existing accent color', () => {
    const store = makeStore();
    store.set('widgetAppearance_clock', { opacity: 80, radius: 4, background: true, border: true, accent: '#ff0000' });
    applyWidgetStylePreset('clock', 'glass', store);
    const result = store.get('widgetAppearance_clock');
    expect(result.accent).toBe('#ff0000');
  });

  it('unknown preset key returns false and makes no change', () => {
    const store = makeStore();
    const ret = applyWidgetStylePreset('clock', 'nonexistent', store);
    expect(ret).toBe(false);
    expect(store.get('widgetAppearance_clock')).toBeNull();
  });

  it('preset preserves existing appearance values not covered by preset', () => {
    const store = makeStore();
    store.set('widgetAppearance_clock', { opacity: 80, radius: 4, background: true, border: true, title: false, accent: '#aabbcc' });
    applyWidgetStylePreset('clock', 'plain', store);
    const result = store.get('widgetAppearance_clock');
    // plain overrides these
    expect(result.opacity).toBe(100);
    expect(result.radius).toBe(12);
    expect(result.background).toBe(false);
    expect(result.border).toBe(false);
    // title and accent are not in plain preset — preserved from existing
    expect(result.title).toBe(false);
    expect(result.accent).toBe('#aabbcc');
  });

  it('applies presets to multiple widgets independently', () => {
    const store = makeStore();
    applyWidgetStylePreset('clock', 'glass', store);
    applyWidgetStylePreset('search', 'terminal', store);
    applyWidgetStylePreset('bookmarks', 'compact', store);

    const clock = store.get('widgetAppearance_clock');
    const search = store.get('widgetAppearance_search');
    const bookmarks = store.get('widgetAppearance_bookmarks');

    expect(clock.opacity).toBe(100);
    expect(clock.accent).toBeUndefined();

    expect(search.accent).toBe('#00ff88');
    expect(search.opacity).toBe(95);

    expect(bookmarks.opacity).toBe(85);
    expect(bookmarks.border).toBe(false);
  });
});
