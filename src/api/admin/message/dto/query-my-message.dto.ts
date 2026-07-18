import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryMyMessageSchema = z
  .object({
    page: z.coerce.number().optional().default(1).describe('页码'),
    pageSize: z.coerce
      .number()
      .optional()
      .default(50)
      .refine((val) => val > 0 && val <= 100, {
        message: '每页条数必须在1-100之间',
      })
      .describe('每页数量，默认50'),
    /** 消息类型：1-通知、2-消息；不传为全部 */
    type: z.coerce.number().int().optional().describe('消息类型'),
  })
  .passthrough();

export class QueryMyMessageDto extends createZodDto(QueryMyMessageSchema) {}
