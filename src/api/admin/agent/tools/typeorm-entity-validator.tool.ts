import { generateText, Output } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { TYPEORM_ENTITY_VALIDATOR_SYSTEM } from '../templates/typeorm-entity-validator.template';
import { stripMarkdownCodeFence } from './strip-markdown-code-fence';

const validationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string(),
});

export type TypeormEntityValidationResult = z.infer<
  typeof validationResultSchema
>;

/**
 * 规则校验（不调用 LLM）：快速拦截明显不合格输出
 */
export function quickValidateTypeormEntityCode(code: string): {
  ok: boolean;
  reason: string;
} {
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, reason: '代码为空' };
  }
  if (/```/.test(trimmed)) {
    return { ok: false, reason: '仍包含 Markdown 反引号围栏' };
  }
  if (!/@Entity\s*\(/.test(trimmed)) {
    return { ok: false, reason: '缺少 @Entity 装饰器' };
  }
  if (!/@Column\b/.test(trimmed)) {
    return { ok: false, reason: '缺少 @Column 装饰器' };
  }
  const hasPk =
    /@PrimaryGeneratedColumn\b/.test(trimmed) ||
    /@PrimaryColumn\b/.test(trimmed);
  if (!hasPk) {
    return {
      ok: false,
      reason: '缺少主键装饰器（如 @PrimaryGeneratedColumn）',
    };
  }
  if (!/from\s+['"]typeorm['"]/.test(trimmed)) {
    return { ok: false, reason: '缺少从 typeorm 的 import' };
  }
  return { ok: true, reason: '' };
}

export async function validateTypeormEntityWithLlm(
  model: LanguageModel,
  requirementSummary: string,
  rawCode: string,
): Promise<TypeormEntityValidationResult> {
  const code = stripMarkdownCodeFence(rawCode);

  const quick = quickValidateTypeormEntityCode(code);
  if (!quick.ok) {
    return { valid: false, reason: quick.reason };
  }

  const { output } = await generateText({
    model,
    system: TYPEORM_ENTITY_VALIDATOR_SYSTEM,
    prompt: `用户需求摘要：
${requirementSummary}

待审查的 TypeORM 实体 TS 代码：
${code}`,
    output: Output.object({
      schema: validationResultSchema,
    }),
    temperature: 0,
    maxRetries: 2,
  });

  if (!output) {
    return { valid: false, reason: '模型未返回结构化校验结果' };
  }

  return output;
}
