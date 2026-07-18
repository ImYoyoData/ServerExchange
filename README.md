# ServerExchange

**ServerExchange**（服内交易所）——面向《我的世界》服务器的**玩家服内交易**应用：提供后台管理 API 与管理端界面，用于运营服内交易所相关能力。

| 项目 | 说明 |
|------|------|
| **英文名** | ServerExchange |
| **定位** | Minecraft 服务器玩家服内交易所 |
| **后端** | NestJS 11（`src/`） |
| **管理端** | Vue 3 + Element Plus（`admin-web/`） |
| **运行时** | Node.js ≥ 20 |
| **包管理** | pnpm ≥ 9（`packageManager`: pnpm@10.32.1） |

---

## 环境要求

- **Node.js** ≥ 20  
- **pnpm** ≥ 9  
- **SQLite**（默认，`./data/app.db`）  
  - 开发：`synchronize: true` 自动同步表结构；启动后备份为根目录 `sys.sql`  
  - 可选：`node scripts/import-sys-sql-to-sqlite.cjs` 从 SQL 导入  
  - 关闭自动备份：环境变量 `DEV_SQLITE_BACKUP=false`
- 可选 MySQL / PostgreSQL（在 `config.*.json5` 的 `database` 中切换）

> 项目路径及父目录请避免中文、日韩文和空格，以免影响依赖安装或启动。

---

## 快速开始

### 1. 安装依赖

```bash
pnpm install
pnpm --dir admin-web install
```

### 2. 配置

按 `NODE_ENV` 加载 JSON5（自项目根向上查找）：

1. `config.<NODE_ENV>.local.json5`（优先）  
2. `config.<NODE_ENV>.json5`

同时加载 `.env` / `.env.local`（如 `APP_NAME`、`JWT_SECRET`、`API_PREFIX`）。可参考 `.env.example`。

### 3. 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm run start:dev` | 开发启动（热更新） |
| `pnpm run build` | 编译后端 |
| `pnpm --dir admin-web run build` | 编译管理端 → `public/admin/` |
| `pnpm run start:prod` | 生产运行 `dist/src/main.js` |
| `pnpm run pack:win` | 打 Windows 便携包 |

开发默认端口见 `config.development.json5` 的 `httpPort`（示例 `3500`）；生产便携包默认 `8080`。  
管理端地址一般为：`http://localhost:<端口>/admin/`。

---

## Windows 便携包与自动发布

```bash
pnpm run pack:win
```

产物：`release/ServerExchange-portable/`（含自带 `node.exe`，对方无需安装 Node）。

**分支约定：** 日常在 `dev` 开发；推送到 **`main`** 时，GitHub Actions 会自动编译、打 zip 并创建 Release（含距上次版本的更新说明）。

也可在 Actions 中手动 `workflow_dispatch`。

---

## Docker（可选）

```bash
docker build -t server-exchange:latest .
docker run --rm -p 8080:8080 -e NODE_ENV=production \
  -v /你的路径/config.production.json5:/app/config.production.json5:ro \
  -v /你的路径/.env:/app/.env:ro \
  server-exchange:latest
```

容器端口需与配置中的 `httpPort` 一致。

---

## 技术栈

- **后端**：NestJS、TypeORM、Zod、JWT、本地内存+文件缓存、定时任务  
- **前端**：Vue 3、Element Plus、Vite、Pinia  
- **数据库**：默认 SQLite；可切换 MySQL / PostgreSQL  

后台能力包括：菜单权限、角色用户、字典、文件、站内消息、计划任务、代码生成、可选 AI Agent 等（交易所业务模块可在此基础上扩展）。

---

## 目录结构（简）

```
ServerExchange/
├── src/                 # Nest API
├── admin-web/           # 管理端前端
├── public/admin/        # 前端构建产物（由 Nest 托管）
├── config.*.json5       # 环境配置
├── scripts/             # 打包、SQLite 导入等
├── data/app.db          # SQLite（本地，勿提交）
└── release/             # Windows 便携包输出（勿提交）
```

---

## 常见问题

1. **未找到配置文件** — 确认存在对应 `config.<NODE_ENV>.json5`（或 `.local`）。  
2. **数据库** — 检查 `database` / `cache` 配置；SQLite 可用导入脚本重建。  
3. **JWT / 前缀** — 配置 `.env` 中的 `JWT_SECRET`、`API_PREFIX`。  

---

## 许可

`UNLICENSED`（私有项目）。
