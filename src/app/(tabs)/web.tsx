import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, Text, View } from 'react-native';

import type { WebAskResponse, WebResponse } from '../../api/types';
import { ResultCard, RichAnswer, SourceList } from '../../components/content';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Header,
  Screen,
  SectionTitle,
  Waiting,
} from '../../components/ui';
import { citedNumbers } from '../../lib/answer';
import { displayUrl, plural } from '../../lib/format';
import { useElapsed, useRequest } from '../../lib/hooks';
import { useConnection } from '../../state/connection';
import { makeStyles, space, text, useTheme } from '../../theme';

type Mode = 'results' | 'answer';

export default function WebScreen() {
  const s = useStyles();
  const c = useTheme();
  const { api, stats } = useConnection();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<Mode>('results');
  const [focused, setFocused] = useState<number | null>(null);
  const results = useRequest<WebResponse>();
  const answer = useRequest<WebAskResponse>();
  const elapsed = useElapsed(answer.state.status === 'loading' ? answer.state.startedAt : null);
  const llm = stats?.llm_available ?? false;

  const searchWeb = () => {
    const q = query.trim();
    if (!q || !api) return;
    Keyboard.dismiss();
    setView('results');
    answer.cancel();
    void results.run((signal) => api.web(q, undefined, signal));
  };

  const answerFromWeb = () => {
    const q = query.trim();
    if (!q || !api) return;
    Keyboard.dismiss();
    setView('answer');
    setFocused(null);
    results.cancel();
    void answer.run((signal) => api.webAsk(q, signal));
  };

  if (!api) {
    return (
      <Screen>
        <Header title="Web" />
        <EmptyState
          icon="server-outline"
          title="Connect to your computer"
          message="Web searches run through your llmsearch server, so connect it first."
          action={{ label: 'Set up connection', onPress: () => router.navigate('/library') }}
        />
      </Screen>
    );
  }

  const r = results.state;
  const a = answer.state;
  return (
    <Screen>
      <Header title="Web" subtitle="Live DuckDuckGo search, run by your computer." />

      <View style={s.controls}>
        <Field
          icon="globe-outline"
          placeholder="Search the web"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={searchWeb}
          returnKeyType="search"
          onClear={() => setQuery('')}
        />
        <View style={s.row}>
          <View style={s.flex}>
            <Button title="Search" icon="search" variant="secondary" onPress={searchWeb} disabled={!query.trim()} />
          </View>
          <View style={s.flex}>
            <Button
              title="Answer"
              icon="sparkles"
              onPress={answerFromWeb}
              disabled={!query.trim() || !llm || a.status === 'loading'}
            />
          </View>
        </View>
        <Text style={s.hint}>
          {llm
            ? 'Answer reads the top pages and has Claude answer from them, with sources.'
            : 'Answer needs an LLM backend on the server; Search works without one.'}
        </Text>
      </View>

      {view === 'results' ? (
        <>
          {r.status === 'loading' ? <ActivityIndicator color={c.accent} style={s.spinner} /> : null}
          {r.status === 'error' ? (
            <Banner title="Web search failed" message={r.error.message} action={{ label: 'Try again', onPress: searchWeb }} />
          ) : null}
          {r.status === 'done' ? (
            r.data.results.length === 0 ? (
              <EmptyState icon="globe-outline" title={`Nothing found for “${r.data.query}”`} />
            ) : (
              <>
                <SectionTitle>{plural(r.data.results.length, 'result')}</SectionTitle>
                {r.data.results.map((item, i) => (
                  <ResultCard key={`${item.url}-${i}`} title={item.title} url={item.url} snippet={item.snippet} query={r.data.query} />
                ))}
              </>
            )
          ) : null}
        </>
      ) : (
        <>
          {a.status === 'loading' ? (
            <Waiting
              label="Reading the web"
              elapsedMs={elapsed}
              hint="Your computer fetches up to three result pages, then Claude answers from them. This can take a minute."
              onCancel={answer.cancel}
            />
          ) : null}
          {a.status === 'error' ? (
            <Banner title="Could not answer" message={a.error.message} action={{ label: 'Try again', onPress: answerFromWeb }} />
          ) : null}
          {a.status === 'done' ? (
            <>
              <Card>
                <Text style={s.asked} numberOfLines={3}>
                  {a.data.query}
                </Text>
                <RichAnswer text={a.data.answer} sourceCount={a.data.sources.length} onCitePress={setFocused} />
              </Card>
              <SectionTitle>Pages read</SectionTitle>
              <SourceList sources={a.data.sources} cited={citedNumbers(a.data.answer)} focused={focused} />
              {a.data.skipped.length ? (
                <Text style={s.hint}>
                  Skipped {plural(a.data.skipped.length, 'page')} that could not be read:{' '}
                  {a.data.skipped.map((u) => displayUrl(u, 40)).join(', ')}
                </Text>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  flex: { flex: 1 },
  controls: { gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  hint: { fontSize: text.tiny, color: c.textFaint, lineHeight: 17 },
  spinner: { marginTop: space.xl },
  asked: { fontSize: text.small, fontWeight: '600', color: c.textMuted },
}));
