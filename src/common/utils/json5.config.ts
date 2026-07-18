import json5 from 'json5';
import { join, dirname, resolve } from 'path';
import fs from 'fs';
import { z } from 'zod';

import { normalizeAgentProvider } from '../../api/admin/agent/ai-model';

/** 本地内存 + 文件缓存配置（替代 Redis） */
const CacheConfigSchema = z.object({
  /** false 时仅内存层，不写文件（调试用） */
  open: z.boolean().default(true),
  memory: z
    .object({
      /** 默认 TTL（毫秒）；0 = 不设默认过期 */
      ttlMs: z.number().nonnegative().default(0),
      /** 内存 LRU 上限 */
      lruSize: z.number().int().positive().default(5000),
    })
    .default({ ttlMs: 0, lruSize: 5000 }),
  file: z
    .object({
      /** keyv-file 持久化路径（相对项目根） */
      filename: z.string().min(1).default('./.cache/kv.json'),
      /** 批量写盘延迟（毫秒） */
      writeDelayMs: z.number().nonnegative().default(100),
      /** 过期扫描间隔（毫秒） */
      expiredCheckDelayMs: z.number().positive().default(86_400_000),
    })
    .default({
      filename: './.cache/kv.json',
      writeDelayMs: 100,
      expiredCheckDelayMs: 86_400_000,
    }),
});

// 标准数据库配置 Schema（MySQL、PostgreSQL、MariaDB、Oracle、MSSQL 等）
const StandardDbConfigSchema = z
  .object({
    open: z.boolean(),
    type: z.enum([
      'mysql',
      'postgres',
      'mariadb',
      'oracle',
      'mssql',
      'sap',
      'spanner',
    ]),
    host: z.string(),
    port: z.number(),
    username: z.string(),
    password: z.string(),
    database: z.string(),
  })
  .catchall(z.any());

// SQLite 配置 Schema（配置写 type: 'sqlite'；运行时映射为 better-sqlite3 驱动）
const SqliteConfigSchema = z
  .object({
    open: z.boolean(),
    type: z.literal('sqlite'),
    database: z.string(),
  })
  .catchall(z.any());

// 数据库配置 Schema（可以是标准数据库或 SQLite）
const DatabaseConfigSchema = z.union([
  StandardDbConfigSchema,
  SqliteConfigSchema,
]);

const DatabaseConfigsSchema = z.record(z.string(), DatabaseConfigSchema);

/** AI Agent 配置（当前仅支持 OpenAI 兼容 Chat Completions 网关） */
const AgentConfigSchema = z.object({
  /**
   * 协议类型：openai | anthropic（也兼容 openai-compatible / anthropic-compatible）
   */
  provider: z
    .enum(['openai', 'anthropic', 'openai-compatible', 'anthropic-compatible'])
    .transform(normalizeAgentProvider)
    .default('openai'),
  /**
   * 网关 baseURL。
   * openai 示例：https://api.siliconflow.cn/v1
   * anthropic 示例：https://api.anthropic.com/v1
   */
  url: z.string().min(1),
  /** API Key */
  key: z.string().min(1),
  /** 模型 ID，以网关文档为准 */
  model: z.string().min(1),
  /** 可选：Jina Reader/Search API Key，提升网页抓取与搜索配额 */
  jinaKey: z.string().optional(),
});

// 全局配置 Schema
export const ConfigSchema = z
  .object({
    httpPort: z.coerce.number('请填写Http监听端口').default(3000),
    agent: AgentConfigSchema.optional(),
    cache: CacheConfigSchema,
    database: DatabaseConfigsSchema,
  })
  .catchall(z.any());

// ==================== Types ====================

// 从 Schema 导出类型
export type ConfigType = z.infer<typeof ConfigSchema>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type StandardDbConfig = z.infer<typeof StandardDbConfigSchema>;
export type SqliteConfig = z.infer<typeof SqliteConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type DatabaseConfigs = z.infer<typeof DatabaseConfigsSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// ==================== Config Loader ====================

/**
 * 查找配置文件
 * @param baseDepth 向上查找的层级数，默认不超过cwd目录
 * @param configName 配置文件名，默认为 config.${NODE_ENV}.json5
 */
const getConfigPath = (baseDepth?: number): string | null => {
  const env = process.env.NODE_ENV || 'production';
  const configFiles = [
    `config.${env}.local.json5`, // 优先查找带 .local 的配置文件
    `config.${env}.json5`, // 其次查找普通的配置文件
  ];

  let currentDir = __dirname;
  const cwd = resolve(process.cwd());

  // 如果没有指定baseDepth，则默认只找到cwd目录
  const maxDepth =
    baseDepth !== undefined ? baseDepth : Number.POSITIVE_INFINITY;
  let depth = 0;

  // 向上查找，但不超过cwd目录
  while (depth < maxDepth) {
    for (const configFileName of configFiles) {
      const possiblePath = join(currentDir, '../..', configFileName);

      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    }

    // 如果已经到达cwd目录，停止向上查找
    if (resolve(currentDir) === cwd) {
      break;
    }

    const parentDir = dirname(currentDir);

    // 如果已经到达根目录，停止向上查找
    if (parentDir === currentDir) {
      break;
    }

    // 继续向上查找
    currentDir = parentDir;
    depth++;
  }

  // 如果没找到，返回null
  return null;
};

const initConfig = (): ConfigType => {
  const configPath = getConfigPath();
  if (configPath == null) {
    throw new Error('未找到配置文件');
  }
  const configContent = fs.readFileSync(configPath, 'utf8');
  try {
    const parsed = json5.parse(configContent);
    // 使用 Zod 验证配置
    return ConfigSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('配置验证失败:', error.issues[0].message);
    } else {
      console.error('解析配置文件失败:', error);
    }
    throw error;
  }
};

const config = initConfig();
global.CONFIG = config;

export default initConfig;
export { config };
