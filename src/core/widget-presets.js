export const WIDGET_STYLE_PRESETS = {
  glass: { opacity: 100, radius: 8, background: true, border: true },
  compact: { opacity: 85, radius: 4, background: true, border: false },
  plain: { opacity: 100, radius: 12, background: false, border: false },
  terminal: { opacity: 95, radius: 0, background: true, border: true, accent: '#00ff88' },
  cardless: { opacity: 100, radius: 0, background: false, border: false },
};

export function widgetAppearanceKey(widgetId) {
  return `widgetAppearance_${widgetId}`;
}

export function applyWidgetStylePreset(widgetId, presetKey, store, keyBuilder = widgetAppearanceKey) {
  const preset = WIDGET_STYLE_PRESETS[presetKey];
  if (!preset) return false;

  const key = keyBuilder(widgetId);
  const current = store.get(key) ?? {};
  const next = {
    ...current,
    opacity: preset.opacity,
    radius: preset.radius,
    background: preset.background,
    border: preset.border,
    ...(preset.accent ? { accent: preset.accent } : {}),
  };
  store.set(key, next);
  return true;
}
