<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from "vue";
import dayjs from "dayjs";
import { deviceDetection } from "@pureadmin/utils";
import { ElTag } from "element-plus";
import { ElMessageBox } from "element-plus";
import { ElTooltip } from "element-plus";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { CronElementPlus } from "@vue-js-cron/element-plus";
import "@vue-js-cron/element-plus/dist/element-plus.css";
import { defaultItems, type Field, type Period } from "@vue-js-cron/core";
import {
  executeAdminTask,
  getAdminTask,
  pageAdminTasks,
  postAdminAgentChat,
  removeAdminTask,
  updateAdminTask
} from "@/api/tasks";
import { PURE_TABLE_PAGE_SIZES } from "@/utils/pureTable";

import Delete from "~icons/ep/delete";
import EditPen from "~icons/ep/edit-pen";
import Refresh from "~icons/ep/refresh";
import Play from "~icons/ri/play-circle-line";

defineOptions({ name: "SystemTasks" });

const formRef = ref();
const loading = ref(false);

const queryForm = reactive<{
  /** el-input clearable 可能为 null */
  name: string | null;
  enabled: "" | boolean;
  lastExecuteTimeRange: [string, string] | [] | null;
}>({
  name: "",
  enabled: "",
  lastExecuteTimeRange: []
});

const pagination = reactive({
  total: 0,
  pageSize: 10,
  currentPage: 1,
  background: true,
  pageSizes: PURE_TABLE_PAGE_SIZES
});

const dataList = ref<any[]>([]);

const columns: TableColumnList = [
  { label: "ID", prop: "id", width: 90, fixed: "left" },
  { label: "名称", prop: "name", minWidth: 160, showOverflowTooltip: true },
  {
    label: "Cron",
    prop: "cron",
    minWidth: 220,
    showOverflowTooltip: true
  },
  {
    label: "状态",
    prop: "enabled",
    width: 110,
    cellRenderer: ({ row }) =>
      h(
        ElTag,
        {
          type: row?.enabled ? "success" : "danger",
          effect: "plain",
          size: "small"
        },
        {
          default: () => (row?.enabled ? "启用" : "禁用")
        }
      )
  },
  {
    label: "有效性",
    prop: "isValid",
    width: 100,
    cellRenderer: ({ row }) => {
      const isInvalid = row?.isValid === false;
      const tag = h(
        ElTag,
        {
          type: isInvalid ? "info" : "success",
          effect: "plain",
          size: "small"
        },
        {
          default: () => (isInvalid ? "无效" : "有效")
        }
      );
      if (!isInvalid) return tag;
      return h(
        ElTooltip,
        {
          content: "该任务对应代码已不存在，当前任务无效",
          placement: "top"
        },
        {
          default: () => tag
        }
      );
    }
  },
  {
    label: "上次执行状态",
    prop: "lastExecuteStatus",
    width: 150,
    cellRenderer: ({ row }) => {
      if (row?.lastExecuteStatus == null) {
        return h(
          "span",
          { style: { color: "var(--el-text-color-secondary)" } },
          "--"
        );
      }
      const ok = Boolean(row?.lastExecuteStatus);
      return h(
        ElTag,
        {
          type: ok ? "success" : "danger",
          effect: "plain",
          size: "small"
        },
        {
          default: () => (ok ? "成功" : "失败")
        }
      );
    }
  },
  {
    label: "上次是否手动执行",
    prop: "isManualExecute",
    width: 170,
    cellRenderer: ({ row }) => {
      if (row?.isManualExecute == null) {
        return h(
          "span",
          { style: { color: "var(--el-text-color-secondary)" } },
          "--"
        );
      }
      const manual = Boolean(row?.isManualExecute);
      return h(
        ElTag,
        {
          type: manual ? "warning" : "info",
          effect: "plain",
          size: "small"
        },
        {
          default: () => (manual ? "手动" : "自动")
        }
      );
    }
  },

  {
    label: "上次执行时间",
    prop: "lastExecuteTime",
    minWidth: 180,
    formatter: ({ lastExecuteTime }) =>
      lastExecuteTime
        ? dayjs(lastExecuteTime).format("YYYY-MM-DD HH:mm:ss")
        : "--"
  },
  {
    label: "描述",
    prop: "remark",
    minWidth: 200,
    showOverflowTooltip: true
  },
  {
    label: "操作",
    fixed: "right",
    width: 240,
    slot: "operation"
  }
];

function resetQuery() {
  queryForm.name = "";
  queryForm.enabled = "";
  queryForm.lastExecuteTimeRange = [];
  pagination.currentPage = 1;
  onSearch();
}

