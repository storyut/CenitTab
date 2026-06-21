export function getMinimizedWidgets(store) {
  return new Set(store.get('minimizedWidgets') ?? []);
}
export function setMinimizedWidgets(store, set) {
  store.set('minimizedWidgets', [...set]);
}
export function minimizeWidget(store, widgetId) {
  const m = getMinimizedWidgets(store);
  m.add(widgetId);
  setMinimizedWidgets(store, m);
}
export function restoreWidget(store, widgetId) {
  const m = getMinimizedWidgets(store);
  m.delete(widgetId);
  setMinimizedWidgets(store, m);
}
