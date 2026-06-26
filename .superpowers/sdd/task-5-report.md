# Task 5 Report — Widget Style Presets

## Status
COMPLETE

## Commit Hash
d0e6006

## Test Summary
47 tests passed (5 test files) — 11 new tests in `tests/unit/widget-presets.test.js`

## What Was Done

1. **app.js** — Added `WIDGET_STYLE_PRESETS` constant and `applyWidgetStylePreset(widgetId, presetKey)` function above the Per-widget Appearance section. Added preset button event wiring after `bindWidgetAppearanceControls()`.

2. **newtab.html** — Inserted "Style Preset" label, `.widget-preset-row` with 5 preset buttons (Glass/Compact/Plain/Terminal/Cardless), and "Apply to All Widgets" button after the settings-help paragraph in the Widget Customization section.

3. **style.css** — Appended `.widget-preset-row` and `.widget-preset-btn` styles at end of file.

4. **tests/helpers/widget-presets.js** — Standalone helper with `WIDGET_STYLE_PRESETS` and `applyWidgetStylePreset` (store-injected, no DOM dependency).

5. **tests/unit/widget-presets.test.js** — 11 tests covering all required cases.

## Concerns / Deviations from Spec

- **`glassBg` → `background`**: The spec used `glassBg` as the field name, but the actual codebase uses `background` (as seen in `WIDGET_APPEARANCE_DEFAULTS`). The implementation uses `background` to match the real code.
- **Storage pattern**: The spec showed `Store.get('widgetAppearance')` as a single object keyed by widget ID, but the real code uses per-widget keys (`widgetAppearance_${id}`). The implementation follows the actual storage pattern.
- **`syncWidgetAppearanceControls` → `loadWidgetAppearanceControls`**: The spec referenced a function that doesn't exist; the correct existing function is `loadWidgetAppearanceControls`.
- **`applyWidgetStylePreset` in app.js**: Must be defined after `widgetAppearanceKey` (line ~1546) so it can reference it — placed just before `WIDGET_APPEARANCE_DEFAULTS` which is correct.
- The test helper uses `undefined` (not present) for `accent` when a non-terminal preset is applied to a widget with no prior accent, matching the spread behavior. The "apply to multiple widgets independently" test verifies `clock.accent` is `undefined` (not set) after applying glass.
