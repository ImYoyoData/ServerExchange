import { ToolLoopAgent, isStepCount, tool } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { toAiBusinessError } from '../ai-error';
import { runTypeormEntityWorkflow } from '../graphs/typeorm-entity.graph';
import { TYPEORM_ENTITY_AGENT_INSTRUCTIONS } from '../templates/typeorm-entity-agent.template';
import {
  ASK_USER_TOOL,
  askUserOutputSchema,
  createAskUserTool,
  normalizeAskUserInput,
  type AskUserToolOutput,
} from '../tools/ask-user.tool';
import {
  FETCH_WEB_PAGE_TOOL,
  createFetchWebPageTool,
} from '../tools/fetch-web-page.tool';
import {
  SEARCH_WEB_TOOL,
  createSearchWebTool,
} from '../tools/search-web.tool';
import type {
  AgentWebToolOptions,
  FetchWebPageToolOutput,
  WebSearchToolOutput,
} from '../tools/web-tools.types';

const GENERATE_TOOL = 'generateValidatedTypeormEntity';

const STREAM_TOOL_NAMES = new Set([
  ASK_USER_TOOL,
  GENERATE_TOOL,
  SEARCH_WEB_TOOL,
  FETCH_WEB_PAGE_TOOL,
]);

const generateToolOutputSchema = z.object({
  ok: z.boolean(),
  code: z.string().optional(),
  validationReason: z.string().optional(),
  attempts: z.number().optional(),
  reason: z.string().optional(),
});

export type TypeormEntityAgentRuntime = {
  userContext?: string;
  web?: AgentWebToolOptions;
};

export type TypeormEntityAgentResult = {
  kind: 'chat' | 'entity';
  message: string;
  code?: string;
  validationReason?: string;
  attempts?: number;
};

export type TypeormEntityStreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-start'; toolName: string }
  | {
      type: 'ask';
      question: string;
      hint?: string;
      options?: Array<{ id: string; label: string }>;
    }
  | {
      type: 'web-info';
      toolName: string;
      ok: boolean;
      title?: string;
      url?: string;
      summary: string;
    }
  | {
      type: 'entity';
      code: string;
      validationReason?: string;
      attempts?: number;
    }
  | {
      type: 'done';
      kind: 'chat' | 'entity';
      message?: string;
      code?: string;
      validationReason?: string;
      attempts?: number;
    }
  | { type: 'error'; message: string };

function buildAgentPrompt(message: string, userContext: string): string {
  const parts: string[] = [];
  const history = userContext.trim();
  if (history) {
    parts.push(`【对话历史】\n${history}`);
  }
  parts.push(`【本轮用户输入】\n${message.trim()}`);
  return parts.join('\n\n');
}

function findLatestGenerateToolOutput(
  toolResults: Array<{ toolName: string; output: unknown }>,
) {
  for (let i = toolResults.length - 1; i >= 0; i -= 1) {
    const item = toolResults[i];
    if (item.toolName !== GENERATE_TOOL) continue;
    const parsed = generateToolOutputSchema.safeParse(item.output);
    if (parsed.success) return parsed.data;
  }
  return null;
}

function findLatestAskUserToolOutput(
  toolResults: Array<{ toolName: string; output: unknown }>,
): AskUserToolOutput | null {
  for (let i = toolResults.length - 1; i >= 0; i -= 1) {
    const item = toolResults[i];
    if (item.toolName !== ASK_USER_TOOL) continue;
    const parsed = askUserOutputSchema.safeParse(item.output);
    if (parsed.success) return parsed.data;
    return normalizeAskUserInput(item.output);
  }
  return null;
}

function parseAskUserToolOutput(output: unknown): AskUserToolOutput {
  const parsed = askUserOutputSchema.safeParse(output);
  if (parsed.success) return parsed.data;
  return normalizeAskUserInput(output);
}

function buildAskStreamPayload(toolOutput: AskUserToolOutput) {
  return {
    type: 'ask' as const,
    question: toolOutput.question,
    hint: toolOutput.hint,
    options: toolOutput.options,
  };
}

function summarizeSearchOutput(output: WebSearchToolOutput) {
  if (!output.ok) {
    return output.error || '搜索未返回有效结果';
  }
  return output.results
    .slice(0, 3)
    .map(
      (item, index) =>
        `${index + 1}. ${item.title}\n${item.url}\n${item.snippet}`,
    )
    .join('\n\n');
}

function summarizeFetchOutput(output: FetchWebPageToolOutput) {
  if (!output.ok) {
    return output.error || '网页抓取失败';
  }
  const head = output.title ? `${output.title}\n${output.url}` : output.url;
  const body = String(output.content ?? '').slice(0, 280);
  return `${head}\n${body}${body.length >= 280 ? '...' : ''}`;
}

