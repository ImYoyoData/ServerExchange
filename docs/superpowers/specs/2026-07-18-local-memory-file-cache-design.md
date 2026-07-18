# 本地内存 + 文件缓存替换 Redis — 设计文档

> 日期：2026-07-18  
> 状态：已批准并实现  
> 范围：方案 B（缓存 + 会话全部本地化）+ 方案 1（官方 CacheModule 分层）

## 1. 背景与目标

当前项目通过 `@nestjs-modules/ioredis` 连接 Redis，用于：

1. 字典树缓存（含防击穿锁）
2. 管理端 accessToken 会话（登录态 / 在线用户 / 踢下线）
3. users 模块示例写入

目标：

- **去掉 Redis 依赖**，改为 Nest 官方推荐的「内存 + 文件」分层缓存
- **单机部署**：重启后会话与缓存可从文件恢复
- 现有管理端 API/UI（清字典缓存、在线踢人）行为不变
- `config.*.json5` 中的 `redis` 段改为文件持久化缓存配置

非目标：

- 多实例共享会话 / 分布式锁
- 保留 Redis 作为可选后端（本次不做双模切换）

## 2. 技术选型

| 包 | 角色 |
|----|------|
| `@nestjs/cache-manager` | Nest 官方 CacheModule |
| `cache-manager` | 缓存门面（分层 store） |
| `keyv` | Keyv 适配层 |
| `cacheable`（`KeyvCacheableMemory`） | 内存 LRU + TTL |
| `keyv-file` | 文件持久化（Keyv 第三方适配器，社区收录） |

分层行为：

- **读**：先内存，miss 再文件
- **写**：两层都写
- **重启**：文件层恢复数据到后续读路径

移除：

- `ioredis`
- `@nestjs-modules/ioredis`
- `src/common/utils/redis.config.ts` 的 `getRedisModules()`

## 3. 配置设计（替换 `redis`）

### 3.1 新配置结构

所有模板与本地覆盖文件统一改为 `cache` 段（**删除整个 `redis` 段**）：

- `config.development.json5`
- `config.development.local.json5`（若含 redis）
- `config.production.json5`
- `config.production.local.json5`（若含 redis）

```json5
cache: {
  open: true, // false 时仍启动进程内内存层，但跳过文件持久化（仅调试用）
  memory: {
    // 默认条目 TTL（毫秒）；0 = 不设默认过期（由业务 set 时指定）
    ttlMs: 0,
    // 内存 LRU 上限
    lruSize: 5000,
  },
  file: {
    // keyv-file 持久化文件路径（相对项目根目录）
    filename: './.cache/kv.json',
    // 批量写盘延迟（毫秒），降低高频写放大
    writeDelayMs: 100,
    // 过期扫描间隔（毫秒）
    expiredCheckDelayMs: 86400000, // 24h
  },
}
```

### 3.2 Zod Schema（`json5.config.ts`）

- 删除 `RedisSingleConfigSchema` / `RedisClusterConfigSchema` / `RedisConfigSchema` 及相关导出类型
- 新增：

```ts
const CacheConfigSchema = z.object({
  open: z.boolean().default(true),
  memory: z
    .object({
      ttlMs: z.number().nonnegative().default(0),
      lruSize: z.number().int().positive().default(5000),
    })
    .default({ ttlMs: 0, lruSize: 5000 }),
  file: z
    .object({
      filename: z.string().min(1).default('./.cache/kv.json'),
      writeDelayMs: z.number().nonnegative().default(100),
      expiredCheckDelayMs: z.number().positive().default(86_400_000),
    })
    .default({
      filename: './.cache/kv.json',
      writeDelayMs: 100,
      expiredCheckDelayMs: 86_400_000,
    }),
});
```

- `ConfigSchema`：`redis: RedisConfigSchema` → `cache: CacheConfigSchema`
- 导出类型：`CacheConfig` 替换原 Redis 类型

### 3.3 其它配置相关

