export const TRACKING_PARAMS = new Set([
  'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
  'utm_id','fbclid','gclid','dclid','msclkid',
  '_ga','_gl',
]);

export function normalizeBookmarkUrl(raw) {
  let url;
  try { url = new URL(raw.startsWith('http') ? raw : 'https://' + raw); }
  catch { return raw; }
  const toDelete = [...url.searchParams.keys()].filter(k => TRACKING_PARAMS.has(k));
  toDelete.forEach(k => url.searchParams.delete(k));
  return url.toString();
}

export function isValidBookmarkUrl(url) {
  try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}
