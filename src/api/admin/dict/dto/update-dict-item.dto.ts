import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateDictItemSchema = z
  .object({
    id: z.coerce.number().int().positive().describe('字典项id'),

    // 关系字段：如果未传则在 service 中使用原值
    parentId: z.preprocess(
      (val) => (val === '' || val === null ? undefined : val),
      z.coerce.number().int().positive().optional(),
    ),

    name: z.string().min(1).optional(),
    value: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    tagType: z.string().optional(),

    // 嵌套字典id：用于指定下一层来源字典
    dictId: z.preprocess(
      (val) => (val === '' || val === '0' || val === 0 ? null : val),
      z.coerce.number().int().positive().optional().nullable(),
    ),

    sort: z.coerce.number().int().optional(),
    status: z.coerce.boolean().optional(),

    updatedBy: z.string().optional().nullable(),
    createdBy: z.string().optional().nullable(),
  })
  .passthrough();

export class UpdateDictItemDto extends createZodDto(UpdateDictItemSchema) {}
