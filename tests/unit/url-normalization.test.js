import { describe, it, expect } from 'vitest';
import { normalizeBookmarkUrl, isValidBookmarkUrl } from '../helpers/url-normalization.js';

describe('normalizeBookmarkUrl', () => {
  it('strips utm_source, utm_medium, utm_campaign', () => {
    const raw = 'https://example.com/page?utm_source=newsletter&utm_medium=email&utm_campaign=spring';
    expect(normalizeBookmarkUrl(raw)).toBe('https://example.com/page');
  });

  it('strips fbclid', () => {
    const raw = 'https://example.com/?fbclid=IwAR1abc123';
    expect(normalizeBookmarkUrl(raw)).toBe('https://example.com/');
  });

  it('strips gclid', () => {
    const raw = 'https://example.com/landing?gclid=abc123xyz';
    expect(normalizeBookmarkUrl(raw)).toBe('https://example.com/landing');
  });

  it('strips _ga and _gl', () => {
    const raw = 'https://example.com/?_ga=2.123456.789&_gl=abcdef';
    expect(normalizeBookmarkUrl(raw)).toBe('https://example.com/');
  });

  it('strips multiple tracking params but preserves non-tracking query params', () => {
    const raw = 'https://example.com/search?q=test&utm_source=google&page=2';
    const result = normalizeBookmarkUrl(raw);
    expect(result).toContain('q=test');
    expect(result).toContain('page=2');
    expect(result).not.toContain('utm_source');
  });

  it('preserves non-tracking query params unchanged', () => {
    const raw = 'https://example.com/search?q=test&lang=en';
    expect(normalizeBookmarkUrl(raw)).toBe('https://example.com/search?q=test&lang=en');
  });

  it('handles URLs without query params unchanged', () => {
    const raw = 'https://example.com/about';
    expect(normalizeBookmarkUrl(raw)).toBe('https://example.com/about');
  });

  it('handles bare domain by prepending https://', () => {
    const raw = 'example.com/page';
    expect(normalizeBookmarkUrl(raw)).toBe('https://example.com/page');
  });

  it('handles malformed input gracefully by returning as-is', () => {
    const raw = 'not a url at all !!!';
    expect(normalizeBookmarkUrl(raw)).toBe(raw);
  });

  it('handles empty string gracefully', () => {
    // empty string: new URL('https://') throws, so returns as-is
    const raw = '';
    expect(normalizeBookmarkUrl(raw)).toBe(raw);
  });

  it('strips utm_term and utm_content', () => {
    const raw = 'https://example.com/?utm_term=shoes&utm_content=banner_ad';
    expect(normalizeBookmarkUrl(raw)).toBe('https://example.com/');
  });

  it('strips msclkid and dclid', () => {
    const raw = 'https://example.com/?msclkid=abc&dclid=xyz&id=42';
    const result = normalizeBookmarkUrl(raw);
    expect(result).not.toContain('msclkid');
    expect(result).not.toContain('dclid');
    expect(result).toContain('id=42');
  });
});

describe('isValidBookmarkUrl', () => {
  it('accepts http URLs', () => {
    expect(isValidBookmarkUrl('http://example.com')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(isValidBookmarkUrl('https://example.com/page?q=1')).toBe(true);
  });

  it('rejects file:// URLs', () => {
    expect(isValidBookmarkUrl('file:///home/user/doc.html')).toBe(false);
  });

  it('rejects ftp:// URLs', () => {
    expect(isValidBookmarkUrl('ftp://files.example.com')).toBe(false);
  });

  it('rejects bare domains (no protocol)', () => {
    expect(isValidBookmarkUrl('example.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidBookmarkUrl('')).toBe(false);
  });

  it('rejects javascript: protocol', () => {
    expect(isValidBookmarkUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: URLs', () => {
    expect(isValidBookmarkUrl('data:text/html,<h1>hi</h1>')).toBe(false);
  });
});
