export function makeStore() {
  const data = {};
  return {
    get: (key) => { try { return JSON.parse(data[key] ?? 'null'); } catch { return null; } },
    set: (key, val) => { data[key] = JSON.stringify(val); },
    clear: () => Object.keys(data).forEach(k => delete data[k]),
  };
}
