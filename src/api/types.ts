/** Response shapes of the `llmsearch serve` JSON API (llmsearch 0.2). */

export interface Health {
  ok: boolean;
  service: string;
  version: string;
}

export interface Stats {
  documents: number;
  chunks: number;
  unique_terms: number;
  by_source: Record<string, number>;
  backend: 'api' | 'claude-cli' | 'off';
  model: string | null;
  llm_available: boolean;
  version: string;
}

export interface SearchResult {
  title: string;
  url: string;
  score: number;
  snippet: string;
  text: string;
}

export interface SearchResponse {
  query: string;
  variants: string[];
  notice: string | null;
  results: SearchResult[];
}

export interface Source {
  n: number;
  title: string;
  url: string;
  text: string;
}

export interface AskResponse {
  question: string;
  answer: string;
  sources: Source[];
}

export interface SummarizeResponse {
  query: string;
  summary: string;
  sources: Source[];
}

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebResponse {
  query: string;
  results: WebResult[];
}

export interface WebAskResponse {
  query: string;
  answer: string;
  sources: Source[];
  skipped: string[];
}

export type CrawlStatus = 'running' | 'done' | 'cancelled' | 'error';

export interface CrawlJob {
  id: string;
  url: string;
  depth: number;
  max_pages: number;
  same_domain: boolean;
  status: CrawlStatus;
  pages: number;
  chunks: number;
  error: string | null;
  log: string[];
  started_at: string;
  finished_at: string | null;
}

export interface CrawlResponse {
  job: CrawlJob | null;
}

export interface CrawlOptions {
  url: string;
  depth: number;
  max_pages: number;
  all_domains: boolean;
}
