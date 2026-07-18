<script setup lang="ts">
import dayjs from "dayjs";
import { h, nextTick, onBeforeUnmount, reactive, ref, toRaw, watch } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import { message } from "@/utils/message";
import {
  pageDict,
  pageDictItem,
  saveDictItem,
  updateDictItem,
  delDictItem
} from "@/api/system";

import Delete from "~icons/ep/delete";
import EditPen from "~icons/ep/edit-pen";
import AddFill from "~icons/ri/add-circle-line";
import Refresh from "~icons/ep/refresh";

import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { PureTableBar } from "@/components/RePureTableBar";
import { PURE_TABLE_PAGE_SIZES } from "@/utils/pureTable";
import DictTag from "@/components/DictTag.vue";

import { ElTag } from "element-plus";
import type { FormRules } from "element-plus";

interface DictItemFormProps {
  dictId?: string | number;
  dictName?: string;
  tableHeight?: number;
}

interface DictItemModel {
  id?: string | number;
  parentId?: string | number;
  name: string;
  value: string;
  dictId?: string | number;
  tagType?: string;
  description?: string;
  sort?: number;
  status?: boolean;
  /** 前端用于渲染层级的标记（由递归计算） */
  __level?: number;
}

const props = withDefaults(defineProps<DictItemFormProps>(), {
  dictId: undefined,
  dictName: "",
  tableHeight: 440
});

const loading = ref(true);

const searchForm = reactive({
  name: "",
  value: "",
  status: "" as boolean | "",
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

const columns: TableColumnList = [
  {
    label: "字典值",
    prop: "value",
    minWidth: 120,
    fixed: "left"
  },
  {
    label: "字典项",
    prop: "name",
    minWidth: 150,
    cellRenderer: (scope: any) => {
      const row = scope?.row;
      const level = Number.isFinite(row?.__level) ? row?.__level : 0;
      const safeLevel = level;

      if (safeLevel === 0) {
        return h(
          "span",
          { style: { display: "inline-block", minWidth: 0 } },
          row?.name ?? ""
        );
      }

      const theme =
        safeLevel % 3 === 0
          ? {
              border: "#409EFF",
              bg: "rgba(64,158,255,0.10)",
              type: "info"
            }
          : safeLevel % 3 === 1
            ? {
                border: "#67C23A",
                bg: "rgba(103,194,58,0.10)",
                type: "success"
              }
            : {
                border: "#E6A23C",
                bg: "rgba(230,162,60,0.12)",
                type: "warning"
              };

      return h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            background: theme.bg,
            borderLeft: `4px solid ${theme.border}`,
            padding: "4px 10px",
            borderRadius: "6px",
            boxSizing: "border-box",
            fontWeight: 600
          }
        },
        [
          h(
            ElTag,
            {
              size: "small",
              type: theme.type as any,
              effect: "plain"
            },
            () => `L${safeLevel}`
          ),
          h(
            "span",
            { style: { flex: "1 1 auto", minWidth: 0 } },
            row?.name ?? ""
          )
        ]
      );
    }
  },

  {
    label: "状态",
    prop: "status",
    width: 80,
    cellRenderer: ({ row }) =>
      h(
        ElTag,
        {
          type: row?.status ? "success" : "danger",
          effect: "plain"
        },
        {
          default: () => (row?.status ? "启用" : "禁用")
        }
      )
  },

  {
    label: "字典描述",
    prop: "description",
    minWidth: 140
  },
  {
    label: "排序",
    prop: "sort",
    width: 100
  },
  {
    label: "展示效果",
    prop: "tagType",
    minWidth: 130,
    cellRenderer: ({ row }) =>
      h(DictTag, {
        label: row?.name ?? "--",
        tagType: row?.tagType ?? "default"
      })
  },
  {
    label: "嵌套字典ID",
    prop: "dictId",
    minWidth: 120
  },
  {
    label: "创建时间",
    prop: "createdAt",
    minWidth: 140,
    formatter: ({ createdAt }) =>
      createdAt ? dayjs(createdAt).format("YYYY-MM-DD HH:mm:ss") : ""
  },
  {
    label: "操作",
    fixed: "right",
    width: 100,
    slot: "operation"
  }
];

