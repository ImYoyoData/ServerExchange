// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../admin.constants';

export const ROLES_KEY = 'roles';
/**
 * 标记路由为需要指定角色才能访问
 * @param roles 角色列表
 * @returns
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