function buildQueryParams() {
  const params: Record<string, any> = {
    page: pagination.currentPage,
    pageSize: pagination.pageSize
  };
  const taskName = String(queryForm.name ?? "").trim();
  if (taskName) params.name = taskName;
  if (queryForm.enabled !== "") {
    params.enabled = queryForm.enabled;
  }
  if (
    Array.isArray(queryForm.lastExecuteTimeRange) &&
    queryForm.lastExecuteTimeRange.length === 2
  ) {
    params.lastExecuteTimeBegin = queryForm.lastExecuteTimeRange[0];
    params.lastExecuteTimeEnd = queryForm.lastExecuteTimeRange[1];
  }
  return params;
}

async function onSearch() {
  loading.value = true;
  try {
    const res: any = await pageAdminTasks(buildQueryParams());
    const ok = res?.success === true || res?.code === 200 || res?.code === 201;
    if (!ok) {
      message(res?.message ?? "获取任务列表失败", { type: "error" });
      return;
    }
    const d = res?.data ?? {};
    dataList.value = d?.list ?? res?.list ?? [];
    pagination.total = d?.total ?? 0;
    pagination.pageSize = d?.pageSize ?? pagination.pageSize;
    pagination.currentPage =
      d?.currentPage ?? d?.page ?? pagination.currentPage;
  } finally {
    loading.value = false;
  }
}

const editVisible = ref(false);
const editLoading = ref(false);
const executingId = ref<string | number | null>(null);
const cronError = ref("");
const cronEditorKey = ref("");
const cronItems = defaultItems("zh", "crontab");
const cronFields: Field[] = [
  { id: "second", items: cronItems.secondItems },
  { id: "minute", items: cronItems.minuteItems },
  { id: "hour", items: cronItems.hourItems },
  { id: "day", items: cronItems.dayItems },
  { id: "month", items: cronItems.monthItems },
  { id: "dayOfWeek", items: cronItems.dayOfWeekItems }
];
const cronPeriods: Period[] = [
  { id: "second", value: ["second"] },
  { id: "minute", value: ["minute", "second"] },
  { id: "hour", value: ["hour", "minute", "second"] },
  { id: "day", value: ["day", "hour", "minute", "second"] },
  { id: "week", value: ["dayOfWeek", "hour", "minute", "second"] },
  { id: "month", value: ["day", "month", "hour", "minute", "second"] },
  {
    id: "year",
    value: ["day", "month", "dayOfWeek", "hour", "minute", "second"]
  }
];

/**
 * Quartz -> node-cron 兼容归一化：
 * - 把 `?` 替换为 `*`
 * - 若是 7 段（含 year）则去掉最后一段
 */
function normalizeCronForNode(input: string) {
  const text = String(input ?? "").trim();
  if (!text) return "";
  const parts = text.split(/\s+/).map(x => (x === "?" ? "*" : x));
  if (parts.length === 7) {
    return parts.slice(0, 6).join(" ");
  }
  return parts.join(" ");
}

function validateCronForNode6(input: string) {
  const text = normalizeCronForNode(input);
  const parts = text.split(/\s+/);
  if (parts.length !== 6) return false;
  // 放宽校验：允许数字、*、/、,、- 以及英文缩写（如 MON）
  return parts.every(part => /^[\dA-Za-z*/,\-]+$/.test(part));
}

const editForm = reactive<{
  id: string | number | null;
  cron: string;
  enabled: boolean;
  remark: string;
}>({
  id: null,
  cron: "",
  enabled: true,
  remark: ""
});

const quickSecondStep = ref(2);
const quickMinuteStep = ref(5);
const quickDailyTime = ref("08:00:00");
const aiGenerating = ref(false);

function touchCronEditor() {
  cronError.value = "";
  cronEditorKey.value = `${editForm.id ?? "new"}-${editForm.cron}`;
}

function applyCron(cron: string) {
  editForm.cron = normalizeCronForNode(cron);
  touchCronEditor();
}

function applyEveryNSeconds() {
  const n = Math.max(1, Number(quickSecondStep.value) || 1);
  applyCron(`*/${n} * * * * *`);
}

function applyEveryNMinutes() {
  const n = Math.max(1, Number(quickMinuteStep.value) || 1);
  applyCron(`0 */${n} * * * *`);
}

function applyDailyAt() {
  const [hh = "08", mm = "00", ss = "00"] = String(quickDailyTime.value).split(
    ":"
  );
  const h = Math.min(23, Math.max(0, Number(hh) || 0));
  const m = Math.min(59, Math.max(0, Number(mm) || 0));
  const s = Math.min(59, Math.max(0, Number(ss) || 0));
  applyCron(`${s} ${m} ${h} * * *`);
}