function buildWebInfoFromOutput(
  toolName: string,
  output: unknown,
): {
  type: 'web-info';
  toolName: string;
  ok: boolean;
  title?: string;
  url?: string;
  summary: string;
} | null {
  if (toolName === SEARCH_WEB_TOOL) {
    const data = output as WebSearchToolOutput;
    return {
      type: 'web-info',
      toolName,
      ok: !!data.ok,
      title: data.query,
      summary: summarizeSearchOutput(data),
    };
  }

  if (toolName === FETCH_WEB_PAGE_TOOL) {
    const data = output as FetchWebPageToolOutput;
    return {
      type: 'web-info',
      toolName,
      ok: !!data.ok,
      title: data.title,
      url: data.url,
      summary: summarizeFetchOutput(data),
    };
  }

  return null;
}

export function createTypeormEntityAgent(
  model: LanguageModel,
  runtime: TypeormEntityAgentRuntime = {},
) {
  const userContext = runtime.userContext ?? '';
  const webOptions = runtime.web ?? {};

  const tools = {
    [ASK_USER_TOOL]: createAskUserTool(),
    [SEARCH_WEB_TOOL]: createSearchWebTool(webOptions),
    [FETCH_WEB_PAGE_TOOL]: createFetchWebPageTool(webOptions),
    [GENERATE_TOOL]: tool({
      description:
        '根据明确的实体/表结构需求，生成并通过规则+LLM 校验 TypeORM 实体 TS 代码（内部最多重试 3 次）',
      inputSchema: z.object({
        requirement: z
          .string()
          .min(1)
          .describe('整理后的实体设计需求摘要（含表名、字段、类型、约束等）'),
      }),
      execute: async ({ requirement }) => {
        const state = await runTypeormEntityWorkflow(model, {
          requirement,
          userContext,
        });

        if (!state.validationOk) {
          return {
            ok: false,
            reason:
              state.validationReason ||
              state.validationFeedback ||
              '校验未通过',
            attempts: state.attempts,
            code: state.code,
          };
        }

        return {
          ok: true,
          code: state.code,
          validationReason: state.validationReason,
          attempts: state.attempts,
        };
      },
    }),
  };

  return new ToolLoopAgent({
    model,
    instructions: TYPEORM_ENTITY_AGENT_INSTRUCTIONS,
    temperature: 0.4,
    stopWhen: isStepCount(12),
    tools,
    experimental_refineToolInput: {
      [ASK_USER_TOOL]: (input) => normalizeAskUserInput(input),
    },
  });
}

export async function runTypeormEntityAgent(
  model: LanguageModel,
  message: string,
  runtime: TypeormEntityAgentRuntime = {},
): Promise<TypeormEntityAgentResult> {
  const userContext = runtime.userContext ?? '';
  const agent = createTypeormEntityAgent(model, runtime);

  let result;
  try {
    result = await agent.generate({
      prompt: buildAgentPrompt(message, userContext),
    });
  } catch (error) {
    throw toAiBusinessError(error);
  }

  const toolOutput = findLatestGenerateToolOutput(
    result.toolResults.map((item) => ({
      toolName: item.toolName,
      output: item.output,
    })),
  );

  if (toolOutput?.ok && toolOutput.code) {
    return {
      kind: 'entity',
      message:
        result.text.trim() ||
        toolOutput.validationReason ||
        '已生成 TypeORM 实体代码',
      code: toolOutput.code,
      validationReason: toolOutput.validationReason,
      attempts: toolOutput.attempts,
    };
  }

  if (toolOutput && !toolOutput.ok) {
    throw new Error(
      `已尝试 ${toolOutput.attempts ?? 0} 次仍未通过校验：${toolOutput.reason ?? '未知原因'}`,
    );
  }

  const askOutput = findLatestAskUserToolOutput(
    result.toolResults.map((item) => ({
      toolName: item.toolName,
      output: item.output,
    })),
  );

  if (askOutput) {
    const reply = result.text.trim() || askOutput.question;
    return {
      kind: 'chat',
      message: reply,
    };
  }

  const reply =
    result.text.trim() ||
    '你好，我是 TypeORM 实体助手。请描述你要生成的表/实体（字段、类型、约束等）。';

  return {
    kind: 'chat',
    message: reply,
  };
}

function parseGenerateToolOutput(output: unknown) {
  return generateToolOutputSchema.safeParse(output);
}

function buildEntityStreamPayload(toolOutput: z.infer<typeof generateToolOutputSchema>) {
  return {
    type: 'entity' as const,
    code: toolOutput.code!,
    validationReason: toolOutput.validationReason,
    attempts: toolOutput.attempts,
  };
}

async function collectEntityFromToolResults(
  toolResults: Array<{ toolName: string; output: unknown }>,
) {
  for (let i = toolResults.length - 1; i >= 0; i -= 1) {
    const item = toolResults[i];
    if (item.toolName !== GENERATE_TOOL) continue;
    const parsed = parseGenerateToolOutput(item.output);
    if (parsed.success && parsed.data.ok && parsed.data.code) {
      return parsed.data;
    }
  }
  return null;
}

async function collectAskFromToolResults(
  toolResults: Array<{ toolName: string; output: unknown }>,
) {
  for (let i = toolResults.length - 1; i >= 0; i -= 1) {
    const item = toolResults[i];
    if (item.toolName !== ASK_USER_TOOL) continue;
    return parseAskUserToolOutput(item.output);
  }
  return null;
}

