<script setup lang="ts">
import { computed, reactive, ref, toRaw, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import dayjs from "dayjs";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { listDict } from "@/api/system";
import {
  getGeneratorCodeTable,
  getGeneratorColumns,
  getGeneratorTables,
  getGeneratorTemplates,
  postGeneratorCodeTable,
  postGeneratorGenerate
} from "@/api/generator";
import { highlightByFilePath } from "@/utils/highlight/code";
import "highlight.js/styles/github-dark.css";
import {
  bizMessage,
  buildTableFromColumns,
  extractColumnsArray,
  extractTableList,
  isBizFailure,
  isEmptyCodeTablePayload,
  extractTemplateOptions,
  mergeCodeTableToGeneratorTable,
  rowToSummary,
  toCodeTablePostBody,
  resolveGeneratorGenerateResponse,
  unwrapApiData
} from "./apiAdapter";
import { queryComponentOptions, queryOperatorOptions } from "./options";
import { buildFileTitle, queryComponentLabel, suggestClassName } from "./utils";
import {
  generatedFilesToZipBlob,
  zipBlobToGeneratedFiles
} from "./zipToPreview";
import type {
  GeneratedFile,
  GeneratorField,
  GeneratorTable,
  GeneratorTableSummary,
  QueryComponent,
  QueryOperator
} from "./types";
import { PureTableBar } from "@/components/RePureTableBar";
import EditPen from "~icons/ep/edit-pen";
import View from "~icons/ep/view";
import Download from "~icons/ep/download";
import Refresh from "~icons/ep/refresh";

defineOptions({ name: "SystemGeneratorIndex" });

const listLoading = ref(false);
const detailLoading = ref(false);

/** 接口1：表列表（无字段） */
const tableSummaries = ref<GeneratorTableSummary[]>([]);
/** 按表名缓存完整配置（保存编辑后写入，避免重复拉字段） */
const configCache = ref<Record<string, GeneratorTable>>({});

const form = reactive({
  keyword: ""
});

const editVisible = ref(false);
const previewVisible = ref(false);
/** 编辑弹窗全屏 */
const editDialogFullscreen = ref(false);

watch(editVisible, v => {
  if (!v) editDialogFullscreen.value = false;
});

const editTableMaxHeight = computed(() =>
  editDialogFullscreen.value ? "calc(100vh - 300px)" : "480"
);

const tableColumns = [
  { label: "表名", prop: "tableName", minWidth: 180 },
  { label: "表备注", prop: "tableComment", minWidth: 200 },
  { label: "实体类", prop: "className", minWidth: 140 },
  { label: "模块", prop: "moduleName", minWidth: 180 },
  { label: "操作", slot: "operation", fixed: "right" as const, width: 250 }
];

const currentTable = ref<GeneratorTable | null>(null);
const editModel = ref<GeneratorTable | null>(null);
const previewFiles = ref<GeneratedFile[]>([]);
const activePreviewPath = ref("");
/** 当前预览对应的表名（与后端 generate 一致） */
const previewContextTableName = ref("");

/** 后端模板名（GET /generator/templates；预览 / 编辑 / 下载共用） */
const backendTemplateName = ref("");
const generateApiPathPrefix = ref("admin");
const generatorTemplateOptions = ref<Array<{ value: string; label: string }>>(
  []
);
const dictCodeOptions = ref<Array<{ value: string; label: string }>>([]);

const activeFile = computed(() => {
  return (
    previewFiles.value.find(f => f.path === activePreviewPath.value) ?? null
  );
});

const activeFileHighlighted = computed(() => {
  const f = activeFile.value;
  return highlightByFilePath(f?.code ?? "", f?.path ?? "");
});

const debouncedRefreshPreview = useDebounceFn(() => {
  if (
    previewVisible.value &&
    String(previewContextTableName.value ?? "").trim()
  ) {
    void refreshPreviewContent();
  }
}, 450);

watch([backendTemplateName, generateApiPathPrefix], () => {
  debouncedRefreshPreview();
});

watch(previewVisible, v => {
  if (!v) {
    previewFiles.value = [];
    previewContextTableName.value = "";
    activePreviewPath.value = "";
  }
});

async function loadGeneratorTemplates() {
  try {
    const res = await getGeneratorTemplates();
    generatorTemplateOptions.value = extractTemplateOptions(res);
    if (
      generatorTemplateOptions.value.length > 0 &&
      !backendTemplateName.value
    ) {
      backendTemplateName.value = generatorTemplateOptions.value[0].value;
    }
  } catch {
    generatorTemplateOptions.value = [];
  }
}

function triggerDownloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadTableList() {
  listLoading.value = true;
  try {
    const res = await getGeneratorTables({
      keyword: String(form.keyword ?? "").trim() || undefined
    });
    const rows = extractTableList(res);
    let list = rows
      .map(r => rowToSummary(r))
      .filter((x): x is GeneratorTableSummary => x != null);
    const kw = String(form.keyword ?? "")
      .trim()
      .toLowerCase();
    if (kw) {
      list = list.filter(
        t =>
          t.tableName.toLowerCase().includes(kw) ||
          (t.tableComment || "").toLowerCase().includes(kw) ||
          (t.className || "").toLowerCase().includes(kw) ||
          (t.moduleName || "").toLowerCase().includes(kw)
      );
    }
    tableSummaries.value = list;
  } catch (e: any) {
    message(e?.message ?? "加载表列表失败", { type: "error" });
    tableSummaries.value = [];
  } finally {
    listLoading.value = false;
  }
}

function onSearch() {
  void loadTableList();
}

function onReset() {
  form.keyword = "";
  void loadTableList();
}

function defaultModuleName(tableName: string) {
  return `system/${tableName.replace(/^sys_/, "")}`;
}

/**
 * 合并列表行 + 本地缓存 + 后端 code-table（无则 columns）得到完整 GeneratorTable
 */
async function ensureFullTable(
  row: GeneratorTableSummary
): Promise<GeneratorTable> {
  const key = row.tableName?.trim();
  if (!key) throw new Error("表名为空");

  const cached = configCache.value[key];
  if (cached) {
    return cloneTable(cached);
  }

  const codeRes = await getGeneratorCodeTable(key);
  const code = unwrapApiData(codeRes);

  if (!isEmptyCodeTablePayload(code)) {
    return mergeCodeTableToGeneratorTable(
      row,
      code as Record<string, unknown>,
      defaultModuleName
    );
  }

  const colRes = await getGeneratorColumns(key);
  const cols = extractColumnsArray(colRes);
  return buildTableFromColumns(row, cols, defaultModuleName);
}

function cloneTable(table: GeneratorTable): GeneratorTable {
  const raw = toRaw(table) as GeneratorTable;
  return JSON.parse(JSON.stringify(raw)) as GeneratorTable;
}

async function loadDictCodes() {
  try {
    const res: any = await listDict({ page: 1, pageSize: 100 });
    const list = res?.data?.list ?? res?.data ?? [];
    dictCodeOptions.value = (list || [])
      .map((d: any) => ({
        value: String(d.code ?? ""),
        label: `${String(d.name ?? d.code ?? "")} (${String(d.code ?? "")})`
      }))
      .filter((x: { value: string }) => x.value);
  } catch {
    dictCodeOptions.value = [
      { label: "系统消息类型 (sys_message_type)", value: "sys_message_type" },
      {
        label: "系统消息状态 (sys_message_status)",
        value: "sys_message_status"
      },
      { label: "用户状态 (sys_user_status)", value: "sys_user_status" }
    ];
  }
}

async function openEdit(row: GeneratorTableSummary) {
  detailLoading.value = true;
  try {
    const full = await ensureFullTable(row);
    currentTable.value = full;
    editModel.value = cloneTable(full);
    editVisible.value = true;
  } catch (e: any) {
    message(e?.message ?? "加载表字段失败", { type: "error" });
  } finally {
    detailLoading.value = false;
  }
}

function addField() {
  if (!editModel.value) return;
  editModel.value.fields.push({
    name: `field${editModel.value.fields.length + 1}`,
    dbType: "varchar",
    tsType: "string",
    length: 255,
    comment: "新字段",
    isInsert: true,
    isUpdate: true,
    isList: true,
    isQuery: false,
    isMultiSelect: false,
    queryOperator: "=",
    queryComponent: "input",
    formComponent: "input"
  });
}

function removeField(index: number) {
  if (!editModel.value) return;
  editModel.value.fields.splice(index, 1);
}

function onQueryToggle(row: GeneratorField) {
  if (!row.isQuery) {
    row.queryOperator = "=";
    row.queryComponent = "input";
    row.isMultiSelect = false;
    row.dictCode = "";
  }
}

async function onSaveEdit() {
  if (!editModel.value || !currentTable.value) return;
  if (!String(editModel.value.tableName ?? "").trim()) {
    message("表名不能为空", { type: "warning" });
    return;
  }
  if (!String(editModel.value.className ?? "").trim()) {
    editModel.value.className = suggestClassName(editModel.value.tableName);
  }

  const body = toCodeTablePostBody(editModel.value);
  let res: unknown;
  try {
    res = await postGeneratorCodeTable(body);
  } catch {
    return;
  }
  if (isBizFailure(res)) {
    message(bizMessage(res), { type: "error" });
    return;
  }

  const saved = cloneTable(editModel.value);
  configCache.value[saved.tableName] = saved;
  currentTable.value = saved;

  const idx = tableSummaries.value.findIndex(
    t => t.tableName === saved.tableName
  );
  if (idx >= 0) {
    tableSummaries.value[idx] = {
      tableName: saved.tableName,
      tableComment: saved.tableComment,
      className: saved.className,
      moduleName: saved.moduleName
    };
  }

  editVisible.value = false;
  message("保存成功", { type: "success" });
}

/** 预览：调用后端 generate，解压 zip 展示（与下载同源） */
async function refreshPreviewContent() {
  const tableName = String(previewContextTableName.value ?? "").trim();
  if (!tableName || !previewVisible.value) return;
  if (!String(backendTemplateName.value ?? "").trim()) {
    message("请选择生成模板", { type: "warning" });
    previewFiles.value = [];
    activePreviewPath.value = "";
    return;
  }
  detailLoading.value = true;
  previewFiles.value = [];
  activePreviewPath.value = "";
  try {
    const blob = await postGeneratorGenerate({
      templateName: String(backendTemplateName.value ?? "").trim(),
      tableName,
      apiPathPrefix: String(generateApiPathPrefix.value ?? "").trim()
    });
    if (!(blob instanceof Blob)) {
      message("响应不是二进制流，请检查接口与代理配置", { type: "error" });
      previewFiles.value = [];
      activePreviewPath.value = "";
      return;
    }
    const parsed = await resolveGeneratorGenerateResponse(blob);
    if (parsed.kind === "error") {
      message(parsed.message, { type: "error" });
      previewFiles.value = [];
      activePreviewPath.value = "";
      return;
    }
    const files =
      parsed.kind === "files"
        ? parsed.files
        : await zipBlobToGeneratedFiles(parsed.zipBlob);
    if (
      !previewVisible.value ||
      String(previewContextTableName.value ?? "").trim() !== tableName
    ) {
      return;
    }
    previewFiles.value = files;
    activePreviewPath.value = files[0]?.path ?? "";
    if (!files.length) {
      message("压缩包内无文件", { type: "warning" });
    }
  } catch (e: any) {
    message(e?.message ?? "预览生成失败", { type: "error" });
    previewFiles.value = [];
    activePreviewPath.value = "";
  } finally {
    detailLoading.value = false;
  }
}

function onPreviewParamsChange() {
  if (
    previewVisible.value &&
    String(previewContextTableName.value ?? "").trim()
  ) {
    void refreshPreviewContent();
  }
}

async function openPreview(row: GeneratorTableSummary) {
  const name = row.tableName?.trim();
  if (!name) {
    message("表名为空", { type: "warning" });
    return;
  }
  previewContextTableName.value = name;
  previewVisible.value = true;
  await refreshPreviewContent();
}

async function copyActiveCode() {
  if (!activeFile.value) return;
  await navigator.clipboard.writeText(activeFile.value.code);
  message("已复制代码", { type: "success" });
}

async function confirmGenerate(row: GeneratorTableSummary) {
  if (!String(backendTemplateName.value ?? "").trim()) {
    message("请选择后端生成模板", { type: "warning" });
    return;
  }
  await ElMessageBox.confirm(
    `确认使用模板「${backendTemplateName.value}」生成并下载 ${row.tableName} 的代码包吗？`,
    "生成确认",
    { type: "warning" }
  );
  detailLoading.value = true;
  try {
    const blob = await postGeneratorGenerate({
      templateName: String(backendTemplateName.value ?? "").trim(),
      tableName: row.tableName,
      apiPathPrefix: String(generateApiPathPrefix.value ?? "").trim()
    });
    if (!(blob instanceof Blob)) {
      message("响应不是二进制流，请检查接口与代理配置", { type: "error" });
      return;
    }
    const parsed = await resolveGeneratorGenerateResponse(blob);
    if (parsed.kind === "error") {
      message(parsed.message, { type: "error" });
      return;
    }
    const name = `${row.tableName}-${dayjs().format("YYYYMMDDHHmmss")}.zip`;
    const downloadBlob =
      parsed.kind === "files"
        ? await generatedFilesToZipBlob(parsed.files)
        : parsed.zipBlob;
    triggerDownloadBlob(downloadBlob, name);
    message("已生成并下载", { type: "success" });
  } catch (e: any) {
    message(e?.message ?? "生成失败", { type: "error" });
  } finally {
    detailLoading.value = false;
  }
}

loadDictCodes();
void loadGeneratorTemplates();
void loadTableList();
</script>

<template>
  <div>
    <el-form
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-full pl-8 pt-3 overflow-auto"
    >
      <el-form-item label="关键字">
        <el-input
          v-model="form.keyword"
          clearable
          placeholder="表名/表备注/类名"
          class="w-56!"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="listLoading" @click="onSearch"
          >搜索</el-button
        >
        <el-button :icon="useRenderIcon(Refresh)" @click="onReset"
          >重置</el-button
        >
      </el-form-item>
    </el-form>

    <el-card class="mt-3">
      <PureTableBar
        title="数据表列表"
        :columns="tableColumns"
        @refresh="onSearch"
      >
        <template v-slot="{ size, dynamicColumns }">
          <pure-table
            v-loading="listLoading"
            row-key="tableName"
            adaptive
            :border="true"
            showOverflowTooltip
            table-layout="auto"
            :size="size"
            :data="tableSummaries"
            :columns="dynamicColumns"
          >
            <template #operation="{ row }">
              <el-button
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(View)"
                @click="openPreview(row)"
                >预览</el-button
              >
              <el-button
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(EditPen)"
                @click="openEdit(row)"
                >编辑</el-button
              >
              <el-button
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(Download)"
                @click="confirmGenerate(row)"
                >生成下载</el-button
              >
            </template>
          </pure-table>
        </template>
      </PureTableBar>
    </el-card>

    <el-dialog
      v-model="previewVisible"
      title="代码预览（与生成下载同源）"
      width="980px"
      destroy-on-close
    >
      <div v-loading="detailLoading" class="relative min-h-[240px]">
        <div
          class="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--el-border-color-lighter)] pb-3"
        >
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-2">
              <span
                class="text-sm whitespace-nowrap text-[var(--el-text-color-secondary)]"
                >模板</span
              >
              <el-select
                v-model="backendTemplateName"
                filterable
                clearable
                placeholder="请选择"
                class="min-w-52!"
                @change="onPreviewParamsChange"
              >
                <el-option
                  v-for="t in generatorTemplateOptions"
                  :key="t.value"
                  :label="t.label"
                  :value="t.value"
                />
              </el-select>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="text-sm whitespace-nowrap text-[var(--el-text-color-secondary)]"
                >API 前缀</span
              >
              <el-input
                v-model="generateApiPathPrefix"
                clearable
                placeholder="如 admin"
                class="w-36!"
                @change="onPreviewParamsChange"
              />
            </div>
            <el-button @click="refreshPreviewContent">重新生成预览</el-button>
          </div>
          <el-button
            type="primary"
            :disabled="!activeFile"
            @click="copyActiveCode"
            >复制当前文件</el-button
          >
        </div>
        <el-empty
          v-if="!detailLoading && !previewFiles.length"
          description="暂无预览内容，请选择模板后等待生成"
        />
        <el-tabs
          v-else-if="previewFiles.length"
          v-model="activePreviewPath"
          type="border-card"
        >
          <el-tab-pane
            v-for="f in previewFiles"
            :key="f.path"
            :name="f.path"
            :label="buildFileTitle(f.path)"
          >
            <pre
              class="code-pre"
            ><code class="hljs" v-html="activeFileHighlighted" /></pre>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>

    <el-dialog
      v-model="editVisible"
      :fullscreen="editDialogFullscreen"
      width="1240px"
      destroy-on-close
      align-center
      class="generator-edit-dialog"
      @closed="editDialogFullscreen = false"
    >
      <template #header="{ titleId, titleClass }">
        <div
          class="flex w-full flex-wrap items-center justify-between gap-2 pr-2"
        >
          <span :id="titleId" :class="titleClass">编辑生成配置</span>
          <el-button
            link
            type="primary"
            @click.stop="editDialogFullscreen = !editDialogFullscreen"
          >
            {{ editDialogFullscreen ? "退出全屏" : "全屏" }}
          </el-button>
        </div>
      </template>
      <template v-if="editModel">
        <div v-loading="detailLoading" class="relative min-h-[320px]">
          <el-form :model="editModel" label-width="95px" class="mb-2">
            <el-row :gutter="12">
              <el-col :span="6">
                <el-form-item label="表名">
                  <el-input v-model="editModel.tableName" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="表备注">
                  <el-input v-model="editModel.tableComment" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="实体类">
                  <el-input v-model="editModel.className" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="模块路径">
                  <el-input v-model="editModel.moduleName" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="生成模板">
                  <el-select
                    v-model="backendTemplateName"
                    filterable
                    clearable
                    placeholder="请选择后端模板"
                    class="w-full!"
                    @change="onPreviewParamsChange"
                  >
                    <el-option
                      v-for="t in generatorTemplateOptions"
                      :key="t.value"
                      :label="t.label"
                      :value="t.value"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="16" class="flex items-center justify-end">
                <el-button type="primary" plain @click="addField"
                  >新增字段</el-button
                >
              </el-col>
            </el-row>
          </el-form>

          <el-table
            :data="editModel.fields"
            :max-height="editTableMaxHeight"
            border
          >
            <el-table-column prop="name" label="字段名" min-width="130">
              <template #default="{ row }">{{ row.name }}</template>
            </el-table-column>
            <el-table-column prop="dbType" label="类型" width="110">
              <template #default="{ row }">{{ row.dbType }}</template>
            </el-table-column>
            <el-table-column prop="comment" label="备注" min-width="140">
              <template #default="{ row }"
                ><el-input v-model="row.comment"
              /></template>
            </el-table-column>
            <el-table-column prop="length" label="长度" width="95">
              <template #default="{ row }">{{ row.length ?? "-" }}</template>
            </el-table-column>
            <el-table-column label="插入" width="60"
              ><template #default="{ row }"
                ><el-checkbox v-model="row.isInsert" /></template
            ></el-table-column>
            <el-table-column label="修改" width="60"
              ><template #default="{ row }"
                ><el-checkbox v-model="row.isUpdate" /></template
            ></el-table-column>
            <el-table-column label="列表" width="60"
              ><template #default="{ row }"
                ><el-checkbox v-model="row.isList" /></template
            ></el-table-column>
            <el-table-column label="查询" width="60"
              ><template #default="{ row }"
                ><el-checkbox
                  v-model="row.isQuery"
                  @change="onQueryToggle(row)" /></template
            ></el-table-column>
            <el-table-column label="查询条件" min-width="145">
              <template #default="{ row }">
                <el-select
                  v-model="row.queryOperator"
                  :disabled="!row.isQuery"
                  class="w-full!"
                >
                  <el-option
                    v-for="op in queryOperatorOptions"
                    :key="op.value"
                    :label="op.label"
                    :value="op.value as QueryOperator"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="查询组件" min-width="130">
              <template #default="{ row }">
                <el-select
                  v-model="row.queryComponent"
                  :disabled="!row.isQuery"
                  class="w-full!"
                >
                  <el-option
                    v-for="cmp in queryComponentOptions"
                    :key="cmp.value"
                    :label="cmp.label"
                    :value="cmp.value as QueryComponent"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="多选查询" width="88">
              <template #default="{ row }">
                <el-checkbox
                  v-model="row.isMultiSelect"
                  :disabled="!row.isQuery"
                />
              </template>
            </el-table-column>
            <el-table-column label="表单组件" min-width="130">
              <template #default="{ row }">
                <el-select v-model="row.formComponent" class="w-full!">
                  <el-option
                    v-for="cmp in queryComponentOptions"
                    :key="`f-${cmp.value}`"
                    :label="cmp.label"
                    :value="cmp.value"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="字典" min-width="190">
              <template #default="{ row }">
                <el-select
                  v-model="row.dictCode"
                  clearable
                  filterable
                  :disabled="
                    !row.isQuery ||
                    queryComponentLabel(row.queryComponent) !== '下拉框'
                  "
                  placeholder="选择字典"
                  class="w-full!"
                >
                  <el-option
                    v-for="d in dictCodeOptions"
                    :key="d.value"
                    :label="d.label"
                    :value="d.value"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="68" fixed="right">
              <template #default="{ $index }">
                <el-button link type="danger" @click="removeField($index)"
                  >删</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </div>
      </template>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="onSaveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.code-pre {
  margin: 0;
  max-height: 520px;
  overflow: auto;
  padding: 12px;
  border-radius: 6px;
  background: #252526;
}

.code-pre :deep(.hljs) {
  background: transparent !important;
}
</style>
