<script setup lang="ts">
import dayjs from "dayjs";
import { h, onMounted, onBeforeUnmount, reactive, ref, toRaw } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import { ElTag } from "element-plus";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { addDialog } from "@/components/ReDialog";
import { message } from "@/utils/message";
import { pageDict, saveDict, updateDict, delDict, clearDictCache } from "@/api/system";
import { ClearDictLocalCache, InitDict } from "@/hooks/dict";
import dictCodes from "@/config/dictCodes";
import DictForm from "./form.vue";
import DictItemForm from "./itemForm.vue";
import { PURE_TABLE_PAGE_SIZES } from "@/utils/pureTable";

import Delete from "~icons/ep/delete";
import EditPen from "~icons/ep/edit-pen";
import Refresh from "~icons/ep/refresh";
import AddFill from "~icons/ri/add-circle-line";
import DeleteCache from "~icons/ep/delete-filled";

defineOptions({
  name: "SystemDict"
});

const formRef = ref();
const dictFormRef = ref();

const selectedDictId = ref<string | number | null>(null);
const selectedDictName = ref<string>("");

const loading = ref(true);
const clearingCache = ref(false);
const tableHeight = ref(deviceDetection() ? 320 : 440);

function updateTableHeight() {
  const w = window.innerWidth;
  if (w < 900) {
    tableHeight.value = 260;
    return;
  }
  if (w < 1200) {
    tableHeight.value = 300;
    return;
  }
  tableHeight.value = deviceDetection() ? 320 : 440;
}

onMounted(() => {
  updateTableHeight();
  window.addEventListener("resize", updateTableHeight);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateTableHeight);
});

