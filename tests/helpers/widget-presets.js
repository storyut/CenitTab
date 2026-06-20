export const WIDGET_STYLE_PRESETS = {
  glass:    { opacity: 100, radius: 8,  background: true,  border: true  },
  compact:  { opacity: 85,  radius: 4,  background: true,  border: false },
  plain:    { opacity: 100, radius: 12, background: false, border: false },
  terminal: { opacity: 95,  radius: 0,  background: true,  border: true,  accent: '#00ff88' },
  cardless: { opacity: 100, radius: 0,  background: false, border: false },
};

function widgetAppearanceKey(id) { return `widgetAppearance_${id}`; }

export function applyWidgetStylePreset(widgetId, presetKey, store) {
  const preset = WIDGET_STYLE_PRESETS[presetKey];
  if (!preset) return false;
  const current = store.get(widgetAppearanceKey(widgetId)) ?? {};
  const next = {
    ...current,
    opacity: preset.opacity,
    radius: preset.radius,
    background: preset.background,
    border: preset.border,
    ...(preset.accent ? { accent: preset.accent } : {}),
  };
  store.set(widgetAppearanceKey(widgetId), next);
  return true;
}
