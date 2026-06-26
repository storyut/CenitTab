# CenitTab Features Plan

## Global Constraints

- Chrome Extension MV3, no build step, vanilla JS + HTML + CSS only
- All code in `app.js`, `newtab.html`, `style.css` (no module bundler)
- Storage via `localStorage` through the existing `Store` helper
- `showToast(text, undoFn?)` is the notification primitive — use it
- No external runtime dependencies (icons, fonts via CDN only)
- Unit tests use Vitest (pure function extraction to `tests/` directory)
- Playwright e2e tests load `newtab.html` as a local file in browser context
- Every task must commit its implementation + tests separately

## Task 1: Test Infrastructure Setup

Set up Vitest for unit tests and Playwright for browser e2e tests.

### Deliverables
- `package.json` with vitest + @playwright/test dev dependencies
- `vitest.config.js`
- `playwright.config.js` pointing at `newtab.html` (file:// or local server)
- `tests/` directory with a trivial smoke test to prove the harness works
- `.gitignore` entry for `node_modules/`
- All tests passing

### Notes
- Unit tests target pure functions extracted from app.js (or tested via import)
- Since app.js is not a module, test helpers go in `tests/helpers/` that re-implement or extract logic
- Playwright tests load `file:///path/to/newtab.html` directly

---

## Task 2: Widget Style Presets

Add one-click style presets per widget: Glass (current default), Compact, Plain, Terminal, Cardless.

### Deliverables
- Preset picker UI in the Widget Customization section of Settings
- 5 presets: Glass, Compact, Plain, Terminal, Cardless
- Each preset sets opacity, radius, glass bg, border, and accent color atomically
- "Apply to all widgets" button applies selected preset to every widget
- Presets stored as constants in app.js (not persisted separately)
- Unit tests for preset application logic
- Playwright test: open settings, apply Terminal preset to Clock widget, verify style

### Preset Definitions
```
Glass:    opacity 100, radius 8, glassBg true,  border true,  accent unchanged
Compact:  opacity 85,  radius 4, glassBg true,  border false, accent unchanged
Plain:    opacity 100, radius 12, glassBg false, border false, accent unchanged
Terminal: opacity 95,  radius 0, glassBg true,  border true,  accent #00ff88
Cardless: opacity 100, radius 0, glassBg false, border false, accent unchanged
```

---

## Task 3: Import Validation

Make settings import safer with shape validation and a preview step.

### Deliverables
- Validate imported JSON: only accept known Cenit keys (whitelist)
- Validate value shapes (bookmarks must be array, themes must be array, etc.)
- Show a preview modal before writing: "X bookmarks, Y notes, Z themes will be imported"
- "Import All" and "Cancel" buttons in the preview
- Warn if the backup looks like it came from an unknown/future version
- Unit tests for the validation logic
- Playwright test: import a valid backup, verify preview appears; import garbage JSON, verify error toast

---

## Task 4: Versioned Settings Migrations

Add schema versioning to protect against future breaking changes.

### Deliverables
- `SETTINGS_VERSION = 2` constant (current schema is now v2)
- `settingsVersion` key written to localStorage on every save/export
- `runMigrations(storedVersion)` function that runs upgrade steps sequentially
- Migration v1→v2: normalize bookmark folder IDs (existing data assumed v1)
- `runMigrations` called on page load before anything else reads storage
- Unit tests for each migration step
- Playwright test: simulate v1 data in localStorage, reload page, verify migration ran

---

## Task 5: Smart Bookmark Inbox (URL Normalization + Validation)

Complete the smart bookmark inbox with URL normalization and validation.

### Deliverables
- Strip common tracking params before saving (utm_*, fbclid, gclid)
- Normalize trailing slashes (strip trailing slash from path-only URLs)
- Warn with toast when entered URL looks invalid (no TLD, clearly malformed)
- Already-implemented duplicate check remains; update it to compare normalized URLs
- Unit tests for URL normalization and validation
- Playwright test: enter URL with utm params, verify saved URL is clean

---

## Task 6: Command Palette

Add a Ctrl+K / Cmd+K command palette that launches bookmarks, notes, search, themes, and layout profiles.

### Deliverables
- `<div id="cmd-palette">` overlay with backdrop, input, and results list
- Keyboard shortcut: Ctrl+K (Cmd+K on Mac) to open; Escape to close
- Commands include:
  - All bookmarks (open in new tab)
  - All notes (switch active note)
  - All themes (apply theme)
  - All layout profiles (load profile)
  - "Search web for …" (submits search)
  - "New note"
  - "Open Settings" / "Open Background" / "Open Bookmarks" / "Open Layout"
- Fuzzy filter: type to filter, arrow keys to navigate, Enter to execute
- CSS: dark glass overlay, prominent input, highlighted active item
- Unit tests for the fuzzy filter and command-building logic
- Playwright test: open palette with Ctrl+K, type "note", verify note commands appear, press Enter

---

## Task 7: Better Settings Organization

Reorganize the settings panel into clearly labeled collapsible sections.

### Deliverables
- 6 sections: Appearance, Widgets, Search, Layout, Data, Advanced
- Each section has a clickable header that collapses/expands its content
- Collapsed state persisted in localStorage (`settingsCollapsed`)
- Settings search (#20, already implemented) still works across sections
- No settings removed, reordered within sections only
- CSS: section header with chevron indicator
- Playwright test: collapse Appearance section, reload page, verify still collapsed

---

## Task 8: Widget Dock

Add a dock where minimized widgets live as icons.

### Deliverables
- "Minimize" button added to each widget (visible in layout mode)
- Minimized widgets appear as small icon-buttons in a floating dock (bottom-center by default)
- Clicking a dock icon restores the widget
- Dock position: bottom-center; auto-hides when empty
- Dock position persisted in localStorage (`widgetDockPosition`)
- `minimizedWidgets` set persisted in localStorage
- CSS: dock bar, dock icon buttons, minimize button on widget
- Unit tests for minimize/restore logic
- Playwright test: enter layout mode, minimize Clock widget, verify it appears in dock, click to restore

---

## Suggested Build Order

1. Test Infrastructure (Task 1)
2. Versioned Settings Migrations (Task 4) — foundational, affects others
3. Import Validation (Task 3) — builds on migration versioning
4. Smart Bookmark Inbox (Task 5) — small, self-contained
5. Widget Style Presets (Task 2) — visual, self-contained
6. Better Settings Organization (Task 7) — restructures HTML
7. Command Palette (Task 6) — largest, benefits from stable settings structure
8. Widget Dock (Task 8) — independent, last because it adds new UI layer
