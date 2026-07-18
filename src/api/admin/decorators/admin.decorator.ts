// src/common/decorators/admin.decorator.ts
import { applyDecorators, UseGuards } from '@nestjs/common';
import { Roles } from './roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { ROLES } from '../admin.constants';

/**
 * 标记路由为需要系统管理员角色才能访问
 * @returns
 */
export function AdminOnly() {
  return applyDecorators(
    Roles(ROLES.ADMIN), // 需要admin角色
    UseGuards(RolesGuard), // 应用角色验证
  );
}
