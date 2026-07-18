import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import {
  buildLocalCacheStores,
  type LocalCacheStores,
} from './build-local-cache-stores';
import { LOCAL_KV_FILE_STORE } from './local-cache.constants';
import { LocalKvService } from './local-kv.service';

let sharedStores: LocalCacheStores | null = null;

function getSharedLocalCacheStores(): LocalCacheStores {
  if (!sharedStores) {
    sharedStores = buildLocalCacheStores();
  }
  return sharedStores;
}

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => {
        const { stores } = getSharedLocalCacheStores();
        return { stores };
      },
    }),
  ],
  providers: [
    {
      provide: LOCAL_KV_FILE_STORE,
      useFactory: () => getSharedLocalCacheStores().fileStore,
    },
    LocalKvService,
  ],
  exports: [LocalKvService, CacheModule],
})
export class LocalCacheModule {}
