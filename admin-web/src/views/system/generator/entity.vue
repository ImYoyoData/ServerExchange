<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  getSrcList,
  streamTypeormEntityAgent,
  type TypeormEntityStreamEvent,
  saveSrcFile
} from "@/api/generator";
import { message } from "@/utils/message";
import { highlightTypeScript } from "@/utils/highlight/typescript";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Delete from "~icons/ep/delete";
import DocumentCopy from "~icons/ep/document-copy";
import FolderAdd from "~icons/ep/folder-add";
import Promotion from "~icons/ep/promotion";
import "highlight.js/styles/github-dark.css";

defineOptions({
  name: "SystemGeneratorEntity"
});

/** 工具执行步骤（流式中间态） */
type ToolStep = {
  toolName: string;
  label: string;
  status: "running" | "success" | "error";
  detail?: string;
};

/** 单条对话 */
type ChatTurn = {
  role: "user" | "assistant" | "error";
  /** chat=自然语言回复，entity=实体 TS 代码 */
  kind?: "chat" | "entity";
  content: string;
  /** entity 消息：AI 补充说明（流式） */
  summary?: string;
  /** 流式生成中 */
  streaming?: boolean;
  /** 工具执行等中间状态 */
  statusText?: string;
  /** 工具步骤日志 */
  toolSteps?: ToolStep[];
  /** askUser 追问内容 */
  askQuestion?: string;
  askHint?: string;
  askOptions?: Array<{ id: string; label: string }>;
  /** 网络工具摘要 */
  webInfo?: Array<{
    toolName: string;
    title?: string;
    url?: string;
    summary: string;
  }>;
  /** entity 消息：highlight.js HTML */
  codeHtml?: string;
  validationReason?: string;
};

const TOOL_LABELS: Record<string, string> = {
  askUser: "询问用户",
  searchWeb: "搜索网络",
  fetchWebPage: "抓取网页",
  generateValidatedTypeormEntity: "生成并校验实体"
};

function toolStatusText(toolName: string): string {
  switch (toolName) {
    case "askUser":
      return "正在整理追问…";
    case "searchWeb":
      return "正在搜索网络资料…";
    case "fetchWebPage":
      return "正在抓取网页内容…";
    case "generateValidatedTypeormEntity":
      return "正在生成并校验 TypeORM 实体代码…";
    default:
      return "正在执行工具…";
  }
}

function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

function upsertToolStep(
  steps: ToolStep[] | undefined,
  toolName: string,
  patch: Partial<ToolStep> & Pick<ToolStep, "status">
): ToolStep[] {
  const label = toolLabel(toolName);
  const next = [...(steps ?? [])];
  const idx = next.findIndex(item => item.toolName === toolName);
  if (idx >= 0) {
    next[idx] = { ...next[idx], ...patch, toolName, label };
  } else {
    next.push({ toolName, label, ...patch });
  }
  return next;
}

const MAX_HISTORY = 20;

const isDev = import.meta.env.DEV;

const inputText = ref("");
const loading = ref(false);
const messages = ref<ChatTurn[]>([]);
/** 最近一次 AI 生成的代码，便于「保存到项目」里使用 */
const lastGeneratedCode = ref("");
/** 当前流式请求，用于取消 */
let streamAbort: AbortController | null = null;

const scrollRef = ref<HTMLElement | null>(null);

const saveDialogVisible = ref(false);
const savePathInput = ref("");
const pendingSaveCode = ref("");
/** 当前路径在 src-list 中 isExist === true 时不可保存 */
const savePathTargetExists = ref(false);

const historyCount = computed(() => messages.value.length);

function buildUserContext(prev: ChatTurn[]): string {
  if (!prev.length) return "";
  const lines: string[] = [];
  for (const m of prev) {
    if (m.role === "user") {
      lines.push(`【用户】\n${m.content}`);
    } else if (m.role === "assistant") {
      if (m.kind === "entity") {
        lines.push(`【AI·已生成实体】\n${m.content}`);
      } else {
        lines.push(`【AI】\n${m.content}`);
      }
    }
  }
  return lines.join("\n\n----------\n\n");
}

