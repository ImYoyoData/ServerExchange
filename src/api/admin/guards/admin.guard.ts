import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { buildAdminAccessTokenSessionRedisKey } from 'src/api/admin/admin.constants';
import { IS_PUBLIC_KEY } from 'src/api/admin/decorators';
import { LocalKvService } from 'src/common/cache';
import { AuthenticatedRequest, UserSchema } from '../types/request.types';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly pathMath = /^(\/[a-zA-Z0-9]+)?\/admin\/.*$/;
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private readonly kv: LocalKvService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const path = request.path;
    // 简单判断路径是否包含 /admin/
    if (!this.pathMath.test(path)) {
      return true; // 放行非admin路径
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('未提供认证令牌，请登录！');
    }

    try {
      // 1. 验证 JWT
      const payload = await this.jwtService.verifyAsync(token);
      // 2. 使用 Zod 验证 payload 结构
      const validationResult = UserSchema.safeParse(payload);

      if (!validationResult.success) {
        console.error('JWT payload 验证失败:', validationResult.error.format());
        throw new UnauthorizedException('令牌数据格式错误，请重新登录！');
      }

      const user = validationResult.data;
      // 带 jti 的 accessToken：须会话仍存在（被踢下线 / 全量撤销 / 自然过期后键消失则拒绝）
      const jti = user.jti;
      if (typeof jti === 'string' && jti.length > 0) {
        const sessionKey = buildAdminAccessTokenSessionRedisKey(user.id, jti);
        try {
          const exists = await this.kv.exists(sessionKey);
          if (!exists) {
            throw new UnauthorizedException('登录已失效，请重新登录！');
          }
        } catch (e) {
          if (e instanceof UnauthorizedException) throw e;
          console.warn(
            'AdminGuard 会话校验异常，已降级放行:',
            (e as Error)?.message ?? e,
          );
        }
      }

      // 3. 设置用户信息
      request.user = user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('令牌无效或已过期，请重新登录！');
    }
    return true;
  }

  /**
   * 从请求头中提取 token
   * @param request
   * @returns
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
