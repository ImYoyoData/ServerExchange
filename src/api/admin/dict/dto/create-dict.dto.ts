import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const CreateDictDtoSchema = z.object({
  code: z.string().min(1, '字典code不能为空'),
  name: z.string(),
  description: z.string().optional(),
  status: z.coerce.boolean().optional().default(true),
});

export class CreateDictDto extends createZodDto(CreateDictDtoSchema) {}
