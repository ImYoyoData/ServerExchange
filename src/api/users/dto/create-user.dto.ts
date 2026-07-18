import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateUserSchema = z.object({
  id: z.coerce.number().optional().default(0).describe('用户ID'),
  name: z.string().min(2, '用户名至少2个字符').describe('用户名称'),
  email: z
    .string()
    .email('请输入正确的邮箱格式')
    .optional()
    .default('')
    .describe('电子邮箱'),
  password: z.string().min(6, '用户密码至少6个字符').describe('用户密码'),
  isBanned: z.boolean().optional().default(false).describe('是否禁用'),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
