import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import type { AskResponse } from '../../api/types';
import { RichAnswer, SourceList } from '../../components/content';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Header,
  Screen,
  SectionTitle,
  Waiting,
} from '../../components/ui';
import { citedNumbers, toPlainText } from '../../lib/answer';
import { useElapsed, useRequest } from '../../lib/hooks';
import { useConnection } from '../../state/connection';
import { makeStyles, space, text } from '../../theme';

export default function AskScreen() {
  const s = useStyles();
  const { api, status, stats } = useConnection();
  const [question, setQuestion] = useState('');
  const [smart, setSmart] = useState(false);
  const [focused, setFocused] = useState<number | null>(null);
  const ask = useRequest<AskResponse>();
  const elapsed = useElapsed(ask.state.status === 'loading' ? ask.state.startedAt : null);
  const llm = stats?.llm_available ?? false;

  const scrollRef = useRef<ScrollView>(null);
  const sourcesTop = useRef(0);
  const listTop = useRef(0);
  const sourceOffsets = useRef<Record<number, number>>({});

  const submit = () => {
    const q = question.trim();
    if (!q || !api) return;
    Keyboard.dismiss();
    setFocused(null);
    sourceOffsets.current = {};
    void ask.run((signal) => api.ask(q, llm && smart, signal));
  };

  const showSource = (n: number) => {
    setFocused(n);
    const offset = sourceOffsets.current[n];
    if (offset !== undefined) {
      const y = sourcesTop.current + listTop.current + offset - space.lg;
      scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
    }
  };

  const share = (result: AskResponse) => {
    const sources = result.sources.map((src) => `[${src.n}] ${src.title} - ${src.url}`).join('\n');
    void Share.share({
      message: `${result.question}\n\n${toPlainText(result.answer)}\n\nSources:\n${sources}`,
    }).catch(() => undefined);
  };

  if (!api) {
    return (
      <Screen>
        <Header title="Ask" />
        <EmptyState
          icon="server-outline"
          title="Connect to your computer"
          message="Answers are written from your own index, so the app needs your llmsearch server."
          action={{ label: 'Set up connection', onPress: () => router.navigate('/library') }}
        />
      </Screen>
    );
  }

  const state = ask.state;
  return (
    <Screen scrollRef={scrollRef}>
      <Header title="Ask" subtitle="Answers come only from your index, with sources." />

      <View style={s.controls}>
        <Field
          placeholder="Ask a question about your index"
          value={question}
          onChangeText={setQuestion}
          multiline
          submitBehavior="blurAndSubmit"
          returnKeyType="send"
          onSubmitEditing={submit}
          onKeyPress={Platform.OS === 'web' ? (event) => {
            // react-native-web ignores submitBehavior on multiline inputs:
            // Enter asks, Shift+Enter still starts a new line.
            const key = event.nativeEvent as { key: string; shiftKey?: boolean };
            if (key.key === 'Enter' && !key.shiftKey) {
              event.preventDefault();
              submit();
            }
          } : undefined}
          onClear={() => setQuestion('')}
          style={s.question}
        />
        <View style={s.row}>
          <Chip
            label="Smart retrieval"
            icon="sparkles-outline"
            selected={llm && smart}
            disabled={!llm}
            onPress={() => setSmart((v) => !v)}
          />
          <View style={s.flex} />
          <Button
            title="Ask"
            icon="arrow-up"
            onPress={submit}
            compact
            disabled={!question.trim() || !llm || state.status === 'loading'}
          />
        </View>
      </View>

      {status === 'online' && !llm ? (
        <Banner
          kind="notice"
          title="No LLM on the server"
          message="Asking needs Claude on your computer: an ANTHROPIC_API_KEY or a signed-in claude CLI. Search still works."
        />
      ) : null}

      {state.status === 'loading' ? (
        <Waiting
          label="Thinking"
          elapsedMs={elapsed}
          hint="Claude writes the answer on your computer from the best matching passages. This usually takes 10 to 60 seconds."
          onCancel={ask.cancel}
        />
      ) : null}

      {state.status === 'error' ? (
        state.error.code === 'no_context' ? (
          <Banner
            kind="notice"
            title="Nothing to answer from"
            message="Your index has nothing relevant to this question yet."
            action={{ label: 'Crawl a site', onPress: () => router.navigate('/library') }}
          />
        ) : (
          <Banner
            title={state.error.code === 'llm_unavailable' ? 'The model is unavailable' : 'Could not answer'}
            message={state.error.message}
            action={{ label: 'Try again', onPress: submit }}
          />
        )
      ) : null}

      {state.status === 'done' ? (
        <>
          <Card>
            <Text style={s.asked} numberOfLines={3}>
              {state.data.question}
            </Text>
            <RichAnswer
              text={state.data.answer}
              sourceCount={state.data.sources.length}
              onCitePress={showSource}
            />
            <View style={s.actions}>
              <Button title="Share" icon="share-outline" variant="ghost" compact onPress={() => share(state.data)} />
            </View>
          </Card>

          {/* Scrolling to a citation adds up three measured offsets: this section
              within the page, the list within the section, the item within the list. */}
          <View onLayout={(e) => (sourcesTop.current = e.nativeEvent.layout.y)} style={s.sources}>
            <SectionTitle>Sources</SectionTitle>
            <View onLayout={(e) => (listTop.current = e.nativeEvent.layout.y)}>
              <SourceList
                sources={state.data.sources}
                cited={citedNumbers(state.data.answer)}
                focused={focused}
                onItemLayout={(n, y) => (sourceOffsets.current[n] = y)}
              />
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  flex: { flex: 1 },
  controls: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  question: { minHeight: 72, textAlignVertical: 'top' },
  asked: { fontSize: text.small, fontWeight: '600', color: c.textMuted },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  sources: { gap: space.sm },
}));
