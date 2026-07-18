import { tool } from 'ai';
import { z } from 'zod';

export const ASK_USER_TOOL = 'askUser';

export const DEFAULT_ASK_USER_QUESTION =
  '请补充实体设计所需的关键信息：表名、各字段名称与类型、是否可空、唯一约束、索引及关联关系等。';

const askUserOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const askUserInputSchema = z.object({
  /** 向用户提出的具体问题；若模型未填写会在服务端兜底 */
  question: z
    .string()
    .optional()
    .describe('向用户提出的完整追问句，禁止留空；例如「请提供表名和各字段类型？」'),
  hint: z
    .string()
    .optional()
    .describe('可选补充说明，帮助用户理解如何回答'),
  options: z
    .array(askUserOptionSchema)
    .optional()
    .describe('可选：选择题选项（2-4 个），无则留空'),
});

export const askUserOutputSchema = z.object({
  ok: z.literal(true),
  question: z.string().min(1),
  hint: z.string().optional(),
  options: z.array(askUserOptionSchema).optional(),
});

export type AskUserToolOutput = z.infer<typeof askUserOutputSchema>;

export function normalizeAskUserInput(input: unknown): AskUserToolOutput {
  const parsed = askUserInputSchema.safeParse(input);
  const raw = parsed.success ? parsed.data : {};
  const question = String(raw.question ?? '').trim() || DEFAULT_ASK_USER_QUESTION;
  const hint = String(raw.hint ?? '').trim() || undefined;
  const options =
    raw.options?.filter((item) => item.id.trim() && item.label.trim()) ?? undefined;

  return {
    ok: true,
    question,
    ...(hint ? { hint } : {}),
    ...(options?.length ? { options } : {}),
  };
}

export function createAskUserTool() {
  return tool({
    description:
      '当实体需求不明确时，向用户提出 1-2 个关键追问（必须填写 question 参数）。不要用于问候或概念问答。',
    inputSchema: askUserInputSchema,
    execute: async (input) => normalizeAskUserInput(input),
  });
}