function markTreeLevel(list: any[], level = 0) {
  if (!Array.isArray(list)) return list;
  list.forEach(node => {
    if (node && typeof node === "object") {
      node.__level = level;
      if (Array.isArray(node.children) && node.children.length) {
        markTreeLevel(node.children, level + 1);
      }
    }
  });
  return list;
}

function resetSearch() {
  searchForm.name = "";
  searchForm.value = "";
  searchForm.status = "";
  searchForm.page = 1;
  searchForm.pageSize = pagination.pageSize;
  onSearch();
}

async function onSearch() {
  if (props.dictId === undefined || props.dictId === null) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const query = {
      parentId: props.dictId,
      ...toRaw(searchForm)
    };
    const res: any = await pageDictItem(query);
    if (res?.success || res?.code === 200) {
      const list = res?.data?.list ?? res?.data ?? [];
      dataList.value = markTreeLevel(list, 0);
      pagination.total = res?.data?.total ?? 0;
      pagination.pageSize = res?.data?.pageSize ?? searchForm.pageSize;
      pagination.currentPage = res?.data?.currentPage ?? searchForm.page;
      searchForm.page = pagination.currentPage;
      searchForm.pageSize = pagination.pageSize;
    } else {
      message(res?.message ?? "获取字典项失败", { type: "error" });
    }
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(val: number) {
  pagination.pageSize = val;
  searchForm.pageSize = val;
  searchForm.page = 1;
  onSearch();
}

function handleCurrentChange(val: number) {
  pagination.currentPage = val;
  searchForm.page = val;
  onSearch();
}

const dialogVisible = ref(false);
const dialogTitle = ref<"新增字典项" | "修改字典项">("新增字典项");
const itemMode = ref<"add" | "edit">("add");

const itemFormRef = ref();

const itemRules = reactive<FormRules>({
  name: [{ required: true, message: "字典项为必填项", trigger: "blur" }],
  value: [{ required: true, message: "值为必填项", trigger: "blur" }]
});

const itemForm = reactive<DictItemModel>({
  id: undefined,
  parentId: undefined,
  name: "",
  value: "",
  dictId: "",
  tagType: undefined,
  description: "",
  sort: 0,
  status: true
});

const tagTypeOptions = [
  { label: "default（文本）", value: "default" },
  { label: "primary_dark", value: "primary_dark" },
  { label: "primary_light", value: "primary_light" },
  { label: "primary_plain", value: "primary_plain" },
  { label: "success_dark", value: "success_dark" },
  { label: "success_light", value: "success_light" },
  { label: "success_plain", value: "success_plain" },
  { label: "info_dark", value: "info_dark" },
  { label: "info_light", value: "info_light" },
  { label: "info_plain", value: "info_plain" },
  { label: "warning_dark", value: "warning_dark" },
  { label: "warning_light", value: "warning_light" },
  { label: "warning_plain", value: "warning_plain" },
  { label: "danger_dark", value: "danger_dark" },
  { label: "danger_light", value: "danger_light" },
  { label: "danger_plain", value: "danger_plain" }
];

// ---------------------------
// 嵌套字典编码选择：只展示启用字典 + 支持搜索与滚动分页加载
// ---------------------------
const NESTED_DICT_PAGE_SIZE = 20;
const nestedDictOptions = ref<
  Array<{ label: string; value: string; status?: boolean }>
>([]);
const nestedSelectedStatus = ref<boolean | null>(null);
const nestedDictLoading = ref(false);
const nestedDictKeyword = ref("");
const nestedDictPage = ref(1);
const nestedDictHasMore = ref(true);
let nestedDictFetchSeq = 0;

/** 批量回填表单时跳过 dictId 的 watch，避免与 openEditDialog 内 await ensure 重复请求 */
const skipNestedDictWatch = ref(false);

const nestedDictPopperClass = "dict-nested-select-popper";
let nestedDictScrollEl: HTMLElement | null = null;
let nestedDictScrollHandler: (() => void) | null = null;

function detachNestedDictScroll() {
  if (nestedDictScrollEl && nestedDictScrollHandler) {
    nestedDictScrollEl.removeEventListener("scroll", nestedDictScrollHandler);
  }
  nestedDictScrollEl = null;
  nestedDictScrollHandler = null;
}

function getPinnedNestedDictOptions(): Array<{
  label: string;
  value: string;
  status?: boolean;
}> {
  const raw = itemForm.dictId;
  if (raw === undefined || raw === null || raw === "") return [];
  const cur = String(raw);
  return nestedDictOptions.value.filter(o => o.value === cur);
}

async function loadNestedDictOptions({ reset }: { reset: boolean }) {
  if (nestedDictLoading.value) return;
  if (!nestedDictHasMore.value) return;

  nestedDictLoading.value = true;
  const seq = ++nestedDictFetchSeq;

  try {
    const query: any = {
      status: true,
      page: nestedDictPage.value,
      pageSize: NESTED_DICT_PAGE_SIZE
    };

    // 后端不一定要求这些字段名，这里同时带上 code/name 以提升匹配概率
    if (nestedDictKeyword.value) {
      query.name = nestedDictKeyword.value;
    }

    const res: any = await pageDict(query);
    if (seq !== nestedDictFetchSeq) return; // 忽略过期请求

    const list = res?.data?.list ?? res?.data ?? [];
    const mapped = (list || [])
      .filter(Boolean)
      .map((d: any) => ({
        value: String(d?.id ?? ""),
        label: String(d?.name ?? d?.code ?? d?.id ?? ""),
        status: true
      }))
      .filter(opt => opt.value);

    if (reset) {
      const pinned = getPinnedNestedDictOptions();
      const pinIds = new Set(pinned.map(p => p.value));
      const rest = mapped.filter(m => !pinIds.has(m.value));
      nestedDictOptions.value = [...pinned, ...rest];
    } else {
      nestedDictOptions.value = [...nestedDictOptions.value, ...mapped];
    }

    // 下一页
    const total = res?.data?.total;
    const loadedCount = nestedDictOptions.value.length;
    if (
      mapped.length < NESTED_DICT_PAGE_SIZE ||
      (typeof total === "number" && loadedCount >= total)
    ) {
      nestedDictHasMore.value = false;
    } else {
      nestedDictPage.value += 1;
    }
  } finally {
    nestedDictLoading.value = false;
  }
}

function onNestedDictRemoteMethod(query: string) {
  nestedDictKeyword.value = query || "";
  nestedDictPage.value = 1;
  nestedDictHasMore.value = true;
  /* reset 时在 loadNestedDictOptions 内会保留当前 dictId 对应项，避免冲掉回显 label */
  loadNestedDictOptions({ reset: true });
}

function attachNestedDictScroll() {
  detachNestedDictScroll();

  const popper = document.querySelector(
    `.${nestedDictPopperClass}`
  ) as HTMLElement | null;
  const wrap =
    (popper?.querySelector(".el-select-dropdown__wrap") as HTMLElement) ??
    (popper?.querySelector(
      ".el-select-v2__dropdown .el-select-dropdown__wrap"
    ) as HTMLElement) ??
    null;

  if (!wrap) return;

  nestedDictScrollEl = wrap;
  nestedDictScrollHandler = () => {
    if (!nestedDictHasMore.value || nestedDictLoading.value) return;
    const remain = wrap.scrollHeight - (wrap.scrollTop + wrap.clientHeight);
    if (remain <= 20) {
      loadNestedDictOptions({ reset: false });
    }
  };

  wrap.addEventListener("scroll", nestedDictScrollHandler, { passive: true });
}

function onNestedDictVisibleChange(visible: boolean) {
  if (!visible) {
    detachNestedDictScroll();
    return;
  }

  nextTick(() => {
    attachNestedDictScroll();
    // 下拉打开时，如果尚未加载过，先拉取第一页
    if (!nestedDictOptions.value.length) {
      nestedDictHasMore.value = true;
      nestedDictPage.value = 1;
      loadNestedDictOptions({ reset: true });
    }
  });
}

async function ensureNestedOptionById(dictId: any) {
  if (!dictId) return;
  const cur = String(dictId);
  const hitInOptions = nestedDictOptions.value.find(
    o => String(o.value) === cur
  );
  if (hitInOptions) {
    nestedSelectedStatus.value =
      typeof hitInOptions.status === "boolean" ? hitInOptions.status : null;
    return;
  }

  const res: any = await pageDict({
    id: cur,
    page: 1,
    pageSize: 20
  });
  const list = res?.data?.list ?? res?.data ?? [];
  const hit = (list || []).find((d: any) => String(d?.id ?? "") === cur);
  if (!hit) return;

  nestedDictOptions.value = [
    {
      value: cur,
      label: String(hit?.name ?? hit?.code ?? hit?.id ?? ""),
      status: typeof hit?.status === "boolean" ? hit.status : null
    },
    ...nestedDictOptions.value
  ];

  nestedSelectedStatus.value =
    typeof hit?.status === "boolean" ? hit.status : null;
}

watch(
  () => itemForm.dictId,
  val => {
    if (skipNestedDictWatch.value) return;
    if (val === "" || val === undefined || val === null) {
      nestedSelectedStatus.value = null;
      return;
    }
    const cur = String(val);
    const hit = nestedDictOptions.value.find(o => o.value === cur);
    if (hit) {
      nestedSelectedStatus.value =
        typeof hit.status === "boolean" ? hit.status : null;
      return;
    }
    ensureNestedOptionById(val);
  }
);

onBeforeUnmount(() => {
  detachNestedDictScroll();
});

function openAddDialog() {
  dialogTitle.value = "新增字典项";
  itemMode.value = "add";
  nestedDictOptions.value = [];
  nestedDictPage.value = 1;
  nestedDictHasMore.value = true;
  nestedDictKeyword.value = "";
  itemForm.parentId = props.dictId;
  itemForm.id = undefined;
  itemForm.name = "";
  itemForm.value = "";
  itemForm.dictId = "";
  itemForm.tagType = undefined;
  itemForm.description = "";
  itemForm.sort = 0;
  itemForm.status = true;
  nestedSelectedStatus.value = null;
  dialogVisible.value = true;
}

async function openEditDialog(row: any) {
  dialogTitle.value = "修改字典项";
  itemMode.value = "edit";
  skipNestedDictWatch.value = true;
  itemForm.parentId = props.dictId;
  itemForm.id = row?.id;
  // 编辑时必须保持该行自身的 parentId（不要被当前选中的父节点覆盖）
  if (row?.parentId !== undefined) {
    itemForm.parentId = row?.parentId;
  }
  itemForm.name = row?.name ?? "";
  itemForm.value = row?.value ?? "";
  itemForm.dictId =
    row?.dictId !== undefined && row?.dictId !== null && row?.dictId !== ""
      ? String(row.dictId)
      : "";
  itemForm.tagType = row?.tagType ? String(row.tagType) : undefined;
  itemForm.description = row?.description ?? "";
  itemForm.sort = row?.sort ?? 0;
  itemForm.status = row?.status ?? true;
  nestedSelectedStatus.value = null;
  await ensureNestedOptionById(itemForm.dictId);
  skipNestedDictWatch.value = false;
  dialogVisible.value = true;
}

function closeItemDialog() {
  dialogVisible.value = false;
}

function submitItem() {
  const formEl = itemFormRef.value;
  if (!formEl) return;
  formEl.validate(async (valid: boolean) => {
    if (!valid) return;
    const payload: any = toRaw(itemForm);
    try {
      // 修改时即使为空也显式提交，避免后端按“未传字段”处理
      if (itemMode.value === "edit") {
        if (payload.parentId === undefined) payload.parentId = null;
        if (payload.dictId === undefined) payload.dictId = null;
        if (!payload.tagType) payload.tagType = "default";
      }
      if (!payload.tagType) payload.tagType = "default";
      const res: any =
        itemMode.value === "edit"
          ? await updateDictItem(payload)
          : await saveDictItem(payload);
      if (res?.success || res?.code === 200) {
        message(
          `${dialogTitle.value === "新增字典项" ? "已新增" : "已修改"}：${payload?.name ?? ""}`,
          { type: "success" }
        );
        closeItemDialog();
        onSearch();
      } else {
        message(res?.message ?? "保存失败", { type: "error" });
      }
    } catch (e) {
      message("保存失败", { type: "error" });
    }
  });
}

function handleDelete(row: any) {
  const id = String(row?.id ?? "");
  if (!id) return;
  // 这里用模板里的 el-popconfirm 做确认，直接执行接口
  delDictItem(id).then((res: any) => {
    if (res?.success || res?.code === 200) {
      message(`已删除字典项：${row?.name ?? row?.value ?? id}`, {
        type: "success"
      });
      onSearch();
    } else {
      message(res?.message ?? "删除失败", { type: "error" });
    }
  });
}

watch(
  [() => props.dictId],
  () => {
    searchForm.page = 1;
    onSearch();
  },
  { immediate: true }
);
</script>

<template>
  <div class="main">
    <el-form
      :inline="true"
      :model="searchForm"
      class="search-form bg-bg_color w-full pl-8 pt-3 overflow-auto"
    >
      <el-form-item label="字典项：" prop="name">
        <el-input
          v-model="searchForm.name"
          placeholder="请输入字典项"
          clearable
          class="w-45!"
        />
      </el-form-item>

      <el-form-item label="值：" prop="value">
        <el-input
          v-model="searchForm.value"
          placeholder="请输入值"
          clearable
          class="w-45!"
        />
      </el-form-item>

      <el-form-item label="状态：" prop="status">
        <el-select
          v-model="searchForm.status"
          placeholder="请选择"
          clearable
          class="w-45!"
        >
          <el-option label="启用" :value="true" />
          <el-option label="禁用" :value="false" />
        </el-select>
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
        <el-button :icon="useRenderIcon(Refresh)" @click="resetSearch">
          重置
        </el-button>
      </el-form-item>
    </el-form>

    <PureTableBar title="字典项" :columns="columns" @refresh="onSearch">
      <template #buttons>
        <el-button
          type="primary"
          :icon="useRenderIcon(AddFill)"
          @click="openAddDialog"
        >
          新增字典项
        </el-button>
      </template>

      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          row-key="id"
          align-whole="center"
          showOverflowTooltip
          table-layout="auto"
          :indent="36"
          :loading="loading"
          :adaptive="false"
          :height="tableHeight"
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
              @click="openEditDialog(row)"
            />
            <el-popconfirm
              :title="`是否确认删除字典项：${row?.name ?? row?.value}`"
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

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :width="deviceDetection() ? '95%' : '520px'"
      :destroy-on-close="true"
      :close-on-click-modal="false"
    >
      <el-form
        ref="itemFormRef"
        :model="itemForm"
        :rules="itemRules"
        label-width="110px"
      >
        <el-form-item label="字典项" prop="name">
          <el-input
            v-model="itemForm.name"
            clearable
            placeholder="请输入字典项"
          />
        </el-form-item>
        <el-form-item label="字典值" prop="value">
          <el-input v-model="itemForm.value" clearable placeholder="请输入值" />
        </el-form-item>
        <el-form-item label="嵌套字典" prop="dictId">
          <div class="nested-select-row">
            <el-select-v2
              v-model="itemForm.dictId"
              class="nested-select-input"
              :options="nestedDictOptions"
              :remote="true"
              :filterable="true"
              :remote-method="onNestedDictRemoteMethod"
              :loading="nestedDictLoading"
              clearable
              placeholder="可选：选择嵌套字典"
              popper-class="dict-nested-select-popper"
              :props="{ label: 'label', value: 'value' }"
              @visible-change="onNestedDictVisibleChange"
            />
            <el-tag
              v-if="nestedSelectedStatus === false"
              type="danger"
              effect="plain"
              class="nested-select-tag"
            >
              禁用
            </el-tag>
          </div>
        </el-form-item>
        <el-form-item label="展示风格" prop="tagType">
          <div class="tag-type-select-row">
            <el-select
              v-model="itemForm.tagType"
              class="tag-type-select"
              clearable
              filterable
              placeholder="请选择展示风格"
            >
              <el-option
                v-for="opt in tagTypeOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              >
                <DictTag :label="opt.label" :tag-type="opt.value" />
              </el-option>
            </el-select>
            <DictTag
              class="tag-type-preview"
              :label="itemForm.name || '预览'"
              :tag-type="itemForm.tagType || 'default'"
            />
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number
            v-model="itemForm.sort"
            :min="0"
            :max="9999"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="itemForm.status"
            :active-value="true"
            :inactive-value="false"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="itemForm.description"
            type="textarea"
            :rows="3"
            clearable
            placeholder="请输入字典描述"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="closeItemDialog">取消</el-button>
        <el-button type="primary" @click="submitItem">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.main {
  padding-bottom: 0;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}

:deep(.el-form-item__label) {
  white-space: nowrap;
}

.nested-select-row {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.nested-select-input {
  flex: 1;
  min-width: 0;
}

.nested-select-tag {
  flex: 0 0 auto;
  margin-left: 0;
}

.tag-type-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.tag-type-select {
  flex: 1;
  min-width: 0;
}

.tag-type-preview {
  flex: 0 0 auto;
  max-width: none;
  white-space: nowrap;
}
</style>
