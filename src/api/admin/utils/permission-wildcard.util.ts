/**
 * 权限字符串按 `:` 分段；任一段为 `*` 时匹配该位置上任意实际段值。
 * - 用户持有的 granted 比路由 required 段数少时，缺失的尾部视为 `*`（例：`user:list` 可覆盖 `user:list:read`）。
 * - granted 比 required 段数多时，多出的段须为 `*`（否则视为过窄，不覆盖更短的路由码）。
 */
export function permissionGrantCoversRequired(
  granted: string,
  required: string,
): boolean {
  const g = granted.split(':');
  const r = required.split(':');
  const n = Math.max(g.length, r.length);

  for (let i = 0; i < n; i++) {
    const gi = i < g.length ? g[i] : '*';
    const ri = i < r.length ? r[i] : undefined;

    if (ri === undefined) {
      if (gi === '*') continue;
      return false;
    }
    if (gi === '*') continue;
    if (gi !== ri) return false;
  }
  return true;
}

/** 任一 granted 模式能覆盖 required 即视为拥有该权限 */
export function userGrantsCoverRequired(
  grantedList: string[],
  required: string,
): boolean {
  return grantedList.some((g) => permissionGrantCoversRequired(g, required));
}
