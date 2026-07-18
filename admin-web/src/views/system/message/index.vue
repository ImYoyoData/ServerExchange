<script setup lang="ts">
import dayjs from "dayjs";
import { h, nextTick, reactive, ref } from "vue";
import { ElTag, type TableInstance } from "element-plus";
import { deviceDetection } from "@pureadmin/utils";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { addDialog } from "@/components/ReDialog";
import { message } from "@/utils/message";
import DictTag from "@/components/DictTag.vue";
import {
  pageAdminMessage,
  createMessage,
  updateMessage,
  removeMessage
} from "@/api/message";
import { getUserList } from "@/api/system";
import MessageForm from "./form.vue";
import { GetDict, parseDictValueAsReadFlag } from "@/hooks/dict";
import { PURE_TABLE_PAGE_SIZES } from "@/utils/pureTable";

import Delete from "~icons/ep/delete";
import EditPen from "~icons/ep/edit-pen";
import Refresh from "~icons/ep/refresh";
import AddFill from "~icons/ri/add-circle-line";
import UserPickIcon from "~icons/ri/user-3-fill";

defineOptions({
  name: "SystemMessage"
});

const formRef = ref();
const messageFormRef = ref();

const loading = ref(false);

const form = reactive({
  keyword: "",
  /** 字典 sys_message_status 的 value */
  status: "" as string,
  /** 字典 sys_message_type 的 value */
  type: "" as string,
  userId: undefined as number | undefined,
  page: 1,
  pageSize: 10
});

const pagination = reactive({
  total: 0,
  pageSize: 10,
  currentPage: 1,
  background: true,
  pageSizes: PURE_TABLE_PAGE_SIZES
});

const dataList = ref<any[]>([]);

/** 筛选：已选用户回显（与 form.userId 同步） */
const filterUserPick = ref<{ id: number; label: string } | null>(null);

/** 用户选择弹窗 */
const userPickVisible = ref(false);
const pickSearchKeyword = ref("");
const pickLoading = ref(false);
const pickList = ref<any[]>([]);
const pickSelectedId = ref<number | null>(null);
const userPickTableRef = ref<TableInstance>();

function formatUserPickLabel(row: any): string {
  const name = row?.nickname || row?.username || "用户";
  return `${name}（ID: ${row?.id}）`;
}

async function fetchPickUserList() {
  pickLoading.value = true;
  try {
    const q = String(pickSearchKeyword.value ?? "").trim();
    const pageSize = /^\d+$/.test(q) ? 500 : 100;
    const res: any = await getUserList({
      page: 1,
      pageSize,
      username: q && !/^\d+$/.test(q) ? q : undefined,
      phone: "",
      status: ""
    });
    let list = res?.success && res?.data?.list ? [...res.data.list] : [];
    if (/^\d+$/.test(q)) {
      list = list.filter(
        (u: any) =>
          String(u.id) === q ||
          String(u.id).includes(q) ||
          String(u.username ?? "").includes(q) ||
          String(u.nickname ?? "").includes(q)
      );
    }
    pickList.value = list;
    await nextTick();
    if (pickSelectedId.value != null) {
      const hit = list.find((u: any) => Number(u.id) === pickSelectedId.value);
      userPickTableRef.value?.setCurrentRow(hit ?? undefined);
    } else {
      userPickTableRef.value?.setCurrentRow(undefined);
    }
  } finally {
    pickLoading.value = false;
  }
}

function openUserPicker() {
  pickSearchKeyword.value = "";
  pickSelectedId.value =
    form.userId != null && form.userId > 0 ? Number(form.userId) : null;
  userPickVisible.value = true;
  void fetchPickUserList();
}

function onPickRowClick(row: any) {
  pickSelectedId.value = Number(row.id);
  userPickTableRef.value?.setCurrentRow(row);
}

function confirmUserPick() {
  if (pickSelectedId.value == null || pickSelectedId.value < 1) {
    message("请选择一个用户", { type: "warning" });
    return;
  }
  const row = pickList.value.find(
    (u: any) => Number(u.id) === pickSelectedId.value
  );
  form.userId = pickSelectedId.value;
  filterUserPick.value = {
    id: pickSelectedId.value,
    label: row ? formatUserPickLabel(row) : `ID: ${pickSelectedId.value}`
  };
  userPickVisible.value = false;
}

function clearFilterUser() {
  form.userId = undefined;
  filterUserPick.value = null;
}

function isReadRow(row: any): boolean {
  if (row?.read === true) return true;
  if (row?.status === true) return true;
  if (row?.isRead === true) return true;
  return false;
}

