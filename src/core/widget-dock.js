export function getMinimizedWidgets(store) {
  return new Set(store.get('minimizedWidgets') ?? []);
}

export function setMinimizedWidgets(store, widgetsSet) {
  store.set('minimizedWidgets', [...widgetsSet]);
}

export function minimizeWidget(store, widgetId) {
  const minimized = getMinimizedWidgets(store);
  minimized.add(widgetId);
  setMinimizedWidgets(store, minimized);
}

export function restoreWidget(store, widgetId) {
  const minimized = getMinimizedWidgets(store);
  minimized.delete(widgetId);
  setMinimizedWidgets(store, minimized);
}
