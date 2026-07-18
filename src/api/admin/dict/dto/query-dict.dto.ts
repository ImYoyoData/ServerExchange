import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryDictSchema = z
  .object({
    // 分页参数
    page: z.coerce.number().optional().default(1).describe('页码'),
    pageSize: z.coerce
      .number()
      .optional()
      .default(10)
      .refine((val) => val > 0 && val <= 100, {
        message: '每页条数必须在1-100之间',
      })
      .describe('每页数量'),

    // 查询参数
    code: z.string().optional().default('').describe('字典编码'),
    name: z.string().optional().default('').describe('字典名称'),
    status: z
      .preprocess((val) => {
        if (val === undefined || val === null || val === '') return undefined;
        if (typeof val === 'string') {
          if (val === 'true' || val === '1') return true;
          if (val === 'false' || val === '0') return false;
          return val;
        }
        if (typeof val === 'number') return val === 1;
        return val;
      }, z.boolean().optional().nullable())
      .optional()
      .describe('状态: true/1/启用, false/0/禁用, 空/全部'),
  })
  .passthrough();

export class QueryDictDto extends createZodDto(QueryDictSchema) {}