function resolveReadStatusDictValue(read: boolean): string {
  for (const opt of GetDict.sys_message_status) {
    if (parseDictValueAsReadFlag(opt.value) === read) return String(opt.value);
  }
  return read ? "1" : "0";
}

/** 发布时间：优先 publishedAt / publishAt，否则创建时间 */
function resolvePublishAt(row: any): unknown {
  return row?.publishedAt ?? row?.publishAt ?? row?.createdAt;
}

/** 已读时间字段（兼容多种命名） */
function resolveReadAt(row: any): unknown {
  return row?.readAt ?? row?.readTime ?? row?.read_at;
}

/**
 * 发布(创建) → 已读 的间隔文案：56秒、3分32秒、3小时32分、1天5小时、2月15天、1年3月
 */
function formatPublishToReadInterval(
  publishedRaw: unknown,
  readRaw: unknown
): { text: string; ms: number } | null {
  if (readRaw == null || readRaw === "") return null;
  const start = dayjs(publishedRaw as any);
  const end = dayjs(readRaw as any);
  if (!start.isValid() || !end.isValid()) return null;
  const ms = end.diff(start);
  if (ms <= 0) return { text: "0秒", ms: 0 };

  let cursor = start;
  const years = end.diff(cursor, "year");
  cursor = cursor.add(years, "year");
  const months = end.diff(cursor, "month");
  cursor = cursor.add(months, "month");
  const days = end.diff(cursor, "day");
  cursor = cursor.add(days, "day");
  const hours = end.diff(cursor, "hour");
  cursor = cursor.add(hours, "hour");
  const minutes = end.diff(cursor, "minute");
  cursor = cursor.add(minutes, "minute");
  const seconds = end.diff(cursor, "second");

  let text: string;
  if (years > 0) {
    text = months > 0 ? `${years}年${months}月` : `${years}年`;
  } else if (months > 0) {
    text = days > 0 ? `${months}月${days}天` : `${months}月`;
  } else if (days > 0) {
    text = hours > 0 ? `${days}天${hours}小时` : `${days}天`;
  } else if (hours > 0) {
    text = minutes > 0 ? `${hours}小时${minutes}分` : `${hours}小时`;
  } else if (minutes > 0) {
    text = seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分`;
  } else {
    text = `${seconds}秒`;
  }
  return { text, ms };
}

/** 间隔越久 tag 越「严重」 */
function readDelayTagProps(ms: number): {
  type: "success" | "info" | "warning" | "danger";
  effect: "plain" | "dark";
} {
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  const week = 7 * day;
  if (ms < minute) return { type: "success", effect: "plain" };
  if (ms < hour) return { type: "info", effect: "plain" };
  if (ms < day) return { type: "warning", effect: "plain" };
  if (ms < week) return { type: "danger", effect: "plain" };
  return { type: "danger", effect: "dark" };
}

const columns: TableColumnList = [
  { label: "标题", prop: "title", minWidth: 140, showOverflowTooltip: true },
  {
    label: "内容",
    prop: "content",
    minWidth: 180,
    showOverflowTooltip: true
  },
  {
    label: "类型",
    prop: "type",
    width: 100,
    cellRenderer: ({ row }) =>
      h(DictTag, {
        code: "sys_message_type",
        value: row?.type
      })
  },
  {
    label: "用户",
    prop: "userId",
    minWidth: 120,
    formatter: ({ userId }) => {
      if (userId === 0 || userId === "0") return "全部";
      if (Array.isArray(userId)) return userId.join(", ");
      return userId ?? "";
    }
  },

  {
    label: "状态",
    prop: "read",
    width: 100,
    cellRenderer: ({ row }) => {
      const read = isReadRow(row);
      return h(DictTag, {
        code: "sys_message_status",
        value: resolveReadStatusDictValue(read)
      });
    }
  },
  {
    label: "发布至已读",
    prop: "readDelay",
    minWidth: 140,
    cellRenderer: ({ row }) => {
      const pub = resolvePublishAt(row);
      const read = resolveReadAt(row);
      const parsed = formatPublishToReadInterval(pub, read);
      if (!parsed) {
        return h(
          "span",
          { class: "text-[var(--el-text-color-placeholder)]" },
          "—"
        );
      }
      const { type, effect } = readDelayTagProps(parsed.ms);
      return h(
        ElTag,
        { type, effect, size: "small" },
        { default: () => parsed.text }
      );
    }
  },
  {
    label: "跳转",
    prop: "redirectUrl",
    minWidth: 120,
    showOverflowTooltip: true
  },
  {
    label: "创建时间",
    prop: "createdAt",
    minWidth: 160,
    formatter: ({ createdAt }) =>
      createdAt ? dayjs(createdAt).format("YYYY-MM-DD HH:mm:ss") : ""
  },
  {
    label: "已读时间",
    prop: "readAt",
    minWidth: 160,
    formatter: (row: any) => {
      const v = resolveReadAt(row);
      return v
        ? dayjs(v as string | number | Date).format("YYYY-MM-DD HH:mm:ss")
        : "";
    }
  },

  {
    label: "操作",
    fixed: "right",
    width: 130,
    slot: "operation"
  }
];

function buildPageParams() {
  const p: Record<string, any> = {
    page: pagination.currentPage,
    pageSize: pagination.pageSize,
    keyword: String(form.keyword ?? "").trim() || undefined
  };
  if (form.status !== "" && form.status != null) {
    const b = parseDictValueAsReadFlag(form.status);
    if (b !== null) p.status = b;
  }
  if (form.type !== "" && form.type != null) {
    const n = Number(form.type);
    if (!Number.isNaN(n)) p.type = n;
  }
  if (
    form.userId != null &&
    form.userId !== ("" as any) &&
    Number(form.userId) > 0
  ) {
    p.userId = Number(form.userId);
  }
  return p;
}

function resetForm(formEl: any) {
  if (!formEl) return;
  formEl.resetFields();
  form.keyword = "";
  form.status = "";
  form.type = "";
  form.userId = undefined;
  filterUserPick.value = null;
  onSearch();
}

async function onSearch() {
  loading.value = true;
  try {
    const res: any = await pageAdminMessage(buildPageParams());
    const ok = res?.success === true || res?.code === 200;
    if (!ok) {
      message(res?.message ?? "获取消息列表失败", { type: "error" });
      return;
    }
    const d = res?.data;
    dataList.value = d?.list ?? d?.items ?? (Array.isArray(d) ? d : []);
    pagination.total = d?.total ?? 0;
    pagination.pageSize = d?.pageSize ?? form.pageSize;
    pagination.currentPage =
      d?.currentPage ?? d?.page ?? pagination.currentPage;
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(val: number) {
  pagination.pageSize = val;
  pagination.currentPage = 1;
  onSearch();
}

function handleCurrentChange(val: number) {
  pagination.currentPage = val;
  onSearch();
}

function openDialog(title: "新增" | "修改" = "新增", row?: any) {
  const isEdit = title === "修改";
  addDialog({
    title: `${title}消息`,
    props: {
      formInline: {
        id: row?.id,
        title: row?.title ?? "",
        content: row?.content ?? "",
        type: row?.type ?? 1,
        userId: row?.userId ?? 0,
        roleIds: row?.roleIds,
        redirectUrl: row?.redirectUrl ?? ""
      },
      isEdit
    },
    width: "820px",
    draggable: true,
    fullscreen: deviceDetection(),
    fullscreenIcon: true,
    closeOnClickModal: false,
    contentRenderer: ({ options }) =>
      h(MessageForm, {
        ref: messageFormRef,
        formInline: options.props.formInline,
        isEdit: Boolean((options.props as { isEdit?: boolean }).isEdit)
      }),
    beforeSure: done => {
      const formVm = messageFormRef.value;
      const FormRef = formVm?.getRef?.();
      if (!formVm?.getFormData || !FormRef) {
        message("表单未就绪", { type: "error" });
        return;
      }
      FormRef.validate((valid: boolean) => {
        if (!valid) return;

        const curData = formVm.getFormData() as Record<string, any>;

        if (title === "新增") {
          createMessage(curData).then((res: any) => {
            if (res?.success || res?.code === 200 || res?.code === 201) {
              message("新增成功", { type: "success" });
              done();
              onSearch();
            }
          });
          return;
        }

        if (curData.id == null && row?.id != null) curData.id = row.id;
        updateMessage(curData).then((res: any) => {
          if (res?.success || res?.code === 200) {
            message("修改成功", { type: "success" });
            done();
            onSearch();
          }
        });
      });
    }
  });
}

function handleDelete(row: any) {
  if (!row?.id) return;
  removeMessage(String(row.id)).then((res: any) => {
    if (res?.success || res?.code === 200) {
      message("已删除", { type: "success" });
      onSearch();
    }
  });
}

onSearch();
</script>

<template>
  <div :class="['flex', 'justify-between', deviceDetection() && 'flex-wrap']">
    <div :class="[deviceDetection() ? ['w-full', 'mt-2'] : 'w-[calc(100%)]']">
      <el-form
        ref="formRef"
        :inline="true"
        :model="form"
        class="search-form bg-bg_color w-full pl-8 pt-3 overflow-auto"
      >
        <el-form-item label="关键词：" prop="keyword">
          <el-input
            v-model="form.keyword"
            placeholder="标题/内容"
            clearable
            class="w-40!"
          />
        </el-form-item>
        <el-form-item label="状态：" prop="status">
          <el-select
            v-model="form.status"
            placeholder="全部"
            clearable
            class="w-40!"
          >
            <el-option
              v-for="opt in GetDict.sys_message_status"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="类型：" prop="type">
          <el-select
            v-model="form.type"
            placeholder="全部"
            clearable
            class="w-40!"
          >
            <el-option
              v-for="opt in GetDict.sys_message_type"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="接收用户：" prop="userId">
          <div class="flex flex-wrap items-center gap-2">
            <el-input
              :model-value="
                filterUserPick?.label ??
                (form.userId != null && form.userId > 0
                  ? `用户 ID: ${form.userId}`
                  : '')
              "
              readonly
              placeholder="点击选择用户（按名称或 ID 搜索）"
              class="w-56!"
            />
            <el-button
              :icon="useRenderIcon(UserPickIcon)"
              @click="openUserPicker"
            >
              选择用户
            </el-button>
            <el-button
              v-if="form.userId != null && form.userId > 0"
              link
              type="primary"
              @click="clearFilterUser"
            >
              清除
            </el-button>
          </div>
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
          <el-button :icon="useRenderIcon(Refresh)" @click="resetForm(formRef)">
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <PureTableBar title="站内消息" :columns="columns" @refresh="onSearch">
        <template #buttons>
          <el-button
            type="primary"
            :icon="useRenderIcon(AddFill)"
            @click="openDialog()"
          >
            新增消息
          </el-button>
        </template>
        <template v-slot="{ size, dynamicColumns }">
          <pure-table
            row-key="id"
            adaptive
            stripe
            align-whole="center"
            showOverflowTooltip
            table-layout="auto"
            :loading="loading"
            :size="size"
            :data="dataList"
            :border="true"
            :columns="dynamicColumns"
            :pagination="{ ...pagination, size }"
            :header-cell-style="{
              background: 'var(--el-fill-color-light)',
              color: 'var(--el-text-color-primary)'
            }"
            @page-size-change="handleSizeChange"
            @page-current-change="handleCurrentChange"
          >
            <template #operation="{ row }">
              <el-button
                class="reset-margin"
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(EditPen)"
                @click="openDialog('修改', row)"
              />
              <el-popconfirm
                :title="`确定删除「${row.title || row.id}」？`"
                @confirm="handleDelete(row)"
              >
                <template #reference>
                  <el-button
                    class="reset-margin"
                    link
                    type="primary"
                    :size="size"
                    :icon="useRenderIcon(Delete)"
                  />
                </template>
              </el-popconfirm>
            </template>
          </pure-table>
        </template>
      </PureTableBar>
    </div>

    <el-dialog
      v-model="userPickVisible"
      title="选择用户（筛选）"
      width="640px"
      append-to-body
      destroy-on-close
    >
      <div class="flex flex-wrap gap-2 mb-3">
        <el-input
          v-model="pickSearchKeyword"
          clearable
          placeholder="搜索：用户名称，或用户 ID（数字）"
          class="flex-1 min-w-[200px]"
          @keyup.enter="fetchPickUserList"
        />
        <el-button
          type="primary"
          :loading="pickLoading"
          @click="fetchPickUserList"
        >
          搜索
        </el-button>
      </div>
      <p
        v-if="pickSelectedId != null"
        class="text-xs text-(--el-text-color-secondary) mb-2"
      >
        已选用户 ID：<strong>{{ pickSelectedId }}</strong>
        （点击表格行可更改）
      </p>
      <el-table
        ref="userPickTableRef"
        v-loading="pickLoading"
        :data="pickList"
        max-height="360"
        highlight-current-row
        row-key="id"
        @row-click="onPickRowClick"
      >
        <el-table-column prop="id" label="用户 ID" width="100" />
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="nickname" label="昵称" min-width="120" />
      </el-table>
      <template #footer>
        <el-button @click="userPickVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmUserPick">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
:deep(.el-dropdown-menu__item i) {
  margin: 0;
}

.main-content {
  margin: 24px 24px 0 !important;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
