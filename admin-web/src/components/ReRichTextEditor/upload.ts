import { ElMessage } from "element-plus";
import {
  initChunkUpload,
  mergeChunkUpload,
  uploadAdminFile,
  uploadChunk
} from "@/api/file";

export const RICH_TEXT_IMAGE_MODULE = "rich_text_image";
export const RICH_TEXT_VIDEO_MODULE = "rich_text_video";

const IMAGE_SUFFIXES = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg"
]);

const VIDEO_SUFFIXES = new Set([
  "mp4",
  "webm",
  "mov",
  "m4v",
  "avi",
  "mkv"
]);

export function resolveUploadedUrl(res: any): string {
  return String(
    res?.data?.url ??
      res?.data?.fileUrl ??
      res?.data?.fullUrl ??
      res?.data?.path ??
      res?.data?.accessUrl ??
      ""
  );
}

function getFileSuffix(file: File): string {
  const name = String(file.name ?? "");
  if (!name.includes(".")) return "";
  return name.split(".").pop()?.trim().toLowerCase() ?? "";
}

function validateSuffix(file: File, allow: Set<string>, label: string) {
  const suffix = getFileSuffix(file);
  if (!suffix || !allow.has(suffix)) {
    ElMessage.warning(`${label}仅支持：${Array.from(allow).join(", ")}`);
    return false;
  }
  return true;
}

function validateSize(file: File, maxSizeKB: number, label: string) {
  const maxBytes = Math.max(1, maxSizeKB) * 1024;
  if (file.size > maxBytes) {
    ElMessage.warning(`${label}大小不能超过 ${maxSizeKB}KB`);
    return false;
  }
  return true;
}

async function calcSha256(file: File) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function uploadByChunk(file: File, module: string) {
  const fileHash = await calcSha256(file);
  const chunkSize = 5 * 1024 * 1024;
  const totalChunks = Math.ceil(file.size / chunkSize);

  await initChunkUpload({
    fileName: file.name,
    fileHash,
    fileSize: file.size,
    chunkSize,
    totalChunks,
    module
  });

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
    form.append("module", module);
    await uploadChunk(fileHash, i, form);
  }

  return mergeChunkUpload({
    fileName: file.name,
    fileHash,
    totalChunks,
    module
  });
}

async function uploadFileToServer(
  file: File,
  module: string,
  chunkThresholdBytes: number
) {
  const res: any =
    file.size > chunkThresholdBytes
      ? await uploadByChunk(file, module)
      : await uploadAdminFile(file, module);

  const ok = res?.success === true || res?.code === 200 || res?.code === 201;
  if (!ok) {
    throw new Error(res?.message ?? "上传失败");
  }

  const url = resolveUploadedUrl(res);
  if (!url) {
    throw new Error("上传成功但未返回文件地址");
  }
  return url;
}

export type RichTextUploadOptions = {
  module: string;
  allowSuffixes: Set<string>;
  maxSizeKB: number;
  label: string;
  chunkThresholdMB?: number;
};

export async function uploadRichTextMedia(
  file: File,
  options: RichTextUploadOptions
): Promise<string> {
  if (!validateSuffix(file, options.allowSuffixes, options.label)) {
    throw new Error("invalid suffix");
  }
  if (!validateSize(file, options.maxSizeKB, options.label)) {
    throw new Error("invalid size");
  }

  const chunkThresholdBytes =
    Math.max(1, options.chunkThresholdMB ?? 50) * 1024 * 1024;

  try {
    return await uploadFileToServer(file, options.module, chunkThresholdBytes);
  } catch (error: any) {
    const msg = String(error?.message ?? error ?? "上传失败");
    if (msg !== "invalid suffix" && msg !== "invalid size") {
      ElMessage.error(msg);
    }
    throw error;
  }
}

export function createRichTextImageUploader(
  module = RICH_TEXT_IMAGE_MODULE,
  maxSizeKB = 5120
) {
  return async (
    file: File,
    insertFn: (url: string, alt?: string, href?: string) => void
  ) => {
    try {
      const url = await uploadRichTextMedia(file, {
        module,
        allowSuffixes: IMAGE_SUFFIXES,
        maxSizeKB,
        label: "图片"
      });
      insertFn(url, file.name, url);
    } catch {
      /* 已在 uploadRichTextMedia 中提示 */
    }
  };
}

export function createRichTextVideoUploader(
  module = RICH_TEXT_VIDEO_MODULE,
  maxSizeKB = 204800
) {
  return async (
    file: File,
    insertFn: (url: string, poster?: string) => void
  ) => {
    try {
      const url = await uploadRichTextMedia(file, {
        module,
        allowSuffixes: VIDEO_SUFFIXES,
        maxSizeKB,
        label: "视频",
        chunkThresholdMB: 50
      });
      insertFn(url, "");
    } catch {
      /* 已在 uploadRichTextMedia 中提示 */
    }
  };
}
