/**
 * Shared storage wrapper around localStorage.
 * Provides a consistent interface for reading/writing JSON-serialized values.
 */
export const Store = {
  get: (key) => {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null'); }
    catch { return null; }
  },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
};

/**
 * Safely set a value in the store, retrying after clearing the key on quota errors.
 */
export function setStoredValue(key, value) {
  try { Store.set(key, value); }
  catch (err) {
    localStorage.removeItem(key);
    Store.set(key, value);
  }
}
