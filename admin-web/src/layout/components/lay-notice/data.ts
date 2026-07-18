import { $t } from "@/plugins/i18n";

export interface ListItem {
  avatar: string;
  title: string;
  /** 列表区简短时间 */
  datetime: string;
  type: string;
  /** 列表摘要（纯文本，已截断） */
  description: string;
  /** 详情弹窗：富文本正文（后端返回 HTML，仅站内可信内容请使用 v-html） */
  contentHtml?: string;
  /** 详情弹窗：完整发布时间 */
  publishTimeFull?: string;
  status?: "primary" | "success" | "warning" | "info" | "danger";
  extra?: string;
  /** 站内消息 id，存在时可点击标记已读 */
  messageId?: string;
  read?: boolean;
  /** 站内跳转路径或外链，存在且合法时在详情弹窗展示「前往」入口 */
  redirectUrl?: string;
}

export interface TabItem {
  key: string;
  name: string;
  list: ListItem[];
  emptyText: string;
}

/** 静态通知页（无接口时为空） */
export const notifyTabEmpty: TabItem = {
  key: "1",
  name: "status.pureNotify",
  list: [],
  emptyText: $t("status.pureNoNotify")
};
