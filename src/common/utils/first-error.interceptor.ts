// src/utils/first-error.interceptor.ts
// 将zod的error错误信息转成第一个错误信息
import {
  Injectable,
  BadRequestException,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface ErrorItem {
  message: string;
  path?: (string | number)[];
  [key: string]: unknown;
}

interface ErrorResponse {
  errors?: ErrorItem[];
  [key: string]: unknown;
}

@Injectable()
export class FirstErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(FirstErrorInterceptor.name);

  /** 会在 Nest 中变成 5xx 的异常：HttpStatus>=500，或非 HttpException */
  private shouldLogAsServerError(error: unknown): boolean {
    if (error instanceof HttpException) {
      return error.getStatus() >= 500;
    }
    return true;
  }

  private buildRequestPrefix(context: ExecutionContext): string {
    try {
      if (context.getType() === 'http') {
        const req = context.switchToHttp().getRequest<{
          method?: string;
          url?: string;
        }>();
        return `${req.method ?? 'HTTP'} ${req.url ?? ''} — `;
      }
    } catch {
      /* 非 HTTP 上下文 */
    }
    return '';
  }

  private logServerError(error: unknown, context: ExecutionContext): void {
    const prefix = this.buildRequestPrefix(context);
    if (error instanceof Error) {
      this.logger.error(`${prefix}${error.message}`, error.stack);
      return;
    }
    this.logger.error(`${prefix}${String(error)}`);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (error instanceof BadRequestException) {
          const response = error.getResponse();

          const errList = (response as ErrorResponse).errors;
          if (
            response &&
            typeof response === 'object' &&
            'errors' in response &&
            Array.isArray(errList) &&
            errList.length > 0
          ) {
            const first = errList[0];
            const pathStr =
              Array.isArray(first.path) && first.path.length > 0
                ? first.path.join(',')
                : 'field';
            const errorMessage = `“${pathStr}” ${first.message || '验证失败'}`;

            return throwError(() => new BadRequestException(errorMessage));
          }
        }

        if (this.shouldLogAsServerError(error)) {
          this.logServerError(error, context);
        }

        return throwError(() => error);
      }),
    );
  }
}
