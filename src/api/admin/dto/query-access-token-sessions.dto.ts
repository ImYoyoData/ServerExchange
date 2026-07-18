import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryAccessTokenSessionsSchema = z.object({
  page: z.coerce
    .number()
    .optional()
    .transform((val) => (val ? Number(val) : 1))
    .refine((val) => val > 0, { message: '页码必须大于0' })
    .default(1)
    .describe('页码'),

  pageSize: z.coerce
    .number()
    .optional()
    .transform((val) => (val ? Number(val) : 10))
    .refine((val) => val > 0 && val <= 100, {
      message: '每页条数必须在1-100之间',
    })
    .default(10)
    .describe('每页条数'),

  /** 匹配用户名 / 设备 / jti（不区分大小写） */
  keyword: z.string().optional().default('').describe('搜索关键词'),
});

export class QueryAccessTokenSessionsDto extends createZodDto(
  QueryAccessTokenSessionsSchema,
) {}
