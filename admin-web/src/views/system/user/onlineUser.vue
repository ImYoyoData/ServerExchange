<script lang="ts" setup>
import dayjs from "dayjs";
import { h, nextTick, onMounted, reactive, ref } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import { ElAvatar, ElMessageBox } from "element-plus";
import userAvatar from "@/assets/user.jpg";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import {
  pageAccessTokenSessions,
  revokeAccessTokenSession,
  revokeAllAccessTokenSessions
} from "@/api/accessTokenSession";
import { PURE_TABLE_PAGE_SIZES } from "@/utils/pureTable";

import Refresh from "~icons/ep/refresh";
import Delete from "~icons/ep/delete";

defineOptions({
  name: "OnlineUser"
});

const formRef = ref();
const onlineTableRef = ref();
const loading = ref(false);

const queryForm = reactive({
  keyword: ""
});

const pagination = reactive({
  total: 0,
  pageSize: 10,
  currentPage: 1,
  background: true,
  pageSizes: PURE_TABLE_PAGE_SIZES
});

const dataList = ref<any[]>([]);

function normalizeRowKey(list: any[]) {
  return (list || []).map((row: any) => {
    const uid = row?.userId ?? "";
    const children = Array.isArray(row?.children) ? row.children : [];
    return {
      ...row,
      id: `u-${uid}`,
      children: children.map((c: any) => ({
        ...c,
        id: `s-${uid}-${c?.jti ?? ""}`,
        __isSession: true
      }))
    };
  });
}

function isSessionRow(row: any) {
  return row?.__isSession === true;
}

function formatTs(ts: unknown) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "--";
  return dayjs(n).format("YYYY-MM-DD HH:mm:ss");
}

function resolveAvatarSrc(row: any) {
  const u = String(row?.avatar ?? "").trim();
  return u || userAvatar;
}

/** 剩余有效秒数：优先 ttlSeconds，否则由 expiresAt 推算 */
function getSessionRemainingSeconds(row: any): number | null {
  const raw = row?.ttlSeconds;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  const exp = row?.expiresAt;
  if (exp) {
    const end = dayjs(exp);
    if (end.isValid()) return end.diff(dayjs(), "second");
  }
  return null;
}

function formatNicknameUsername(row: any) {
  if (isSessionRow(row)) return "--";
  const nick = String(row?.nickname ?? "").trim();
  const user = String(row?.username ?? "").trim();
  if (nick && user) return `${nick} · ${user}`;
  return nick || user || "--";
}

function getSessionRowExpireClass(row: any): string {
  if (!isSessionRow(row)) return "";
  const sec = getSessionRemainingSeconds(row);
  if (sec === null || !Number.isFinite(sec)) {
    return "online-session-row online-session--unknown";
  }
  if (sec < 600) return "online-session-row online-session--lt10";
  if (sec < 1800) return "online-session-row online-session--10to30";
  return "online-session-row online-session--gt30";
}

function tableRowClassName({ row }: { row: any }) {
  return getSessionRowExpireClass(row);
}

/** 会话行底色：主表用半透明；操作列用不透明，避免 fixed 列透视 */
function getRowBackgroundColor(row: any, opaque = false) {
  if (!isSessionRow(row)) {
    return "var(--el-bg-color)";
  }
  const sec = getSessionRemainingSeconds(row);
  if (sec === null || !Number.isFinite(sec)) {
    return opaque
      ? "var(--el-fill-color-lighter)"
      : "var(--el-fill-color-lighter)";
  }
  if (sec < 600) {
    return opaque
      ? "var(--el-color-danger-light-9)"
      : "rgba(245, 108, 108, 0.14)";
  }
  if (sec < 1800) {
    return opaque
      ? "var(--el-color-warning-light-9)"
      : "rgba(230, 162, 60, 0.16)";
  }
  return opaque
    ? "var(--el-color-success-light-9)"
    : "rgba(103, 194, 58, 0.14)";
}

function isOperationColumn(column: any) {
  return (
    column?.property === "_operation" ||
    column?.columnKey === "onlineUser-operation" ||
    String(column?.className ?? "").includes("online-user-op-cell")
  );
}

/** 每格内联背景（含右侧 fixed「操作」列），操作列必须不透明 */
function tableCellStyle({ row, column }: { row: any; column?: any }) {
  const opaque = isOperationColumn(column);
  return { backgroundColor: getRowBackgroundColor(row, opaque) };
}