- `.gitignore` 增加 `/.cache/`
- `AGENTS.md` / 相关规则中若提及 Redis 本地依赖，改为本地 cache（实现阶段同步）

## 4. 模块与服务

### 4.1 `LocalCacheModule`（全局）

路径建议：`src/common/cache/local-cache.module.ts`

- `CacheModule.registerAsync({ isGlobal: true, ... })`
  - `stores: [ memoryKeyv, fileKeyv ]`（`open === false` 时仅 memory）
- 提供 `LocalKvService`

### 4.2 `LocalKvService`

路径建议：`src/common/cache/local-kv.service.ts`

业务唯一入口，API 对齐现有 Redis 用法：

| 方法 | 说明 |
|------|------|
| `get(key)` | 读 |
| `mget(keys)` | 并行 get |
| `set(key, value, ttlSeconds?)` | 写；TTL 秒 → 毫秒传给 cache-manager |
| `del(...keys)` | 删 |
| `exists(key)` | 是否存在 |
| `keys(pattern)` | 简易 glob（`*`）；维护内存 key 索引，必要时与文件层同步 |
| `clearByPrefix(prefix)` | 按前缀批量删除（字典清缓存） |
| `withLock(key, ttlMs, fn)` | 进程内互斥，替代 `SET NX` + Lua |

锁实现：进程内 `Map<lockKey, { token, expireAt }>`；过期自动释放；不跨进程。

值类型：JSON 可序列化（string / number / object / array / boolean / null）。现有会话与字典树已满足。

### 4.3 AppModule

- `...getRedisModules()` → `LocalCacheModule`
- 删除对 `@nestjs-modules/ioredis` 的依赖引用

## 5. 业务迁移

| 文件 | 改动 |
|------|------|
| `dict.service.ts` | `@InjectRedis` → `LocalKvService`；`tryAcquireLock/releaseLock` → `withLock`；`scan` → `keys` / `clearByPrefix` |
| `admin.service.ts` | 会话 set/del/scan/pipeline → LocalKv 等价 API |
| `admin.guard.ts` | `exists` 走 LocalKv；异常仍降级放行 |
| `users.controller.ts` | 示例改用 LocalKv，或删除 Redis 演示代码 |
| `admin.constants.ts` | key 前缀常量可保留不变 |

管理端接口保持：

- `POST /admin/dict/cache/clear`
- 在线会话列表 / 踢下线 / logout

## 6. 行为与兼容说明

| 场景 | 行为 |
|------|------|
| 单进程重启 | 文件层恢复；短时冷启动后内存回填 |
| 多进程 / 多实例 | **不支持**共享；各自独立文件与内存 |
| 字典防击穿 | 进程内锁；单机有效 |
| Guard Redis 异常降级 | 改为 LocalKv 异常时同样降级放行 |
| TTL | 业务仍按「秒」传入 LocalKv；内部转毫秒 |

## 7. 验证标准

1. 无 Redis 进程时，应用可正常启动
2. 登录后 accessToken 会话生效；重启后会话仍可从文件恢复（在 TTL 内）
3. 字典树缓存命中；写操作后缓存失效；「清除缓存」可用
4. 在线用户列表 / 踢下线可用
5. `pnpm` 依赖中不再包含 `ioredis`、`@nestjs-modules/ioredis`
6. 四个 `config*.json5` 均无 `redis` 段，均有合法 `cache` 段

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `keyv-file` 高频写放大 | `writeDelayMs` 批量写 |
| 内存无限增长 | `lruSize` 限制 |
| `keys(pattern)` 性能 | 维护 key 索引；字典/会话 key 空间有限 |
| 提交误带 `.cache/` | `.gitignore` |

## 9. 实现顺序（概要）

1. 依赖增删 + `.gitignore`
2. Zod + 四个 config 文件 `redis` → `cache`
3. `LocalCacheModule` + `LocalKvService`
4. 迁移 dict / admin / guard / users
5. 移除 redis.config 与 AppModule 旧加载
6. 手工验证登录、字典缓存、清缓存、踢下线、重启恢复
