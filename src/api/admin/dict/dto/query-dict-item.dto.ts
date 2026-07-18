import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryDictItemSchema = z
  .object({
    // 分页参数（仅 page 接口会用到）
    page: z.coerce.number().optional().default(1).describe('页码'),
    pageSize: z.coerce.number().optional().default(10).describe('每页数量'),

    // 顶层父ID（一般等于 sys_dict.id）
    parentId: z.coerce.number().int().positive().optional(),
    dictCode: z.string().optional().default(''),

    // 兼容：如果前端只传 code 作为顶层字典编码
    code: z.string().optional().default(''),

    name: z.string().optional().default(''),
    value: z.string().optional().default(''),
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
      .describe('状态: true/1/启用, false/0/禁用'),
  })
  .passthrough();

export class QueryDictItemDto extends createZodDto(QueryDictItemSchema) {}
