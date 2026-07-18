import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export type AgentProviderType = 'openai' | 'anthropic';

export type AgentAiConfig = {
  provider?: AgentProviderType | string;
  url: string;
  key: string;
  model: string;
};

const DEFAULT_MODEL_BY_PROVIDER: Record<AgentProviderType, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-20250514',
};

const DEFAULT_BASE_URL_BY_PROVIDER: Record<AgentProviderType, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
};

export const DEFAULT_PROVIDER: AgentProviderType = 'openai';

/** 支持 openai / anthropic，兼容旧写法 openai-compatible / anthropic-compatible */
export function normalizeAgentProvider(
  provider?: string | null,
): AgentProviderType {
  const value = String(provider ?? '').trim().toLowerCase();
  if (value === 'anthropic' || value === 'anthropic-compatible') {
    return 'anthropic';
  }
  return 'openai';
}

/**
 * 创建语言模型实例。
 * - openai：OpenAI Chat Completions（硅基流动 / OneAPI / vLLM 等）
 * - anthropic：Anthropic Messages API（官方或兼容网关）
 */
export function createAgentLanguageModel(config: AgentAiConfig): LanguageModel {
  const providerType = normalizeAgentProvider(config.provider);
  const modelId =
    String(config.model ?? '').trim() || DEFAULT_MODEL_BY_PROVIDER[providerType];
  const baseURL =
    String(config.url ?? '').trim() || DEFAULT_BASE_URL_BY_PROVIDER[providerType];
  const apiKey = config.key || 'not-configured';

  if (providerType === 'anthropic') {
    const anthropic = createAnthropic({
      apiKey,
      baseURL,
    });
    return anthropic(modelId);
  }

  const openai = createOpenAI({
    apiKey,
    baseURL,
  });
  return openai.chat(modelId);
}
