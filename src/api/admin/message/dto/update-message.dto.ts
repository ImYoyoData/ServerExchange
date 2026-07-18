import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * 编辑允许改标题、正文、跳转地址；接收用户 userId、已读状态等不可通过此接口修改。
 */
export const UpdateMessageSchema = z
  .object({
    id: z.coerce.number().int().positive().describe('消息ID'),
    title: z
      .string()
      .min(1, '标题不能为空')
      .max(255)
      .optional()
      .describe('标题'),
    content: z.string().min(1, '内容不能为空').optional().describe('消息内容'),
    redirectUrl: z
      .string()
      .max(255)
      .optional()
      .nullable()
      .describe('跳转路径；不传不改，传 null 或空串可清空'),
  })
  .strict()
  .refine(
    (d) =>
      d.title !== undefined ||
      d.content !== undefined ||
      d.redirectUrl !== undefined,
    {
      message: 'title、content、redirectUrl 至少传一项',
      path: ['content'],
    },
  );

export class UpdateMessageDto extends createZodDto(UpdateMessageSchema) {}
