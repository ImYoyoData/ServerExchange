/**
 * 管理端 API 前缀（相对路径，跟当前页面同源）。
 * - 开发：Vite 代理 `/api` → 后端（见 vite.config.ts，默认 3500）
 * - 生产：由 Nest 同端口托管 `/admin` + `/api`（如 8080），勿写死 host/port
 */
export const baseUrlApi = (url: string) => `/api/${url}/`;
