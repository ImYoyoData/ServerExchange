import Axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type CustomParamsSerializer
} from "axios";
import type {
  PureHttpError,
  RequestMethods,
  PureHttpResponse,
  PureHttpRequestConfig
} from "./types.d";
import { stringify } from "qs";
import { getToken, formatToken, setToken } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";
import { ElNotification, ElMessage } from "element-plus";

// 相关配置请参考：www.axios-js.com/zh-cn/docs/#axios-request-config-1
const defaultConfig: AxiosRequestConfig = {
  // 请求超时时间
  timeout: 10000,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  },
  // 数组格式参数序列化（https://github.com/axios/axios/issues/5142）
  paramsSerializer: {
    serialize: stringify as unknown as CustomParamsSerializer
  }
};

class PureHttp {
  constructor() {
    this.httpInterceptorsRequest();
    this.httpInterceptorsResponse();
  }

  /** `token`过期后，暂存待执行的请求 */
  private static requests = [];

  /** 防止重复刷新`token` */
  private static isRefreshing = false;

  /** 初始化配置对象 */
  private static initConfig: PureHttpRequestConfig = {};

  /** 保存当前`Axios`实例对象 */
  private static axiosInstance: AxiosInstance = Axios.create(defaultConfig);

  /** 重连原始请求 */
  private static retryOriginalRequest(config: PureHttpRequestConfig) {
    return new Promise(resolve => {
      PureHttp.requests.push((token: string) => {
        PureHttp.setAuthorizationHeader(config, token);
        resolve(config);
      });
    });
  }

  private static setAuthorizationHeader(
    config: PureHttpRequestConfig,
    token: string
  ) {
    const authorization = formatToken(token);
    if (!config.headers) {
      config.headers = {};
    }
    const headers = config.headers as Record<string, unknown> & {
      set?: (key: string, value: string) => void;
    };
    if (typeof headers.set === "function") {
      headers.set("Authorization", authorization);
    } else {
      headers.Authorization = authorization;
    }
  }

  private static isAccessTokenExpired(expires?: number) {
    const value = Number(expires);
    if (!value || Number.isNaN(value)) return false;
    return value - Date.now() <= 0;
  }

  /** 读取最新 token 并附加到请求头；expires 无效时不误判为过期 */
  private static ensureAccessToken(
    config: PureHttpRequestConfig
  ): Promise<PureHttpRequestConfig> {
    const data = getToken();
    if (!data?.accessToken) {
      return Promise.resolve(config);
    }

    if (!PureHttp.isAccessTokenExpired(data.expires)) {
      PureHttp.setAuthorizationHeader(config, data.accessToken);
      return Promise.resolve(config);
    }

    if (!PureHttp.isRefreshing) {
      PureHttp.isRefreshing = true;
      useUserStoreHook()
        .handRefreshToken({ refreshToken: data.refreshToken })
        .then(res => {
          const token = res.data.accessToken;
          setToken({
            ...res.data,
            refreshToken: data.refreshToken
          });
          PureHttp.setAuthorizationHeader(config, token);
          PureHttp.requests.forEach(cb => cb(token));
          PureHttp.requests = [];
        })
        .finally(() => {
          PureHttp.isRefreshing = false;
        });
    }
    return PureHttp.retryOriginalRequest(config);
  }

  /** 请求拦截 */
  private httpInterceptorsRequest(): void {
    PureHttp.axiosInstance.interceptors.request.use(
      async (config: PureHttpRequestConfig): Promise<any> => {
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof config.beforeRequestCallback === "function") {
          config.beforeRequestCallback(config);
          return config;
        }
        if (PureHttp.initConfig.beforeRequestCallback) {
          PureHttp.initConfig.beforeRequestCallback(config);
          return config;
        }
        /** 请求白名单，放置一些不需要`token`的接口（通过设置请求白名单，防止`token`过期后再请求造成的死循环问题） */
        const whiteList = ["/refreshToken\/?$", "/login\/?$"];
        return whiteList.some(url => new RegExp(url).test(config.url))
          ? config
          : PureHttp.ensureAccessToken(config);
      },
      error => {
        return Promise.reject(error);
      }
    );
  }

  /** 响应拦截 */
  private httpInterceptorsResponse(): void {
    const instance = PureHttp.axiosInstance;
    instance.interceptors.response.use(
      (response: PureHttpResponse) => {
        const $config = response.config;
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof $config.beforeResponseCallback === "function") {
          $config.beforeResponseCallback(response);
          return response.data;
        }
        if (PureHttp.initConfig.beforeResponseCallback) {
          PureHttp.initConfig.beforeResponseCallback(response);
          return response.data;
        }
        return response.data;
      },
      (error: PureHttpError) => {
        const $error = error;
        $error.isCancelRequest = Axios.isCancel($error);
        // 所有的响应异常 区分来源为取消请求/非取消请求
        return Promise.reject($error);
      }
    );
  }

  /** 通用请求工具函数 */
  public request<T>(
    method: RequestMethods,
    url: string,
    param?: AxiosRequestConfig,
    axiosConfig?: PureHttpRequestConfig
  ): Promise<T> {
    const config = {
      method,
      url,
      ...param,
      ...axiosConfig
    } as PureHttpRequestConfig;

    // 单独处理自定义请求/响应回调
    return new Promise((resolve, reject) => {
      PureHttp.axiosInstance
        .request(config)
        .then((response: undefined) => {
          resolve(response);
        })
        .catch(error => {
          const $cfg = error.config as PureHttpRequestConfig;
          if ($cfg?.silent) {
            reject(error);
            return;
          }
          const httpStatus = error.response?.status ?? error.status;
          const errMsg =
            error.response?.data?.message ||
            error.message ||
            "请求失败，请稍后再试！";
          if (httpStatus === 400) {
            // 400 通常来说是业务拒绝 用轻提示即可
            ElMessage({
              message: errMsg,
              type: "error",
              plain: true
            });
          } else {
            if (httpStatus === 401) {
              useUserStoreHook().logOut();
            }
            // 这个就是保护了 401 未认证 403 权限拒绝 500+等重要的提示
            ElNotification({
              title: "Error",
              message: errMsg,
              type: "error"
            });
          }

          reject(error);
        });
    });
  }

  /** 单独抽离的`post`工具函数 */
  public post<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("post", url, params, config);
  }

  /** 单独抽离的`put`工具函数 */
  public put<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("put", url, params, config);
  }

  /** 单独抽离的`get`工具函数 */
  public get<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("get", url, params, config);
  }

  /** 单独抽离的`delete`工具函数 */
  public delete<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("delete", url, params, config);
  }
}

export const http = new PureHttp();
