<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import dayjs from "dayjs";
import type { ListItem, TabItem } from "./data";
import { notifyTabEmpty } from "./data";
import NoticeList from "./components/NoticeList.vue";
import BellIcon from "~icons/ep/bell";
import Right from "~icons/ep/right";
import { inboxMessage, markInboxMessageRead } from "@/api/message";
import { message } from "@/utils/message";
import { stripHtmlToText, truncateText } from "./utils";

const { t } = useI18n();
const router = useRouter();

/** 列表摘要最大字符数 */
const PREVIEW_MAX_LEN = 96;

const detailVisible = ref(false);
const detailItem = ref<ListItem | null>(null);

const DEFAULT_AVATAR = "https://xiaoxian521.github.io/hyperlink/svg/smile1.svg";

const messageList = ref<ListItem[]>([]);
const unreadCount = ref(0);
const activeKey = ref(notifyTabEmpty.key);
const inboxLoading = ref(false);

const notices = computed<TabItem[]>(() => [
  notifyTabEmpty,
  {
    key: "2",
    name: t("status.pureMessage"),
    list: messageList.value,
    emptyText: t("status.pureNoMessage")
  }
]);

const noticesNum = computed(() => unreadCount.value);

/** 从收件箱单条记录中尽量识别跳转字段（不同后端命名） */
function pickInboxRedirectUrl(row: any): string {
  const keys = [
    "redirectUrl",
    "redirect_url",
    "redirect",
    "jumpUrl",
    "jump_url",
    "linkUrl",
    "link_url",
    "routePath",
    "route_path",
    "path"
  ];
  for (const k of keys) {
    const s = String(row?.[k] ?? "").trim();
    if (s) return s;
  }
  const nested = row?.data ?? row?.meta;
  if (nested && typeof nested === "object") {
    for (const k of keys) {
      const s = String((nested as any)?.[k] ?? "").trim();
      if (s) return s;
    }
  }
  return "";
}

/** 规范站内 path：补全前导 /，便于 router.push */
function normalizeRedirectTarget(raw: string): string {
  const u = raw.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/")) return u;
  return `/${u.replace(/^\/+/, "")}`;
}

/** 站内 / 或 http(s) 外链；禁止 javascript: 等 */
function isValidRedirectUrl(s: unknown): boolean {
  const raw = String(s ?? "").trim();
  if (!raw || raw.length > 2048) return false;
  if (/^javascript:/i.test(raw)) return false;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }
  const internal = normalizeRedirectTarget(raw);
  return internal.startsWith("/") && !/^javascript:/i.test(internal);
}

function navigateByRedirectUrl(raw: string) {
  const u = raw.trim();
  if (/^https?:\/\//i.test(u)) {
    window.open(u, "_blank", "noopener,noreferrer");
    return;
  }
  const path = normalizeRedirectTarget(u);
  void router.push(path).catch(() => {
    message(t("status.pureNoticeRedirectFail"), { type: "warning" });
  });
}

const detailRedirectUrl = computed(() => {
  const u = detailItem.value?.redirectUrl;
  if (!isValidRedirectUrl(u)) return "";
  return normalizeRedirectTarget(String(u).trim());
});

function onGoNoticeRedirect() {
  const url = detailRedirectUrl.value;
  if (!url) return;
  detailVisible.value = false;
  navigateByRedirectUrl(url);
}

const getLabel = computed(
  () => (item: TabItem) =>
    (typeof item.name === "string" && item.name.startsWith("status.")
      ? t(item.name)
      : item.name) + (item.list.length > 0 ? `(${item.list.length})` : "")
);

function mapInboxToListItem(row: any): ListItem {
  const read =
    row?.read === true ||
    row?.isRead === true ||
    row?.status === true ||
    row?.readStatus === true;
  const id = row?.id != null ? String(row.id) : "";
  const rawHtml =
    row?.contentHtml ??
    row?.content ??
    row?.body ??
    row?.html ??
    row?.summary ??
    "";
  const plain = stripHtmlToText(String(rawHtml));
  const previewSource =
    plain ||
    stripHtmlToText(String(row?.summary ?? "")) ||
    stripHtmlToText(String(row?.content ?? ""));
  const redirectRaw = pickInboxRedirectUrl(row);
  return {
    avatar: row?.avatar || DEFAULT_AVATAR,
    title: row?.title || row?.subject || "站内消息",
    description: truncateText(previewSource, PREVIEW_MAX_LEN),
    contentHtml: String(rawHtml || row?.content || row?.body || ""),
    publishTimeFull: row?.createdAt
      ? dayjs(row.createdAt).format("YYYY-MM-DD HH:mm:ss")
      : "",
    datetime: row?.createdAt ? dayjs(row.createdAt).format("MM-DD HH:mm") : "",
    type: String(row?.type ?? ""),
    messageId: id || undefined,
    read,
    extra: read ? "" : "未读",
    status: read ? "info" : "warning",
    redirectUrl: redirectRaw || undefined
  };
}

function recalcUnread() {
  unreadCount.value = messageList.value.filter(i => !i.read).length;
}

async function loadInbox() {
  inboxLoading.value = true;
  try {
    const res: any = await inboxMessage({ page: 1, pageSize: 50 });
    const ok = res?.success === true || res?.code === 200;
    if (!ok) {
      return;
    }
    const d = res?.data;
    const raw = d?.list ?? d?.items ?? (Array.isArray(d) ? d : []);
    messageList.value = (raw as any[]).map(mapInboxToListItem);
    recalcUnread();
  } catch {
    /* http 拦截器已提示 */
  } finally {
    inboxLoading.value = false;
  }
}

