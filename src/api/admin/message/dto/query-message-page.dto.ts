import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const boolFromQuery = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'string') {
    if (val === 'true' || val === '1') return true;
    if (val === 'false' || val === '0') return false;
    return val;
  }
  if (typeof val === 'number') return val === 1;
  return val;
}, z.boolean().optional().nullable());

export const QueryMessagePageSchema = z
  .object({
    page: z.coerce.number().optional().default(1).describe('页码'),
    pageSize: z.coerce
      .number()
      .optional()
      .default(10)
      .refine((val) => val > 0 && val <= 100, {
        message: '每页条数必须在1-100之间',
      })
      .describe('每页数量'),
    /** 同时匹配标题、内容（模糊） */
    keyword: z.string().optional().default('').describe('搜索关键词'),
    /** 已读状态：true 已读 / false 未读；不传为全部 */
    status: boolFromQuery.optional().describe('已读状态'),
    /** 消息类型：1-通知、2-消息；不传为全部 */
    type: z.coerce.number().int().optional().describe('消息类型'),
    /** 接收用户（sys_admin.id）；不传为全部 */
    userId: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .describe('接收用户ID'),
  })
  .passthrough();

export class QueryMessagePageDto extends createZodDto(QueryMessagePageSchema) {}
