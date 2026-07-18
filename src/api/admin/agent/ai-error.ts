/**
 * 将 Vercel AI SDK / 网关错误转为可读的业务提示。
 */
export function formatAiCallError(error: unknown): string {
  if (error instanceof Error && error.message && !isAiSdkError(error)) {
    return error.message;
  }

  const e = (error ?? {}) as {
    message?: string;
    statusCode?: number;
    url?: string;
    responseBody?: unknown;
  };

  const bodyText =
    typeof e.responseBody === 'string'
      ? e.responseBody
      : e.responseBody != null
        ? JSON.stringify(e.responseBody)
        : '';

  if (e.statusCode === 404 && String(e.url ?? '').includes('/responses')) {
    return 'AI 网关不支持 OpenAI Responses 接口，请将 agent.provider 设为 openai，并确认 agent.url 指向 Chat Completions 兼容地址';
  }

  if (
    e.statusCode === 404 &&
    (String(e.url ?? '').includes('/messages') ||
      String(e.url ?? '').includes('anthropic'))
  ) {
    return 'AI 网关不支持 Anthropic Messages 接口，请将 agent.provider 设为 anthropic，并确认 agent.url 指向 Messages API 兼容地址';
  }

  if (bodyText.includes('Model disabled') || bodyText.includes('"code":30003')) {
    return '当前 agent.model 在 AI 网关已下线或无权限，请在 config.development.local.json5 中更换模型';
  }

  if (e.statusCode === 403) {
    return `AI 接口拒绝访问（403）${bodyText ? `：${bodyText}` : '，请检查 agent.key 与 model'}`;
  }

  if (e.statusCode === 401) {
    return 'AI 接口鉴权失败（401），请检查 agent.key';
  }

  return e.message || bodyText || 'AI 调用失败';
}

function isAiSdkError(error: Error): boolean {
  return error.name === 'AI_APICallError' || error.name === 'AI_NoObjectGeneratedError';
}

export function toAiBusinessError(error: unknown): Error {
  return new Error(formatAiCallError(error));
}
