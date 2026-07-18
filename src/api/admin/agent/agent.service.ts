import { Injectable, Logger, type MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { generateText, streamText } from 'ai';
import type { LanguageModel } from 'ai';
import {
  createAgentLanguageModel,
  DEFAULT_PROVIDER,
  normalizeAgentProvider,
  type AgentAiConfig,
} from './ai-model';
import { toAiBusinessError } from './ai-error';
import { runTypeormEntityAgent, streamTypeormEntityAgent, type TypeormEntityStreamEvent } from './agents/typeorm-entity.agent';
import type { AgentWebToolOptions } from './tools/web-tools.types';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly languageModel: LanguageModel;
  private readonly agentConfig: AgentAiConfig;
  private readonly webToolOptions: AgentWebToolOptions;

  constructor(private readonly config: ConfigService) {
    this.agentConfig = {
      provider: normalizeAgentProvider(
        this.config.get<string>('agent.provider', DEFAULT_PROVIDER),
      ),
      url: this.config.get<string>('agent.url', '').trim(),
      key: this.config.get<string>('agent.key', '').trim(),
      model: this.config.get<string>('agent.model', '').trim(),
    };
    this.webToolOptions = {
      jinaKey: this.config.get<string>('agent.jinaKey', '')?.trim() || undefined,
    };
    if (!this.agentConfig.url || !this.agentConfig.key) {
      this.logger.warn(
        'AI_URL 或 AI_KEY 未配置：请在 .env 中设置后重启服务，否则对话流式接口会失败。',
      );
    }

    this.languageModel = createAgentLanguageModel(this.agentConfig);
  }

  isAiConfigured(): boolean {
    return Boolean(this.agentConfig.url && this.agentConfig.key);
  }

  /**
   * 一次性返回完整回复（非流式）
   */
  async chatOnce(message: string): Promise<string> {
    if (!this.isAiConfigured()) {
      throw new Error('未配置 AI_URL 或 AI_KEY，无法调用模型');
    }

    const { text } = await generateText({
      model: this.languageModel,
      prompt: message,
      temperature: 0.7,
      maxRetries: 2,
    }).catch((error) => {
      throw toAiBusinessError(error);
    });
    return text;
  }

  /**
   * TypeORM 实体 Agent：对话澄清 + 按需调用工具生成/校验实体代码
   */
  async generateTypeormEntityTs(
    requirement: string,
    userContext?: string,
  ): Promise<{
    kind: 'chat' | 'entity';
    message: string;
    code?: string;
    attempts?: number;
    validationReason?: string;
  }> {
    if (!this.isAiConfigured()) {
      throw new Error('未配置 AI_URL 或 AI_KEY，无法调用模型');
    }

    try {
      return await runTypeormEntityAgent(
        this.languageModel,
        requirement,
        {
          userContext: userContext ?? '',
          web: this.webToolOptions,
        },
      );
    } catch (error) {
      throw toAiBusinessError(error);
    }
  }

  /**
   * TypeORM 实体 Agent 流式输出（SSE 事件）
   */
  async *streamTypeormEntityTs(
    requirement: string,
    userContext?: string,
  ): AsyncGenerator<TypeormEntityStreamEvent, void, unknown> {
    if (!this.isAiConfigured()) {
      throw new Error('未配置 AI_URL 或 AI_KEY，无法调用模型');
    }

    yield* streamTypeormEntityAgent(
      this.languageModel,
      requirement,
      {
        userContext: userContext ?? '',
        web: this.webToolOptions,
      },
    );
  }

  /**
   * AI SDK 流式输出（按 token / 片段迭代）
   */
  async *streamChat(message: string): AsyncGenerator<string, void, unknown> {
    if (!this.isAiConfigured()) {
      throw new Error('未配置 AI_URL 或 AI_KEY，无法调用模型');
    }

    const result = streamText({
      model: this.languageModel,
      prompt: message,
      temperature: 0.7,
      maxRetries: 2,
    });

    try {
      for await (const text of result.textStream) {
        if (text.length > 0) {
          yield text;
        }
      }
    } catch (error) {
      throw toAiBusinessError(error);
    }
  }

  /**
   * 供 Nest 的 @Sse() 使用：把异步迭代封装为 Observable，每条事件的 data 为 JSON 字符串。
   */
  streamChatSse(message: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      void (async () => {
        try {
          for await (const text of this.streamChat(message)) {
            subscriber.next({
              data: JSON.stringify({ type: 'delta', text }),
            });
          }
          subscriber.next({ data: JSON.stringify({ type: 'done' }) });
          subscriber.complete();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          subscriber.next({
            data: JSON.stringify({ type: 'error', message: msg }),
          });
          subscriber.complete();
        }
      })();
    });
  }
}
