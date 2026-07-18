import type { QueryComponent } from "./types";

function upperFirst(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function queryComponentLabel(v: QueryComponent): string {
  const m: Record<QueryComponent, string> = {
    input: "输入框",
    select: "下拉框",
    radio: "单选",
    checkbox: "多选",
    date: "日期"
  };
  return m[v];
}

export function buildFileTitle(path: string): string {
  const seg = path.split("/");
  return seg[seg.length - 1] || path;
}

export function suggestClassName(tableName: string): string {
  return tableName.split("_").filter(Boolean).map(upperFirst).join("");
}
