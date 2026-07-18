import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { randomUUID } from 'crypto';
import type { KeyvFile } from 'keyv-file';
import { LOCAL_KV_FILE_STORE } from './local-cache.constants';

type LockEntry = { token: string; expireAt: number };

/**
 * 本地 KV：内存 + 文件分层缓存的业务入口（替代 ioredis）。
 * TTL 入参单位为「秒」，与原 Redis EX 用法对齐；内部转为毫秒。
 */
@Injectable()
export class LocalKvService implements OnModuleInit {
  private readonly logger = new Logger(LocalKvService.name);
  private readonly keyIndex = new Set<string>();
  private readonly locks = new Map<string, LockEntry>();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Optional()
    @Inject(LOCAL_KV_FILE_STORE)
    private readonly fileStore: KeyvFile | null,
  ) {}

  async onModuleInit() {
    if (!this.fileStore) return;
    try {
      const keys = await this.fileStore.keys();
      for (const key of keys) {
        this.keyIndex.add(String(key));
      }
      this.logger.log(`已从文件缓存加载 ${this.keyIndex.size} 个 key`);
    } catch (e) {
      this.logger.warn(
        `加载文件缓存 key 索引失败: ${String((e as Error)?.message ?? e)}`,
      );
    }
  }

  async get<T = string>(key: string): Promise<T | undefined> {
    const value = await this.cache.get<T>(key);
    if (value === undefined || value === null) {
      this.keyIndex.delete(key);
      return undefined;
    }
    this.keyIndex.add(key);
    return value;
  }

  async mget<T = string>(keys: string[]): Promise<Array<T | undefined>> {
    if (keys.length === 0) return [];
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }

  /**
   * @param ttlSeconds 过期秒数；省略或 <=0 表示不设过期（依赖 store 默认）
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds != null && ttlSeconds > 0) {
      await this.cache.set(key, value, ttlSeconds * 1000);
    } else {
      await this.cache.set(key, value);
    }
    this.keyIndex.add(key);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    let deleted = 0;
    await Promise.all(
      keys.map(async (key) => {
        const existed = this.keyIndex.has(key) || (await this.exists(key));
        await this.cache.del(key);
        this.keyIndex.delete(key);
        if (existed) deleted += 1;
      }),
    );
    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.cache.get(key);
    if (value === undefined || value === null) {
      this.keyIndex.delete(key);
      return false;
    }
    this.keyIndex.add(key);
    return true;
  }

  /**
   * 简易 glob：仅支持 `*` 通配（与 Redis MATCH 常用写法一致）。
   */
  async keys(pattern: string): Promise<string[]> {
    await this.refreshKeyIndexFromFile();
    const re = this.patternToRegExp(pattern);
    return Array.from(this.keyIndex).filter((k) => re.test(k));
  }

  async clearByPrefix(prefix: string): Promise<number> {
    const matched = await this.keys(`${prefix}*`);
    return this.del(...matched);
  }

  async tryAcquireLock(
    lockKey: string,
    ttlMs: number,
  ): Promise<string | null> {
    this.purgeExpiredLocks();
    const existing = this.locks.get(lockKey);
    if (existing && existing.expireAt > Date.now()) {
      return null;
    }
    const token = randomUUID();
    this.locks.set(lockKey, { token, expireAt: Date.now() + ttlMs });
    return token;
  }

  async releaseLock(lockKey: string, token: string): Promise<void> {
    const existing = this.locks.get(lockKey);
    if (existing && existing.token === token) {
      this.locks.delete(lockKey);
    }
  }

  async withLock<T>(
    lockKey: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T | undefined> {
    const token = await this.tryAcquireLock(lockKey, ttlMs);
    if (!token) return undefined;
    try {
      return await fn();
    } finally {
      await this.releaseLock(lockKey, token);
    }
  }

  private async refreshKeyIndexFromFile() {
    if (!this.fileStore) return;
    try {
      const keys = await this.fileStore.keys();
      for (const key of keys) {
        this.keyIndex.add(String(key));
      }
    } catch {
      // ignore
    }
  }

  private purgeExpiredLocks() {
    const now = Date.now();
    for (const [key, entry] of this.locks.entries()) {
      if (entry.expireAt <= now) this.locks.delete(key);
    }
  }

  private patternToRegExp(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const reSrc = `^${escaped.replace(/\*/g, '.*')}$`;
    return new RegExp(reSrc);
  }
}
