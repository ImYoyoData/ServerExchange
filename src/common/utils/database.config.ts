// database.config.ts
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DynamicModule } from '@nestjs/common';

/**
 * 创建多个数据库连接
 * 会被 app.module.ts 的 imports 加载
 */
export function getDatabaseModules(): DynamicModule[] {
  const databaseConfigs = global.CONFIG.database;
  const databaseModules: DynamicModule[] = [];

  for (const key in databaseConfigs) {
    const config = databaseConfigs[key];
    if (!config.open) continue;

    // 移除 open 字段，因为 TypeOrmModuleOptions 不需要它
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    delete config.open;
    setConfigFromEnv(config, 'logging', 'DB_LOGGING', true);
    setConfigFromEnv(config, 'logger', 'DB_LOGGING_TYPE', 'file', false); // 生产环境使用  和 开发环境使用
    setConfigFromEnv(
      config,
      'logger',
      'DB_LOGGING_TYPE_DEV',
      'advanced-console',
    ); // 开发环境使用 会覆盖生产环境使用
    setConfigFromEnv(config, 'dateStrings', 'DB_DATE_STRINGS', true);
    setConfigFromEnv(config, 'synchronize', 'DB_SYNCHRONIZE', true);
    if (!config.entityPrefix && process.env.DB_ENTITY_PREFIX) {
      config['entityPrefix'] = process.env.DB_ENTITY_PREFIX;
    }

    // TypeORM 的 forRoot 方法第一个参数是配置，第二个参数是连接名称
    databaseModules.push(
      TypeOrmModule.forRoot({
        autoLoadEntities: true,
        ...(config as TypeOrmModuleOptions),
        name: key, // 连接名称
      }),
    );
  }

  return databaseModules;
}

/**
 * 根据环境变量设置配置项
 * @param config 原始配置对象
 * @param configKey 配置项键名
 * @param envKey 环境变量键名
 * @param defaultValue 默认值
 * @param requireDev 是否仅在开发环境生效
 */
function setConfigFromEnv<T>(
  config: any,
  configKey: string,
  envKey: string,
  defaultValue: T,
  requireDev: boolean = true,
): void {
  const isDev = process.env.NODE_ENV === 'development';
  const shouldApply = !requireDev || isDev;
  const envValue = process.env[envKey];
  if (!config[configKey] && shouldApply && envValue === 'true') {
    config[configKey] = defaultValue;
  }
}
