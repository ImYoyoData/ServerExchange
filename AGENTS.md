# nest-admin-xo — Agent 开发指南

本文档供 AI Agent 与开发者协作时使用，描述项目结构、目录约定与开发规范。

## 项目概览

| 部分 | 路径 | 说明 |
|------|------|------|
| 后端 API | `src/` | NestJS 11，TypeORM，Zod 校验，JWT，本地内存+文件缓存，计划任务 |
| 管理端前端 | `admin-web/` | Vue 3 + Element Plus + PureAdmin |
| 本地开发配置 | `config.development.local.json5` | 本地环境覆盖（数据库、cache 等） |
| 基础库结构参考 | `sys.sql` | **只读**，勿编辑 |
| Agent 规则 | `.cursor/rules/` | Cursor 持久化规则 |
| Agent Skills | `.cursor/skills/` | UI、调试、规划等 skill |
| MCP 配置 | `.cursor/mcp.json` | 项目级 MCP（如 Playwright） |

## 目录结构

```
xo-admin/
├── src/
│   ├── main.ts                 # 入口
│   ├── app.module.ts           # 根模块
│   ├── api/
│   │   ├── admin/              # 后台管理 API（勿混放 C 端接口）
│   │   │   ├── admin.module.ts
│   │   │   ├── menu/           # 菜单
│   │   │   ├── role/           # 角色
│   │   │   ├── dict/           # 字典
│   │   │   ├── tasks/          # 计划任务
│   │   │   ├── file/           # 文件
│   │   │   ├── message/        # 消息
│   │   │   ├── generator/      # 代码生成
│   │   │   └── ...
│   │   ├── users/              # 示例：非 admin 模块
│   │   └── xxx/                # C 端或其他应用 API 在此新建
│   └── common/                 # 公共工具、拦截器、配置
├── admin-web/
│   ├── src/
│   │   ├── views/              # 页面（如 system/tasks/index.vue）
│   │   ├── api/                # 前端 API 封装
│   │   ├── components/
│   │   └── router/
│   └── package.json
├── config.development.json5
├── config.development.local.json5
├── sys.sql                     # 基础表结构参考，勿改
└── package.json                # scripts 勿擅自修改
```

## API 分层

- **`src/api/admin`**：后台管理端 API，路由前缀通常为 `/admin/...`
- **`src/api/xxx`**：C 端或其他独立应用的 API，按业务新建目录（如 `app`、`mobile`），**不要**放进 `admin`

修改后台 API 时，若影响 C 端共用逻辑或 DTO，需同步更新 C 端接口与 `admin-web` 调用。

## 后台界面开发清单

新增一个后台功能时，通常需要：

1. **数据库**：Entity、迁移（如需）
2. **后端**：Module / Controller / Service / DTO
3. **菜单与权限**（MySQL MCP）：
   - 在 `sys_menu` 新增菜单行（目录 / 菜单 / 按钮）
   - 按钮权限码格式参考：`模块:btn:操作`（如 `dict:btn:add`）
   - 使用当前开发环境数据库（见 `config.development.local.json5`）
4. **前端**：`admin-web/src/views/...` + `admin-web/src/api/...`
5. **路由**：菜单 `component` 路径与 `views` 下文件对应

## 列表页标准

每个列表功能应包含：

| 能力 | 说明 |
|------|------|
| 筛选 | 顶部查询表单，支持常用字段 |
| 列展示 | 表格列定义 |
| 排序 | 时间、数字等字段支持服务端或前端排序 |
| 删除 | 软删除进**回收站** |
| 回收站 | 支持**恢复**与**永久删除** |
| 操作列 | 可见按钮 ≤ 3 个，其余收入右侧「更多」下拉 |

参考：`admin-web/src/views/system/tasks/index.vue`

## 计划任务

- 新增任务**必须设置名称**（`name` 字段）
- 后端：`src/api/admin/tasks/`

## 后端开发要点

| 场景 | 要求 |
|------|------|
| 支付等关键写操作 | 使用数据库**事务** |
| 抢单 / 秒杀 | **本地进程内锁**（`LocalKvService.withLock`），单机防并发；多实例需另行设计 |
| C 端高频读接口 | **本地内存 + 文件缓存**（`LocalKvService`） |
| 后台修改缓存数据 | 提供**清除缓存**按钮或接口 |
| 任意 API 变更 | 评估对 admin-web、C 端、其他模块的影响 |

## 本地缓存（替代 Redis）

- 模块：`src/common/cache`（`LocalCacheModule` / `LocalKvService`）
- 配置：`config.*.json5` 的 `cache` 段（内存 LRU + `keyv-file`）
- 数据目录：`./.cache/`（已 gitignore）

## UI 与功能开发流程

1. **先查 skill**：`.cursor/skills/`（如 `frontend-design`、`ui-styling`、`ui-ux-pro-max`、`brainstorming`、`writing-plans`）
2. skill 无任务拆分时，自行拆分任务与细节
3. 不确定处**询问开发者**，勿自行假设
4. 写 UI 时优先遵循 skill 中的设计规范

## 禁止擅自修改

- `package.json` 的 `scripts`（除非开发者明确要求）
- `sys.sql`

## 工具与维护

- **Codegraph**：大量代码变更后执行 `codegraph sync` 更新结构索引
- **MySQL MCP**：配置为当前开发库，用于菜单/权限数据维护
- **本地缓存**：字典/会话等走 `src/common/cache`（内存 + `.cache/kv.json`）
- **Redis MCP**：已不再依赖 Redis；可忽略或用于其它服务

## 技术栈速查

**后端**：NestJS、TypeORM、nestjs-zod、@nestjs/cache-manager、keyv-file、@nestjs/schedule、JWT  
**前端**：Vue 3、Element Plus、PureAdmin、pnpm  
**配置**：json5（`config.*.json5`）
