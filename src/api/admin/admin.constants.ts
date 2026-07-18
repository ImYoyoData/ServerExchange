export const jwtConstants = {
  secret:
    process.env.JWT_SECRET ||
    'your-long-random-secret-key-at-least-32-characters-here',
};

/** Redis 中 admin accessToken 会话 key 前缀（与 JWT jti 一一对应） */
export const ADMIN_ACCESS_TOKEN_SESSION_KEY_PREFIX = 'admin:accessToken';

export function buildAdminAccessTokenSessionRedisKey(
  userId: number,
  jti: string,
): string {
  return `${ADMIN_ACCESS_TOKEN_SESSION_KEY_PREFIX}:${userId}:${jti}`;
}

// src/common/constants/roles.constants.ts
export enum ROLES {
  /** 系统管理员 */
  ADMIN = 'admin',
  // 可以加其他的角色需要和角色表对应 如客服、开发、测试、销售、采购、设计、市场、人事、财务、广告
}

export type UserRole = (typeof ROLES)[keyof typeof ROLES];
