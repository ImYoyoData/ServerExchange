import JSZip from "jszip";
import type { GeneratedFile } from "./types";

const TEXT_EXT =
  /^(vue|ts|tsx|js|jsx|json|md|mjs|cjs|txt|scss|css|less|html|htm|xml|yml|yaml|env|sh|gitignore)$/i;

/**
 * 将后端 generate 返回的 zip（Blob）解压为预览用文本文件列表。
 */
export async function zipBlobToGeneratedFiles(
  blob: Blob
): Promise<GeneratedFile[]> {
  const zip = await JSZip.loadAsync(blob);
  const entries: Array<{ path: string; zipEntry: JSZip.JSZipObject }> = [];
  zip.forEach((relPath, zipEntry) => {
    if (zipEntry.dir) return;
    entries.push({ path: relPath.replace(/\\/g, "/"), zipEntry });
  });
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const out: GeneratedFile[] = [];
  for (const { path, zipEntry } of entries) {
    const ext = path.includes(".") ? (path.split(".").pop() ?? "") : "";
    const asText = !ext || TEXT_EXT.test(ext);
    let code: string;
    if (asText) {
      try {
        code = await zipEntry.async("string");
      } catch {
        code = `/* 无法解码为文本: ${path} */\n`;
      }
    } else {
      code = `/* 非文本类型，已省略内容 (${path}) */\n`;
    }
    out.push({ path, code });
  }
  return out;
}

/** 将文件列表打成 zip，供「生成下载」在接口返回 JSON 文件列表时使用 */
export async function generatedFilesToZipBlob(
  files: GeneratedFile[]
): Promise<Blob> {
  const zip = new JSZip();
  for (const f of files) {
    const p = f.path.replace(/^\/+/, "");
    if (p) zip.file(p, f.code);
  }
  return zip.generateAsync({ type: "blob" });
}