function extractCronFromText(text: string) {
  const normalized = String(text ?? "")
    .trim()
    .replace(/`/g, "");
  const parts = normalized.split(/\s+/);
  if (parts.length >= 6) {
    const firstSix = parts.slice(0, 6).join(" ");
    if (validateCronForNode6(firstSix)) return firstSix;
  }
  const lineMatch = normalized.match(
    /([*\dA-Za-z\/,\-?]+\s+[*\dA-Za-z\/,\-?]+\s+[*\dA-Za-z\/,\-?]+\s+[*\dA-Za-z\/,\-?]+\s+[*\dA-Za-z\/,\-?]+\s+[*\dA-Za-z\/,\-?]+)/
  );
  if (lineMatch?.[1] && validateCronForNode6(lineMatch[1])) {
    return lineMatch[1];
  }
  return "";
}

async function handleAiGenerateCron() {
  const { value, action } = await ElMessageBox.prompt(
    "请输入调度需求（例如：每5分钟执行一次）",
    "AI 生成 Cron",
    {
      inputPlaceholder: "请输入你的任务执行需求",
      confirmButtonText: "生成",
      cancelButtonText: "取消"
    }
  ).catch(() => ({ value: "", action: "cancel" as const }));

  if (action !== "confirm") return;
  const demand = String(value ?? "").trim();
  if (!demand) {
    message("请输入调度需求", { type: "warning" });
    return;
  }

  aiGenerating.value = true;
  try {
    const prompt =
      `给我生成一个 cron 表达式（node cron 6 段，含秒，禁止使用 ?）。` +
      `我的需求如下：${demand}。` +
      `根据我的需求生成 cron 表达式，只返回表达式本身，其他内容都不要返回。`;
    const res: any = await postAdminAgentChat(prompt);
    const ok = res?.success === true || res?.code === 200 || res?.code === 201;
    if (!ok) {
      message(res?.message ?? "AI 生成失败", { type: "error" });
      return;
    }

    const raw =
      (typeof res?.data === "string" ? res.data : "") ||
      (typeof res?.data?.message === "string" ? res.data.message : "") ||
      (typeof res?.message === "string" ? res.message : "");
    const cron = normalizeCronForNode(extractCronFromText(raw));
    if (!validateCronForNode6(cron)) {
      message("AI 返回的表达式无法识别，请重试或手动调整", { type: "warning" });
      return;
    }
    applyCron(cron);
    message("已应用 AI 生成的 Cron", { type: "success" });
  } finally {
    aiGenerating.value = false;
  }
}

const canSave = computed(() => {
  return editForm.id != null && String(editForm.cron ?? "").trim().length > 0;
});

async function openEdit(row: any) {
  editLoading.value = true;
  try {
    const id = row?.id;
    if (id == null) return;

    // 列表一般会带 cron/remark/enabled；若缺失则按 id 再取详情，避免提交字段不全
    let task = row;
    const needDetail =
      task?.cron == null || task?.remark == null || task?.enabled == null;
    if (needDetail) {
      const res: any = await getAdminTask(id);
      const ok = res?.success === true || res?.code === 200;
      if (!ok) throw new Error(res?.message ?? "获取任务详情失败");
      task = res?.data ?? task;
    }

    editForm.id = id;
    editForm.cron = normalizeCronForNode(String(task?.cron ?? ""));
    editForm.enabled = Boolean(task?.enabled);
    editForm.remark = String(task?.remark ?? "");
    cronError.value = "";
    // 每次根据后端表达式重建编辑器，确保正确复显
    cronEditorKey.value = `${id}-${editForm.cron}`;
    editVisible.value = true;
  } catch (e: any) {
    message(e?.message ?? "打开编辑失败", { type: "error" });
  } finally {
    editLoading.value = false;
  }
}

async function onSaveEdit() {
  if (!canSave.value || editForm.id == null) return;
  const cron = normalizeCronForNode(editForm.cron);
  if (!validateCronForNode6(cron)) {
    message("Cron 需为 node 兼容的 6 段表达式（含秒）", { type: "warning" });
    return;
  }
  editLoading.value = true;
  try {
    const res: any = await updateAdminTask(editForm.id, {
      cron,
      remark: editForm.remark ?? "",
      enabled: editForm.enabled
    });
    const ok = res?.success === true || res?.code === 200;
    if (!ok) {
      message(res?.message ?? "保存失败", { type: "error" });
      return;
    }
    message("保存成功", { type: "success" });
    editVisible.value = false;
    onSearch();
  } finally {
    editLoading.value = false;
  }
}

function closeEdit() {
  editVisible.value = false;
}

async function handleExecute(row: any) {
  const id = row?.id;
  if (id == null) return;
  if (executingId.value === id) return;

  const confirmed = await ElMessageBox.confirm(
    `确认运行任务「${row?.cron ?? id}」吗？`,
    "运行确认",
    { type: "warning" }
  )
    .then(() => true)
    .catch(() => false);

  if (!confirmed) return;

  try {
    executingId.value = id;
    const res: any = await executeAdminTask(id);
    const ok = res?.success === true || res?.code === 200 || res?.code === 201;
    if (!ok) {
      message(res?.message ?? "运行失败", { type: "error" });
      return;
    }
    message("任务已触发执行", { type: "success" });
  } catch (e: any) {
    message(e?.message ?? "运行失败", { type: "error" });
  } finally {
    executingId.value = null;
  }
}

async function handleDelete(row: any) {
  const id = row?.id;
  if (id == null) return;
  if (row?.isValid !== false) {
    message("仅无效任务可删除", { type: "warning" });
    return;
  }
  const res: any = await removeAdminTask(id);
  const ok = res?.success === true || res?.code === 200 || res?.code === 201;
  if (!ok) {
    message(res?.message ?? "删除失败", { type: "error" });
    return;
  }
  message("删除成功", { type: "success" });
  onSearch();
}

function tableRowStyle({ row }: { row: any }) {
  if (row?.isValid === false) {
    return {
      background: "var(--el-fill-color-light)"
    };
  }
  return {};
}

onMounted(() => {
  void onSearch();
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
        <el-form-item label="任务名称" prop="name">
          <el-input
            v-model="queryForm.name"
            clearable
            placeholder="请输入任务名称"
            class="w-48!"
          />
        </el-form-item>
        <el-form-item label="启用状态" prop="enabled">
          <el-select
            v-model="queryForm.enabled"
            clearable
            placeholder="全部"
            class="w-40!"
          >
            <el-option label="启用" :value="true" />
            <el-option label="禁用" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="上次执行时间" prop="lastExecuteTimeRange">
          <el-date-picker
            v-model="queryForm.lastExecuteTimeRange"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            class="w-90!"
            clearable
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

      <PureTableBar title="计划任务" :columns="columns" @refresh="onSearch">
        <template v-slot="{ size, dynamicColumns }">
          <pure-table
            row-key="id"
            adaptive
            :adaptiveConfig="{ offsetBottom: 108 }"
            align-whole="center"
            table-layout="auto"
            :loading="loading"
            :size="size"
            :border="true"
            :data="dataList"
            :columns="dynamicColumns"
            :row-style="tableRowStyle"
            :pagination="{ ...pagination, size }"
            :header-cell-style="{
              background: 'var(--el-fill-color-light)',
              color: 'var(--el-text-color-primary)'
            }"
            @page-size-change="
              (val: number) => {
                pagination.pageSize = val;
                pagination.currentPage = 1;
                onSearch();
              }
            "
            @page-current-change="
              (val: number) => {
                pagination.currentPage = val;
                onSearch();
              }
            "
          >
            <template #operation="{ row }">
              <el-tooltip
                v-if="row?.isValid === false"
                content="该任务对应代码已不存在，不能修改"
                placement="top"
              >
                <span>
                  <el-button
                    class="reset-margin"
                    link
                    type="primary"
                    :size="size"
                    :icon="useRenderIcon(EditPen)"
                    disabled
                  >
                    修改
                  </el-button>
                </span>
              </el-tooltip>
              <el-button
                v-else
                class="reset-margin"
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(EditPen)"
                @click="openEdit(row)"
              >
                修改
              </el-button>

              <el-tooltip
                v-if="row?.isValid === false"
                content="该任务对应代码已不存在，不能运行"
                placement="top"
              >
                <span>
                  <el-button
                    class="reset-margin"
                    link
                    type="primary"
                    :size="size"
                    :icon="useRenderIcon(Play)"
                    disabled
                  >
                    运行
                  </el-button>
                </span>
              </el-tooltip>
              <el-button
                v-else
                class="reset-margin"
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(Play)"
                :loading="executingId === row.id"
                @click="handleExecute(row)"
              >
                运行
              </el-button>
              <el-popconfirm
                v-if="row?.isValid === false"
                :title="`确认删除任务 #${row?.id} 吗？`"
                @confirm="handleDelete(row)"
              >
                <template #reference>
                  <el-button
                    class="reset-margin"
                    link
                    type="danger"
                    :size="size"
                    :icon="useRenderIcon(Delete)"
                  >
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </pure-table>
        </template>
      </PureTableBar>

      <el-dialog
        v-model="editVisible"
        title="修改计划任务"
        width="620px"
        destroy-on-close
        :close-on-click-modal="false"
      >
        <div v-loading="editLoading" class="min-h-[120px]">
          <el-form label-width="90px">
            <el-form-item label="Cron">
              <div class="cron-editor-wrap">
                <div class="cron-quick-panel">
                  <div class="cron-quick-row">
                    <span class="cron-row-label">常用</span>
                    <div class="flex flex-wrap items-center gap-2">
                      <el-button
                        link
                        type="primary"
                        @click="applyCron('* * * * * *')"
                        >每秒</el-button
                      >
                      <el-button
                        link
                        type="primary"
                        @click="applyCron('0 * * * * *')"
                        >每分钟</el-button
                      >
                      <el-button
                        link
                        type="primary"
                        @click="applyCron('0 0 * * * *')"
                        >每小时</el-button
                      >
                    </div>
                  </div>
                  <div class="cron-quick-row">
                    <span class="cron-row-label">每 N 秒</span>
                    <div class="flex flex-wrap items-center gap-2">
                      <el-input-number
                        v-model="quickSecondStep"
                        :min="1"
                        :max="59"
                        controls-position="right"
                        class="w-30!"
                      />
                      <el-button size="small" @click="applyEveryNSeconds"
                        >应用</el-button
                      >
                    </div>
                  </div>
                  <div class="cron-quick-row">
                    <span class="cron-row-label">每 N 分钟</span>
                    <div class="flex flex-wrap items-center gap-2">
                      <el-input-number
                        v-model="quickMinuteStep"
                        :min="1"
                        :max="59"
                        controls-position="right"
                        class="w-30!"
                      />
                      <el-button size="small" @click="applyEveryNMinutes"
                        >应用</el-button
                      >
                    </div>
                  </div>
                  <div class="cron-quick-row">
                    <span class="cron-row-label">每天固定时间</span>
                    <div class="flex flex-wrap items-center gap-2">
                      <el-time-picker
                        v-model="quickDailyTime"
                        value-format="HH:mm:ss"
                        format="HH:mm:ss"
                        placeholder="选择时间"
                        class="w-42!"
                      />
                      <el-button size="small" @click="applyDailyAt"
                        >应用</el-button
                      >
                    </div>
                  </div>
                </div>

                <div class="cron-manual-row">
                  <el-input
                    v-model="editForm.cron"
                    clearable
                    placeholder="支持手动输入，如 */1 * * * * *"
                  />
                  <el-button
                    type="primary"
                    plain
                    :loading="aiGenerating"
                    @click="handleAiGenerateCron"
                  >
                    AI生成
                  </el-button>
                </div>
                <div class="mt-1 text-xs text-(--el-text-color-secondary)">
                  若可视化组件无法编辑 `/` 语法，可直接手动输入并保存
                </div>

                <div class="cron-visual-panel">
                  <CronElementPlus
                    :key="cronEditorKey"
                    v-model="editForm.cron"
                    format="crontab"
                    locale="zh"
                    :fields="cronFields"
                    :periods="cronPeriods"
                    @error="cronError = $event"
                  />
                </div>

                <div
                  v-if="cronError"
                  class="mt-1 text-xs text-(--el-color-danger)"
                >
                  {{ cronError }}
                </div>
              </div>
            </el-form-item>
            <el-form-item label="启用">
              <el-switch
                v-model="editForm.enabled"
                :active-value="true"
                :inactive-value="false"
                active-text="启用"
                inactive-text="禁用"
              />
            </el-form-item>
            <el-form-item label="描述">
              <el-input
                v-model="editForm.remark"
                type="textarea"
                :rows="4"
                clearable
                placeholder="请输入描述"
              />
            </el-form-item>
          </el-form>
        </div>
        <template #footer>
          <el-button @click="closeEdit">取消</el-button>
          <el-button type="primary" :disabled="!canSave" @click="onSaveEdit">
            保存
          </el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}

.cron-editor-wrap {
  width: 100%;
}

.cron-quick-panel {
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.cron-quick-row {
  display: grid;
  grid-template-columns: 90px 1fr;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.cron-quick-row:last-child {
  margin-bottom: 0;
}

.cron-row-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cron-manual-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.cron-visual-panel {
  margin-top: 8px;
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
</style>
