import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 根据路径选 highlight.js 语言（.vue 用 xml 近似 SFC） */
export function highlightByFilePath(code: string, path: string): string {
  if (!code) return "";
  const lower = path.toLowerCase();
  let language = "typescript";
  if (lower.endsWith(".vue")) language = "xml";
  else if (lower.endsWith(".json")) language = "json";
  else if (lower.endsWith(".js") || lower.endsWith(".cjs") || lower.endsWith(".mjs"))
    language = "javascript";
  else if (lower.endsWith(".ts") || lower.endsWith(".tsx")) language = "typescript";

  try {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(code);
  }
}
