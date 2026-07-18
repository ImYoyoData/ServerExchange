import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryFilePageSchema = z
  .object({
    page: z.coerce.number().int().optional().default(1).describe('页码'),
    pageSize: z.coerce
      .number()
      .int()
      .optional()
      .default(10)
      .refine((v) => v > 0 && v <= 100, {
        message: 'pageSize 必须在 1-100 之间',
      })
      .describe('每页条数'),
    fileName: z.string().optional().default('').describe('文件名模糊搜索'),
    fileType: z.string().optional().default('').describe('文件类型模糊搜索'),
    module: z.string().optional().default('').describe('模块模糊搜索'),
    fileSizeMin: z.coerce
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('文件最小大小(字节)'),
    fileSizeMax: z.coerce
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('文件最大大小(字节)'),
  })
  .refine(
    (v) =>
      v.fileSizeMin === undefined ||
      v.fileSizeMax === undefined ||
      v.fileSizeMin <= v.fileSizeMax,
    { message: 'fileSizeMin 不能大于 fileSizeMax' },
  )
  .passthrough();

export class QueryFilePageDto extends createZodDto(QueryFilePageSchema) {}
