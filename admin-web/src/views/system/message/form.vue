<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted } from "vue";
import type { FormRules } from "element-plus";
import { getUserList, getAllRoleList } from "@/api/system";
import { getAsyncRoutes } from "@/api/routes";
import { transformI18n } from "@/plugins/i18n";
import { GetDict } from "@/hooks/dict";
import ReRichTextEditor from "@/components/ReRichTextEditor/index.vue";

/** 与后台字典 code 一致：系统消息类型 */
export interface MessageFormItemProps {
  id?: string | number;
  title: string;
  content: string;
  type: number;
  userId?: number | number[];
  roleIds?: number[];
  redirectUrl?: string;
}

export interface MessageFormProps {
  formInline?: MessageFormItemProps;
  /** 编辑：仅可改标题、正文（富文本），接收人不可改 */
  isEdit?: boolean;
}

const props = withDefaults(defineProps<MessageFormProps>(), {
  formInline: () => ({
    title: "",
    content: "",
    type: 1,
    userId: 0,
    redirectUrl: ""
  }),
  isEdit: false
});

const ruleFormRef = ref();

/** 接收方式：与后端 CreateMessage 一致（userId 与 roleIds 可并存取并集） */
type ReceiveKind = "all" | "users" | "roles" | "both";

const formModel = reactive({
  id: undefined as string | number | undefined,
  title: "",
  content: "",
  type: "1",
  /** 仅路径（不含 ?），与菜单 path 一致；提交时与 redirectQuery 拼成 redirectUrl */
  redirectPath: "" as string | null,
  /** 查询串，不含前导 ?，如 a=1&b=2 */
  redirectQuery: "",
  receiveKind: "all" as ReceiveKind,
  selectedUserIds: [] as number[],
  selectedRoleIds: [] as number[]
});

const roleOptions = ref<{ id: number; name: string }[]>([]);
const roleDialogVisible = ref(false);
const tempRoleIds = ref<number[]>([]);

const userOptions = ref<{ id: number; username?: string; nickname?: string }[]>(
  []
);
const userLoading = ref(false);

/** 来自 getAsyncRoutes 的 path 下拉（与 redirectQuery 分开，提交时再合并） */
type MenuPathOption = { value: string; label: string };

const routePathBaseOptions = ref<MenuPathOption[]>([]);
const routesLoading = ref(false);

/** 将完整 redirectUrl 拆成 path + query（复显） */
function splitRedirectUrl(full: string): { path: string; query: string } {
  const s = String(full ?? "").trim();
  if (!s) return { path: "", query: "" };
  const qIndex = s.indexOf("?");
  if (qIndex === -1) return { path: s, query: "" };
  const path = s.slice(0, qIndex).trim();
  let query = s.slice(qIndex + 1).trim();
  if (query.startsWith("?")) query = query.slice(1).trim();
  return { path, query };
}

/** 保存时组合；无 path 时不提交（忽略仅填参数） */
function combineRedirectUrl(pathRaw: string, queryRaw: string): string {
  const path = String(pathRaw ?? "").trim();
  let query = String(queryRaw ?? "").trim();
  if (query.startsWith("?")) query = query.slice(1).trim();
  if (!path) return "";
  if (!query) return path;
  return `${path}?${query}`;
}

function joinRoutePath(parentAbs: string, segment: string): string {
  const s = String(segment ?? "").trim();
  if (!s) return parentAbs || "";
  if (s.startsWith("/")) return s.replace(/\/+/g, "/");
  const p = (parentAbs || "").replace(/\/+$/, "");
  if (!p || p === "/") return `/${s.replace(/^\/+/, "")}`.replace(/\/+/g, "/");
  return `${p}/${s}`.replace(/\/+/g, "/");
}

function collectAsyncRoutePaths(
  nodes: any[] | undefined,
  parentAbs = ""
): MenuPathOption[] {
  const out: MenuPathOption[] = [];
  if (!Array.isArray(nodes)) return out;
  for (const n of nodes) {
    const full = joinRoutePath(parentAbs, n.path ?? "");
    if (full && full !== "/") {
      const title = String(transformI18n(n.meta?.title ?? "") ?? "").trim();
      const label = title ? `${title} — ${full}` : full;
      out.push({ value: full, label });
    }
    if (n.children?.length) {
      out.push(...collectAsyncRoutePaths(n.children, full || parentAbs));
    }
  }
  return out;
}

