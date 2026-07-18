/**
 * 归一化对外访问用的站点根地址（trim、去掉末尾 `/`）。
 * 可与浏览器 Origin 或 `DOMAIN` / `DOMAIN_DEV` 配置对比、拼接 URL。
 */
export function normalizePublicOrigin(origin?: string): string {
  const o = String(origin ?? '').trim();
  return o.endsWith('/') ? o.slice(0, -1) : o;
}

const isNodeDevelopment = () => process.env.NODE_ENV === 'development';

/**
 * 当前运行环境下用于拼接文件 URL、静态资源 CORS 等的站点根地址。
 * - 开发：`DOMAIN_DEV`，未配置时回退 `DOMAIN`
 * - 生产：`DOMAIN`
 */
export function getAppPublicDomain(): string {
  const raw = isNodeDevelopment()
    ? (process.env.DOMAIN_DEV ?? process.env.DOMAIN ?? '')
    : (process.env.DOMAIN ?? '');
  return normalizePublicOrigin(raw);
}
