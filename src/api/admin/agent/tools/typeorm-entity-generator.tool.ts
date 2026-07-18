import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import {
  TYPEORM_ENTITY_SYSTEM_TEMPLATE,
  TYPEORM_ENTITY_USER_TEMPLATE,
} from '../templates/typeorm-entity.template';
import { stripMarkdownCodeFence } from './strip-markdown-code-fence';

export async function generateTypeormEntityCode(
  model: LanguageModel,
  requirement: string,
): Promise<string> {
  const prompt = TYPEORM_ENTITY_USER_TEMPLATE.replace(
    '{requirement}',
    requirement,
  );

  const { text } = await generateText({
    model,
    system: TYPEORM_ENTITY_SYSTEM_TEMPLATE,
    prompt,
    temperature: 0.2,
    maxRetries: 2,
  });

  return stripMarkdownCodeFence(text);
}