const columns: TableColumnList = [
  {
    label: "昵称 · 用户名",
    prop: "nickname",
    minWidth: 140,
    align: "left",
    showOverflowTooltip: true,
    cellRenderer: ({ row }) => formatNicknameUsername(row)
  },
  {
    label: "头像",
    prop: "avatar",
    width: 64,
    cellRenderer: ({ row }) => {
      if (isSessionRow(row)) return h("span");
      return h(ElAvatar, { size: 30, src: resolveAvatarSrc(row) });
    }
  },
  {
    label: "会话标识",
    prop: "jti",
    minWidth: 120,
    align: "left",
    showOverflowTooltip: true,
    cellRenderer: ({ row }) => {
      if (!isSessionRow(row)) return "--";
      const jti = String(row?.jti ?? "");
      const short =
        jti.length > 28 ? `${jti.slice(0, 14)}…${jti.slice(-8)}` : jti;
      return h("span", { title: jti }, short || "--");
    }
  },
  {
    label: "用户 ID",
    prop: "userId",
    width: 82
  },
  {
    label: "终端数",
    prop: "tokenCount",
    width: 72,
    cellRenderer: ({ row }) =>
      isSessionRow(row) ? "--" : String(row?.tokenCount ?? 0)
  },
  {
    label: "设备信息",
    prop: "device",
    minWidth: 180,
    align: "left",
    showOverflowTooltip: true,
    cellRenderer: ({ row }) =>
      isSessionRow(row) ? String(row?.device ?? "--") : "--"
  },
  {
    label: "会话时间",
    prop: "ts",
    minWidth: 170,
    cellRenderer: ({ row }) => (isSessionRow(row) ? formatTs(row?.ts) : "--")
  },
  {
    label: "过期时间",
    prop: "expiresAt",
    minWidth: 152,
    cellRenderer: ({ row }) =>
      isSessionRow(row) ? String(row?.expiresAt ?? "--") : "--"
  },
  {
    label: "剩余 TTL(秒)",
    prop: "ttlSeconds",
    width: 96,
    cellRenderer: ({ row }) => {
      if (!isSessionRow(row)) return "--";
      const v = row?.ttlSeconds;
      return v == null || v === "" ? "--" : String(v);
    }
  },
  {
    label: "操作",
    columnKey: "onlineUser-operation",
    prop: "_operation",
    fixed: "right",
    width: 128,
    align: "center",
    resizable: false,
    className: "online-user-op-cell",
    slot: "operation"
  }
];

function buildParams() {
  return {
    page: pagination.currentPage,
    pageSize: Math.min(100, Math.max(1, pagination.pageSize)),
    keyword: String(queryForm.keyword ?? "").trim() || undefined
  };
}

async function onSearch() {
  loading.value = true;
  try {
    const res: any = await pageAccessTokenSessions(buildParams());
    const ok = res?.success === true || res?.code === 200 || res?.code === 201;
    if (!ok) {
      message(res?.message ?? "获取在线会话失败", { type: "error" });
      return;
    }
    const d = res?.data ?? {};
    dataList.value = normalizeRowKey(d?.list ?? []);
    pagination.total = d?.total ?? 0;
    pagination.pageSize = Math.min(
      100,
      d?.pageSize ?? pagination.pageSize ?? 10
    );
    pagination.currentPage =
      d?.currentPage ?? d?.page ?? pagination.currentPage;
  } finally {
    loading.value = false;
    await nextTick();
    onlineTableRef.value?.getTableRef?.()?.doLayout?.();
  }
}

function resetQuery() {
  queryForm.keyword = "";
  pagination.currentPage = 1;
  onSearch();
}

