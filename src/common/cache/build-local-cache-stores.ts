import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { Keyv } from 'keyv';
import { KeyvCacheableMemory } from 'cacheable';
import { KeyvFile } from 'keyv-file';
import type { CacheConfig } from '../utils/json5.config';

export type LocalCacheStores = {
  stores: Keyv[];
  fileStore: KeyvFile | null;
};

/**
 * 构建 Nest CacheModule 用的分层 store：内存（优先）+ 可选文件持久化。
 */
export function buildLocalCacheStores(
  cacheConfig?: CacheConfig,
): LocalCacheStores {
  const cfg = cacheConfig ?? global.CONFIG.cache;
  const memoryTtl = cfg.memory?.ttlMs ?? 0;
  const lruSize = cfg.memory?.lruSize ?? 5000;

  const memory = new Keyv({
    // 空 namespace，避免默认 `keyv:` 前缀，保证 keys()/clearByPrefix 与业务 key 一致
    namespace: '',
    store: new KeyvCacheableMemory({
      ...(memoryTtl > 0 ? { ttl: memoryTtl } : {}),
      lruSize,
    }),
  });

  const stores: Keyv[] = [memory];
  let fileStore: KeyvFile | null = null;

  if (cfg.open !== false) {
    const filename = resolve(process.cwd(), cfg.file.filename);
    mkdirSync(dirname(filename), { recursive: true });
    fileStore = new KeyvFile({
      filename,
      writeDelay: cfg.file.writeDelayMs,
      expiredCheckDelay: cfg.file.expiredCheckDelayMs,
    });
    stores.push(
      new Keyv({
        namespace: '',
        store: fileStore,
      }),
    );
  }

  return { stores, fileStore };
}