function applyEntityToMessage(
  msg: ChatTurn,
  code: string,
  options?: { validationReason?: string; summary?: string }
): ChatTurn {
  return {
    ...msg,
    role: "assistant",
    kind: "entity",
    content: code,
    codeHtml: highlightTypeScript(code),
    statusText: "",
    streaming: msg.streaming,
    ...(options?.validationReason
      ? { validationReason: options.validationReason }
      : {}),
    ...(options?.summary ? { summary: options.summary } : {})
  };
}

function patchAssistantMessage(assistantIdx: number, patch: Partial<ChatTurn>) {
  const current = messages.value[assistantIdx];
  if (!current || current.role !== "assistant") return;
  messages.value[assistantIdx] = { ...current, ...patch };
}

function handleStreamEvent(assistantIdx: number, event: TypeormEntityStreamEvent) {
  const msg = messages.value[assistantIdx];
  if (!msg || msg.role !== "assistant") return;

  switch (event.type) {
    case "text-delta": {
      if (msg.kind === "entity") {
        patchAssistantMessage(assistantIdx, {
          summary: `${msg.summary ?? ""}${event.text}`
        });
      } else {
        patchAssistantMessage(assistantIdx, {
          content: `${msg.content}${event.text}`
        });
      }
      break;
    }
    case "tool-start": {
      patchAssistantMessage(assistantIdx, {
        statusText: toolStatusText(event.toolName),
        toolSteps: upsertToolStep(msg.toolSteps, event.toolName, {
          status: "running"
        })
      });
      break;
    }
    case "web-info": {
      const webInfo = [
        ...(msg.webInfo ?? []),
        {
          toolName: event.toolName,
          title: event.title,
          url: event.url,
          summary: event.summary
        }
      ];
      patchAssistantMessage(assistantIdx, {
        webInfo,
        statusText: "",
        toolSteps: upsertToolStep(msg.toolSteps, event.toolName, {
          status: event.ok ? "success" : "error",
          detail: event.ok ? undefined : event.summary
        })
      });
      break;
    }
    case "ask": {
      patchAssistantMessage(assistantIdx, {
        kind: "chat",
        askQuestion: event.question,
        askHint: event.hint,
        askOptions: event.options,
        statusText: "",
        toolSteps: upsertToolStep(msg.toolSteps, "askUser", {
          status: "success"
        })
      });
      break;
    }
    case "entity": {
      messages.value[assistantIdx] = applyEntityToMessage(msg, event.code, {
        validationReason: event.validationReason
      });
      messages.value[assistantIdx].toolSteps = upsertToolStep(
        messages.value[assistantIdx].toolSteps,
        "generateValidatedTypeormEntity",
        { status: "success" }
      );
      lastGeneratedCode.value = event.code;
      break;
    }
    case "done": {
      const current = messages.value[assistantIdx];
      if (!current || current.role !== "assistant") break;

      if (event.kind === "entity" && event.code) {
        messages.value[assistantIdx] = applyEntityToMessage(current, event.code, {
          validationReason:
            event.validationReason ?? current.validationReason,
          summary: event.message ?? current.summary
        });
        lastGeneratedCode.value = event.code;
      } else {
        patchAssistantMessage(assistantIdx, {
          kind: event.kind,
          streaming: false,
          statusText: "",
          ...(event.kind === "chat" && event.message && !current.content.trim()
            ? { content: event.message }
            : {}),
          ...(event.kind === "entity" && event.message
            ? { summary: event.message, kind: "entity" as const }
            : {})
        });
      }
      break;
    }
    case "error": {
      const failedTool = msg.toolSteps?.find(item => item.status === "running");
      messages.value[assistantIdx] = {
        role: "error",
        content: event.message,
        ...(failedTool
          ? {
              toolSteps: upsertToolStep(msg.toolSteps, failedTool.toolName, {
                status: "error",
                detail: event.message
              })
            }
          : {})
      };
      break;
    }
  }
}

function extractErrorMessage(error: any): string {
  return error?.response?.data?.message || error?.message || "请求失败";
}

async function scrollToBottom() {
  await nextTick();
  const el = scrollRef.value;
  if (el) el.scrollTop = el.scrollHeight;
}

function trimHistory() {
  if (messages.value.length > MAX_HISTORY) {
    messages.value = messages.value.slice(-MAX_HISTORY);
  }
}

