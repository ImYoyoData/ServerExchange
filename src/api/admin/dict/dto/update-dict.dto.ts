import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CreateDictDtoSchema } from './create-dict.dto';

export const UpdateDictDtoSchema = CreateDictDtoSchema.partial().extend({
  id: z.coerce.number().int().positive().describe('字典id'),
  code: z.string().min(1, '字典code不能为空').optional(),
  name: z.string().min(1, '字典名称不能为空').optional(),
  description: z.string().optional().nullable(),
  status: z.coerce.boolean().optional(),
});

export class UpdateDictDto extends createZodDto(UpdateDictDtoSchema) {}
