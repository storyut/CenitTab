export function getCollapsedSections(store) {
  return store.get('settingsCollapsed') ?? {};
}
export function toggleSection(store, key) {
  const state = store.get('settingsCollapsed') ?? {};
  state[key] = !state[key];
  store.set('settingsCollapsed', state);
  return state[key];
}
