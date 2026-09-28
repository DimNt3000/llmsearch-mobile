import type {
  AskResponse,
  CrawlOptions,
  CrawlResponse,
  Health,
  SearchResponse,
  Stats,
  SummarizeResponse,
  WebAskResponse,
  WebResponse,
} from './types';

export interface ServerConfig {
  baseUrl: string;
  token: string;
}

/**
 * Every failure the app can meet, as one error type with a code to branch on.
 * Codes from the server (`unauthorized`, `no_context`, `llm_unavailable`, ...)
 * pass through unchanged; transport failures get `offline`, `timeout`,
 * `cancelled`, or `bad_response`.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function isCancelled(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'cancelled';
}

const QUICK_MS = 15_000; // plain search, stats, crawl control
const WEB_MS = 30_000; // live web search
const LLM_MS = 300_000; // anything that waits on the model

type Query = Record<string, string | number | boolean | undefined>;

// Built by hand: URLSearchParams is incomplete in React Native.
function queryString(params: Query): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== false && value !== '')
    .map(([key, value]) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(value === true ? '1' : String(value))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  auth?: boolean;
}

export function createClient(server: ServerConfig) {
  const base = server.baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs ?? QUICK_MS);
    const forwardAbort = () => controller.abort();
    options.signal?.addEventListener('abort', forwardAbort);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.auth !== false) headers.Authorization = `Bearer ${server.token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      if (options.signal?.aborted) throw new ApiError('cancelled', 'Cancelled.');
      if (timedOut) throw new ApiError('timeout', 'The server took too long to respond.');
      throw new ApiError(
        'offline',
        `Can't reach ${base}. Check that “llmsearch serve” is running and that this ` +
          'device is on the same network.',
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', forwardAbort);
    }

    const raw = await response.text();
    let data: unknown = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        throw new ApiError(
          'bad_response',
          `Unexpected response (HTTP ${response.status}). Is this address an llmsearch server?`,
          response.status,
        );
      }
    }
    if (!response.ok) {
      const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(
        error?.code ?? `http_${response.status}`,
        error?.message ?? `The server returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return data as T;
  }

  return {
    baseUrl: base,

    health: (signal?: AbortSignal) =>
      request<Health>('/api/health', { auth: false, signal, timeoutMs: 8_000 }),

    stats: (signal?: AbortSignal) => request<Stats>('/api/stats', { signal }),

    search: (q: string, opts: { smart?: boolean; rerank?: boolean } = {}, signal?: AbortSignal) =>
      request<SearchResponse>(`/api/search${queryString({ q, smart: opts.smart, rerank: opts.rerank })}`, {
        signal,
        timeoutMs: opts.smart || opts.rerank ? LLM_MS : QUICK_MS,
      }),

    ask: (question: string, smart: boolean, signal?: AbortSignal) =>
      request<AskResponse>('/api/ask', {
        method: 'POST',
        body: { question, smart },
        signal,
        timeoutMs: LLM_MS,
      }),

    summarize: (query: string, signal?: AbortSignal) =>
      request<SummarizeResponse>('/api/summarize', {
        method: 'POST',
        body: { query },
        signal,
        timeoutMs: LLM_MS,
      }),

    web: (q: string, n?: number, signal?: AbortSignal) =>
      request<WebResponse>(`/api/web${queryString({ q, n })}`, { signal, timeoutMs: WEB_MS }),

    webAsk: (query: string, signal?: AbortSignal) =>
      request<WebAskResponse>('/api/web/ask', {
        method: 'POST',
        body: { query },
        signal,
        timeoutMs: LLM_MS,
      }),

    crawlStatus: (signal?: AbortSignal) => request<CrawlResponse>('/api/crawl', { signal }),

    crawlStart: (options: CrawlOptions) =>
      request<CrawlResponse>('/api/crawl', { method: 'POST', body: options }),

    crawlCancel: () => request<CrawlResponse>('/api/crawl', { method: 'DELETE' }),
  };
}

export type ApiClient = ReturnType<typeof createClient>;
