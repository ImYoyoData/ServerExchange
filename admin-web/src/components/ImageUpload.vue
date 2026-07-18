<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import type {
  UploadFile,
  UploadFiles,
  UploadRequestOptions,
  UploadUserFile
} from "element-plus";
import { uploadAdminFile } from "@/api/file";

defineOptions({ name: "ImageUpload" });

export type UploadedImageItem = {
  id?: string | number;
  url: string;
  name?: string;
};

const props = withDefaults(
  defineProps<{
    /** v-model 绑定值 */
    modelValue?: UploadedImageItem[];
    /** 上传模块（后端 module） */
    module?: string;
    /** 最多可选数量 */
    limit?: number;
    /** 允许后缀，如 ["jpg","jpeg","png"] */
    suffixes?: string[];
    /** 组件宽度，支持 number(px) 或任意 css 字符串 */
    width?: number | string;
    /** 组件高度，支持 number(px) 或任意 css 字符串 */
    height?: number | string;
    /** 最大文件大小（KB） */
    maxSizeKB?: number;
    disabled?: boolean;
  }>(),
  {
    modelValue: () => [],
    module: "",
    limit: 1,
    suffixes: () => ["jpg", "jpeg", "png", "webp", "gif", "bmp"],
    width: 120,
    height: 120,
    maxSizeKB: 2048,
    disabled: false
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: UploadedImageItem[]];
  change: [value: UploadedImageItem[]];
}>();

const fileList = ref<UploadUserFile[]>([]);
const uploadLoading = ref(false);

function normalizeSize(v: number | string) {
  if (typeof v === "number") return `${v}px`;
  return v;
}

const wrapperStyle = computed(() => ({
  "--img-upload-width": normalizeSize(props.width),
  "--img-upload-height": normalizeSize(props.height)
}));

const accept = computed(() =>
  props.suffixes
    .map(s => s.replace(/^\./, "").trim().toLowerCase())
    .filter(Boolean)
    .map(s => `.${s}`)
    .join(",")
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
      name: item.name || `image-${idx + 1}`,
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
  const next: UploadedImageItem[] = fileList.value
    .filter(f => !!f.url)
    .map(f => ({
      url: String(f.url),
      name: f.name
    }));
  emit("update:modelValue", next);
  emit("change", next);
}

function validateSuffix(file: File) {
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

async function doUpload(options: UploadRequestOptions) {
  const raw = options.file as File;
  uploadLoading.value = true;
  try {
    const res: any = await uploadAdminFile(raw, props.module);
    const ok = res?.success === true || res?.code === 200 || res?.code === 201;
    if (!ok) {
      const msg = res?.message ?? "上传失败";
      options.onError?.(new Error(msg) as any);
      ElMessage.error(msg);
      return;
    }
    const url = resolveUploadedUrl(res);
    if (!url) {
      options.onError?.(new Error("上传成功但未返回图片地址") as any);
      ElMessage.error("上传成功但未返回图片地址");
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
  const next: UploadedImageItem[] = fileList.value
    .filter(f => !!f.url)
    .map(f => ({
      id: f.uid === uploadFile.uid ? id : undefined,
      url: String(f.url),
      name: f.name
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
  <div class="img-upload" :style="wrapperStyle">
    <el-upload
      v-model:file-list="fileList"
      action="#"
      list-type="picture-card"
      :auto-upload="true"
      :http-request="doUpload"
      :before-upload="beforeUpload"
      :on-success="handleSuccess"
      :on-remove="handleRemove"
      :accept="accept"
      :limit="limit"
      :disabled="disabled || uploadLoading"
      :show-file-list="true"
    >
      <div>{{ uploadLoading ? "上传中..." : "上传" }}</div>
    </el-upload>
  </div>
</template>

<style scoped lang="scss">
.img-upload {
  width: var(--img-upload-width, 120px);
  min-height: var(--img-upload-height, 120px);
}

.img-upload :deep(.el-upload--picture-card),
.img-upload :deep(.el-upload-list__item) {
  width: var(--img-upload-width, 120px);
  height: var(--img-upload-height, 120px);
}
</style>
