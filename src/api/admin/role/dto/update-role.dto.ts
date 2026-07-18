import { createZodDto } from 'nestjs-zod';
import { CreateRoleSchema } from './create-role.dto';
import z from 'zod';

export const UpdateRoleSchema = CreateRoleSchema.partial().extend({
  id: z.number(),
  status: z.coerce.boolean().describe('角色状态').optional(),
});
export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}
