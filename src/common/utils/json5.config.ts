import json5 from 'json5';
import { join, dirname, resolve } from 'path';
import fs from 'fs';
import { z } from 'zod';

import { normalizeAgentProvider } from '../../api/admin/agent/ai-model';

// Redis 单节点配置 Schema
const RedisSingleConfigSchema = z.object({
  open: z.boolean(),
  type: z.literal('single'),
  url: z.string(),
  options: z
    .object({
      password: z.string().optional(),
      db: z.number().optional(),
    })
    .catchall(z.any()),
});

// Redis 集群节点 Schema
const RedisClusterNodeSchema = z.object({
  host: z.string(),
  port: z.number(),
});

// Redis 集群配置 Schema
const RedisClusterConfigSchema = z.object({
  open: z.boolean(),
  type: z.literal('cluster'),
  nodes: z.array(RedisClusterNodeSchema),
  options: z
    .object({
      scaleReads: z.enum(['master', 'slave', 'all', 'nearest']).optional(),
      db: z.number().optional(),
      redisOptions: z
        .object({
          password: z.string().optional(),
          keyPrefix: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

// Redis 配置 Schema（可以是单节点或集群）
const RedisConfigItemSchema = z.union([
  RedisSingleConfigSchema,
  RedisClusterConfigSchema,
]);

const RedisConfigSchema = z.record(z.string(), RedisConfigItemSchema);

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

// SQLite 配置 Schema
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
    redis: RedisConfigSchema,
    database: DatabaseConfigsSchema,
  })
  .catchall(z.any());

// ==================== Types ====================

// 从 Schema 导出类型
export type ConfigType = z.infer<typeof ConfigSchema>;
export type RedisSingleConfig = z.infer<typeof RedisSingleConfigSchema>;
export type RedisClusterConfig = z.infer<typeof RedisClusterConfigSchema>;
export type RedisClusterNode = z.infer<typeof RedisClusterNodeSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
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
