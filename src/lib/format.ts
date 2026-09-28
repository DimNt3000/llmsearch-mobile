/**
 * Small, pure helpers for turning server data into display text.
 *
 * They avoid `URL`, `URLSearchParams`, and `Intl`, whose React Native
 * implementations are incomplete under Hermes, and have no imports so they
 * can be unit-tested with plain `node --test`.
 */

/** Accepts what people actually type ("192.168.1.19:8765", "http://host:8765/api/"). */
export function normalizeBaseUrl(input: string): string {
  let url = input.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/api$/i, '');
  return url;
}

/** A crawl target as typed on a phone: "docs.python.org/3" becomes https://docs.python.org/3. */
export function withScheme(input: string): string {
  const url = input.trim();
  if (!url) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
}

/** True for http(s) URLs with a plausible host, the only kind a crawl accepts. */
export function isCrawlableUrl(url: string): boolean {
  return /^https?:\/\/[^\s/?#]+\.[^\s/?#]+|^https?:\/\/(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(url);
}

export function isOpenableUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** A readable, short form of a result's address: host and path for the web,
 *  the tail of the path for local files. */
export function displayUrl(url: string, max = 60): string {
  let shown: string;
  const web = /^https?:\/\/(?:www\.)?([^/?#]+)([^?#]*)/i.exec(url);
  if (web) {
    shown = web[1] + (web[2] === '/' ? '' : safeDecode(web[2]).replace(/\/$/, ''));
  } else if (/^file:\/\//i.test(url)) {
    const parts = safeDecode(url.replace(/^file:\/\/\/?/i, '')).split('/').filter(Boolean);
    shown = parts.slice(-2).join('/');
  } else {
    shown = url;
  }
  return shown.length > max ? `${shown.slice(0, max - 1)}…` : shown;
}

/** Elapsed time as m:ss, formatted by hand because Hermes lacks full Intl. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export function queryTerms(query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/[\s.,;:!?()[\]{}"'«»“”‘’/\\|<>+=*&^%$#@~`-]+/)
    .filter((term) => term.length >= 2);
  return [...new Set(terms)];
}

export interface Segment {
  text: string;
  match: boolean;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits `text` into runs, marking the ones that match a query term. */
export function highlightSegments(text: string, query: string): Segment[] {
  const terms = queryTerms(query).sort((a, b) => b.length - a.length);
  if (!terms.length || !text) return text ? [{ text, match: false }] : [];
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  const segments: Segment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), match: false });
    segments.push({ text: match[0], match: true });
    last = pattern.lastIndex;
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false });
  return segments;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