function isWebTool(toolName: string) {
  return toolName === SEARCH_WEB_TOOL || toolName === FETCH_WEB_PAGE_TOOL;
}

export async function* streamTypeormEntityAgent(
  model: LanguageModel,
  message: string,
  runtime: TypeormEntityAgentRuntime = {},
): AsyncGenerator<TypeormEntityStreamEvent, void, unknown> {
  const userContext = runtime.userContext ?? '';
  const agent = createTypeormEntityAgent(model, runtime);

  let streamResult;
  try {
    streamResult = await agent.stream({
      prompt: buildAgentPrompt(message, userContext),
    });
  } catch (error) {
    const err = toAiBusinessError(error);
    yield {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
    return;
  }

  let entityEmitted = false;
  let askEmitted = false;
  let latestAskOutput: AskUserToolOutput | null = null;

  try {
    for await (const part of streamResult.fullStream) {
      if (part.type === 'text-delta' && part.text) {
        yield { type: 'text-delta', text: part.text };
        continue;
      }

      if (part.type === 'tool-call' && STREAM_TOOL_NAMES.has(part.toolName)) {
        yield { type: 'tool-start', toolName: part.toolName };
        continue;
      }

      if (part.type === 'tool-result' && part.toolName === GENERATE_TOOL) {
        const parsed = parseGenerateToolOutput(part.output);
        if (!parsed.success) continue;

        const toolOutput = parsed.data;
        if (toolOutput.ok && toolOutput.code) {
          entityEmitted = true;
          yield buildEntityStreamPayload(toolOutput);
          continue;
        }

        if (!toolOutput.ok) {
          yield {
            type: 'error',
            message: `已尝试 ${toolOutput.attempts ?? 0} 次仍未通过校验：${toolOutput.reason ?? '未知原因'}`,
          };
          return;
        }
      }

      if (part.type === 'tool-result' && part.toolName === ASK_USER_TOOL) {
        latestAskOutput = parseAskUserToolOutput(part.output);
        askEmitted = true;
        yield buildAskStreamPayload(latestAskOutput);
        continue;
      }

      if (part.type === 'tool-result' && isWebTool(part.toolName)) {
        const webInfo = buildWebInfoFromOutput(part.toolName, part.output);
        if (webInfo) {
          yield webInfo;
        }
        continue;
      }

      if (part.type === 'tool-error' && part.toolName === ASK_USER_TOOL) {
        latestAskOutput = normalizeAskUserInput(part.input);
        askEmitted = true;
        yield buildAskStreamPayload(latestAskOutput);
        continue;
      }

      if (part.type === 'tool-error' && part.toolName === GENERATE_TOOL) {
        const errText =
          part.error instanceof Error
            ? part.error.message
            : String(part.error ?? '工具执行失败');
        yield { type: 'error', message: errText };
        return;
      }

      if (part.type === 'tool-error' && isWebTool(part.toolName)) {
        const webInfo = buildWebInfoFromOutput(part.toolName, {
          ok: false,
          error:
            part.error instanceof Error
              ? part.error.message
              : String(part.error ?? '网络工具执行失败'),
        });
        if (webInfo) {
          yield webInfo;
        }
        continue;
      }

      if (part.type === 'error') {
        const err = toAiBusinessError(part.error);
        yield {
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        };
        return;
      }
    }

    if (!entityEmitted) {
      const staticToolResults = await streamResult.staticToolResults;
      const toolOutput = await collectEntityFromToolResults(
        staticToolResults.map((item) => ({
          toolName: item.toolName,
          output: item.output,
        })),
      );
      if (toolOutput) {
        entityEmitted = true;
        yield buildEntityStreamPayload(toolOutput);
      }
    }

    if (!askEmitted) {
      const staticToolResults = await streamResult.staticToolResults;
      const askOutput = await collectAskFromToolResults(
        staticToolResults.map((item) => ({
          toolName: item.toolName,
          output: item.output,
        })),
      );
      if (askOutput) {
        latestAskOutput = askOutput;
        askEmitted = true;
        yield buildAskStreamPayload(askOutput);
      }
    }

    const finalText = (await streamResult.text).trim();
    const staticToolResults = await streamResult.staticToolResults;
    const finalToolOutput = entityEmitted
      ? await collectEntityFromToolResults(
          staticToolResults.map((item) => ({
            toolName: item.toolName,
            output: item.output,
          })),
        )
      : null;

    if (entityEmitted) {
      yield {
        type: 'done',
        kind: 'entity',
        message: finalText || undefined,
        code: finalToolOutput?.code,
        validationReason: finalToolOutput?.validationReason,
        attempts: finalToolOutput?.attempts,
      };
      return;
    }

    if (askEmitted && latestAskOutput) {
      yield {
        type: 'done',
        kind: 'chat',
        message: finalText || latestAskOutput.question,
      };
      return;
    }

    yield {
      type: 'done',
      kind: 'chat',
      message: finalText || undefined,
    };
  } catch (error) {
    const err = toAiBusinessError(error);
    yield {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