/** 兼容非 HTTPS、旧内核：用隐藏 textarea + execCommand */
function copyViaExecCommand(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

async function copyText(text: string) {
  if (!text) return;

  // Clipboard API 需安全上下文（HTTPS / localhost），部分浏览器无权限时会抛错
  const canUseClipboard =
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function" &&
    typeof window !== "undefined" &&
    window.isSecureContext;

  if (canUseClipboard) {
    try {
      await navigator.clipboard.writeText(text);
      message("已复制到剪贴板", { type: "success" });
      return;
    } catch {
      /* 继续走降级方案 */
    }
  }

  try {
    if (copyViaExecCommand(text)) {
      message("已复制到剪贴板", { type: "success" });
    } else {
      message("复制失败，请手动选择复制", { type: "warning" });
    }
  } catch {
    message("复制失败，请手动选择复制", { type: "warning" });
  }
}

async function sendMessage() {
  const text = String(inputText.value ?? "").trim();
  if (!text || loading.value) return;

  const userContext = buildUserContext(messages.value.slice(-MAX_HISTORY));

  messages.value.push({ role: "user", content: text });
  messages.value.push({
    role: "assistant",
    kind: "chat",
    content: "",
    streaming: true
  });
  const assistantIdx = messages.value.length - 1;

  inputText.value = "";
  loading.value = true;
  streamAbort?.abort();
  streamAbort = new AbortController();

  await scrollToBottom();

  try {
    await streamTypeormEntityAgent(
      { message: text, userContext },
      event => {
        handleStreamEvent(assistantIdx, event);
        void scrollToBottom();
      },
      streamAbort.signal
    );

    const finalMsg = messages.value[assistantIdx];
    if (finalMsg?.role === "assistant" && finalMsg.streaming) {
      finalMsg.streaming = false;
      if (!finalMsg.kind) {
        finalMsg.kind = "chat";
      }
    }

    trimHistory();
    await scrollToBottom();
  } catch (e: any) {
    if (e?.name === "AbortError") return;
    const errMsg = extractErrorMessage(e);
    const current = messages.value[assistantIdx];
    if (current?.role === "assistant" && !current.content.trim()) {
      messages.value[assistantIdx] = { role: "error", content: errMsg };
    } else {
      messages.value.push({ role: "error", content: errMsg });
    }
    await scrollToBottom();
    message(errMsg, { type: "error" });
  } finally {
    loading.value = false;
    streamAbort = null;
  }
}

function clearMemory() {
  streamAbort?.abort();
  streamAbort = null;
  loading.value = false;
  messages.value = [];
  lastGeneratedCode.value = "";
  message("已清除对话记忆", { type: "success" });
}

/** 打开「保存到项目」弹窗（每条 AI 回复上操作） */
function openSaveDialog(code: string) {
  if (!isDev) return;
  pendingSaveCode.value = code;
  if (!savePathInput.value) savePathInput.value = "/api/";
  savePathTargetExists.value = false;
  saveDialogVisible.value = true;
}

async function confirmSaveToProject() {
  const path = String(savePathInput.value ?? "").trim();
  if (!path) {
    message("请填写保存路径", { type: "warning" });
    return;
  }
  if (savePathTargetExists.value) {
    message("目录或文件已存在", { type: "warning" });
    return;
  }
  const ok = await saveToProjectImpl(path, pendingSaveCode.value);
  if (ok) {
    saveDialogVisible.value = false;
    pendingSaveCode.value = "";
    savePathInput.value = "";
  }
}

/**
 * 保存到项目：POST admin/utils/save-src-file
 * @param path 相对路径（relativePath）
 * @param code 当前条 AI 返回的 TS 源码
 */
async function saveToProjectImpl(path: string, code: string): Promise<boolean> {
  try {
    const res: any = await saveSrcFile({
      relativePath: path + ".entity.ts",
      content: code
    });
    if (res?.success === false) {
      message(res?.message ?? "保存失败", { type: "error" });
      return false;
    }
    message(
      typeof res?.message === "string" && res.message
        ? res.message
        : "已保存到项目",
      { type: "success" }
    );
    return true;
  } catch {
    // 网络/HTTP 错误由 http 拦截器提示时，此处不再重复弹窗
    return false;
  }
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

/** 路径比较（忽略末尾多余 /） */
function pathsEqual(a: string, b: string): boolean {
  const norm = (s: string) => {
    const t = (s || "").trim() || "/";
    return t === "/" ? "/" : t.replace(/\/+$/, "") || "/";
  };
  return norm(a) === norm(b);
}

/**
 * 解析保存路径输入，对接后端：path 仅为目录，fileName 为「最后一段 + .entity.ts」
 * - 末尾带 / 视为纯目录浏览：只 list，不做「文件是否存在」校验
 * - 无尾 / 时最后一段视为实体名，目录为父路径
 */
function parseSrcListQuery(input: string): {
  listPath: string;
  dirPathForExist: string;
  fileName?: string;
} {
  const raw = (input || "").trim();
  if (!raw || raw === "/") {
    return { listPath: "/", dirPathForExist: "/" };
  }
  if (raw.endsWith("/")) {
    const dir = raw.replace(/\/+$/, "") || "/";
    return { listPath: dir, dirPathForExist: dir };
  }
  const noTrail = raw.replace(/\/+$/, "");
  const parts = noTrail.split("/").filter(Boolean);
  if (parts.length === 0) {
    return { listPath: "/", dirPathForExist: "/" };
  }
  const stem = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  const dirPath = dirParts.length === 0 ? "/" : `/${dirParts.join("/")}`;
  const fileName = stem.endsWith(".entity.ts") ? stem : `${stem}.entity.ts`;
  return {
    listPath: dirPath,
    dirPathForExist: dirPath,
    fileName
  };
}

/** 解析新版 src-list 根对象（支持包一层 data） */
function unwrapSrcListPayload(res: any): Record<string, any> | null {
  if (res == null || typeof res !== "object" || Array.isArray(res)) return null;
  if (
    "items" in res ||
    "isExist" in res ||
    "relativePath" in res ||
    "total" in res
  ) {
    return res as Record<string, any>;
  }
  const d = (res as { data?: unknown }).data;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    return d as Record<string, any>;
  }
  return null;
}

/** 旧版或其它结构：从数组 / list 中取路径 */
function normalizeSrcListLegacy(res: any): string[] {
  const d = res?.data !== undefined ? res.data : res;
  if (Array.isArray(d)) {
    return d
      .map((item: unknown) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          const p = o.path ?? o.relativePath ?? o.value ?? o.name ?? o.fullPath;
          return typeof p === "string" ? p : "";
        }
        return String(item);
      })
      .filter(Boolean);
  }
  if (d && typeof d === "object") {
    const list =
      (d as { list?: unknown[] }).list ??
      (d as { paths?: unknown[] }).paths ??
      (d as { items?: unknown[] }).items;
    if (Array.isArray(list)) {
      return normalizeSrcListLegacy({ data: list });
    }
  }
  return [];
}

