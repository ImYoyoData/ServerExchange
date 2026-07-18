// src/api/admin/decorators/permissions.decorator.ts
import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { PermissionsGuard } from '../guards/permissions.guard';

export const PERMISSIONS_KEY = 'permissions';

/**
 * 推荐写入库/JWT 的「全站通配」权限码之一（PermissionsGuard 按段匹配 `*`）。
 * 等价能力也可用单段 `*` 或任意段全为 `*` 的串（如 `*:*:*`）。
 */
export const ALL_PERMISSIONS_WILDCARD = '*:*:*';

/**
 * 标记路由为需要指定权限才能访问
 * 会自动应用 PermissionsGuard
 *
 * 用法：
 * 1. 在控制器级别使用：
 * @Permissions('user:read')
 * @Controller('users')
 * export class UsersController {}
 *
 * 2. 在方法级别使用：
 * @Permissions('user:btn:create')
 * @Post()
 * create() {}
 *
 * @param permissions 权限标识符列表（建议 模块:功能:操作，段数可多于或少于 3）
 * 用户侧支持通配：按 `:` 分段，任一段为 `*` 可匹配该位置任意值。例如 `*`、`*:*:*`、`user:*:*`、`user:list:*`。
 * 亦可将 {@link ALL_PERMISSIONS_WILDCARD} 写入用户权限表作全站放行。
 * @returns
 */
export const Permissions = (permissions: string | string[]) => {
  const permissionList = Array.isArray(permissions)
    ? permissions
    : [permissions];

  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissionList),
    UseGuards(PermissionsGuard),
  );
};
