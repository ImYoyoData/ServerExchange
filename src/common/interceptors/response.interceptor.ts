// common/interceptors/response.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Provider,
  Logger,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// 响应接口
export interface ApiResponse<T = any> {
  success: boolean; // 业务成功状态
  code: number; // 业务状态码
  message: string; // 业务消息
  data: T; // 业务数据
  timestamp: number; // 时间戳
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // 如果已经是被包装的格式，直接返回
        if (this.isWrappedResponse(data)) {
          return {
            ...data,
            timestamp: Date.now(),
          };
        }

        // 获取HTTP状态码
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;

        // 默认包装
        return {
          success: true,
          code: 200,
          message: this.getDefaultMessage(Number(statusCode)),
          data,
          timestamp: Date.now(),
        };
      }),
    );
  }

  // 检查是否已经是包装过的响应
  private isWrappedResponse(data: any): data is ApiResponse {
    return (
      data &&
      typeof data === 'object' &&
      'success' in data &&
      'code' in data &&
      'message' in data &&
      'data' in data
    );
  }

  // 获取默认消息
  private getDefaultMessage(statusCode: number): string {
    const messages: Map<number, string> = new Map([
      [200, '请求成功'],
      [201, '创建成功'],
      [204, '操作成功'],
    ]);
    return messages.get(statusCode) || '操作成功';
  }
}

const logger = new Logger(ResponseInterceptor.name);

// 改为导出函数
export function getResponseInterceptor(): Provider[] {
  if (process.env.RESPONSE_INTERCEPTOR === 'true') {
    logger.log('✅ 全局响应对象拦截器已启用');
    return [
      {
        provide: APP_GUARD,
        useClass: ResponseInterceptor,
      },
    ];
  }

  logger.log('⭕ 全局响应对象拦截器已禁用');
  return [];
}
