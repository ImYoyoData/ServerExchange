import { assertSafeHttpUrl } from './web-url.utils';

export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_PAGE_BYTES = 2 * 1024 * 1024;
export const DEFAULT_MAX_PAGE_CHARS = 12_000;

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (compatible; ServerExchange-agent/1.0; +https://github.com/ImYoyoData/ServerExchange)';

export function extractHtmlTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  return decodeBasicEntities(match[1].replace(/\s+/g, ' ').trim()) || undefined;
}

export function htmlToText(html: string): string {
  return decodeBasicEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/(h1|h2|h3|h4|h5|h6|li|tr|div|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

export function truncateText(text: string, maxChars: number): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, maxChars)}\n\n...[内容已截断]`,
    truncated: true,
  };
}

export async function readResponseBodyLimited(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.body) {
    return await response.text();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`响应体超过 ${maxBytes} 字节限制`);
    }
    chunks.push(value);
  }

  const merged = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return merged.toString('utf8');
}

export type FetchWebContentOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxChars?: number;
  jinaKey?: string;
  userAgent?: string;
};

export async function fetchWebContentDirect(
  rawUrl: string,
  options: FetchWebContentOptions = {},
): Promise<{
  ok: true;
  url: string;
  title?: string;
  content: string;
  truncated: boolean;
  provider: 'direct';
}> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_PAGE_BYTES;
  const maxChars = options.maxChars ?? DEFAULT_MAX_PAGE_CHARS;
  const parsed = await assertSafeHttpUrl(rawUrl);

  const response = await fetch(parsed.toString(), {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': options.userAgent ?? DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  }

  const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
  if (
    contentType &&
    !contentType.includes('text/html') &&
    !contentType.includes('text/plain') &&
    !contentType.includes('application/xhtml')
  ) {
    throw new Error(`不支持的内容类型：${contentType}`);
  }

  const body = await readResponseBodyLimited(response, maxBytes);
  const title = extractHtmlTitle(body);
  const plain =
    contentType.includes('text/plain') && !contentType.includes('html')
      ? body.trim()
      : htmlToText(body);
  const { text, truncated } = truncateText(plain, maxChars);

  return {
    ok: true,
    url: parsed.toString(),
    title,
    content: text,
    truncated,
    provider: 'direct',
  };
}

export async function fetchWebContentViaJina(
  rawUrl: string,
  options: FetchWebContentOptions = {},
): Promise<{
  ok: true;
  url: string;
  title?: string;
  content: string;
  truncated: boolean;
  provider: 'jina';
}> {
  const maxChars = options.maxChars ?? DEFAULT_MAX_PAGE_CHARS;
  const parsed = await assertSafeHttpUrl(rawUrl);
  const headers: Record<string, string> = {
    Accept: 'text/plain',
    'X-Return-Format': 'markdown',
  };
  if (options.jinaKey) {
    headers.Authorization = `Bearer ${options.jinaKey}`;
  }

  const response = await fetch(`https://r.jina.ai/${parsed.toString()}`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Jina Reader 失败：HTTP ${response.status}`);
  }

  const body = (await response.text()).trim();
  const titleLine = body.match(/^Title:\s*(.+)$/m);
  const title = titleLine?.[1]?.trim();
  const contentStart = body.indexOf('\nMarkdown Content:\n');
  const markdown =
    contentStart >= 0
      ? body.slice(contentStart + '\nMarkdown Content:\n'.length).trim()
      : body;
  const { text, truncated } = truncateText(markdown, maxChars);

  return {
    ok: true,
    url: parsed.toString(),
    title,
    content: text,
    truncated,
    provider: 'jina',
  };
}

export async function fetchWebContent(
  rawUrl: string,
  options: FetchWebContentOptions = {},
) {
  try {
    return await fetchWebContentDirect(rawUrl, options);
  } catch (directError) {
    try {
      return await fetchWebContentViaJina(rawUrl, options);
    } catch (jinaError) {
      const directMsg =
        directError instanceof Error ? directError.message : String(directError);
      const jinaMsg =
        jinaError instanceof Error ? jinaError.message : String(jinaError);
      throw new Error(`网页抓取失败：${directMsg}；Jina 兜底也失败：${jinaMsg}`);
    }
  }
}