async function handleRevokeSession(row: any) {
  const userId = Number(row?.userId);
  const jti = String(row?.jti ?? "");
  if (!userId || !jti) {
    message("缺少 userId 或 jti", { type: "warning" });
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定作废该用户的这条会话吗？\nJTI：${jti}`,
      "作废会话",
      { type: "warning", confirmButtonText: "确定", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  try {
    const res: any = await revokeAccessTokenSession({ userId, jti });
    const ok = res?.success === true || res?.code === 200 || res?.code === 201;
    if (!ok) {
      message(res?.message ?? "操作失败", { type: "error" });
      return;
    }
    if (res?.data?.revoked === false) {
      message("未找到对应 Redis 会话（可能已过期）", { type: "warning" });
    } else {
      message("已作废该会话", { type: "success" });
    }
    onSearch();
  } catch {
    /* http 层已提示 */
  }
}

async function handleRevokeAll(row: any) {
  const userId = Number(row?.userId);
  if (!userId) {
    message("缺少用户 ID", { type: "warning" });
    return;
  }
  const name =
    String(row?.nickname ?? "").trim() || row?.username || `ID:${userId}`;
  try {
    await ElMessageBox.confirm(
      `确定作废用户「${name}」的全部 accessToken 会话吗？`,
      "全部踢出",
      { type: "warning", confirmButtonText: "确定", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  try {
    const res: any = await revokeAllAccessTokenSessions(userId);
    const ok = res?.success === true || res?.code === 200 || res?.code === 201;
    if (!ok) {
      message(res?.message ?? "操作失败", { type: "error" });
      return;
    }
    const n = res?.data?.revokedCount;
    message(typeof n === "number" ? `已删除 ${n} 条会话` : "操作完成", {
      type: "success"
    });
    onSearch();
  } catch {
    /* http 层已提示 */
  }
}

function handleSizeChange(val: number) {
  pagination.pageSize = Math.min(100, val);
  pagination.currentPage = 1;
  onSearch();
}

function handleCurrentChange(val: number) {
  pagination.currentPage = val;
  onSearch();
}

onMounted(() => {
  onSearch();
});
</script>

<template>
  <div :class="['flex', 'justify-between', deviceDetection() && 'flex-wrap']">
    <div :class="[deviceDetection() ? ['w-full', 'mt-2'] : 'w-[calc(100%)]']">
      <el-form
        ref="formRef"
        :inline="true"
        :model="queryForm"
        class="search-form bg-bg_color w-full pl-8 pt-3 overflow-auto"
      >
        <el-form-item label="关键词" prop="keyword">
          <el-input
            v-model="queryForm.keyword"
            clearable
            placeholder="昵称 / 用户名 / 设备 / JTI"
            class="w-56!"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :icon="useRenderIcon('ri/search-line')"
            :loading="loading"
            @click="onSearch"
          >
            搜索
          </el-button>
          <el-button :icon="useRenderIcon(Refresh)" @click="resetQuery">
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <PureTableBar
        title="在线用户"
        :columns="columns"
        :is-expand-all="false"
        @refresh="onSearch"
      >
        <template v-slot="{ size, dynamicColumns }">
          <pure-table
            ref="onlineTableRef"
            class="online-user-table"
            row-key="id"
            table-key="onlineAccessSessions"
            align-whole="center"
            showOverflowTooltip
            table-layout="fixed"
            :indent="24"
            :border="true"
            :loading="loading"
            adaptive
            :adaptive-config="{ offsetBottom: 108 }"
            size="small"
            :data="dataList"
            :columns="dynamicColumns"
            :pagination="{ ...pagination, size: 'small' }"
            :row-class-name="tableRowClassName"
            :cell-style="tableCellStyle"
            :header-cell-style="{
              background: 'var(--el-fill-color-light)',
              color: 'var(--el-text-color-primary)'
            }"
            @page-size-change="handleSizeChange"
            @page-current-change="handleCurrentChange"
          >
            <template #operation="{ row }">
              <template v-if="!isSessionRow(row)">
                <el-button
                  link
                  type="danger"
                  :size="size"
                  :icon="useRenderIcon(Delete)"
                  :disabled="!row?.tokenCount"
                  @click="handleRevokeAll(row)"
                >
                  全部踢出
                </el-button>
              </template>
              <el-button
                v-else
                link
                type="danger"
                :size="size"
                :icon="useRenderIcon(Delete)"
                @click="handleRevokeSession(row)"
              >
                踢出
              </el-button>
            </template>
          </pure-table>
        </template>
      </PureTableBar>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}

.online-user-table {
  :deep(.el-table__cell) {
    padding: 4px 6px;
  }

  :deep(.el-table .cell) {
    line-height: 1.35;
  }

  /* 操作列：防止内容撑开宽度，避免多次 layout 后 fixed 列被越算越宽 */
  :deep(.online-user-op-cell) {
    overflow: hidden;
  }

  :deep(.online-user-op-cell .cell) {
    overflow: hidden;
    white-space: nowrap;
  }

  /* fixed 操作列：强制不透明底色，避免横向滚动时透视 */
  :deep(.online-user-op-cell.el-table__cell) {
    background-color: var(--el-bg-color) !important;
  }

  :deep(tr.online-session--unknown .online-user-op-cell.el-table__cell) {
    background-color: var(--el-fill-color-lighter) !important;
  }

  :deep(tr.online-session--lt10 .online-user-op-cell.el-table__cell) {
    background-color: var(--el-color-danger-light-9) !important;
  }

  :deep(tr.online-session--10to30 .online-user-op-cell.el-table__cell) {
    background-color: var(--el-color-warning-light-9) !important;
  }

  :deep(tr.online-session--gt30 .online-user-op-cell.el-table__cell) {
    background-color: var(--el-color-success-light-9) !important;
  }

  :deep(.el-table__fixed-right .el-table__header .online-user-op-cell.el-table__cell),
  :deep(.el-table__fixed-right-patch) {
    background-color: var(--el-fill-color-light) !important;
  }

  :deep(.el-table__body tr:hover > .online-user-op-cell.el-table__cell) {
    background-color: var(--el-table-row-hover-bg-color) !important;
  }
}
</style>