const form = reactive({
  name: "",
  code: "",
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
    label: "字典名称",
    prop: "name",
    minWidth: 120,
    fixed: "left"
  },
  {
    label: "字典编码",
    prop: "code",
    width: 120
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

function resetForm(formEl: any) {
  if (!formEl) return;
  formEl.resetFields();
  onSearch();
}

async function onSearch() {
  loading.value = true;
  form.page = pagination.currentPage;
  form.pageSize = pagination.pageSize;
  try {
    const res: any = await pageDict(toRaw(form));
    if (res?.success || res?.code === 200) {
      dataList.value = res?.data?.list ?? res?.data ?? [];
      pagination.total = res?.data?.total ?? 0;
      pagination.pageSize = res?.data?.pageSize ?? form.pageSize;
      pagination.currentPage = res?.data?.currentPage ?? form.page;
      selectedDictName.value = dataList.value?.[0]?.name ?? "";
      selectedDictId.value = dataList.value?.[0]?.id ?? null;
    } else {
      message(res?.message ?? "获取字典列表失败", { type: "error" });
    }
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
  addDialog({
    title: `${title}字典`,
    props: {
      formInline: {
        id: row?.id,
        code: row?.code ?? "",
        name: row?.name ?? "",
        description: row?.description ?? "",
        status: row?.status ?? true
      }
    },
    width: "46%",
    draggable: true,
    fullscreen: deviceDetection(),
    fullscreenIcon: true,
    closeOnClickModal: false,
    contentRenderer: () => h(DictForm, { ref: dictFormRef, formInline: null }),
    beforeSure: (done, { options }) => {
      const FormRef = dictFormRef.value.getRef();
      const curData = options.props.formInline;
      FormRef.validate((valid: boolean) => {
        if (!valid) return;

        if (title === "新增") {
          saveDict(curData).then((res: any) => {
            if (res?.success || res?.code === 200) {
              message(`已成功新增字典：${curData?.name ?? ""}`, {
                type: "success"
              });
              done();
              onSearch();
            }
          });
          return;
        }

        // 修改时确保带上主键与 code（后端一般需要）
        if (!curData?.id) curData.id = row?.id;
        if (!curData?.code) curData.code = row?.code;
        updateDict(curData).then((res: any) => {
          if (res?.success || res?.code === 200) {
            message(`已成功修改字典：${curData?.name ?? ""}`, {
              type: "success"
            });
            done();
            onSearch();
          }
        });
      });
    }
  });
}

function handleDelete(row: any) {
  const id = String(row?.id ?? "");
  if (!id) return;
  delDict(id).then((res: any) => {
    if (res?.success || res?.code === 200) {
      message(`已删除字典：${row?.name ?? row?.code ?? id}`, {
        type: "success"
      });
      onSearch();
    } else {
      message(res?.message ?? "删除失败", { type: "error" });
    }
  });
}

function handleDictRowClick(row: any) {
  selectedDictId.value = row?.id ?? null;
  selectedDictName.value = row?.name ?? "";
}

async function handleClearDictCache() {
  clearingCache.value = true;
  try {
    const res: any = await clearDictCache();
    const ok = res?.success === true || res?.code === 200 || res?.code === 201;
    if (!ok) {
      message(res?.message ?? "清除缓存失败", { type: "error" });
      return;
    }
    const codes = Array.from(
      new Set([
        ...dictCodes.map(code => String(code)),
        ...dataList.value.map(row => String(row?.code ?? "")).filter(Boolean)
      ])
    );
    ClearDictLocalCache(codes);
    await InitDict(codes);
    const deleted = res?.data?.deleted;
    message(
      typeof deleted === "number"
        ? `字典缓存已清除（Redis ${deleted} 项）`
        : (res?.message ?? "字典缓存已清除"),
      { type: "success" }
    );
  } finally {
    clearingCache.value = false;
  }
}

onSearch();
</script>

<template>
  <div class="dict-layout">
    <div class="dict-left">
      <el-form
        ref="formRef"
        :inline="true"
        :model="form"
        class="search-form bg-bg_color w-full pl-8 pt-3 overflow-auto"
      >
        <el-form-item label="字典名称：" prop="name">
          <el-input
            v-model="form.name"
            placeholder="请输入字典名称"
            clearable
            class="w-45!"
          />
        </el-form-item>

        <el-form-item label="字典标识：" prop="code">
          <el-input
            v-model="form.code"
            placeholder="请输入字典标识"
            clearable
            class="w-45!"
          />
        </el-form-item>

        <el-form-item label="状态：" prop="status">
          <el-select
            v-model="form.status"
            placeholder="请选择状态"
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
          <el-button :icon="useRenderIcon(Refresh)" @click="resetForm(formRef)">
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <PureTableBar title="字典管理" :columns="columns" @refresh="onSearch">
        <template #buttons>
          <el-button
            type="primary"
            :icon="useRenderIcon(AddFill)"
            @click="openDialog('新增')"
          >
            新增字典
          </el-button>
          <el-button
            type="warning"
            plain
            :icon="useRenderIcon(DeleteCache)"
            :loading="clearingCache"
            @click="handleClearDictCache"
          >
            清除缓存
          </el-button>
        </template>

        <template v-slot="{ size, dynamicColumns }">
          <pure-table
            row-key="id"
            align-whole="center"
            showOverflowTooltip
            table-layout="auto"
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
            :highlight-current-row="true"
            :currentRowKey="selectedDictId"
            @row-click="handleDictRowClick"
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
                :title="`是否确认删除字典：${row?.name ?? row?.code ?? ''} ?`"
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

    <div class="dict-right">
      <DictItemForm
        v-if="selectedDictId"
        :dict-id="selectedDictId"
        :dict-name="selectedDictName"
        :table-height="tableHeight"
      />
      <div v-else class="dict-empty">请选择左侧字典后查看字典项</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dict-layout {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.dict-left {
  flex: 0 0 35%;
  min-width: 320px;
}

.dict-right {
  flex: 1 1 auto;
  min-width: 360px;
}

@media (max-width: 1200px) {
  .dict-layout {
    flex-direction: column;
  }

  .dict-left,
  .dict-right {
    min-width: 0;
  }
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}

.dict-empty {
  height: 100%;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}
</style>
