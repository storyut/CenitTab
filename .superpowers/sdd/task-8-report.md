# Task 8 Report — Widget Dock

## Status
COMPLETE

## Commit
7057622 — feat: add widget dock for minimizing widgets

## Test Summary
74 passed (74) across 8 test files — 6 new widget-dock tests all green.

## What Was Done

1. **newtab.html** — added `<div id="widget-dock" class="widget-dock" hidden></div>` before `<script src="app.js">`.

2. **style.css** — appended Widget Dock section: `.widget-dock`, `.widget-dock[hidden]`, `.dock-icon`, `.dock-icon:hover`, `.widget-minimize-btn`, `.widget-minimize-btn:hover`, `.layout-mode .widget .widget-minimize-btn`.

3. **app.js** — appended `// ─── Widget Dock ───` section at end of file with `getMinimizedWidgets`, `setMinimizedWidgets`, `minimizeWidget`, `restoreWidget`, `renderWidgetDock`, `addMinimizeButtons`, and init block. No changes needed to `setLayoutMode` — it already calls `document.body.classList.toggle('layout-mode', on)` at line 2113.

4. **tests/helpers/widget-dock.js** — helper with pure store-based implementations of the four dock functions.

5. **tests/unit/widget-dock.test.js** — 6 unit tests covering: initial empty state, minimize adds, restore removes, double-minimize no-op, multiple widgets, restore non-minimized no-op.

## Concerns
None. The `layout-mode` body class was already wired up; no rework needed. The dock persists minimized state via `Store` (localStorage), so minimized widgets survive page reload.
