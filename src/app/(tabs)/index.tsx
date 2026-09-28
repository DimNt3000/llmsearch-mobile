import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, Text, View } from 'react-native';

import type { SearchResponse, SummarizeResponse } from '../../api/types';
import { ResultCard, RichAnswer, SourceList } from '../../components/content';
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
import { citedNumbers } from '../../lib/answer';
import { plural } from '../../lib/format';
import { useElapsed, useRequest } from '../../lib/hooks';
import { useConnection } from '../../state/connection';
import { makeStyles, space, text, useTheme } from '../../theme';

export default function SearchScreen() {
  const s = useStyles();
  const c = useTheme();
  const { api, status, stats } = useConnection();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [smart, setSmart] = useState(false);
  const [rerank, setRerank] = useState(false);
  const search = useRequest<SearchResponse>();
  const summary = useRequest<SummarizeResponse>();
  const llm = stats?.llm_available ?? false;
  const usesModel = llm && (smart || rerank);

  const searchElapsed = useElapsed(search.state.status === 'loading' ? search.state.startedAt : null);
  const summaryElapsed = useElapsed(summary.state.status === 'loading' ? summary.state.startedAt : null);

  const submit = () => {
    const q = query.trim();
    if (!q || !api) return;
    Keyboard.dismiss();
    setSubmitted(q);
    summary.reset();
    void search.run((signal) => api.search(q, { smart: llm && smart, rerank: llm && rerank }, signal));
  };

  const summarize = () => {
    if (!api || !submitted) return;
    void summary.run((signal) => api.summarize(submitted, signal));
  };

  const subtitle =
    status === 'online' && stats
      ? `${plural(stats.documents, 'document')} · ${plural(stats.chunks, 'chunk')} indexed`
      : 'Search the index on your computer';

  if (!api) {
    return (
      <Screen>
        <Header title="Search" subtitle={subtitle} />
        <EmptyState
          icon="server-outline"
          title="Connect to your computer"
          message="On your computer, run “llmsearch serve”, then enter the address and token it prints."
          action={{ label: 'Set up connection', onPress: () => router.navigate('/library') }}
        />
      </Screen>
    );
  }

  const state = search.state;
  return (
    <Screen>
      <Header title="Search" subtitle={subtitle} />

      <View style={s.controls}>
        <Field
          icon="search"
          placeholder="Search your index"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          returnKeyType="search"
          onClear={() => setQuery('')}
        />
        <View style={s.row}>
          <Chip
            label="Smart"
            icon="sparkles-outline"
            selected={llm && smart}
            disabled={!llm}
            onPress={() => setSmart((v) => !v)}
          />
          <Chip
            label="Rerank"
            icon="swap-vertical-outline"
            selected={llm && rerank}
            disabled={!llm}
            onPress={() => setRerank((v) => !v)}
          />
          <View style={s.flex} />
          <Button title="Search" onPress={submit} compact disabled={!query.trim()} />
        </View>
        {status === 'online' && !llm ? (
          <Text style={s.hint}>Smart and Rerank need an LLM backend on the server.</Text>
        ) : null}
      </View>

      {state.status === 'loading' ? (
        usesModel ? (
          <Waiting
            label="Searching with the model"
            elapsedMs={searchElapsed}
            hint="Query expansion and reranking ask Claude on your computer, which takes a few seconds."
            onCancel={search.cancel}
          />
        ) : (
          <ActivityIndicator color={c.accent} style={s.spinner} />
        )
      ) : null}

      {state.status === 'error' ? (
        <Banner
          title="Search failed"
          message={state.error.message}
          action={{ label: 'Try again', onPress: submit }}
        />
      ) : null}

      {state.status === 'done' ? (
        <>
          {state.data.variants.length ? (
            <Text style={s.variants}>
              <Text style={s.variantsLabel}>Also searched: </Text>
              {state.data.variants.join('  ·  ')}
            </Text>
          ) : null}
          {state.data.notice ? <Banner kind="notice" message={state.data.notice} /> : null}

          {state.data.results.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title={`No results for “${state.data.query}”`}
              message={llm ? 'Try other words, or turn on Smart to let the model rephrase.' : 'Try other words.'}
            />
          ) : (
            <>
              {llm ? (
                summary.state.status === 'idle' ? (
                  <Button title="Summarize these results" icon="reader-outline" variant="secondary" onPress={summarize} />
                ) : summary.state.status === 'loading' ? (
                  <Waiting label="Summarizing" elapsedMs={summaryElapsed} onCancel={summary.cancel} />
                ) : summary.state.status === 'error' ? (
                  <Banner
                    title="Summary failed"
                    message={summary.state.error.message}
                    action={{ label: 'Try again', onPress: summarize }}
                  />
                ) : (
                  <Card>
                    <SectionTitle>Summary</SectionTitle>
                    <RichAnswer text={summary.state.data.summary} sourceCount={summary.state.data.sources.length} />
                    <SourceList
                      sources={summary.state.data.sources}
                      cited={citedNumbers(summary.state.data.summary)}
                      focused={null}
                    />
                  </Card>
                )
              ) : null}

              <SectionTitle>{plural(state.data.results.length, 'result')}</SectionTitle>
              {state.data.results.map((result) => (
                <ResultCard
                  key={result.url}
                  title={result.title}
                  url={result.url}
                  snippet={result.snippet}
                  fullText={result.text}
                  score={result.score}
                  query={state.data.query}
                />
              ))}
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  flex: { flex: 1 },
  controls: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hint: { fontSize: text.tiny, color: c.textFaint },
  spinner: { marginTop: space.xl },
  variants: { fontSize: text.small, color: c.textMuted, lineHeight: 20 },
  variantsLabel: { fontWeight: '700', color: c.text },
}));
