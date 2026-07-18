<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import type {
  UploadFile,
  UploadFiles,
  UploadRequestOptions,
  UploadUserFile
} from "element-plus";
import {
  initChunkUpload,
  mergeChunkUpload,
  uploadAdminFile,
  uploadChunk
} from "@/api/file";

defineOptions({ name: "FileUpload" });

export type UploadedFileItem = {
  id?: string | number;
  url: string;
  name: string;
  size?: number;
};

const props = withDefaults(
  defineProps<{
    /** v-model 绑定值 */
    modelValue?: UploadedFileItem[];
    /** 上传模块，建议传值 */
    module?: string;
    /** 最多可选数量 */
    limit?: number;
    /** 允许后缀，如 ["pdf","docx","zip"] */
    suffixes?: string[];
    /** 大于该值(MB)自动分片上传 */
    chunkThresholdMB?: number;
    /** 分片大小(MB) */
    chunkSizeMB?: number;
    /** 最大文件大小（KB） */
    maxSizeKB?: number;
    disabled?: boolean;
  }>(),
  {
    modelValue: () => [],
    module: "",
    limit: 1,
    suffixes: () => [],
    chunkThresholdMB: 50,
    chunkSizeMB: 5,
    maxSizeKB: 102400,
    disabled: false
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: UploadedFileItem[]];
  change: [value: UploadedFileItem[]];
}>();

const fileList = ref<UploadUserFile[]>([]);
const uploadLoading = ref(false);

const accept = computed(() => {
  const list = props.suffixes
    .map(s => s.replace(/^\./, "").trim().toLowerCase())
    .filter(Boolean);
  return list.map(s => `.${s}`).join(",");
});

const chunkThresholdBytes = computed(
  () => Math.max(1, Number(props.chunkThresholdMB) || 50) * 1024 * 1024
);
const chunkSizeBytes = computed(
  () => Math.max(1, Number(props.chunkSizeMB) || 5) * 1024 * 1024
);

function resolveUploadedUrl(res: any): string {
  return String(
    res?.data?.url ??
      res?.data?.fileUrl ??
      res?.data?.fullUrl ??
      res?.data?.path ??
      res?.data?.accessUrl ??
      ""
  );
}

function resolveUploadedId(res: any): string | number | undefined {
  const id = res?.data?.id ?? res?.data?.fileId ?? res?.data?.data?.id;
  return id === undefined || id === null || id === "" ? undefined : id;
}

function syncFromModelValue() {
  const incoming = Array.isArray(props.modelValue) ? props.modelValue : [];
  fileList.value = incoming.map(
    (item, idx): UploadUserFile => ({
      uid: idx + 1,
      name: item.name || `file-${idx + 1}`,
      status: "success",
      url: item.url
    })
  );
}

watch(
  () => props.modelValue,
  () => syncFromModelValue(),
  { immediate: true, deep: true }
);

function emitChangeByFileList() {
  const next: UploadedFileItem[] = fileList.value
    .filter(f => !!f.url)
    .map(f => ({
      url: String(f.url),
      name: f.name || "file",
      size: Number.isFinite(Number(f.size)) ? Number(f.size) : undefined
    }));
  emit("update:modelValue", next);
  emit("change", next);
}

function validateSuffix(file: File) {
  if (!props.suffixes.length) return true;
  const suffix = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase() || ""
    : "";
  const allowSet = new Set(
    props.suffixes.map(s => s.replace(/^\./, "").trim().toLowerCase())
  );
  if (!suffix || !allowSet.has(suffix)) {
    ElMessage.warning(`仅支持后缀：${props.suffixes.join(", ")}`);
    return false;
  }
  return true;
}

function validateSize(file: File) {
  const max = Math.max(1, Number(props.maxSizeKB) || 1) * 1024;
  if (file.size > max) {
    ElMessage.warning(`文件大小不能超过 ${props.maxSizeKB}KB`);
    return false;
  }
  return true;
}

function beforeUpload(rawFile: File) {
  return validateSuffix(rawFile) && validateSize(rawFile);
}

async function calcSha256(file: File) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function uploadByNormal(file: File) {
  return uploadAdminFile(file, props.module);
}

async function uploadByChunk(file: File) {
  const fileHash = await calcSha256(file);
  const chunkSize = chunkSizeBytes.value;
  const totalChunks = Math.ceil(file.size / chunkSize);

  const initBody: Record<string, any> = {
    fileName: file.name,
    fileHash,
    fileSize: file.size,
    chunkSize,
    totalChunks
  };
  if (props.module) initBody.module = props.module;
  await initChunkUpload(initBody);

  for (let i = 0; i < totalChunks; i += 1) {
    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunk = file.slice(start, end);
    const form = new FormData();
    form.append("file", chunk, file.name);
    form.append("fileHash", fileHash);
    form.append("index", String(i));
    form.append("totalChunks", String(totalChunks));
    form.append("fileName", file.name);
    if (props.module) form.append("module", props.module);
    await uploadChunk(fileHash, i, form);
  }

  const mergeBody: Record<string, any> = {
    fileName: file.name,
    fileHash,
    totalChunks
  };
  if (props.module) mergeBody.module = props.module;
  return mergeChunkUpload(mergeBody);
}

async function doUpload(options: UploadRequestOptions) {
  const raw = options.file as File;
  uploadLoading.value = true;
  try {
    const res: any =
      raw.size > chunkThresholdBytes.value
        ? await uploadByChunk(raw)
        : await uploadByNormal(raw);
    const ok = res?.success === true || res?.code === 200 || res?.code === 201;
    if (!ok) {
      const msg = res?.message ?? "上传失败";
      options.onError?.(new Error(msg) as any);
      ElMessage.error(msg);
      return;
    }
    const url = resolveUploadedUrl(res);
    if (!url) {
      options.onError?.(new Error("上传成功但未返回文件地址") as any);
      ElMessage.error("上传成功但未返回文件地址");
      return;
    }
    const id = resolveUploadedId(res);
    options.onSuccess?.({ ...res, _uploaded: { id, url } });
  } catch (e: any) {
    options.onError?.(e as any);
    ElMessage.error(e?.message ?? "上传失败");
  } finally {
    uploadLoading.value = false;
  }
}

function handleSuccess(res: any, uploadFile: UploadFile, files: UploadFiles) {
  const u = String(res?._uploaded?.url ?? uploadFile.url ?? "");
  const id = res?._uploaded?.id;
  fileList.value = files.map(f => ({
    ...f,
    url: String(f.uid === uploadFile.uid ? u : f.url || "")
  }));
  const next: UploadedFileItem[] = fileList.value
    .filter(f => !!f.url)
    .map(f => ({
      id: f.uid === uploadFile.uid ? id : undefined,
      url: String(f.url),
      name: f.name || "file",
      size: Number.isFinite(Number(f.size)) ? Number(f.size) : undefined
    }));
  emit("update:modelValue", next);
  emit("change", next);
}

function handleRemove(_file: UploadFile, files: UploadFiles) {
  fileList.value = files as UploadUserFile[];
  emitChangeByFileList();
}
</script>

<template>
  <el-upload
    v-model:file-list="fileList"
    action="#"
    :auto-upload="true"
    :http-request="doUpload"
    :before-upload="beforeUpload"
    :on-success="handleSuccess"
    :on-remove="handleRemove"
    :accept="accept || undefined"
    :limit="limit"
    :disabled="disabled || uploadLoading"
  >
    <el-button type="primary" :loading="uploadLoading">
      {{ uploadLoading ? "上传中..." : "上传文件" }}
    </el-button>
  </el-upload>
</template>
