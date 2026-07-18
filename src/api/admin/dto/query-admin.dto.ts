// src/admin/dto/query-admin.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryAdminSchema = z.object({
  // 分页参数
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

  // 查询参数
  username: z.string().optional().default('').describe('用户名'),

  phone: z.string().optional().default('').describe('手机号'),

  // status 支持 string | number | boolean
  status: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') {
        return undefined;
      }
      if (typeof val === 'string') {
        if (val === 'true' || val === '1') return true;
        if (val === 'false' || val === '0') return false;
        return val;
      }
      if (typeof val === 'number') {
        return val === 1;
      }
      return val;
    }, z.boolean().optional().nullable())
    .optional()
    .describe('状态: true/1/启用, false/0/禁用, 空/全部'),
});

export class QueryAdminDto extends createZodDto(QueryAdminSchema) {}
