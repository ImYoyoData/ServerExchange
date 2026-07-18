import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateDictItemSchema = z
  .object({
    parentId: z.coerce.number().int().positive('parentId不能为空'),
    name: z.string().min(1, '名称不能为空'),
    value: z.string().min(1, 'value不能为空'),

    description: z.string().optional().nullable(),
    tagType: z.string().optional().default('default'),

    // 嵌套字典id：用于指定下一层来源字典
    dictId: z.preprocess(
      (val) => (val === '' || val === '0' || val === 0 ? null : val),
      z.coerce.number().int().positive().optional().nullable(),
    ),

    sort: z.coerce.number().int().optional().default(0),
    status: z.coerce.boolean().optional().default(true),

    createdBy: z.string().optional().nullable(),
    updatedBy: z.string().optional().nullable(),
  })
  .passthrough();

export type DictItemInputDto = z.infer<typeof CreateDictItemSchema>;

export class CreateDictItemDto extends createZodDto(CreateDictItemSchema) {}
