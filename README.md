# nest-admin-xo-server

基于 [NestJS](https://nestjs.com/) 的后台管理 API 服务（TypeScript）。

字典 · 角色菜单 · 消息 · 代码生成 · 文件 · 定时任务 · 可选 AI Agent

---

| 项目信息 | 说明 |
|----------|------|
| **包名** | `nest-admin-xo` |
| **运行时** | Node.js **≥ 20** |
| **包管理** | **pnpm** ≥ 9（见 `package.json` → `packageManager`） |

---

## 环境要求

- **Node.js** ≥ 20.0.0  
- **pnpm** ≥ 9.0.0（全局安装：`npm i -g pnpm`）  
- **SQLite**（默认，配置 `type: 'sqlite'`，库文件 `./data/app.db`；可用 `node scripts/import-sys-sql-to-sqlite.cjs` 从只读 `sys.sql` 导入）  
- 可选 MySQL / PostgreSQL（在 `config.*.json5` 的 `database` 中切换）

> 存放代码的目录及父级路径**避免中文、韩文、日文及空格**，否则可能影响依赖安装或启动。

---

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置文件

按 `NODE_ENV` 加载 JSON5 配置，查找顺序（自项目根目录向上）：

1. `config.<NODE_ENV>.local.json5`（优先，适合本机覆盖）
2. `config.<NODE_ENV>.json5`

例如开发环境常用：`config.development.local.json5` 或 `config.development.json5`。

同时会加载 **`.env.local`**、**`.env`**（`ConfigModule`），用于 `JWT_SECRET`、`API_PREFIX` 等与运行环境相关的变量。

### 3. 启动命令

| 命令 | 说明 |
|------|------|
| `pnpm run start` | 开发环境启动（`NODE_ENV=development`） |
| `pnpm run start:dev` | 开发 + 文件变更自动重启（推荐日常开发） |
| `pnpm run start:debug` | 开发 + 调试端口 |
| `pnpm run build` | 编译；会执行 `dist/scripts/build-copy-file.js` |
| `pnpm run start:prod` | 生产：运行已编译的 `dist/src/main.js`（需先 `build`） |
| `pnpm run start:build-prod` | 先 build 再生产启动 |
| `pnpm run lint` | ESLint |
| `pnpm run test` | 单元测试 |

默认 HTTP 端口来自配置文件中的 **`httpPort`**（示例：`config.development.json5` 里为 `3500`），以你本地实际配置为准。

全局路由前缀由环境变量 **`API_PREFIX`** 控制（未设置时见 `src/main.ts`，可能为 `/`）。Swagger 地址在启动日志中输出（见 `PrintSwaggerUrl`）。

---

## Docker（内置镜像构建）

仓库根目录提供 **`Dockerfile`**（多阶段构建：Node 22 Alpine + pnpm 构建，生产镜像仅含 `node_modules` 与编译产物）及 **`.dockerignore`**。

### 构建镜像

```bash
docker build -t nest-admin-xo-server:latest .
```

### 运行容器（示例）

应用监听端口以 **`config.<NODE_ENV>.json5` 中的 `httpPort`** 为准（与本地一致），请与 `-p 宿主机:容器` 的**容器侧端口**对齐。镜像内 `ENV` 示例为 `8080`，若你的配置里是 `3500`，请改为 `-p 3500:3500` 并保证配置文件中 `httpPort` 为 `3500`。

```bash
docker run --rm \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -v /你的路径/config.production.json5:/app/config.production.json5:ro \
  -v /你的路径/.env:/app/.env:ro \
  nest-admin-xo-server:latest
```

**说明：**

- **MySQL** 需自行部署或使用另一 Compose 栈；在配置文件中把 `host` 写成容器网络内可达地址（如 `mysql` 服务名）。  
- 生产配置需包含可用的 `database`、`cache`、`httpPort` 等；`JWT_SECRET` 等可放在挂载的 `.env` 中。缓存文件目录（默认 `./.cache`）建议挂载卷以便重启后保留会话。  
- 当前仓库**未附带** `docker-compose.yml`，可按需自行增加 MySQL 与上述镜像的编排。

---

## 技术栈摘要

- **框架**：NestJS 11、Express  
- **校验**：nestjs-zod + Zod（全局 `ZodValidationPipe`）  
- **ORM**：TypeORM + SQLite（默认可切换 MySQL / PostgreSQL）  
- **缓存**：`@nestjs/cache-manager` + Keyv（内存 LRU + `keyv-file` 文件持久化）  
- **认证**：`@nestjs/jwt`，管理端路由由 `AdminGuard` + 本地 KV 会话校验  
- **其它**：dayjs、log4js、限流（Throttler）、静态资源、定时任务（Schedule）、可选 LangChain / LangGraph（Agent 模块）

---

## 业务模块说明

### 根模块 `AppModule`（`src/app.module.ts`）

- **UsersModule**（`src/api/users`）：用户相关 API  
- **AdminModule**（`src/api/admin`）：后台管理核心（注册 **全局** `AdminGuard`，对匹配 `/admin/*` 的路由做 JWT 校验）

### Admin 子模块（均在 `src/api/admin/` 下）

| 模块 | 路径 | 能力简述 |
|------|------|----------|
| **菜单** | `menu/` | 菜单与角色-菜单关联 |
| **角色** | `role/` | 角色管理 |
| **字典** | `dict/` | 系统字典与字典项（含树形查询、本地 KV 缓存等） |
| **文件** | `file/` | 文件上传与信息管理 |
| **消息** | `message/` | 站内通知/消息 |
| **工具** | `utils/` | 通用工具接口 |
| **定时任务** | `tasks/` | 计划任务 |
| **代码生成** | `generator/` | 基于模板的代码生成（含 element-plus CRUD 等前端模板） |
| **Agent** | `agent/` | LLM 对话/流式输出（依赖配置中的 `agent` 等） |

管理端登录、刷新 Token、用户 CRUD、会话列表与踢线等与 **`admin.controller` / `admin.service`** 同目录实现。

---

## 目录结构

```
nest-admin-xo-server/
├── Dockerfile                 # 生产镜像多阶段构建
├── .dockerignore
├── package.json
├── tsconfig.json / nest-cli.json
├── config.development.json5   # 开发环境 JSON5 配置（可复制为 .local 覆盖）
├── config.<NODE_ENV>.json5    # 其它环境同理
├── .env / .env.local          # 环境变量（JWT、API_PREFIX 等）
├── scripts/
│   └── build-copy-file.ts     # build 后拷贝资源（由 nest build 后脚本引用）
├── dist/                      # 编译输出（pnpm run build）
└── src/
    ├── main.ts                # 入口：端口、全局前缀、Swagger、日志
    ├── app.module.ts          # 根模块：Config、DB、LocalCache、Jwt、各业务模块
    ├── app.controller.ts      # 根路径健康/欢迎
    ├── app.service.ts
    │
    ├── api/
    │   ├── users/             # 用户模块
    │   │   ├── users.module.ts
    │   │   ├── users.controller.ts
    │   │   └── users.service.ts
    │   │
    │   └── admin/             # 后台管理
    │       ├── admin.module.ts
    │       ├── admin.controller.ts
    │       ├── admin.service.ts
    │       ├── admin.constants.ts
    │       ├── decorators/    # @Public、@Permissions 等
    │       ├── dto/
    │       ├── entities/        # Admin、Role
    │       ├── guards/          # AdminGuard、PermissionsGuard 等
    │       ├── types/           # JWT 用户类型、Zod Schema
    │       │
    │       ├── menu/            # 菜单、RoleMenu
    │       ├── role/            # 角色
    │       ├── dict/            # 字典与字典项
    │       ├── file/            # 上传与文件元数据
    │       ├── message/         # 站内消息
    │       ├── utils/           # 工具接口
    │       ├── tasks/           # 定时任务
    │       ├── generator/       # 代码生成 + templates/
    │       └── agent/           # LLM Agent、graphs、tools
    │
    └── common/
        ├── constants/
        ├── decorators/
        ├── exceptions/          # BusinessPass、BusinessRejectedException
        ├── guards/
        ├── interceptors/        # 统一响应、首错拦截等
        ├── cache/               # 本地内存 + 文件缓存（LocalKvService）
        └── utils/
            ├── json5.config.ts  # 加载 config.*.json5 → global.CONFIG
            ├── database.config.ts
            ├── static.config.ts
            ├── throttle.config.ts
            ├── swagger.config.ts
            ├── log4js.config.ts
            ├── ms-utils.ts
            └── first-error.interceptor.ts
```

---

### Windows 便携包（无需安装 Node）

在开发机执行：

```bash
pnpm run pack:win
```

产物目录：`release/ServerExchange-portable/`（内容 = `dist/` + 根目录 `node.exe`）

- 启动：`start.bat` → `node.exe src\main.js`（`NODE_ENV=production`）
- 用户无需安装 Node
- SQLite：`data/app.db`；配置：`config.production.json5`

重新从 `sys.sql` 生成库文件：`node scripts/import-sys-sql-to-sqlite.cjs`

---

## 常见问题

1. **启动报「未找到配置文件」**  
   确认项目根（或向上查找路径）存在 `config.development.json5` 或 `config.development.local.json5`（与当前 `NODE_ENV` 一致）。

2. **数据库连不上**  
   检查对应 `config.*.json5` 中的 `database` 是否 `open: true` 以及账号、地址、密码是否正确。本地缓存见 `cache` 段（默认写入 `./.cache/kv.json`）。

3. **JWT / 前缀**  
   在 `.env` / `.env.local` 中配置 `JWT_SECRET`、`JWT_EXPIRES_IN` 等；接口路径需加上 `API_PREFIX`（若设置了 `/api` 等）。

4. **Docker 内连不上库**  
   配置里的 `host` 不能写 `127.0.0.1` 指向宿主机其它容器时，应使用 Docker 网络中的服务名或 `host.docker.internal`（视环境而定）。

---

## 许可

`UNLICENSED`（私有项目，见 `package.json`）。

---

## 参考链接

- [NestJS 文档](https://docs.nestjs.com)
