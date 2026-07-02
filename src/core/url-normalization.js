export const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
  'fbclid', 'gclid', 'dclid', 'msclkid', 'twclid', 'li_fat_id', 'mc_eid',
  '_ga', '_gl', 'ref', 'source',
]);

export function normalizeBookmarkUrl(raw) {
  let url;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return raw;
  }
  const toDelete = [...url.searchParams.keys()].filter((key) => TRACKING_PARAMS.has(key));
  toDelete.forEach((key) => url.searchParams.delete(key));
  return url.toString();
}

export function isValidBookmarkUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
