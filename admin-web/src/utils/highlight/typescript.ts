import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";

hljs.registerLanguage("typescript", typescript);

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 仅注册 typescript，体积小；失败时退回纯文本转义 */
export function highlightTypeScript(code: string): string {
  if (!code) return "";
  try {
    return hljs.highlight(code, {
      language: "typescript",
      ignoreIllegals: true
    }).value;
  } catch {
    return escapeHtml(code);
  }
}
