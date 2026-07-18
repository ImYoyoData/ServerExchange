import { tool } from 'ai';
import { z } from 'zod';
import type {
  AgentWebToolOptions,
  WebSearchResultItem,
  WebSearchToolOutput,
} from './web-tools.types';
import { DEFAULT_FETCH_TIMEOUT_MS } from './web-content.utils';

export const SEARCH_WEB_TOOL = 'searchWeb';

const DEFAULT_MAX_SEARCH_RESULTS = 5;

type DuckDuckGoTopic = {
  Text?: string;
  FirstURL?: string;
};

type DuckDuckGoResponse = {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  RelatedTopics?: Array<DuckDuckGoTopic | { Topics?: DuckDuckGoTopic[] }>;
  Results?: DuckDuckGoTopic[];
};

function normalizeQuery(raw: unknown): string {
  const query = String(raw ?? '').trim();
  if (!query) {
    throw new Error('query 不能为空');
  }
  return query;
}

function pushResult(
  bucket: WebSearchResultItem[],
  seen: Set<string>,
  item: WebSearchResultItem,
  limit: number,
) {
  const url = item.url.trim();
  if (!url || seen.has(url) || bucket.length >= limit) return;
  seen.add(url);
  bucket.push({
    title: item.title.trim() || url,
    url,
    snippet: item.snippet.trim(),
  });
}

function parseDuckDuckGoResults(
  payload: DuckDuckGoResponse,
  limit: number,
): WebSearchResultItem[] {
  const results: WebSearchResultItem[] = [];
  const seen = new Set<string>();

  if (payload.AbstractText && payload.AbstractURL) {
    pushResult(
      results,
      seen,
      {
        title: payload.Heading || '摘要',
        url: payload.AbstractURL,
        snippet: payload.AbstractText,
      },
      limit,
    );
  }

  const related = payload.RelatedTopics ?? [];
  for (const topic of related) {
    if (results.length >= limit) break;
    if ('Topics' in topic && Array.isArray(topic.Topics)) {
      for (const nested of topic.Topics) {
        if (!nested.FirstURL || !nested.Text) continue;
        pushResult(
          results,
          seen,
          {
            title: nested.Text.split(' - ')[0] ?? nested.Text,
            url: nested.FirstURL,
            snippet: nested.Text,
          },
          limit,
        );
      }
      continue;
    }
    const leaf = topic as DuckDuckGoTopic;
    if (!leaf.FirstURL || !leaf.Text) continue;
    pushResult(
      results,
      seen,
      {
        title: leaf.Text.split(' - ')[0] ?? leaf.Text,
        url: leaf.FirstURL,
        snippet: leaf.Text,
      },
      limit,
    );
  }

  for (const item of payload.Results ?? []) {
    if (!item.FirstURL || !item.Text) continue;
    pushResult(
      results,
      seen,
      {
        title: item.Text.split(' - ')[0] ?? item.Text,
        url: item.FirstURL,
        snippet: item.Text,
      },
      limit,
    );
  }

  return results;
}

async function searchViaJina(
  query: string,
  options: AgentWebToolOptions,
  limit: number,
): Promise<WebSearchToolOutput> {
  const headers: Record<string, string> = {
    Accept: 'text/plain',
  };
  if (options.jinaKey) {
    headers.Authorization = `Bearer ${options.jinaKey}`;
  }

  const response = await fetch(
    `https://s.jina.ai/?q=${encodeURIComponent(query)}`,
    {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(
        options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
      ),
    },
  );

  if (!response.ok) {
    throw new Error(`Jina Search 失败：HTTP ${response.status}`);
  }

  const body = (await response.text()).trim();
  const results: WebSearchResultItem[] = [];
  const blocks = body.split(/\n(?=\d+\.\s)/).filter(Boolean);

  for (const block of blocks) {
    if (results.length >= limit) break;
    const titleMatch = block.match(/^\d+\.\s*(.+)$/m);
    const urlMatch = block.match(/^URL:\s*(.+)$/m);
    const snippetMatch = block.match(/^Description:\s*(.+)$/m);
    const url = urlMatch?.[1]?.trim();
    if (!url) continue;
    results.push({
      title: titleMatch?.[1]?.trim() || url,
      url,
      snippet: snippetMatch?.[1]?.trim() || block.slice(0, 240).trim(),
    });
  }

  if (!results.length && body) {
    results.push({
      title: '搜索结果摘要',
      url: `https://s.jina.ai/?q=${encodeURIComponent(query)}`,
      snippet: body.slice(0, 1200),
    });
  }

  return {
    ok: results.length > 0,
    query,
    results,
    provider: 'jina',
    ...(results.length ? {} : { error: '未检索到有效结果' }),
  };
}

async function searchViaDuckDuckGo(
  query: string,
  limit: number,
): Promise<WebSearchToolOutput> {
  const response = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error(`DuckDuckGo 失败：HTTP ${response.status}`);
  }

  const payload = (await response.json()) as DuckDuckGoResponse;
  const results = parseDuckDuckGoResults(payload, limit);

  return {
    ok: results.length > 0,
    query,
    results,
    provider: 'duckduckgo',
    ...(results.length ? {} : { error: '未检索到有效结果' }),
  };
}

export async function executeWebSearch(
  input: { query?: string; limit?: number },
  options: AgentWebToolOptions = {},
): Promise<WebSearchToolOutput> {
  const query = normalizeQuery(input.query);
  const limit = Math.min(
    Math.max(Number(input.limit ?? options.maxSearchResults ?? DEFAULT_MAX_SEARCH_RESULTS), 1),
    8,
  );

  try {
    const jinaResult = await searchViaJina(query, options, limit);
    if (jinaResult.ok) return jinaResult;
  } catch {
    /* fallback */
  }

  try {
    return await searchViaDuckDuckGo(query, limit);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      query,
      results: [],
      error: message,
    };
  }
}

export function createSearchWebTool(options: AgentWebToolOptions = {}) {
  return tool({
    description:
      '搜索互联网获取 TypeORM、NestJS、数据库设计、API 文档等最新资料。query 需为具体关键词或问题。',
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe('搜索关键词或问题，例如「TypeORM @Column decimal 精度」'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(8)
        .optional()
        .describe('返回条数，默认 5，最多 8'),
    }),
    execute: async (input) => executeWebSearch(input, options),
  });
}
