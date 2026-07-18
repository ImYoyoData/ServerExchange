// src/api/admin/guards/permissions.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedRequest } from '../types/request.types';
import { userGrantsCoverRequired } from '../utils/permission-wildcard.util';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. 获取路由要求的权限列表
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    // 2. 如果路由没有设置权限要求，则直接放行
    if (requiredPermissions.length === 0) {
      return true;
    }

    // 3. 从请求中获取当前用户
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest | Request>();
    // 检查用户是否存在
    if (!request['user']) {
      throw new ForbiddenException('用户未认证');
    }
    const user = (request as AuthenticatedRequest).user;

    const granted = user.permissions ?? [];

    // 6. 检查用户是否拥有所有要求的权限（支持段级 `*`，如 *、*:*:*、module:*:*、module:feat:*）
    const hasAllPermissions = requiredPermissions.every((permission) =>
      userGrantsCoverRequired(granted, permission),
    );

    if (!hasAllPermissions) {
      // `权限不足，需要权限: ${requiredPermissions.join(', ')}`,
      throw new ForbiddenException(`您没有权限访问，请联系管理员`);
    }

    return true;
  }
}