function uniquePathOptions(opts: MenuPathOption[]): MenuPathOption[] {
  const m = new Map<string, string>();
  for (const o of opts) {
    if (!m.has(o.value)) m.set(o.value, o.label);
  }
  return [...m.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

/** 当前 path 若不在菜单列表中，补一条便于复显 / 手输路径 */
function mergePathForDisplay(
  base: MenuPathOption[],
  currentPath: string
): MenuPathOption[] {
  const cur = String(currentPath ?? "").trim();
  const map = new Map<string, string>();
  for (const o of base) map.set(o.value, o.label);
  if (cur && !map.has(cur)) {
    map.set(cur, cur);
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

const routePathSelectOptions = computed(() =>
  mergePathForDisplay(routePathBaseOptions.value, formModel.redirectPath ?? "")
);

async function loadMenuPaths() {
  routesLoading.value = true;
  try {
    const res: any = await getAsyncRoutes();
    const ok = res?.success === true || res?.code === 200 || res?.code === 201;
    const raw = ok ? (res?.data ?? []) : [];
    routePathBaseOptions.value = uniquePathOptions(collectAsyncRoutePaths(raw));
  } catch {
    routePathBaseOptions.value = [];
  } finally {
    routesLoading.value = false;
  }
}

function userOptionLabel(u: {
  id: number;
  username?: string;
  nickname?: string;
}) {
  const name = u.nickname || u.username || `用户`;
  return `${name} (#${u.id})`;
}

function ensureUsersInOptions(ids: number[]) {
  for (const id of ids) {
    if (!userOptions.value.some(u => Number(u.id) === Number(id))) {
      userOptions.value.push({
        id: Number(id),
        username: `ID:${id}`,
        nickname: ""
      });
    }
  }
}

async function fetchUsers(keyword: string) {
  userLoading.value = true;
  try {
    const res: any = await getUserList({
      page: 1,
      pageSize: 100,
      username: keyword?.trim() || undefined,
      phone: "",
      status: ""
    });
    if (res?.success && res?.data?.list) {
      userOptions.value = res.data.list.map((row: any) => ({
        id: Number(row.id),
        username: row.username,
        nickname: row.nickname
      }));
    } else {
      userOptions.value = [];
    }
    ensureUsersInOptions(formModel.selectedUserIds);
  } finally {
    userLoading.value = false;
  }
}

function onUserRemoteSearch(query: string) {
  fetchUsers(query);
}

async function loadRoles() {
  try {
    const res: any = await getAllRoleList();
    const list = res?.data ?? [];
    roleOptions.value = (list || []).map((r: any) => ({
      id: Number(r.id),
      name: String(r.name ?? r.roleName ?? r.code ?? r.id)
    }));
  } catch {
    roleOptions.value = [];
  }
}

function openRoleDialog() {
  tempRoleIds.value = [...formModel.selectedRoleIds];
  roleDialogVisible.value = true;
}

function confirmRoleDialog() {
  formModel.selectedRoleIds = [...tempRoleIds.value];
  roleDialogVisible.value = false;
}

function applyUserIdToLocal(uid: number | number[] | undefined) {
  if (uid === 0 || String(uid) === "0" || uid === undefined) {
    formModel.receiveKind = "all";
    formModel.selectedUserIds = [];
    return;
  }
  formModel.receiveKind = "users";
  if (Array.isArray(uid)) {
    formModel.selectedUserIds = uid.map(Number).filter(n => !Number.isNaN(n));
  } else {
    formModel.selectedUserIds = [Number(uid)].filter(
      n => !Number.isNaN(n) && n > 0
    );
  }
  ensureUsersInOptions(formModel.selectedUserIds);
}

function setSelectedUsersFrom(uid: number | number[] | undefined) {
  if (Array.isArray(uid)) {
    formModel.selectedUserIds = uid.map(Number).filter(n => !Number.isNaN(n));
  } else if (
    uid !== undefined &&
    uid !== null &&
    uid !== 0 &&
    String(uid) !== "0"
  ) {
    formModel.selectedUserIds = [Number(uid)].filter(
      n => !Number.isNaN(n) && n > 0
    );
  } else {
    formModel.selectedUserIds = [];
  }
  ensureUsersInOptions(formModel.selectedUserIds);
}

function syncFromProps(v: MessageFormItemProps) {
  formModel.id = v.id;
  formModel.title = v.title ?? "";
  formModel.content = v.content ?? "";
  formModel.type =
    v.type === undefined || v.type === null ? "1" : String(v.type);
  const sp = splitRedirectUrl(String(v.redirectUrl ?? ""));
  formModel.redirectPath = sp.path || "";
  formModel.redirectQuery = sp.query;

  const hasRoles = Array.isArray(v.roleIds) && v.roleIds.length > 0;
  const uid = v.userId;
  const hasUser =
    uid !== undefined &&
    uid !== null &&
    !(uid === 0 || String(uid) === "0") &&
    !(Array.isArray(uid) && uid.length === 0);

  if (hasRoles) {
    formModel.selectedRoleIds = v.roleIds!.map(Number);
  } else {
    formModel.selectedRoleIds = [];
  }

  if (hasRoles && hasUser) {
    formModel.receiveKind = "both";
    setSelectedUsersFrom(uid);
  } else if (hasRoles) {
    formModel.receiveKind = "roles";
    formModel.selectedUserIds = [];
  } else {
    applyUserIdToLocal(uid);
  }
}

syncFromProps({ ...props.formInline });

watch(
  () => props.formInline,
  v => {
    if (v) syncFromProps(v);
  },
  { deep: true }
);

watch(
  () => [formModel.redirectPath, formModel.redirectQuery],
  () => {
    const full = combineRedirectUrl(
      String(formModel.redirectPath ?? ""),
      formModel.redirectQuery
    );
    if (full.length <= 255) return;
    const cut = splitRedirectUrl(full.slice(0, 255));
    formModel.redirectPath = cut.path || "";
    formModel.redirectQuery = cut.query;
  }
);

watch(
  () => formModel.receiveKind,
  k => {
    if (props.isEdit) return;
    if (k === "all") {
      formModel.selectedUserIds = [];
      formModel.selectedRoleIds = [];
    } else if (k === "users") {
      formModel.selectedRoleIds = [];
    } else if (k === "roles") {
      formModel.selectedUserIds = [];
    }
  }
);

function stripHtmlToPlain(s: string): string {
  if (!s) return "";
  return s
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validateContent(
  _rule: unknown,
  value: unknown,
  callback: (e?: Error) => void
) {
  const plain = stripHtmlToPlain(String(value ?? ""));
  if (!plain) {
    callback(new Error("请输入正文内容"));
    return;
  }
  callback();
}

function validateReceivers(
  _rule: unknown,
  _value: unknown,
  callback: (e?: Error) => void
) {
  if (props.isEdit) {
    callback();
    return;
  }
  if (formModel.receiveKind === "all") {
    callback();
    return;
  }
  if (formModel.receiveKind === "users") {
    if (!formModel.selectedUserIds?.length) {
      callback(new Error("请选择至少一名接收用户"));
      return;
    }
    callback();
    return;
  }
  if (formModel.receiveKind === "roles") {
    if (!formModel.selectedRoleIds?.length) {
      callback(new Error("请至少选择一个角色"));
      return;
    }
    callback();
    return;
  }
  const hasU = (formModel.selectedUserIds?.length ?? 0) > 0;
  const hasR = (formModel.selectedRoleIds?.length ?? 0) > 0;
  if (!hasU && !hasR) {
    callback(new Error("请指定用户或选择角色（可同时进行）"));
    return;
  }
  callback();
}

const formRules = computed<FormRules>(() => {
  const titleRule = [
    { required: true, message: "请输入标题", trigger: "blur" },
    { max: 255, message: "标题不超过 255 字", trigger: "blur" }
  ];
  const contentRule = [
    { required: true, validator: validateContent, trigger: "blur" }
  ];

  if (props.isEdit) {
    return {
      title: titleRule,
      content: contentRule
    };
  }

  return {
    title: titleRule,
    content: contentRule,
    type: [{ required: true, message: "请选择消息类型", trigger: "change" }],
    receiveKind: [{ validator: validateReceivers, trigger: "change" }]
  };
});

function getRef() {
  return ruleFormRef.value;
}

function getFormData(): Record<string, unknown> {
  if (props.isEdit) {
    const ru = combineRedirectUrl(
      String(formModel.redirectPath ?? ""),
      formModel.redirectQuery
    ).trim();
    return {
      id: formModel.id,
      title: formModel.title?.trim() ?? "",
      content: formModel.content ?? "",
      redirectUrl: ru.slice(0, 255)
    };
  }

  const typeNum = Number(formModel.type);
  const data: Record<string, unknown> = {
    title: formModel.title?.trim() ?? "",
    content: formModel.content ?? "",
    type: Number.isNaN(typeNum) ? 1 : typeNum
  };

  const ru = combineRedirectUrl(
    String(formModel.redirectPath ?? ""),
    formModel.redirectQuery
  ).trim();
  if (ru) data.redirectUrl = ru.slice(0, 255);

  const uids = formModel.selectedUserIds.map(Number).filter(n => n > 0);
  const rids = formModel.selectedRoleIds.map(Number).filter(n => n > 0);

  if (formModel.receiveKind === "all") {
    data.userId = 0;
  } else if (formModel.receiveKind === "users") {
    if (uids.length === 1) data.userId = uids[0];
    else data.userId = uids;
  } else if (formModel.receiveKind === "roles") {
    data.roleIds = rids;
  } else {
    if (uids.length) {
      data.userId = uids.length === 1 ? uids[0] : uids;
    }
    if (rids.length) {
      data.roleIds = rids;
    }
  }

  if (formModel.id != null && formModel.id !== "") data.id = formModel.id;

  return data;
}

onMounted(() => {
  if (!props.isEdit) {
    fetchUsers("");
    void loadRoles();
    void loadMenuPaths();
  }
});

defineExpose({ getRef, getFormData });
</script>

<template>
  <div>
    <el-form
      ref="ruleFormRef"
      :model="formModel"
      :rules="formRules"
      label-width="110px"
    >
      <el-form-item label="标题" prop="title">
        <el-input
          v-model="formModel.title"
          clearable
          placeholder="消息标题"
          maxlength="255"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="内容" prop="content">
        <ReRichTextEditor
          v-model="formModel.content"
          height="320px"
          placeholder="请输入正文，支持富文本"
        />
      </el-form-item>

      <el-form-item label="跳转路径" prop="redirectPath">
        <el-select
          v-model="formModel.redirectPath"
          class="w-full!"
          filterable
          allow-create
          default-first-option
          clearable
          :loading="routesLoading"
          placeholder="搜索或选择菜单 path（不含参数）"
          @visible-change="
            open => open && !routePathBaseOptions.length && loadMenuPaths()
          "
        >
          <el-option
            v-for="o in routePathSelectOptions"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="跳转参数" prop="redirectQuery">
        <el-input
          v-model="formModel.redirectQuery"
          clearable
          placeholder="查询参数，如 a=1&b=2（不要写 ?）"
          maxlength="255"
          show-word-limit
        />
        <div
          class="mt-1 text-xs text-[var(--el-text-color-secondary)] leading-snug"
        >
          保存时与路径组合为 redirectUrl；编辑回填时自动拆分。合计不超过 255
          字符。
        </div>
      </el-form-item>

      <template v-if="!isEdit">
        <el-form-item label="消息类型" prop="type">
          <el-select
            v-model="formModel.type"
            class="w-full!"
            placeholder="请选择"
          >
            <el-option
              v-for="opt in GetDict.sys_message_type"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="接收方式" prop="receiveKind">
          <div class="flex flex-col gap-3 w-full">
            <el-radio-group v-model="formModel.receiveKind">
              <el-radio label="all">全体成员（userId = 0）</el-radio>
              <el-radio label="users">指定用户</el-radio>
              <el-radio label="roles">按角色群发</el-radio>
              <el-radio label="both">用户 + 角色（并集）</el-radio>
            </el-radio-group>

            <el-select
              v-if="
                formModel.receiveKind === 'users' ||
                formModel.receiveKind === 'both'
              "
              v-model="formModel.selectedUserIds"
              multiple
              filterable
              remote
              reserve-keyword
              collapse-tags
              collapse-tags-tooltip
              :remote-method="onUserRemoteSearch"
              :loading="userLoading"
              class="w-full!"
              placeholder="搜索用户名并选择，可多选"
              @visible-change="v => v && fetchUsers('')"
            >
              <el-option
                v-for="u in userOptions"
                :key="u.id"
                :label="userOptionLabel(u)"
                :value="u.id"
              />
            </el-select>

            <div
              v-if="
                formModel.receiveKind === 'roles' ||
                formModel.receiveKind === 'both'
              "
              class="flex flex-col gap-2"
            >
              <el-button type="primary" plain @click="openRoleDialog">
                选择角色组
              </el-button>
              <div
                v-if="formModel.selectedRoleIds.length"
                class="text-xs text-[var(--el-text-color-secondary)]"
              >
                已选 {{ formModel.selectedRoleIds.length }} 个角色：
                {{
                  formModel.selectedRoleIds
                    .map(
                      id => roleOptions.find(r => r.id === id)?.name ?? `#${id}`
                    )
                    .join("、")
                }}
              </div>
              <div v-else class="text-xs text-[var(--el-color-warning)]">
                请点击「选择角色组」勾选要群发的角色
              </div>
            </div>
          </div>
        </el-form-item>
      </template>
    </el-form>

    <el-dialog
      v-model="roleDialogVisible"
      title="选择角色组"
      width="480px"
      append-to-body
      destroy-on-close
    >
      <el-scrollbar max-height="360px">
        <el-checkbox-group v-model="tempRoleIds" class="flex flex-col gap-2">
          <el-checkbox
            v-for="r in roleOptions"
            :key="r.id"
            :label="r.id"
            class="!mr-0"
          >
            {{ r.name }}
          </el-checkbox>
        </el-checkbox-group>
      </el-scrollbar>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRoleDialog">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
