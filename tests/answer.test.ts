import assert from 'node:assert/strict';
import { test } from 'node:test';

import { citedNumbers, parseAnswer, parseInline, toPlainText } from '../src/lib/answer.ts';

test('plain text stays a single text run', () => {
  assert.deepEqual(parseInline('no markup here'), [{ kind: 'text', text: 'no markup here' }]);
});

test('citations become cite nodes, including comma lists', () => {
  assert.deepEqual(parseInline('BM25 saturates [1] and normalizes [2, 3].'), [
    { kind: 'text', text: 'BM25 saturates ' },
    { kind: 'cite', n: 1 },
    { kind: 'text', text: ' and normalizes ' },
    { kind: 'cite', n: 2 },
    { kind: 'cite', n: 3 },
    { kind: 'text', text: '.' },
  ]);
});

test('adjacent citations stay separate', () => {
  const kinds = parseInline('claim [1][3]').filter((i) => i.kind === 'cite');
  assert.deepEqual(kinds, [{ kind: 'cite', n: 1 }, { kind: 'cite', n: 3 }]);
});

test('bold, italic, and code are recognized', () => {
  assert.deepEqual(parseInline('**b** *i* `c`'), [
    { kind: 'text', text: 'b', bold: true },
    { kind: 'text', text: ' ' },
    { kind: 'text', text: 'i', italic: true },
    { kind: 'text', text: ' ' },
    { kind: 'code', text: 'c' },
  ]);
});

test('citations inside bold text are still citations', () => {
  assert.deepEqual(parseInline('**length normalization [1]**'), [
    { kind: 'text', text: 'length normalization ', bold: true },
    { kind: 'cite', n: 1 },
  ]);
});

test('a lone asterisk is not treated as markup', () => {
  assert.deepEqual(parseInline('5 * 3 = 15'), [{ kind: 'text', text: '5 * 3 = 15' }]);
});

test('bracketed words are not mistaken for citations', () => {
  assert.deepEqual(parseInline('see [note] and [12a]'), [
    { kind: 'text', text: 'see [note] and [12a]' },
  ]);
});

test('paragraphs, bullets, numbered items, and headings become blocks', () => {
  const blocks = parseAnswer('## Summary\n\nFirst line\ncontinues here.\n\n- one [1]\n* two\n1. three\n2) four');
  assert.deepEqual(blocks.map((b) => b.kind), ['heading', 'paragraph', 'item', 'item', 'item', 'item']);
  assert.deepEqual(blocks[1], {
    kind: 'paragraph',
    inlines: [{ kind: 'text', text: 'First line continues here.' }],
  });
  assert.deepEqual(
    blocks.slice(2).map((b) => (b.kind === 'item' ? b.marker : '')),
    ['•', '•', '1.', '2.'],
  );
});

test('an italic phrase at the start of a line is not a bullet', () => {
  const [block] = parseAnswer('*Note:* this matters');
  assert.equal(block.kind, 'paragraph');
});

test('Windows line endings are handled', () => {
  assert.equal(parseAnswer('a\r\n\r\nb').length, 2);
});

test('citedNumbers lists each cited source once, in order', () => {
  assert.deepEqual(citedNumbers('x [3] y [1] z [3]\n- w [2, 1]'), [1, 2, 3]);
  assert.deepEqual(citedNumbers('no citations'), []);
});

test('toPlainText strips markup but keeps citations and list structure', () => {
  assert.equal(
    toPlainText('**BM25** ranks [1].\n\n- one\n- two'),
    'BM25 ranks [1].\n\n• one\n• two',
  );
});

test('empty input yields no blocks', () => {
  assert.deepEqual(parseAnswer(''), []);
  assert.deepEqual(parseAnswer('  \n \n'), []);
});
