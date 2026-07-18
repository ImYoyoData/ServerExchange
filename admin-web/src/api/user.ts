import { http } from "@/utils/http";
import { baseUrlApi } from "./utils";

export type UserResult = {
  success?: boolean;
  code?: number;
  data: {
    /** 头像 */
    avatar: string;
    /** 用户名 */
    username: string;
    /** 昵称 */
    nickname: string;
    /** 当前登录用户的角色 */
    roles: Array<string>;
    /** 按钮级别权限 */
    permissions: Array<string>;
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式 `YYYY-MM-DD HH:mm:ss` 或时间戳） */
    expires: Date | string | number;
  };
};

export type RefreshTokenResult = {
  success?: boolean;
  code?: number;
  data: {
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式 `YYYY-MM-DD HH:mm:ss` 或时间戳） */
    expires: Date | string | number;
  };
};

/** 登录 */
export const getLogin = (data?: object) => {
  return http.request<UserResult>("post", baseUrlApi("admin/login"), { data });
};

/** 刷新`token` */
export const refreshTokenApi = (data?: object) => {
  return http.request<RefreshTokenResult>(
    "post",
    baseUrlApi("admin/refreshToken"),
    {
      data
    }
  );
};

/** 登出（服务端注销，失败可忽略） */
export const logoutApi = () => {
  return http.request<unknown>(
    "post",
    baseUrlApi("admin/logout"),
    {},
    { silent: true }
  );
};