async function handleMarkRead(id: string) {
  try {
    const res: any = await markInboxMessageRead(id);
    const ok = res?.success === true || res?.code === 200;
    if (!ok) {
      message(res?.message ?? "标记已读失败", { type: "error" });
      return;
    }
    const item = messageList.value.find(i => i.messageId === id);
    if (item) {
      item.read = true;
      item.extra = "";
      item.status = "info";
    }
    if (detailItem.value?.messageId === id) {
      detailItem.value.read = true;
      detailItem.value.extra = "";
      detailItem.value.status = "info";
    }
    recalcUnread();
  } catch {
    /* 拦截器 */
  }
}

/** 打开详情：弹窗展示全文；未读则标记已读 */
function handleOpenDetail(item: ListItem) {
  detailItem.value = item;
  detailVisible.value = true;
  const id = item.messageId;
  if (id && !item.read) {
    void handleMarkRead(id);
  }
}

watch(activeKey, key => {
  if (key === "2") loadInbox();
});

function onDropdownVisible(visible: boolean) {
  if (visible) loadInbox();
}

onMounted(() => loadInbox());
</script>

<template>
  <el-dropdown
    trigger="click"
    placement="bottom-end"
    @visible-change="onDropdownVisible"
  >
    <span
      :class="[
        'dropdown-badge',
        'navbar-bg-hover',
        'select-none',
        Number(noticesNum) !== 0 && 'mr-[10px]'
      ]"
    >
      <el-badge :value="Number(noticesNum) === 0 ? '' : noticesNum" :max="99">
        <span class="header-notice-icon">
          <IconifyIconOffline :icon="BellIcon" />
        </span>
      </el-badge>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-tabs
          v-model="activeKey"
          :stretch="true"
          class="dropdown-tabs"
          :style="{ width: notices.length === 0 ? '200px' : '330px' }"
        >
          <el-empty
            v-if="notices.length === 0"
            :description="t('status.pureNoMessage')"
            :image-size="60"
          />
          <span v-else>
            <template v-for="item in notices" :key="item.key">
              <el-tab-pane :label="getLabel(item)" :name="`${item.key}`">
                <el-scrollbar v-loading="inboxLoading" max-height="330px">
                  <div class="noticeList-container">
                    <NoticeList
                      :list="item.list"
                      :empty-text="item.emptyText"
                      @open-detail="handleOpenDetail"
                    />
                  </div>
                </el-scrollbar>
              </el-tab-pane>
            </template>
          </span>
        </el-tabs>
      </el-dropdown-menu>
    </template>
  </el-dropdown>

  <el-dialog
    v-model="detailVisible"
    :title="detailItem?.title || '消息详情'"
    width="560px"
    append-to-body
    destroy-on-close
  >
    <div v-if="detailItem" class="lay-notice-detail-body">
      <div
        v-if="detailRedirectUrl"
        class="lay-notice-redirect-banner mb-4 rounded-lg px-4 py-3"
      >
        <p class="text-sm text-[var(--el-text-color-regular)] mb-3 font-medium">
          {{ t("status.pureNoticeRedirectHint") }}
        </p>
        <el-button
          type="primary"
          size="large"
          class="lay-notice-redirect-btn w-full!"
          :icon="Right"
          @click="onGoNoticeRedirect"
        >
          {{ t("status.pureNoticeGoRedirect") }}
        </el-button>
      </div>
      <div
        class="text-[var(--el-text-color-secondary)] text-sm mb-3 flex items-center gap-2 flex-wrap"
      >
        <span class="font-medium text-[var(--el-text-color-regular)]"
          >发布时间</span
        >
        <span>{{
          detailItem.publishTimeFull || detailItem.datetime || "—"
        }}</span>
      </div>
      <el-divider class="!my-2" />
      <!-- 站内消息正文为后端下发 HTML，请确保来源可信 -->
      <div
        class="notice-detail-html max-h-[55vh] overflow-y-auto text-[var(--el-text-color-primary)] text-sm leading-relaxed"
        v-html="detailItem.contentHtml || detailItem.description"
      />
    </div>
  </el-dialog>
</template>

<style lang="scss" scoped>
.dropdown-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 48px;
  cursor: pointer;

  .header-notice-icon {
    font-size: 18px;
  }
}

.lay-notice-redirect-banner {
  border: 1px solid var(--el-color-primary-light-5);
  background: linear-gradient(
    135deg,
    var(--el-color-primary-light-9) 0%,
    var(--el-fill-color-blank) 100%
  );
  box-shadow: 0 2px 12px rgb(64 158 255 / 12%);
}

.lay-notice-redirect-btn {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.dropdown-tabs {
  .noticeList-container {
    padding: 15px 24px 0;
  }

  :deep(.el-tabs__header) {
    margin: 0;
  }

  :deep(.el-tabs__nav-wrap)::after {
    height: 1px;
  }

  :deep(.el-tabs__nav-wrap) {
    padding: 0 36px;
  }
}
</style>

<style lang="scss">
/* 详情弹窗内富文本（append-to-body，需非 scoped） */
.lay-notice-detail-body .notice-detail-html {
  word-break: break-word;

  img {
    max-width: 100%;
    height: auto;
  }

  p {
    margin: 0.5em 0;
  }

  p:first-child {
    margin-top: 0;
  }

  ul,
  ol {
    padding-left: 1.25rem;
    margin: 0.5em 0;
  }

  a {
    color: var(--el-color-primary);
  }
}
</style>
