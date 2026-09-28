import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Source } from '../api/types';
import { parseAnswer, type Inline } from '../lib/answer';
import { displayUrl, highlightSegments, isOpenableUrl } from '../lib/format';
import { makeStyles, radius, space, text, useTheme } from '../theme';
import { Button } from './ui';

function openUrl(url: string): void {
  if (isOpenableUrl(url)) void Linking.openURL(url).catch(() => undefined);
}

// --------------------------------------------------------------------------
// Answers with citations
// --------------------------------------------------------------------------

interface RichAnswerProps {
  text: string;
  sourceCount: number;
  onCitePress?: (n: number) => void;
}

/** Renders a model answer natively, turning each [n] into a tappable citation. */
export function RichAnswer({ text: answer, sourceCount, onCitePress }: RichAnswerProps) {
  const s = useStyles();
  const blocks = useMemo(() => parseAnswer(answer), [answer]);

  const renderInline = (inline: Inline, key: number) => {
    if (inline.kind === 'cite') {
      const valid = inline.n >= 1 && inline.n <= sourceCount;
      return (
        <Text
          key={key}
          style={[s.cite, !valid && s.citeInvalid]}
          onPress={valid && onCitePress ? () => onCitePress(inline.n) : undefined}
          accessibilityRole={valid ? 'link' : undefined}
          accessibilityLabel={`Source ${inline.n}`}
          suppressHighlighting
        >
          {` ${inline.n} `}
        </Text>
      );
    }
    if (inline.kind === 'code') {
      return (
        <Text key={key} style={s.code}>
          {inline.text}
        </Text>
      );
    }
    return (
      <Text key={key} style={[inline.bold && s.bold, inline.italic && s.italic]}>
        {inline.text}
      </Text>
    );
  };

  return (
    <View style={s.answer}>
      {blocks.map((block, i) => {
        const inlines = block.inlines.map(renderInline);
        if (block.kind === 'heading') {
          return (
            <Text key={i} style={s.heading} accessibilityRole="header">
              {inlines}
            </Text>
          );
        }
        if (block.kind === 'item') {
          return (
            <View key={i} style={s.item}>
              <Text style={s.marker}>{block.marker}</Text>
              <Text style={[s.paragraph, s.flex]}>{inlines}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={s.paragraph} selectable>
            {inlines}
          </Text>
        );
      })}
    </View>
  );
}

// --------------------------------------------------------------------------
// Sources
// --------------------------------------------------------------------------

interface SourceListProps {
  sources: Source[];
  cited: number[];
  focused: number | null;
  onItemLayout?: (n: number, y: number) => void;
}

export function SourceList({ sources, cited, focused, onItemLayout }: SourceListProps) {
  const s = useStyles();
  const c = useTheme();
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  const toggle = (n: number) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <View style={s.sources}>
      {sources.map((source) => {
        const isCited = cited.includes(source.n);
        const isOpen = expanded.has(source.n) || focused === source.n;
        return (
          <View
            key={source.n}
            onLayout={(e) => onItemLayout?.(source.n, e.nativeEvent.layout.y)}
            style={[s.source, focused === source.n && s.sourceFocused, !isCited && s.sourceUncited]}
          >
            <Pressable
              onPress={() => toggle(source.n)}
              style={s.sourceHead}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`Source ${source.n}: ${source.title}${isCited ? '' : ', not cited'}`}
            >
              <View style={[s.badge, isCited && s.badgeCited]}>
                <Text style={[s.badgeText, isCited && s.badgeTextCited]}>{source.n}</Text>
              </View>
              <View style={s.flex}>
                <Text style={s.sourceTitle} numberOfLines={2}>
                  {source.title}
                </Text>
                <Text style={s.url} numberOfLines={1}>
                  {displayUrl(source.url)}
                  {isCited ? '' : '  ·  not cited'}
                </Text>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.textFaint} />
            </Pressable>
            {isOpen ? (
              <View style={s.sourceBody}>
                <Text style={s.excerpt} selectable>
                  {source.text.length > 900 ? `${source.text.slice(0, 900).trimEnd()}…` : source.text}
                </Text>
                {isOpenableUrl(source.url) ? (
                  <Button
                    title="Open page"
                    icon="open-outline"
                    variant="ghost"
                    compact
                    onPress={() => openUrl(source.url)}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// --------------------------------------------------------------------------
// Search results
// --------------------------------------------------------------------------

export function Highlighted({ value, query, numberOfLines }: {
  value: string;
  query: string;
  numberOfLines?: number;
}) {
  const s = useStyles();
  const segments = useMemo(() => highlightSegments(value, query), [value, query]);
  return (
    <Text style={s.snippet} numberOfLines={numberOfLines}>
      {segments.map((segment, i) => (
        <Text key={i} style={segment.match ? s.match : undefined}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

interface ResultCardProps {
  title: string;
  url: string;
  snippet: string;
  query: string;
  score?: number;
  fullText?: string;
  onPress?: () => void;
}

/**
 * One search hit. Index results expand to their full chunk; web results
 * (which carry no chunk text) open in the browser instead.
 */
export function ResultCard({ title, url, snippet, query, score, fullText, onPress }: ResultCardProps) {
  const s = useStyles();
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const expandable = Boolean(fullText);
  const handlePress = onPress ?? (expandable ? () => setOpen((v) => !v) : () => openUrl(url));

  return (
    <View style={s.result}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [s.resultHead, pressed && s.pressed]}
        accessibilityRole="button"
        accessibilityState={expandable ? { expanded: open } : undefined}
        accessibilityLabel={title}
      >
        <View style={s.resultTop}>
          <Text style={s.resultTitle} numberOfLines={2}>
            {title}
          </Text>
          {score !== undefined ? <Text style={s.score}>{score.toFixed(2)}</Text> : null}
        </View>
        <Text style={s.url} numberOfLines={1}>
          {displayUrl(url)}
        </Text>
        <Highlighted value={open && fullText ? fullText : snippet} query={query} numberOfLines={open ? undefined : 4} />
      </Pressable>
      {open ? (
        <View style={s.resultFoot}>
          {isOpenableUrl(url) ? (
            <Button title="Open page" icon="open-outline" variant="ghost" compact onPress={() => openUrl(url)} />
          ) : (
            <Text style={s.localNote}>Local file on your computer</Text>
          )}
          <Pressable onPress={() => setOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Collapse">
            <Ionicons name="chevron-up" size={18} color={c.textFaint} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const useStyles = makeStyles((c) => StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },

  answer: { gap: space.md },
  paragraph: { fontSize: text.body, lineHeight: 25, color: c.text },
  heading: { fontSize: text.h2, fontWeight: '700', color: c.text, marginTop: space.xs },
  item: { flexDirection: 'row', gap: space.sm, paddingLeft: space.xs },
  marker: { fontSize: text.body, lineHeight: 25, color: c.accent, fontWeight: '700', minWidth: 16 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: {
    fontFamily: 'monospace',
    fontSize: text.small,
    backgroundColor: c.surfaceAlt,
    color: c.text,
  },
  cite: {
    fontSize: text.tiny,
    fontWeight: '700',
    color: c.accent,
    backgroundColor: c.accentSoft,
  },
  citeInvalid: { color: c.textFaint, backgroundColor: c.surfaceAlt },

  sources: { gap: space.sm },
  source: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  sourceFocused: { borderColor: c.accent, borderWidth: 2 },
  sourceUncited: { opacity: 0.75 },
  sourceHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  sourceTitle: { fontSize: text.small, fontWeight: '600', color: c.text },
  sourceBody: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    gap: space.sm,
    alignItems: 'flex-start',
  },
  excerpt: { fontSize: text.small, lineHeight: 21, color: c.textMuted },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  badgeCited: { backgroundColor: c.accentSoft },
  badgeText: { fontSize: text.tiny, fontWeight: '700', color: c.textMuted },
  badgeTextCited: { color: c.accent },

  url: { fontSize: text.tiny, color: c.textFaint, marginTop: 2 },
  snippet: { fontSize: text.small, lineHeight: 21, color: c.textMuted },
  match: { color: c.text, fontWeight: '700', backgroundColor: c.highlight },

  result: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  resultHead: { padding: space.lg, gap: space.xs },
  resultTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  resultTitle: { flex: 1, fontSize: text.body, fontWeight: '700', color: c.text },
  score: {
    fontSize: text.tiny,
    color: c.textFaint,
    fontVariant: ['tabular-nums'],
    marginTop: 3,
  },
  resultFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  localNote: { fontSize: text.tiny, color: c.textFaint },
}));
