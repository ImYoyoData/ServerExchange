import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const AgentChatDtoSchema = z.object({
  /** 用户输入的完整问题（单轮对话） */
  message: z.string().min(1, 'message 不能为空'),
});

export class AgentChatDto extends createZodDto(AgentChatDtoSchema) {}
