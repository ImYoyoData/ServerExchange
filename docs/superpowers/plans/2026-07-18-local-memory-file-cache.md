# Local Memory + File Cache Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax.

**Goal:** Replace Redis with Nest CacheModule + KeyvCacheableMemory + keyv-file; migrate dict cache and admin sessions.

**Architecture:** Global `LocalCacheModule` exposes `LocalKvService` (get/mget/set/del/exists/keys/clearByPrefix + in-process locks). Config `redis` → `cache`.

**Tech Stack:** `@nestjs/cache-manager`, `cache-manager`, `keyv`, `cacheable`, `keyv-file`; remove `ioredis`, `@nestjs-modules/ioredis`.

**Spec:** `docs/superpowers/specs/2026-07-18-local-memory-file-cache-design.md`

## Global Constraints

- Single-node only; locks are in-process
- Values JSON-serializable; existing stringified payloads OK
- `.cache/` gitignored
- Do not modify `package.json` scripts
- Do not edit `sys.sql`

---

### Task 1: Dependencies + gitignore

- [x] Add: `@nestjs/cache-manager` `cache-manager` `keyv` `cacheable` `keyv-file`
- [x] Remove: `ioredis` `@nestjs-modules/ioredis`
- [x] `.gitignore`: `/.cache/`

### Task 2: Config redis → cache

- [x] Zod in `json5.config.ts`
- [x] Update all four `config*.json5`

### Task 3: LocalCacheModule + LocalKvService

- [x] Create `src/common/cache/*`
- [x] Wire into `app.module.ts`; delete `redis.config.ts`

### Task 4: Migrate consumers

- [x] `dict.service.ts`, `admin.service.ts`, `admin.guard.ts`, `users.controller.ts`

### Task 5: Docs + verify

- [x] Soft-update AGENTS.md / api-conventions Redis wording
- [x] Typecheck / smoke import
