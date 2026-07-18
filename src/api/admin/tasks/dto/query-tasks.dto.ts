import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

function isValidDateTimeString(v: string): boolean {
  const normalized = v.replace(' ', 'T');
  return !Number.isNaN(Date.parse(normalized));
}

function normalizeDateTimeInput(val: unknown): string | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string') {
    const s = val.trim();
    return s ? s : undefined;
  }
  if (val instanceof Date) return val.toISOString();
  return undefined;
}

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

export const QueryTasksSchema = z
  .object({
    page: z.coerce.number().int().optional().default(1).describe('页码'),
    pageSize: z.coerce
      .number()
      .int()
      .optional()
      .default(10)
      .refine((val) => val > 0 && val <= 100, {
        message: '每页条数必须在1-100之间',
      })
      .describe('每页数量'),
    name: z.string().optional().default('').describe('任务名称模糊搜索'),
    enabled: boolFromQuery.optional().describe('启用筛选'),

    lastExecuteTimeBegin: z
      .preprocess(
        (val) => normalizeDateTimeInput(val),
        z
          .string()
          .optional()
          .refine(
            (v) => !v || isValidDateTimeString(v),
            'lastExecuteTimeBegin 时间格式不正确',
          ),
      )
      .describe('上次执行时间开始（含）'),
    lastExecuteTimeEnd: z
      .preprocess(
        (val) => normalizeDateTimeInput(val),
        z
          .string()
          .optional()
          .refine(
            (v) => !v || isValidDateTimeString(v),
            'lastExecuteTimeEnd 时间格式不正确',
          ),
      )
      .describe('上次执行时间结束（含）'),
  })
  .refine(
    (v) =>
      !v.lastExecuteTimeBegin ||
      !v.lastExecuteTimeEnd ||
      Date.parse(v.lastExecuteTimeBegin.replace(' ', 'T')) <=
        Date.parse(v.lastExecuteTimeEnd.replace(' ', 'T')),
    { message: 'lastExecuteTimeBegin 不能大于 lastExecuteTimeEnd' },
  )
  .passthrough();

export class QueryTasksDto extends createZodDto(QueryTasksSchema) {}