/** 从新版 items[{ name, relativePath, type }] 取补全路径 */
function pathsFromSrcListRoot(root: Record<string, any> | null): string[] {
  if (!root) return [];
  if (Array.isArray(root.items)) {
    return root.items
      .map((item: { relativePath?: string; name?: string }) => {
        if (item && typeof item.relativePath === "string") {
          return item.relativePath;
        }
        if (item && typeof item.name === "string") return item.name;
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

let srcListSeq = 0;
let srcListSuggestTimer: ReturnType<typeof setTimeout> | null = null;
let savePathExistTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 请求 src-list：path 仅目录；带 fileName 时 isExist 表示目录下该文件是否存在
 */
async function runSrcListQuery(
  queryPath: string,
  cb?: (items: { value: string }[]) => void
) {
  const queryTrim = String(queryPath ?? "").trim() || "/";
  const parsed = parseSrcListQuery(queryTrim);
  const seq = ++srcListSeq;

  if (cb) {
    try {
      const resList = await getSrcList(parsed.listPath);
      if (seq !== srcListSeq) return;
      const current = String(savePathInput.value ?? "").trim() || "/";
      if (!pathsEqual(current, queryTrim)) return;

      const rootList = unwrapSrcListPayload(resList);
      const rawList = rootList
        ? pathsFromSrcListRoot(rootList)
        : normalizeSrcListLegacy(resList);
      const uniq = [...new Set(rawList.map(String).filter(Boolean))];
      cb(uniq.map(value => ({ value })));
    } catch {
      if (seq === srcListSeq) cb([]);
    }
  }

  try {
    if (parsed.fileName) {
      const resExist = await getSrcList(
        parsed.dirPathForExist,
        parsed.fileName
      );
      if (seq !== srcListSeq) return;
      const current = String(savePathInput.value ?? "").trim() || "/";
      if (!pathsEqual(current, queryTrim)) return;

      const rootExist = unwrapSrcListPayload(resExist);
      savePathTargetExists.value = rootExist?.isExist === true;
    } else {
      if (seq !== srcListSeq) return;
      const current = String(savePathInput.value ?? "").trim() || "/";
      if (pathsEqual(current, queryTrim)) savePathTargetExists.value = false;
    }
  } catch {
    if (seq !== srcListSeq) return;
    const current = String(savePathInput.value ?? "").trim() || "/";
    if (pathsEqual(current, queryTrim)) savePathTargetExists.value = false;
  }
}

/** 保存路径远程补全（GET admin/utils/src-list?path=） */
function querySavePathSuggestions(
  queryString: string,
  cb: (items: { value: string }[]) => void
) {
  if (srcListSuggestTimer) clearTimeout(srcListSuggestTimer);
  srcListSuggestTimer = setTimeout(() => {
    void runSrcListQuery(queryString, cb).finally(() => {
      srcListSuggestTimer = null;
    });
  }, 280);
}

watch(saveDialogVisible, async visible => {
  if (!visible) {
    savePathTargetExists.value = false;
    srcListSeq++;
    return;
  }
  await nextTick();
  await runSrcListQuery(String(savePathInput.value ?? "").trim() || "/");
});

watch(savePathInput, val => {
  if (!saveDialogVisible.value) return;
  if (savePathExistTimer) clearTimeout(savePathExistTimer);
  savePathExistTimer = setTimeout(() => {
    savePathExistTimer = null;
    void runSrcListQuery(String(val ?? "").trim() || "/");
  }, 320);
});
</script>

<template>
  <div class="generator-page">
    <el-card shadow="never" class="main-card">
        <template #header>
          <div class="card-header">
            <div class="title-wrap">
              <span class="title">TypeORM Entity 生成</span>
              <el-tag size="small" type="info" effect="plain">
                历史 {{ historyCount }} / {{ MAX_HISTORY }} 条
              </el-tag>
            </div>
            <div class="actions">
              <el-button :icon="useRenderIcon(Delete)" @click="clearMemory">
                清除记忆
              </el-button>
            </div>
          </div>
        </template>

        <div ref="scrollRef" class="chat-scroll">
          <template v-if="messages.length === 0">
            <el-empty
              description="与 AI 对话：可闲聊、追问 TypeORM 问题；描述表结构后将自动生成实体代码"
            />
          </template>
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="msg-row"
            :class="{
              'msg-user': msg.role === 'user',
              'msg-assistant': msg.role === 'assistant',
              'msg-error': msg.role === 'error'
            }"
          >
            <div v-if="msg.role !== 'error'" class="msg-label">
              {{ msg.role === "user" ? "我" : "Ai" }}
            </div>
            <div class="msg-body">
              <template v-if="msg.role === 'user'">
                <div class="user-text">{{ msg.content }}</div>
              </template>
              <template v-else-if="msg.role === 'error'">
                <el-alert
                  type="error"
                  :title="msg.content"
                  show-icon
                  :closable="false"
                />
              </template>
              <template v-else-if="msg.kind === 'chat'">
                <div
                  v-if="msg.toolSteps?.length"
                  class="tool-steps"
                >
                  <div
                    v-for="(step, stepIdx) in msg.toolSteps"
                    :key="`${step.toolName}-${stepIdx}`"
                    class="tool-step"
                    :class="`tool-step--${step.status}`"
                  >
                    <span class="tool-step-icon">
                      {{
                        step.status === "success"
                          ? "✓"
                          : step.status === "error"
                            ? "✕"
                            : "…"
                      }}
                    </span>
                    <span class="tool-step-label">{{ step.label }}</span>
                    <span
                      v-if="step.status === 'error' && step.detail"
                      class="tool-step-detail"
                    >
                      失败：{{ step.detail }}
                    </span>
                  </div>
                </div>
                <div v-if="msg.webInfo?.length" class="web-info-list">
                  <div
                    v-for="(info, infoIdx) in msg.webInfo"
                    :key="`${info.toolName}-${infoIdx}`"
                    class="web-info-item"
                  >
                    <div class="web-info-head">
                      <span class="web-info-label">
                        {{ toolLabel(info.toolName) }}
                      </span>
                      <a
                        v-if="info.url"
                        :href="info.url"
                        class="web-info-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {{ info.url }}
                      </a>
                    </div>
                    <div v-if="info.title" class="web-info-title">
                      {{ info.title }}
                    </div>
                    <pre class="web-info-summary">{{ info.summary }}</pre>
                  </div>
                </div>
                <div v-if="msg.askQuestion" class="ask-question-box">
                  <div class="ask-question-title">需要您补充</div>
                  <div class="ask-question-text">{{ msg.askQuestion }}</div>
                  <div v-if="msg.askHint" class="ask-question-hint">
                    {{ msg.askHint }}
                  </div>
                  <div
                    v-if="msg.askOptions?.length"
                    class="ask-question-options"
                  >
                    <el-tag
                      v-for="opt in msg.askOptions"
                      :key="opt.id"
                      size="small"
                      effect="plain"
                      class="ask-option-tag"
                    >
                      {{ opt.label }}
                    </el-tag>
                  </div>
                </div>
                <div
                  v-if="msg.content.trim() && msg.content.trim() !== msg.askQuestion"
                  class="assistant-text"
                >
                  <span>{{ msg.content }}</span>
                  <span v-if="msg.streaming" class="stream-cursor">▍</span>
                </div>
                <div v-if="msg.statusText" class="stream-status">
                  {{ msg.statusText }}
                </div>
              </template>
              <template v-else-if="msg.kind === 'entity'">
                <div class="assistant-bubble">
                  <div v-if="msg.summary" class="entity-summary">
                    {{ msg.summary }}
                  </div>
                  <div v-if="msg.statusText" class="stream-status">
                    {{ msg.statusText }}
                  </div>
                  <div class="code-toolbar">
                    <span class="code-lang">TypeORM Entity</span>
                    <div class="code-toolbar-btns">
                      <el-button
                        size="small"
                        text
                        type="primary"
                        :disabled="!isDev"
                        :title="!isDev ? '仅开发环境可用' : '保存到项目'"
                        :icon="useRenderIcon(FolderAdd)"
                        @click="openSaveDialog(msg.content)"
                      >
                        保存到项目
                      </el-button>
                      <el-button
                        size="small"
                        text
                        type="primary"
                        :icon="useRenderIcon(DocumentCopy)"
                        @click="copyText(msg.content)"
                      >
                        复制
                      </el-button>
                    </div>
                  </div>
                  <div v-if="msg.validationReason" class="validation-inline">
                    <div class="validation-inline-label">校验说明</div>
                    <div class="validation-inline-body">
                      {{ msg.validationReason }}
                    </div>
                  </div>
                  <pre class="code-pre">
                    <code
                      class="hljs"
                      v-html="msg.codeHtml ?? highlightTypeScript(msg.content)"
                    />
                  </pre>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="composer">
          <el-input
            v-model="inputText"
            type="textarea"
            :rows="3"
            placeholder="输入需求…（Enter 发送，Shift+Enter 换行）"
            :disabled="loading"
            @keydown="onInputKeydown"
          />
          <el-button
            type="primary"
            class="send-btn"
            :loading="loading"
            :icon="useRenderIcon(Promotion)"
            @click="sendMessage"
          >
            发送
          </el-button>
        </div>
      </el-card>

    <el-dialog
      v-model="saveDialogVisible"
      title="保存到项目"
      width="520px"
      destroy-on-close
      align-center
    >
      <el-form label-width="88px" @submit.prevent>
        <el-form-item label="保存路径" required>
          <div class="save-path-hint">
            最后一级为实体名（如
            <code>/api/users/entities/user</code>
            会请求目录
            <code>/api/users/entities</code>
            + 文件
            <code>user.entity.ts</code>
            ）；仅浏览目录时请在末尾加
            <code>/</code>
          </div>
          <div class="save-path-input-wrap">
            <el-autocomplete
              v-model="savePathInput"
              class="save-path-autocomplete"
              :fetch-suggestions="querySavePathSuggestions"
              placeholder="例如：/api/users/entities/card-key"
              clearable
              value-key="value"
              fit-input-width
              trigger-on-focus
            />
            <span class="save-path-suffix">.entity.ts</span>
          </div>
          <el-alert
            v-if="savePathTargetExists"
            class="save-path-exist-alert"
            type="warning"
            :closable="false"
            description="当前路径下已有同名目录或文件，请修改路径后再保存。"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="savePathTargetExists"
          :title="
            savePathTargetExists ? '目录或文件已存在，无法保存' : undefined
          "
          @click="confirmSaveToProject"
        >
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.generator-page {
  padding: 12px;
  height: calc(100vh - 120px);
  min-height: 420px;
}

.main-card {
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0;
  }
}

.card-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title {
  font-weight: 600;
  font-size: 16px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chat-scroll {
  flex: 1;
  overflow: auto;
  padding: 16px;
  background: var(--el-bg-color-page);
}

.msg-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: flex-start;
}

.msg-label {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.msg-user .msg-label {
  background: var(--el-color-primary);
}

.msg-assistant .msg-label {
  background: var(--el-color-success);
}

.msg-error {
  margin-bottom: 16px;
}

.msg-error .msg-body {
  width: 100%;
}

.msg-body {
  flex: 1;
  min-width: 0;
}

.user-text {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.assistant-text {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.stream-cursor {
  display: inline-block;
  margin-left: 2px;
  color: var(--el-color-primary);
  animation: stream-blink 1s step-end infinite;
}

.stream-status {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.tool-steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.tool-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.tool-step-icon {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.tool-step--success .tool-step-icon {
  color: var(--el-color-success);
}

.tool-step--error .tool-step-icon {
  color: var(--el-color-danger);
}

.tool-step--running .tool-step-icon {
  color: var(--el-color-primary);
}

.tool-step-detail {
  color: var(--el-color-danger);
  font-size: 12px;
}

.ask-question-box {
  margin-bottom: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
}

.ask-question-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 6px;
}

.ask-question-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
}

.ask-question-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.ask-question-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.ask-option-tag {
  cursor: default;
}

.web-info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.web-info-item {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-blank);
}

.web-info-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.web-info-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.web-info-link {
  font-size: 12px;
  color: var(--el-color-info);
  word-break: break-all;
}

.web-info-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.web-info-summary {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--el-text-color-regular);
  font-family: inherit;
}

.entity-summary {
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

@keyframes stream-blink {
  50% {
    opacity: 0;
  }
}

/* AI 整条回复区域：比默认再灰一档 */
.assistant-bubble {
  padding: 12px 14px 14px;
  border-radius: 10px;
  background: var(--el-fill-color-dark);
  border: 1px solid var(--el-border-color-darker);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 4%);
}

.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
  gap: 8px;
}

/* 工具栏与代码块之间（红框区域）：校验说明 */
.validation-inline {
  margin: 8px 0 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}

.validation-inline-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.validation-inline-body {
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.code-toolbar-btns {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.code-lang {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.msg-assistant .code-pre {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: #494949;
  border: 1px solid var(--el-border-color-darker);
  overflow-x: auto;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre;
  word-break: normal;

  :deep(.hljs) {
    background: transparent !important;
    padding: 0;
  }
}

.composer {
  display: flex;
  gap: 12px;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  align-items: flex-end;
  background: var(--el-bg-color);
}

.composer :deep(.el-textarea) {
  flex: 1;
}

.send-btn {
  flex-shrink: 0;
}

.save-path-exist-alert {
  margin-top: 10px;
}

.save-path-hint {
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);

  code {
    margin: 0 2px;
    padding: 0 4px;
    border-radius: 4px;
    font-size: 11px;
    background: var(--el-fill-color-light);
  }
}

.save-path-input-wrap {
  display: flex;
  align-items: stretch;
  width: 100%;
  gap: 0;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  overflow: hidden;
  background: var(--el-fill-color-blank);
}

.save-path-autocomplete {
  flex: 1;
  min-width: 0;

  :deep(.el-input__wrapper) {
    box-shadow: none !important;
    border-radius: 0;
    border: none;
  }
}

.save-path-suffix {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 0 12px;
  font-size: 13px;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-left: 1px solid var(--el-border-color);
}
</style>
