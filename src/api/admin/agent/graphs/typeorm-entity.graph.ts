import type { LanguageModel } from 'ai';
import { generateTypeormEntityCode } from '../tools/typeorm-entity-generator.tool';
import { validateTypeormEntityWithLlm } from '../tools/typeorm-entity-validator.tool';

const MAX_GENERATION_ATTEMPTS = 3;

export type TypeormEntityWorkflowState = {
  requirement: string;
  userContext: string;
  combinedInput: string;
  code: string;
  attempts: number;
  validationOk: boolean;
  validationReason: string;
  validationFeedback: string;
};

function prepareCombinedInput(
  requirement: string,
  userContext: string,
): string {
  const parts: string[] = [];
  const ctx = userContext.trim();
  if (ctx) {
    parts.push(`用户信息 / 补充上下文：\n${ctx}`);
  }
  parts.push(`实体设计需求：\n${requirement.trim()}`);
  return parts.join('\n\n');
}

/**
 * 用户信息 + 需求 → 生成 → AI 校验 → 不通过则重试，最多 3 次。
 */
export async function runTypeormEntityWorkflow(
  model: LanguageModel,
  input: Pick<TypeormEntityWorkflowState, 'requirement' | 'userContext'>,
): Promise<TypeormEntityWorkflowState> {
  const state: TypeormEntityWorkflowState = {
    requirement: input.requirement,
    userContext: input.userContext ?? '',
    combinedInput: prepareCombinedInput(
      input.requirement,
      input.userContext ?? '',
    ),
    code: '',
    attempts: 0,
    validationOk: false,
    validationReason: '',
    validationFeedback: '',
  };

  while (state.attempts < MAX_GENERATION_ATTEMPTS) {
    let promptBody = state.combinedInput;
    const feedback = state.validationFeedback.trim();
    if (feedback) {
      promptBody += `\n\n【上次未通过校验】审查意见：\n${feedback}\n请根据意见输出修正后的完整 TypeORM 实体 TS 源码（仅源码，无 Markdown 围栏、无说明文字）。`;
    }

    state.code = await generateTypeormEntityCode(model, promptBody);
    state.attempts += 1;

    const validation = await validateTypeormEntityWithLlm(
      model,
      state.combinedInput,
      state.code,
    );
    state.validationOk = validation.valid;
    state.validationReason = validation.reason;
    state.validationFeedback = validation.valid ? '' : validation.reason;

    if (state.validationOk) {
      break;
    }
  }

  return state;
}
