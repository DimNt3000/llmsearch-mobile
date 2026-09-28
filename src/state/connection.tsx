import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { ApiError, createClient, type ApiClient, type ServerConfig } from '../api/client';
import type { Stats } from '../api/types';
import { normalizeBaseUrl } from '../lib/format';
import { clearServer, loadServer, saveServer } from '../lib/storage';

export type ConnectionStatus = 'none' | 'checking' | 'online' | 'unauthorized' | 'offline';

interface ConnectionValue {
  /** False until the saved connection has been read from storage. */
  ready: boolean;
  server: ServerConfig | null;
  api: ApiClient | null;
  status: ConnectionStatus;
  stats: Stats | null;
  error: string | null;
  connect: (baseUrl: string, token: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionValue | null>(null);

const TOKEN_REJECTED =
  'The server rejected this token. Copy it again from the “llmsearch serve” output.';

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [server, setServer] = useState<ServerConfig | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('none');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = useMemo(() => (server ? createClient(server) : null), [server]);
  const latestCheck = useRef(0);

  /** Checks a server and records the outcome; stale checks never win. */
  const probe = useCallback(async (client: ApiClient | null): Promise<boolean> => {
    const id = ++latestCheck.current;
    if (!client) {
      setStatus('none');
      setStats(null);
      setError(null);
      return false;
    }
    setStatus((current) => (current === 'online' ? current : 'checking'));
    try {
      const next = await client.stats();
      if (id !== latestCheck.current) return false;
      setStats(next);
      setStatus('online');
      setError(null);
      return true;
    } catch (caught) {
      if (id !== latestCheck.current) return false;
      const failure = caught instanceof ApiError ? caught : new ApiError('offline', String(caught));
      const rejected = failure.code === 'unauthorized';
      setStatus(rejected ? 'unauthorized' : 'offline');
      setError(rejected ? TOKEN_REJECTED : failure.message);
      return false;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadServer().then((saved) => {
      if (!alive) return;
      setServer(saved);
      setReady(true);
      void probe(saved ? createClient(saved) : null);
    });
    return () => {
      alive = false;
    };
  }, [probe]);

  // Coming back to the app is when a sleeping laptop or a changed network shows up.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && api) void probe(api);
    });
    return () => subscription.remove();
  }, [api, probe]);

  const connect = useCallback(
    async (baseUrl: string, token: string) => {
      const next: ServerConfig = { baseUrl: normalizeBaseUrl(baseUrl), token: token.trim() };
      setServer(next);
      await saveServer(next).catch(() => undefined);
      return probe(createClient(next));
    },
    [probe],
  );

  const disconnect = useCallback(async () => {
    await clearServer().catch(() => undefined);
    setServer(null);
    await probe(null);
  }, [probe]);

  const refresh = useCallback(async () => {
    await probe(api);
  }, [api, probe]);

  const value = useMemo<ConnectionValue>(
    () => ({ ready, server, api, status, stats, error, connect, disconnect, refresh }),
    [ready, server, api, status, stats, error, connect, disconnect, refresh],
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionValue {
  const value = useContext(ConnectionContext);
  if (!value) throw new Error('useConnection must be used inside <ConnectionProvider>');
  return value;
}
