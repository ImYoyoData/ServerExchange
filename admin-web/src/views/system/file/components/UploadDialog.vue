<script setup lang="ts">
import { ref } from "vue";
import type { UploadUserFile } from "element-plus";
import { message } from "@/utils/message";
import {
  initChunkUpload,
  mergeChunkUpload,
  uploadAdminFile,
  uploadChunk
} from "@/api/file";

defineOptions({ name: "FileUploadDialog" });

const visible = defineModel<boolean>({ default: false });

const props = defineProps<{
  moduleOptions: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits<{
  success: [];
}>();

const mode = ref<"normal" | "chunk">("normal");
const uploadLoading = ref(false);
const uploadModule = ref("");
const uploadFiles = ref<UploadUserFile[]>([]);
const chunkSizeMB = ref(2);
const chunkProgress = ref(0);

function resetState() {
  mode.value = "normal";
  uploadModule.value = "";
  uploadFiles.value = [];
  chunkSizeMB.value = 2;
  chunkProgress.value = 0;
}

function onOpen() {
  resetState();
}

function onUploadFileChange(_file: UploadUserFile, fileList: UploadUserFile[]) {
  uploadFiles.value = fileList.slice(-1);
}

async function calcSha256(file: File) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function submitNormal(raw: File) {
  const res: any = await uploadAdminFile(raw, uploadModule.value);
  const ok = res?.success === true || res?.code === 200 || res?.code === 201;
  if (!ok) {
    message(res?.message ?? "上传失败", { type: "error" });
    return;
  }
  message("上传成功", { type: "success" });
  visible.value = false;
  emit("success");
}

async function submitChunk(raw: File) {
  const size = Math.max(1, Number(chunkSizeMB.value) || 1) * 1024 * 1024;
  const totalChunks = Math.max(1, Math.ceil(raw.size / size));
  const fileHash = await calcSha256(raw);

  await initChunkUpload({
    fileHash,
    fileName: raw.name,
    fileSize: raw.size,
    chunkSize: size,
    module: uploadModule.value,
    totalChunks
  });

  for (let i = 0; i < totalChunks; i += 1) {
    const start = i * size;
    const end = Math.min(raw.size, start + size);
    const chunk = raw.slice(start, end);
    const formData = new FormData();
    formData.append("file", chunk, raw.name);
    formData.append("fileHash", fileHash);
    formData.append("index", String(i));
    formData.append("totalChunks", String(totalChunks));
    formData.append("fileName", raw.name);
    formData.append("module", uploadModule.value);

    await uploadChunk(fileHash, i, formData);
    chunkProgress.value = Math.round(((i + 1) / totalChunks) * 100);
  }

  const res: any = await mergeChunkUpload({
    fileHash,
    fileName: raw.name,
    module: uploadModule.value,
    totalChunks
  });

  const ok = res?.success === true || res?.code === 200 || res?.code === 201;
  if (!ok) {
    message(res?.message ?? "分片合并失败", { type: "error" });
    return;
  }
  message("分片上传成功", { type: "success" });
  visible.value = false;
  emit("success");
}

async function submitUpload() {
  if (!uploadModule.value) {
    message("模块为必填项", { type: "warning" });
    return;
  }
  const target = uploadFiles.value[0];
  const raw = target?.raw as File | undefined;
  if (!raw) {
    message("请选择文件", { type: "warning" });
    return;
  }
  uploadLoading.value = true;
  try {
    if (mode.value === "chunk") await submitChunk(raw);
    else await submitNormal(raw);
  } finally {
    uploadLoading.value = false;
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="上传文件"
    width="620px"
    destroy-on-close
    :close-on-click-modal="false"
    @open="onOpen"
  >
    <el-form label-width="110px">
      <el-form-item label="上传方式">
        <el-radio-group v-model="mode">
          <el-radio-button label="normal">普通上传</el-radio-button>
          <el-radio-button label="chunk">分片上传</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="模块">
        <el-select
          v-model="uploadModule"
          placeholder="请选择模块（必填）"
          class="w-full"
        >
          <el-option
            v-for="opt in props.moduleOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="mode === 'chunk'" label="分片大小(MB)">
        <el-input-number
          v-model="chunkSizeMB"
          :min="1"
          :max="50"
          controls-position="right"
        />
      </el-form-item>
      <el-form-item v-if="mode === 'chunk' && uploadLoading" label="上传进度">
        <el-progress :percentage="chunkProgress" />
      </el-form-item>
      <el-form-item label="文件">
        <el-upload
          drag
          :auto-upload="false"
          :limit="1"
          :on-change="onUploadFileChange"
          :file-list="uploadFiles"
        >
          <div>将文件拖到此处，或点击上传</div>
        </el-upload>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="uploadLoading" @click="submitUpload">
        {{ mode === "chunk" ? "开始分片上传" : "上传" }}
      </el-button>
    </template>
  </el-dialog>
</template>

