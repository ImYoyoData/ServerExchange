import { http } from "@/utils/http";
import { baseUrlApi } from "./utils";

/** 管理端-消息分页 */
export function pageAdminMessage(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: boolean | null;
  type?: number;
  userId?: number;
}) {
  return http.request<any>("get", baseUrlApi("admin/message/page"), {
    params
  });
}

/** 管理端-新增消息 */
export function createMessage(data: object) {
  return http.request<any>("post", baseUrlApi("admin/message"), { data });
}

/** 管理端-编辑消息 */
export function updateMessage(data: object) {
  return http.request<any>("put", baseUrlApi("admin/message"), { data });
}

/** 管理端-单条软删除 */
export function removeMessage(id: string | number) {
  return http.request<any>("delete", baseUrlApi(`admin/message/${id}`));
}

/** 当前用户-收件箱 */
export function inboxMessage(params?: {
  page?: number;
  pageSize?: number;
  type?: number;
}) {
  return http.request<any>("get", baseUrlApi("admin/message/inbox"), {
    params
  });
}

/** 标记收件箱单条已读 */
export function markInboxMessageRead(id: string | number) {
  return http.request<any>(
    "patch",
    baseUrlApi(`admin/message/inbox/read/${id}`)
  );
}
