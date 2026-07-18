import { createZodDto } from 'nestjs-zod';
import { CreateAdminSchema } from './create-admin.dto';
import z from 'zod';

export const UpdateAdminSchema = CreateAdminSchema.partial().extend({
  id: z.number(),
  status: z.coerce.boolean().describe('角色状态').optional(),
  avatar: z.coerce.number().int().positive().optional().describe('头像文件ID'),
});
export class UpdateAdminDto extends createZodDto(UpdateAdminSchema) {}
