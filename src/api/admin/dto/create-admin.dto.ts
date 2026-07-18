import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const AdminPassword = z
  .string()
  .min(6, '用户密码至少6个字符')
  .describe('用户密码');

export const CreateAdminSchema = z.object({
  username: z
    .string()
    .min(2, '用户名至少2个字符')
    .regex(/^[a-zA-Z0-9]+$/, '用户名只能包含英文和数字')
    .describe('用户名称'),
  password: AdminPassword,
  nickname: z.string().min(1, '昵称不能为空').describe('用户昵称'),
  email: z
    .string()
    .email('邮箱格式不正确')
    .optional()
    .or(z.literal(''))
    .describe('邮箱'),
  phone: z.string().optional().or(z.literal('')).describe('手机号'),
  remark: z.string().optional().or(z.literal('')).describe('备注'),
  sex: z.coerce.number().optional().describe('性别'),
  status: z.coerce.boolean().describe('状态'),
  title: z.string().min(1, '标题不能为空').describe('标题'),
});

export class VerifyPassWord extends createZodDto(
  z.object({ password: AdminPassword }),
) {}

export class CreateAdminDto extends createZodDto(CreateAdminSchema) {}
