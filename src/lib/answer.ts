/**
 * Turns a model answer into blocks the UI can render natively.
 *
 * Answers arrive as light Markdown with inline `[n]` citations. Rather than
 * pull in a Markdown renderer, this handles the subset the server's prompts
 * produce: paragraphs, bullet and numbered lists, headings, bold, italics,
 * inline code, and citations, which become tappable chips.
 *
 * Kept free of imports so it can be unit-tested with plain `node --test`.
 */

export type Inline =
  | { kind: 'text'; text: string; bold?: boolean; italic?: boolean }
  | { kind: 'code'; text: string }
  | { kind: 'cite'; n: number };

export type Block =
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'heading'; inlines: Inline[] }
  | { kind: 'item'; marker: string; inlines: Inline[] };

interface Style {
  bold?: boolean;
  italic?: boolean;
}

function pushText(out: Inline[], text: string, style: Style): void {
  if (!text) return;
  const node: Inline = { kind: 'text', text };
  if (style.bold) node.bold = true;
  if (style.italic) node.italic = true;
  out.push(node);
}

export function parseInline(text: string, style: Style = {}): Inline[] {
  // A fresh RegExp per call keeps the recursive calls from sharing lastIndex.
  const pattern =
    /\*\*(.+?)\*\*|\*([^\s*](?:[^*]*[^\s*])?)\*|`([^`]+)`|\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g;
  const out: Inline[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    pushText(out, text.slice(last, match.index), style);
    if (match[1] !== undefined) {
      out.push(...parseInline(match[1], { ...style, bold: true }));
    } else if (match[2] !== undefined) {
      out.push(...parseInline(match[2], { ...style, italic: true }));
    } else if (match[3] !== undefined) {
      out.push({ kind: 'code', text: match[3] });
    } else if (match[4] !== undefined) {
      for (const n of match[4].split(',')) out.push({ kind: 'cite', n: Number(n.trim()) });
    }
    last = pattern.lastIndex;
  }
  pushText(out, text.slice(last), style);
  return out;
}

export function parseAnswer(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      blocks.push({ kind: 'paragraph', inlines: parseInline(paragraph.join(' ')) });
      paragraph = [];
    }
  };

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    const bullet = /^[-*•]\s+(.+)$/.exec(line);
    const numbered = /^(\d{1,3})[.)]\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: 'heading', inlines: parseInline(heading[1]) });
    } else if (bullet) {
      flush();
      blocks.push({ kind: 'item', marker: '•', inlines: parseInline(bullet[1]) });
    } else if (numbered) {
      flush();
      blocks.push({ kind: 'item', marker: `${numbered[1]}.`, inlines: parseInline(numbered[2]) });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** Source numbers the answer actually cites, ascending and without repeats. */
export function citedNumbers(text: string): number[] {
  const found = new Set<number>();
  for (const block of parseAnswer(text)) {
    for (const inline of block.inlines) {
      if (inline.kind === 'cite') found.add(inline.n);
    }
  }
  return [...found].sort((a, b) => a - b);
}

/** Plain-text version for sharing: Markdown markers removed, citations kept. */
export function toPlainText(text: string): string {
  let out = '';
  let previous: Block['kind'] | null = null;
  for (const block of parseAnswer(text)) {
    const body = block.inlines
      .map((inline) => (inline.kind === 'cite' ? `[${inline.n}]` : inline.text))
      .join('');
    if (previous !== null) out += previous === 'item' && block.kind === 'item' ? '\n' : '\n\n';
    out += block.kind === 'item' ? `${block.marker} ${body}` : body;
    previous = block.kind;
  }
  return out;
}
