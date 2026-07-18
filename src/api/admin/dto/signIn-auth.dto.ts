import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SignInAuthSchema = z.object({
  username: z.string().min(2, '用户名至少2个字符').describe('用户名称'),
  password: z.string().min(6, '用户密码至少6个字符').describe('用户密码'),
});

export class SignInAuthDto extends createZodDto(SignInAuthSchema) {}
