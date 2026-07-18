// throttler.config.ts
import { Provider, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

const logger: Logger = new Logger('ThrottlerConfig');
// 改为导出函数
export function getThrottleProviders(): Provider[] {
  if (process.env.THROTTLE_GLOBAL === 'true') {
    logger.log('✅ 全局限流守卫已启用');
    return [
      {
        provide: APP_GUARD,
        useClass: ThrottlerGuard,
      },
    ];
  }

  logger.log('⭕ 全局限流守卫已禁用');
  return [ThrottlerGuard];
}

export function getThrottlerModule() {
  return [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule], // 导入 ConfigModule
      inject: [ConfigService], // 注入 ConfigService
      useFactory: (configService: ConfigService) => {
        return [
          {
            ttl: +configService.get<number>('THROTTLE_TTL', 60000), // 默认 60秒
            limit: +configService.get<number>('THROTTLE_LIMIT', 120), // 默认 120次
          },
        ];
      },
    }),
  ];
}
