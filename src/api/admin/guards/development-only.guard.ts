import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * 仅当 NODE_ENV === development 时放行，否则 403。
 * 用于开发辅助类接口（如写本地源码文件）。
 */
@Injectable()
export class DevelopmentOnlyGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException(
        '该接口仅在开发环境（NODE_ENV=development）下可用',
      );
    }
    return true;
  }
}
