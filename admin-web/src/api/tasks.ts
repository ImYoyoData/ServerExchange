import { http } from "@/utils/http";
import { baseUrlApi } from "./utils";

type Result = {
  code?: number;
  success?: boolean;
  message?: string;
  data?: any;
};

type ResultTable = {
  code?: number;
  success?: boolean;
  message?: string;
  data?: {
    list?: Array<any>;
    total?: number;
    pageSize?: number;
    currentPage?: number;
  };
};

export function pageAdminTasks(params?: {
  page?: number;
  pageSize?: number;
  name?: string;
  enabled?: boolean;
  lastExecuteTimeBegin?: string;
  lastExecuteTimeEnd?: string;
}) {
  return http.request<ResultTable>("get", baseUrlApi("admin/tasks"), {
    params
  });
}

export function getAdminTask(id: string | number) {
  return http.request<Result>("get", baseUrlApi(`admin/tasks/${id}`));
}

export function updateAdminTask(
  id: string | number,
  data: { cron: string; remark: string; enabled: boolean }
) {
  return http.request<Result>("patch", baseUrlApi(`admin/tasks/${id}`), {
    data
  });
}

export function removeAdminTask(id: string | number) {
  return http.request<Result>("delete", baseUrlApi(`admin/tasks/${id}`));
}

export function executeAdminTask(id: string | number) {
  // 后端示例：POST /admin/tasks/:id/execute （请求体可为空）
  return http.request<Result>(
    "post",
    baseUrlApi(`admin/tasks/${id}/execute`)
  );
}

export function postAdminAgentChat(message: string) {
  return http.request<Result>("post", baseUrlApi("admin/agent/chat"), {
    data: { message }
  });
}

