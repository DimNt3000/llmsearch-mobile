import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ApiError, type ServerConfig } from '../../api/client';
import type { CrawlJob } from '../../api/types';
import { Banner, Button, Card, Chip, Field, Header, Screen, SectionTitle } from '../../components/ui';
import { displayUrl, isCrawlableUrl, plural, withScheme } from '../../lib/format';
import { useConnection } from '../../state/connection';
import { makeStyles, radius, space, text, useTheme } from '../../theme';

const DEPTHS = [0, 1, 2, 3];
const PAGE_LIMITS = [5, 15, 30, 50];
const POLL_MS = 1000;

export default function LibraryScreen() {
  const s = useStyles();
  const c = useTheme();
  const { ready, server, api, status, stats, error, connect, disconnect, refresh } = useConnection();

  const [address, setAddress] = useState('');
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [crawlUrl, setCrawlUrl] = useState('');
  const [depth, setDepth] = useState(1);
  const [pages, setPages] = useState(15);
  const [sameSite, setSameSite] = useState(true);
  const [job, setJob] = useState<CrawlJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);

  // Fill the form from the saved connection whenever it changes (for example
  // once storage has loaded). Adjusting state during render, rather than in
  // an effect, avoids a second render pass.
  const [formFor, setFormFor] = useState<ServerConfig | null>(null);
  if (server !== formFor) {
    setFormFor(server);
    if (server) {
      setAddress(server.baseUrl);
      setToken(server.token);
    }
  }

  const loadJob = useCallback(async () => {
    if (!api) return;
    try {
      setJob((await api.crawlStatus()).job);
    } catch {
      // the connection card already reports server problems
    }
  }, [api]);

  // Pick up a crawl that was started earlier, from this phone or another.
  useEffect(() => {
    if (status !== 'online' || !api) return;
    let alive = true;
    api
      .crawlStatus()
      .then((result) => {
        if (alive) setJob(result.job);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [status, api]);

  // Poll while a crawl runs; refresh the index counts when it ends.
  const running = job?.status === 'running';
  useEffect(() => {
    if (!api || !running) return;
    let alive = true;
    const id = setInterval(async () => {
      try {
        const next = (await api.crawlStatus()).job;
        if (!alive) return;
        setJob(next);
        if (next && next.status !== 'running') void refresh();
      } catch {
        // a missed poll is retried on the next tick
      }
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [api, running, refresh]);

  const onConnect = async () => {
    setConnecting(true);
    await connect(address, token);
    setConnecting(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadJob()]);
    setRefreshing(false);
  };

  const target = withScheme(crawlUrl);
  const canCrawl = status === 'online' && isCrawlableUrl(target) && !running && !starting;

  const startCrawl = async () => {
    if (!api || !canCrawl) return;
    setStarting(true);
    setCrawlError(null);
    try {
      const result = await api.crawlStart({
        url: target,
        depth,
        max_pages: pages,
        all_domains: !sameSite,
      });
      setJob(result.job);
    } catch (caught) {
      setCrawlError(caught instanceof ApiError ? caught.message : String(caught));
    } finally {
      setStarting(false);
    }
  };

  const stopCrawl = async () => {
    if (!api) return;
    try {
      setJob((await api.crawlCancel()).job);
    } catch (caught) {
      setCrawlError(caught instanceof ApiError ? caught.message : String(caught));
    }
  };

  const online = status === 'online';
  return (
    <Screen
      refreshControl={
        server ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} /> : undefined
      }
    >
      <Header title="Library" subtitle="Your server, your index, and new content for it." />

      {/* Connection ------------------------------------------------------ */}
      <Card>
        <SectionTitle>Server</SectionTitle>
        <Field
          label="Address"
          icon="link-outline"
          placeholder="192.168.1.20:8765"
          value={address}
          onChangeText={setAddress}
          keyboardType="url"
          textContentType="URL"
        />
        <Field
          label="Token"
          icon="key-outline"
          placeholder="Printed by llmsearch serve"
          value={token}
          onChangeText={setToken}
          secret
          textContentType="password"
        />
        <Button
          title={server ? 'Reconnect' : 'Connect'}
          icon="flash-outline"
          onPress={onConnect}
          loading={connecting || (ready && status === 'checking')}
          disabled={!address.trim() || !token.trim()}
        />
        {online && server ? (
          <View style={s.connected}>
            <Ionicons name="checkmark-circle" size={18} color={c.online} />
            <Text style={s.connectedText}>Connected to {displayUrl(server.baseUrl)}</Text>
          </View>
        ) : null}
        {error && (status === 'offline' || status === 'unauthorized') ? (
          <Banner
            title={status === 'unauthorized' ? 'Token rejected' : 'Server unreachable'}
            message={error}
          />
        ) : null}
        {server ? (
          <Button title="Forget this server" variant="ghost" compact onPress={() => void disconnect()} />
        ) : (
          <Text style={s.help}>
            On your computer, run <Text style={s.mono}>llmsearch serve</Text>. It prints the address
            and token to enter here. The phone and the computer must be on the same network.
          </Text>
        )}
      </Card>

      {/* Index ----------------------------------------------------------- */}
      {online && stats ? (
        <Card>
          <SectionTitle
            right={
              <Pressable onPress={onRefresh} hitSlop={10} accessibilityRole="button" accessibilityLabel="Refresh">
                <Ionicons name="refresh" size={18} color={c.textFaint} />
              </Pressable>
            }
          >
            Index
          </SectionTitle>
          <View style={s.tiles}>
            <Tile label="Documents" value={stats.documents} />
            <Tile label="Chunks" value={stats.chunks} />
            <Tile label="Terms" value={stats.unique_terms} />
          </View>
          {Object.keys(stats.by_source).length ? (
            <Text style={s.meta}>
              {Object.entries(stats.by_source)
                .map(([source, count]) => `${count} from ${source === 'web' ? 'the web' : 'files'}`)
                .join('  ·  ')}
            </Text>
          ) : null}
          <View style={s.llmRow}>
            <View style={[s.dot, { backgroundColor: stats.llm_available ? c.online : c.offline }]} />
            <Text style={s.meta}>
              {stats.llm_available
                ? `LLM: ${stats.backend === 'api' ? 'Anthropic API' : 'claude CLI'} · ${stats.model}`
                : 'No LLM configured on the server'}
            </Text>
          </View>
          <Text style={s.version}>llmsearch {stats.version}</Text>
        </Card>
      ) : null}

      {/* Crawl ----------------------------------------------------------- */}
      {online ? (
        <Card>
          <SectionTitle>Crawl a site</SectionTitle>
          <Field
            icon="globe-outline"
            placeholder="docs.python.org/3/tutorial/"
            value={crawlUrl}
            onChangeText={setCrawlUrl}
            keyboardType="url"
            onClear={() => setCrawlUrl('')}
            editable={!running}
          />
          <Text style={s.label}>Link depth</Text>
          <View style={s.chips}>
            {DEPTHS.map((d) => (
              <Chip key={d} label={d === 0 ? 'Page only' : String(d)} selected={depth === d} onPress={() => setDepth(d)} disabled={running} />
            ))}
          </View>
          <Text style={s.label}>Page limit</Text>
          <View style={s.chips}>
            {PAGE_LIMITS.map((n) => (
              <Chip key={n} label={String(n)} selected={pages === n} onPress={() => setPages(n)} disabled={running} />
            ))}
          </View>
          <Chip
            label="Stay on this site"
            icon="shield-checkmark-outline"
            selected={sameSite}
            onPress={() => setSameSite((v) => !v)}
            disabled={running}
          />
          {running ? (
            <Button title="Stop crawl" icon="stop-circle-outline" variant="danger" onPress={stopCrawl} />
          ) : (
            <Button title="Start crawl" icon="download-outline" onPress={startCrawl} loading={starting} disabled={!canCrawl} />
          )}
          {crawlError ? <Banner message={crawlError} /> : null}
          {job ? <CrawlProgress job={job} /> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  const s = useStyles();
  return (
    <View style={s.tile}>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

function CrawlProgress({ job }: { job: CrawlJob }) {
  const s = useStyles();
  const c = useTheme();
  const fraction = Math.min(1, job.pages / Math.max(1, job.max_pages));
  const summary = {
    running: `${job.pages} of up to ${job.max_pages} pages · ${plural(job.chunks, 'chunk')}`,
    done: `Indexed ${plural(job.pages, 'page')} (${plural(job.chunks, 'chunk')})`,
    cancelled: `Stopped after ${plural(job.pages, 'page')} (${plural(job.chunks, 'chunk')})`,
    error: 'The crawl failed',
  }[job.status];
  const icon = { running: null, done: 'checkmark-circle', cancelled: 'pause-circle', error: 'alert-circle' } as const;
  const iconName = icon[job.status];

  return (
    <View style={s.progress} accessibilityLiveRegion="polite">
      <View style={s.progressHead}>
        {iconName ? (
          <Ionicons name={iconName} size={18} color={job.status === 'error' ? c.danger : c.accent} />
        ) : null}
        <Text style={s.progressText}>{summary}</Text>
      </View>
      <Text style={s.meta} numberOfLines={1}>
        {displayUrl(job.url)}
      </Text>
      {job.status === 'running' ? (
        <View style={s.bar}>
          <View style={[s.barFill, { width: `${Math.max(4, fraction * 100)}%` }]} />
        </View>
      ) : null}
      {job.error ? <Text style={s.errorText}>{job.error}</Text> : null}
      {job.log.length ? (
        <View style={s.log}>
          {job.log.slice(-5).map((line, i) => (
            <Text key={`${job.id}-${i}`} style={s.logLine} numberOfLines={1}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  connected: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  connectedText: { fontSize: text.small, color: c.text, fontWeight: '600' },
  help: { fontSize: text.small, color: c.textMuted, lineHeight: 20 },
  mono: { fontFamily: 'monospace', color: c.text },

  tiles: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1,
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
    gap: 2,
  },
  tileValue: { fontSize: 22, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] },
  tileLabel: { fontSize: text.tiny, color: c.textMuted },
  meta: { fontSize: text.small, color: c.textMuted },
  llmRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  version: { fontSize: text.tiny, color: c.textFaint },

  label: { fontSize: text.small, fontWeight: '600', color: c.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  progress: { gap: space.sm, paddingTop: space.xs },
  progressHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  progressText: { fontSize: text.body, fontWeight: '600', color: c.text },
  bar: { height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: c.accent },
  errorText: { fontSize: text.small, color: c.danger },
  log: { backgroundColor: c.surfaceAlt, borderRadius: radius.sm, padding: space.sm, gap: 2 },
  logLine: { fontFamily: 'monospace', fontSize: text.tiny, color: c.textMuted },
}));
