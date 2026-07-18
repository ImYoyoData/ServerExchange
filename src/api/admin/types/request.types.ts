// src/auth/types/request.types.ts
import { Request } from 'express';
import { z } from 'zod';

// 用户 Schema
export const UserSchema = z.object({
  id: z.number().int().positive().describe('用户ID'),
  username: z.string().min(1, '用户名不能为空').describe('用户名'),
  roles: z
    .array(z.string().min(1))
    .min(1, '至少需要一个角色')
    .describe('角色名称数组'),
  roleIds: z
    .array(z.number().int().positive())
    .min(1, '至少需要一个角色ID')
    .describe('角色ID数组'),
  permissions: z.array(z.string()).describe('权限名称数组'),
  /** 登录时从请求头解析的客户端设备信息（如 User-Agent），旧 token 可能无此字段 */
  device: z.string().max(500).optional().describe('客户端设备信息'),
  /** accessToken 会话 id（JWT jti），与 Redis 中会话一一对应；旧 token 可能无此字段 */
  jti: z.string().min(1).max(128).optional().describe('JWT jti'),
  iat: z.number().int().positive().optional().describe('签发时间'),
  exp: z.number().int().positive().optional().describe('过期时间'),
});

// 推导类型
export type UserAuth = z.infer<typeof UserSchema>;
export type AuthenticatedRequest = Request & { user: UserAuth };

// 验证函数
export const safeValidateUser = (data: unknown) => {
  return UserSchema.safeParse(data);
};
