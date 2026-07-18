import { tool } from 'ai';
import { z } from 'zod';
import { fetchWebContent } from './web-content.utils';
import type { AgentWebToolOptions, FetchWebPageToolOutput } from './web-tools.types';
import { assertSafeHttpUrl, normalizePublicUrl } from './web-url.utils';

export const FETCH_WEB_PAGE_TOOL = 'fetchWebPage';

export async function executeFetchWebPage(
  input: { url?: string; maxChars?: number },
  options: AgentWebToolOptions = {},
): Promise<FetchWebPageToolOutput> {
  const rawUrl = String(input.url ?? '').trim();
  if (!rawUrl) {
    return { ok: false, url: '', error: 'url 不能为空' };
  }

  try {
    const normalized = normalizePublicUrl(rawUrl);
    await assertSafeHttpUrl(normalized);
    const result = await fetchWebContent(normalized, {
      jinaKey: options.jinaKey,
      timeoutMs: options.fetchTimeoutMs,
      maxChars: input.maxChars ?? options.maxPageChars,
    });

    return {
      ok: true,
      url: result.url,
      title: result.title,
      content: result.content,
      truncated: result.truncated,
      provider: result.provider,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      url: rawUrl,
      error: message,
    };
  }
}

export function createFetchWebPageTool(options: AgentWebToolOptions = {}) {
  return tool({
    description:
      '抓取指定 URL 的网页正文（Markdown/纯文本），用于阅读官方文档、博客、Issue 等。仅支持公开 http/https 地址。',
    inputSchema: z.object({
      url: z
        .string()
        .min(1)
        .describe('完整网页 URL，例如 https://typeorm.io/entities'),
      maxChars: z
        .number()
        .int()
        .min(1000)
        .max(20000)
        .optional()
        .describe('返回正文最大字符数，默认 12000'),
    }),
    execute: async (input) => executeFetchWebPage(input, options),
  });
}
