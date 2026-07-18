export type AgentWebToolOptions = {
  jinaKey?: string;
  fetchTimeoutMs?: number;
  maxPageChars?: number;
  maxSearchResults?: number;
};

export type WebSearchResultItem = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchToolOutput = {
  ok: boolean;
  query: string;
  results: WebSearchResultItem[];
  provider?: 'jina' | 'duckduckgo';
  error?: string;
};

export type FetchWebPageToolOutput = {
  ok: boolean;
  url: string;
  title?: string;
  content?: string;
  truncated?: boolean;
  provider?: 'direct' | 'jina';
  error?: string;
};
