import { http } from "@/utils/http";
import { baseUrlApi } from "./utils";

type Result = {
  code?: number;
  success?: boolean;
  message?: string;
  data?: any;
};

export function pageAccessTokenSessions(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}) {
  return http.request<Result>("get", baseUrlApi("admin/accessTokenSessions"), {
    params
  });
}

export function revokeAccessTokenSession(data: {
  userId: number;
  jti: string;
}) {
  return http.request<Result>("delete", baseUrlApi("admin/accessTokenSession"), {
    data
  });
}

export function revokeAllAccessTokenSessions(userId: number) {
  return http.request<Result>(
    "delete",
    baseUrlApi(`admin/user/${userId}/accessTokenSessions`)
  );
}
