<script lang="ts" setup>
import dayjs from "dayjs";
import { h, onMounted, reactive, ref } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import { ElCheckbox, ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import DictTag from "@/components/DictTag.vue";
import {
  pageAdminFile,
  removeAdminFile,
  removeAdminFileBatch
} from "@/api/file";
import { GetDict, InitDict } from "@/hooks/dict";
import { PURE_TABLE_PAGE_SIZES } from "@/utils/pureTable";
import UploadDialog from "./components/UploadDialog.vue";
import MediaPreviewDialog from "./components/MediaPreviewDialog.vue";

import Delete from "~icons/ep/delete";
import Refresh from "~icons/ep/refresh";
import Upload from "~icons/ri/upload-cloud-2-line";
import View from "~icons/ep/view";
import Headset from "~icons/ri/customer-service-2-line";

defineOptions({ name: "SystemFile" });
const DICT_FILE_MODULE = "sys_file_module";
const DICT_FILE_TYPE = "sys_file_type";

const formRef = ref();
const tableRef = ref();
const loading = ref(false);
const dataList = ref<any[]>([]);
const selectedRows = ref<any[]>([]);
const selectedNum = ref(0);

const queryForm = reactive({
  fileName: "",
  /** el-select clearable 清除后为 null，勿直接 .trim() */
  fileType: "" as string | number | null,
  module: "" as string | number | null,
  fileSizeMin: undefined as number | undefined,
  fileSizeMax: undefined as number | undefined
});

const pagination = reactive({
  total: 0,
  pageSize: 10,
  currentPage: 1,
  background: true,
  pageSizes: PURE_TABLE_PAGE_SIZES
});

const columns: TableColumnList = [
  {
    label: "勾选列",
    type: "selection",
    fixed: "left",
    reserveSelection: true
  },
  { label: "ID", prop: "id", width: 90, fixed: "left" },
  {
    label: "文件名",
    prop: "fileName",
    minWidth: 220,
    showOverflowTooltip: true
  },
  {
    label: "文件类型",
    prop: "fileType",
    width: 120,
    cellRenderer: ({ row }) =>
      h(DictTag, {
        code: DICT_FILE_TYPE,
        value: row?.fileType
      })
  },
  {
    label: "模块",
    prop: "module",
    minWidth: 140,
    showOverflowTooltip: true,
    cellRenderer: ({ row }) =>
      h(DictTag, {
        code: DICT_FILE_MODULE,
        value: row?.module
      })
  },
  {
    label: "文件大小",
    prop: "fileSize",
    width: 130,
    formatter: ({ fileSize }) => formatBytes(fileSize)
  },
  {
    label: "创建时间",
    prop: "createdAt",
    minWidth: 170,
    formatter: ({ createdAt }) =>
      createdAt ? dayjs(createdAt).format("YYYY-MM-DD HH:mm:ss") : "--"
  },
  {
    label: "操作",
    fixed: "right",
    width: 220,
    slot: "operation"
  }
];

function formatBytes(size: unknown) {
  const n = Number(size);
  if (!Number.isFinite(n) || n < 0) return "--";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function resolveFileUrl(row: any) {
  const raw =
    row?.url ??
    row?.fileUrl ??
    row?.fullUrl ??
    row?.path ??
    row?.filePath ??
    row?.accessUrl ??
    "";
  return String(raw || "");
}

function fileExt(row: any) {
  const name = String(row?.fileName ?? "").toLowerCase();
  const type = String(row?.fileType ?? "").toLowerCase();
  const byName = name.includes(".") ? name.split(".").pop() || "" : "";
  return byName || type;
}

function isImageRow(row: any) {
  const ext = fileExt(row);
  const ft = String(row?.fileType ?? "").toLowerCase();
  return (
    ft.includes("image") ||
    ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)
  );
}

function isVideoRow(row: any) {
  const ext = fileExt(row);
  const ft = String(row?.fileType ?? "").toLowerCase();
  return (
    ft.includes("video") ||
    ["mp4", "webm", "mov", "m4v", "avi", "mkv"].includes(ext)
  );
}

function isAudioRow(row: any) {
  const ext = fileExt(row);
  const ft = String(row?.fileType ?? "").toLowerCase();
  return (
    ft.includes("audio") ||
    ["mp3", "wav", "aac", "flac", "ogg", "m4a"].includes(ext)
  );
}

function buildQueryParams() {
  const params: Record<string, any> = {
    page: pagination.currentPage,
    pageSize: pagination.pageSize
  };
  const fileName = String(queryForm.fileName ?? "").trim();
  if (fileName) params.fileName = fileName;

  const fileType = queryForm.fileType;
  if (
    fileType !== undefined &&
    fileType !== null &&
    fileType !== "" &&
    !(typeof fileType === "number" && Number.isNaN(fileType))
  ) {
    params.fileType = fileType;
  }

  const moduleVal = queryForm.module;
  if (moduleVal !== undefined && moduleVal !== null && moduleVal !== "") {
    const moduleStr = String(moduleVal).trim();
    if (moduleStr) params.module = moduleStr;
  }

  if (queryForm.fileSizeMin != null) params.fileSizeMin = queryForm.fileSizeMin;
  if (queryForm.fileSizeMax != null) params.fileSizeMax = queryForm.fileSizeMax;
  return params;
}

async function onSearch() {
  loading.value = true;
  try {
    const res: any = await pageAdminFile(buildQueryParams());
    const ok = res?.success === true || res?.code === 200 || res?.code === 201;
    if (!ok) {
      message(res?.message ?? "获取文件列表失败", { type: "error" });
      return;
    }
    const d = res?.data ?? {};
    dataList.value = d?.list ?? [];
    pagination.total = d?.total ?? 0;
    pagination.pageSize = d?.pageSize ?? pagination.pageSize;
    pagination.currentPage =
      d?.currentPage ?? d?.page ?? pagination.currentPage;
  } finally {
    loading.value = false;
  }
}

function resetQuery() {
  queryForm.fileName = "";
  queryForm.fileType = "";
  queryForm.module = "";
  queryForm.fileSizeMin = undefined;
  queryForm.fileSizeMax = undefined;
  pagination.currentPage = 1;
  onSearch();
}

async function confirmDeleteFiles(count: number) {
  const removeDiskFile = ref(false);
  try {
    await ElMessageBox({
      title: "确认删除",
      message: () =>
        h("div", { class: "pt-1" }, [
          h(
            "p",
            { class: "mb-3 text-sm" },
            count === 1
              ? "确认删除该文件吗？"
              : `确认删除选中的 ${count} 个文件吗？`
          ),
          h(
            ElCheckbox,
            {
              modelValue: removeDiskFile.value,
              "onUpdate:modelValue": (val: boolean) => {
                removeDiskFile.value = val;
              }
            },
            () => "同时删除磁盘上的物理文件"
          ),
          h(
            "p",
            {
              class: "mt-2 text-xs text-(--el-text-color-secondary) leading-5"
            },
            "不勾选仅软删除，磁盘文件将在 24 小时后由系统自动清理。"
          )
        ]),
      showCancelButton: true,
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning",
      draggable: true
    });
    return { removeDiskFile: removeDiskFile.value };
  } catch {
    return null;
  }
}

function isDeleteOk(res: any) {
  return res?.success === true || res?.code === 200 || res?.code === 201;
}

function handleSelectionChange(rows: any[]) {
  selectedRows.value = rows ?? [];
  selectedNum.value = selectedRows.value.length;
}

function onSelectionCancel() {
  selectedRows.value = [];
  selectedNum.value = 0;
  tableRef.value?.getTableRef?.()?.clearSelection?.();
}

async function handleDelete(row: any, removeDiskFile = false) {
  const id = row?.id;
  if (id == null) return;
  const res: any = await removeAdminFile(id, { removeDiskFile });
  if (!isDeleteOk(res)) {
    message(res?.message ?? "删除失败", { type: "error" });
    return false;
  }
  return true;
}

async function handleDeleteWithConfirm(row: any) {
  const confirmed = await confirmDeleteFiles(1);
  if (!confirmed) return;
  const ok = await handleDelete(row, confirmed.removeDiskFile);
  if (!ok) return;
  message("删除成功", { type: "success" });
  onSearch();
}

async function handleBatchDelete() {
  const ids = selectedRows.value.map(row => row?.id).filter(id => id != null);
  if (!ids.length) {
    message("请先选择要删除的文件", { type: "warning" });
    return;
  }
  const confirmed = await confirmDeleteFiles(ids.length);
  if (!confirmed) return;

  const res: any = await removeAdminFileBatch({
    ids,
    removeDiskFile: confirmed.removeDiskFile
  });
  if (!isDeleteOk(res)) {
    message(res?.message ?? "批量删除失败", { type: "error" });
    return;
  }

  const data = res?.data ?? {};
  if (Number(data.failed) > 0) {
    message(
      res?.message ??
        `删除完成：成功 ${data.deleted ?? 0} 条，失败 ${data.failed ?? 0} 条`,
      { type: "warning" }
    );
  } else {
    message("删除成功", { type: "success" });
  }
  onSelectionCancel();
  onSearch();
}

const mediaPreviewVisible = ref(false);
const mediaPreviewType = ref<"image" | "video" | "audio">("image");
const mediaPreviewUrl = ref("");
const mediaPreviewTitle = ref("");

function openMediaPreview(row: any) {
  const url = resolveFileUrl(row);
  if (!url) {
    message("未找到可预览的文件地址", { type: "warning" });
    return;
  }
  if (isImageRow(row)) mediaPreviewType.value = "image";
  else if (isVideoRow(row)) mediaPreviewType.value = "video";
  else if (isAudioRow(row)) mediaPreviewType.value = "audio";
  else {
    message("当前文件类型不支持预览/播放", { type: "warning" });
    return;
  }
  mediaPreviewUrl.value = url;
  mediaPreviewTitle.value = String(row?.fileName ?? "媒体预览");
  mediaPreviewVisible.value = true;
}

function openUploadDialog() {
  uploadVisible.value = true;
}
const uploadVisible = ref(false);

onMounted(async () => {
  await InitDict([DICT_FILE_MODULE, DICT_FILE_TYPE]);
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
        <el-form-item label="文件名" prop="fileName">
          <el-input
            v-model="queryForm.fileName"
            clearable
            placeholder="文件名模糊搜索"
            class="w-44!"
          />
        </el-form-item>
        <el-form-item label="文件类型" prop="fileType">
          <el-select
            v-model="queryForm.fileType"
            clearable
            placeholder="请选择文件类型"
            class="w-40!"
          >
            <el-option
              v-for="opt in GetDict.sys_file_type"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="模块" prop="module">
          <el-select
            v-model="queryForm.module"
            clearable
            placeholder="请选择模块"
            class="w-40!"
          >
            <el-option
              v-for="opt in GetDict.sys_file_module"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="大小范围(B)">
          <div class="flex items-center gap-2">
            <el-input-number
              v-model="queryForm.fileSizeMin"
              :min="0"
              controls-position="right"
              class="w-34!"
            />
            <span class="text-(--el-text-color-secondary)">-</span>
            <el-input-number
              v-model="queryForm.fileSizeMax"
              :min="0"
              controls-position="right"
              class="w-34!"
            />
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
          <el-button :icon="useRenderIcon(Refresh)" @click="resetQuery">
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <PureTableBar
        title="文件管理（服务器内部存储非oss对象存储）"
        :columns="columns"
        @refresh="onSearch"
      >
        <template #buttons>
          <el-button
            type="primary"
            :icon="useRenderIcon(Upload)"
            @click="openUploadDialog"
          >
            上传文件
          </el-button>
        </template>
        <template v-slot="{ size, dynamicColumns }">
          <div
            v-if="selectedNum > 0"
            v-motion-fade
            class="bg-(--el-fill-color-light) w-full h-12.5 pl-4 flex items-center mb-2"
          >
            <span class="text-sm mr-3">
              已选 {{ selectedNum }} 项
            </span>
            <el-button type="primary" text @click="onSelectionCancel">
              取消选择
            </el-button>
            <el-button type="danger" text @click="handleBatchDelete">
              批量删除
            </el-button>
          </div>
          <pure-table
            ref="tableRef"
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
            :pagination="{ ...pagination, size }"
            :header-cell-style="{
              background: 'var(--el-fill-color-light)',
              color: 'var(--el-text-color-primary)'
            }"
            @selection-change="handleSelectionChange"
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
              <el-button
                v-if="isImageRow(row) || isVideoRow(row)"
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(View)"
                @click="openMediaPreview(row)"
              >
                查看
              </el-button>
              <el-button
                v-if="isAudioRow(row)"
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(Headset)"
                @click="openMediaPreview(row)"
              >
                播放
              </el-button>
              <el-button
                link
                type="danger"
                :size="size"
                :icon="useRenderIcon(Delete)"
                @click="handleDeleteWithConfirm(row)"
              >
                删除
              </el-button>
            </template>
          </pure-table>
        </template>
      </PureTableBar>

      <UploadDialog
        v-model="uploadVisible"
        :module-options="GetDict.sys_file_module"
        @success="onSearch"
      />

      <MediaPreviewDialog
        v-model="mediaPreviewVisible"
        :title="mediaPreviewTitle"
        :type="mediaPreviewType"
        :url="mediaPreviewUrl"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
