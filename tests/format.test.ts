import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  displayUrl,
  formatElapsed,
  highlightSegments,
  isCrawlableUrl,
  isOpenableUrl,
  normalizeBaseUrl,
  plural,
  queryTerms,
  withScheme,
} from '../src/lib/format.ts';

test('withScheme adds https only when no scheme is present', () => {
  assert.equal(withScheme('docs.python.org/3/tutorial/'), 'https://docs.python.org/3/tutorial/');
  assert.equal(withScheme(' http://example.com '), 'http://example.com');
  assert.equal(withScheme('ftp://example.com'), 'ftp://example.com');
  assert.equal(withScheme(''), '');
});

test('isCrawlableUrl accepts real hosts and rejects the rest', () => {
  assert.equal(isCrawlableUrl('https://docs.python.org/3/'), true);
  assert.equal(isCrawlableUrl('http://192.168.1.10:8000/'), true);
  assert.equal(isCrawlableUrl('http://localhost:3000'), true);
  assert.equal(isCrawlableUrl('https://nohost'), false);
  assert.equal(isCrawlableUrl('ftp://example.com'), false);
  assert.equal(isCrawlableUrl('https://'), false);
});

test('normalizeBaseUrl accepts what people type', () => {
  assert.equal(normalizeBaseUrl('192.168.1.19:8765'), 'http://192.168.1.19:8765');
  assert.equal(normalizeBaseUrl('  http://host:8765/ '), 'http://host:8765');
  assert.equal(normalizeBaseUrl('http://host:8765/api/'), 'http://host:8765');
  assert.equal(normalizeBaseUrl('HTTPS://host'), 'HTTPS://host');
  assert.equal(normalizeBaseUrl('   '), '');
});

test('isOpenableUrl only allows the web', () => {
  assert.equal(isOpenableUrl('https://example.com'), true);
  assert.equal(isOpenableUrl('http://example.com'), true);
  assert.equal(isOpenableUrl('file:///C:/docs/a.md'), false);
  assert.equal(isOpenableUrl('javascript:alert(1)'), false);
});

test('displayUrl shortens web addresses', () => {
  assert.equal(displayUrl('https://www.example.com/'), 'example.com');
  assert.equal(displayUrl('https://en.wikipedia.org/wiki/Okapi_BM25'), 'en.wikipedia.org/wiki/Okapi_BM25');
  assert.equal(displayUrl('https://example.com/a/b/?q=1#x'), 'example.com/a/b');
});

test('displayUrl shows the tail of a local file path, decoded', () => {
  assert.equal(
    displayUrl('file:///C:/Users/dimit/OneDrive/%CE%A5%CF%80%CE%BF/llm-search-engine/samples/bm25.md'),
    'samples/bm25.md',
  );
});

test('displayUrl survives malformed percent-encoding and truncates long input', () => {
  assert.equal(displayUrl('file:///x/%E0%A4%A.md'), 'x/%E0%A4%A.md');
  const long = displayUrl(`https://example.com/${'a'.repeat(100)}`, 30);
  assert.equal(long.length, 30);
  assert.ok(long.endsWith('…'));
});

test('formatElapsed formats minutes and seconds', () => {
  assert.equal(formatElapsed(0), '0:00');
  assert.equal(formatElapsed(7_400), '0:07');
  assert.equal(formatElapsed(65_000), '1:05');
  assert.equal(formatElapsed(-50), '0:00');
});

test('queryTerms lowercases, splits on punctuation, dedupes, and drops single letters', () => {
  assert.deepEqual(queryTerms('BM25, the b-parameter? b'), ['bm25', 'the', 'parameter']);
  assert.deepEqual(queryTerms('Μηχανή αναζήτησης'), ['μηχανή', 'αναζήτησης']);
});

test('highlightSegments marks query matches case-insensitively', () => {
  assert.deepEqual(highlightSegments('Inverted index and INDEXES', 'index'), [
    { text: 'Inverted ', match: false },
    { text: 'index', match: true },
    { text: ' and ', match: false },
    { text: 'INDEX', match: true },
    { text: 'ES', match: false },
  ]);
});

test('highlightSegments prefers the longer of overlapping terms', () => {
  const matches = highlightSegments('ranking functions', 'rank ranking')
    .filter((s) => s.match)
    .map((s) => s.text);
  assert.deepEqual(matches, ['ranking']);
});

test('highlightSegments treats regex characters in the query literally', () => {
  assert.deepEqual(highlightSegments('a+b and (c)', 'a+b (c)'), [
    { text: 'a+b and (c)', match: false },
  ]);
  assert.doesNotThrow(() => highlightSegments('text', '[(*'));
});

test('highlightSegments handles empty inputs', () => {
  assert.deepEqual(highlightSegments('', 'x'), []);
  assert.deepEqual(highlightSegments('abc', ''), [{ text: 'abc', match: false }]);
});

test('plural picks the right form', () => {
  assert.equal(plural(1, 'page'), '1 page');
  assert.equal(plural(3, 'page'), '3 pages');
  assert.equal(plural(0, 'query', 'queries'), '0 queries');
});
