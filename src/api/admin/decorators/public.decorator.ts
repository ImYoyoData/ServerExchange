// src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

// 定义元数据的键
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 标记路由为公共路由，无需认证
 * @returns
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
