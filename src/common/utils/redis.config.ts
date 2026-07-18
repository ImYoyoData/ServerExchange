// redis.config.ts
import {
  RedisModule,
  RedisModuleOptions,
  RedisClusterOptions,
} from '@nestjs-modules/ioredis';
import { DynamicModule } from '@nestjs/common';

/**
 * 创建多个 Redis 连接
 * 会被 app.module.ts 的 imports 加载
 */
export function getRedisModules(): DynamicModule[] {
  const redisConfigs = global.CONFIG.redis;
  const redisModules: DynamicModule[] = [];
  for (const key in redisConfigs) {
    const config = redisConfigs[key];
    if (!config.open) continue;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    delete config.open;
    redisModules.push(
      RedisModule.forRoot(
        config as RedisModuleOptions | RedisClusterOptions,
        key,
      ),
    );
  }
  return redisModules;
}
