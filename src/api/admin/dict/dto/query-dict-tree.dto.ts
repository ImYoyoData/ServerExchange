import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryDictTreeSchema = z.object({
  // sys_dict.code
  code: z.string().min(1, '字典code不能为空'),

  // sys_dict_data.status：默认只返回启用（true）
  status: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'string') {
        if (val === 'true' || val === '1') return true;
        if (val === 'false' || val === '0') return false;
        return val;
      }
      if (typeof val === 'number') return val === 1;
      if (typeof val === 'boolean') return val;
      return val;
    }, z.boolean().optional().nullable())
    .default(true),
});

export class QueryDictTreeDto extends createZodDto(QueryDictTreeSchema) {}
