import Cookies from "js-cookie";
import { useUserStoreHook } from "@/store/modules/user";
import { storageLocal, isString, isIncludeAllChildren } from "@pureadmin/utils";

export interface DataInfo<T> {
  /** token */
  accessToken: string;
  /** `accessToken`的过期时间（时间戳） */
  expires: T;
  /** 用于调用刷新accessToken的接口时所需的token */
  refreshToken: string;
  /** 头像 */
  avatar?: string;
  /** 用户名 */
  username?: string;
  /** 昵称 */
  nickname?: string;
  /** 当前登录用户的角色 */
  roles?: Array<string>;
  /** 当前登录用户的按钮级别权限 */
  permissions?: Array<string>;
}

export type TokenPayload = DataInfo<Date | string | number>;

export const userKey = "user-info";
export const TokenKey = "authorized-token";
/**
 * 通过`multiple-tabs`是否在`cookie`中，判断用户是否已经登录系统，
 * 从而支持多标签页打开已经登录的系统后无需再登录。
 * 浏览器完全关闭后`multiple-tabs`将自动从`cookie`中销毁，
 * 再次打开浏览器需要重新登录系统
 */
export const multipleTabsKey = "multiple-tabs";

const DEFAULT_ACCESS_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

/** 解析后端返回的 expires（支持 YYYY-MM-DD HH:mm:ss、时间戳等） */
export function parseTokenExpires(
  expires: Date | string | number | undefined | null
): number {
  if (expires == null || expires === "") return 0;

  if (typeof expires === "number" && !Number.isNaN(expires)) {
    return expires < 1e12 ? expires * 1000 : expires;
  }

  if (typeof expires === "string") {
    const trimmed = expires.trim();
    const isoLike = trimmed.includes(" ")
      ? trimmed.replace(" ", "T")
      : trimmed;
    let ts = Date.parse(isoLike);
    if (!Number.isNaN(ts)) return ts;
    ts = Date.parse(trimmed.replace(/-/g, "/"));
    if (!Number.isNaN(ts)) return ts;
    return 0;
  }

  if (expires instanceof Date) {
    const ts = expires.getTime();
    return Number.isNaN(ts) ? 0 : ts;
  }

  return 0;
}

function readCookieToken(): Partial<DataInfo<number>> | null {
  const raw = Cookies.get(TokenKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<DataInfo<number>>;
  } catch {
    return null;
  }
}

/** 获取`token`（cookie 与 localStorage 合并，accessToken 优先取 cookie） */
export function getToken(): DataInfo<number> | null {
  const cookieData = readCookieToken();
  const localData = storageLocal().getItem<DataInfo<number>>(userKey) ?? null;

  if (!cookieData?.accessToken && !localData?.accessToken) {
    return (cookieData as DataInfo<number>) ?? localData;
  }

  return {
    accessToken: cookieData?.accessToken || localData?.accessToken || "",
    refreshToken: cookieData?.refreshToken || localData?.refreshToken || "",
    expires: cookieData?.expires ?? localData?.expires ?? 0,
    avatar: localData?.avatar ?? "",
    username: localData?.username ?? "",
    nickname: localData?.nickname ?? "",
    roles: localData?.roles ?? [],
    permissions: localData?.permissions ?? []
  };
}

/**
 * @description 设置`token`以及一些必要信息并采用无感刷新`token`方案
 * 无感刷新：后端返回`accessToken`（访问接口使用的`token`）、`refreshToken`（用于调用刷新`accessToken`的接口时所需的`token`，`refreshToken`的过期时间（比如30天）应大于`accessToken`的过期时间（比如2小时））、`expires`（`accessToken`的过期时间）
 * 将`accessToken`、`expires`、`refreshToken`这三条信息放在key值为authorized-token的cookie里（过期自动销毁）
 * 将`avatar`、`username`、`nickname`、`roles`、`permissions`、`refreshToken`、`expires`这七条信息放在key值为`user-info`的localStorage里（利用`multipleTabsKey`当浏览器完全关闭后自动销毁）
 */
export function setToken(data: TokenPayload) {
  if (!data?.accessToken) return;

  const { accessToken, refreshToken } = data;
  const { isRemembered, loginDay } = useUserStoreHook();
  let expires = parseTokenExpires(data.expires);
  if (!expires) {
    expires = Date.now() + DEFAULT_ACCESS_TOKEN_TTL_MS;
  }

  const cookieString = JSON.stringify({ accessToken, expires, refreshToken });
  const cookieExpiresDays = (expires - Date.now()) / 86400000;

  cookieExpiresDays > 0
    ? Cookies.set(TokenKey, cookieString, { expires: cookieExpiresDays })
    : Cookies.set(TokenKey, cookieString);

  Cookies.set(
    multipleTabsKey,
    "true",
    isRemembered
      ? {
          expires: loginDay
        }
      : {}
  );

  function setUserKey({ avatar, username, nickname, roles, permissions }) {
    useUserStoreHook().SET_AVATAR(avatar);
    useUserStoreHook().SET_USERNAME(username);
    useUserStoreHook().SET_NICKNAME(nickname);
    useUserStoreHook().SET_ROLES(roles);
    useUserStoreHook().SET_PERMS(permissions);
    storageLocal().setItem(userKey, {
      accessToken,
      refreshToken,
      expires,
      avatar,
      username,
      nickname,
      roles,
      permissions
    });
  }

  if (data.username && data.roles) {
    const { username, roles } = data;
    setUserKey({
      avatar: data?.avatar ?? "",
      username,
      nickname: data?.nickname ?? "",
      roles,
      permissions: data?.permissions ?? []
    });
  } else {
    const avatar =
      storageLocal().getItem<DataInfo<number>>(userKey)?.avatar ?? "";
    const username =
      storageLocal().getItem<DataInfo<number>>(userKey)?.username ?? "";
    const nickname =
      storageLocal().getItem<DataInfo<number>>(userKey)?.nickname ?? "";
    const roles =
      storageLocal().getItem<DataInfo<number>>(userKey)?.roles ?? [];
    const permissions =
      storageLocal().getItem<DataInfo<number>>(userKey)?.permissions ?? [];
    setUserKey({
      avatar,
      username,
      nickname,
      roles,
      permissions
    });
  }
}

/** 删除`token`以及key值为`user-info`的localStorage信息 */
export function removeToken() {
  Cookies.remove(TokenKey);
  Cookies.remove(multipleTabsKey);
  storageLocal().removeItem(userKey);
}

/** 格式化token（jwt格式） */
export const formatToken = (token: string): string => {
  return "Bearer " + token;
};

/** 是否有按钮级别的权限（根据登录接口返回的`permissions`字段进行判断）*/
export const hasPerms = (value: string | Array<string>): boolean => {
  if (!value) return false;
  const allPerms = "*:*:*";
  const { permissions } = useUserStoreHook();
  if (!permissions) return false;
  if (permissions.includes(allPerms)) return true;
  const isAuths = isString(value)
    ? permissions.includes(value)
    : isIncludeAllChildren(value, permissions);
  return isAuths ? true : false;
};
