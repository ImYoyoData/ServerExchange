import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateRoleSchema = z.object({
  id: z.number().optional(),
  code: z.string().min(1).max(20).describe('角色编码'),
  name: z.string().min(1).max(20).describe('角色名称'),
  remark: z.string().max(100).describe('角色描述').optional(),
});

export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}
