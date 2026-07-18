import type {
  GeneratedFile,
  GeneratorField,
  GeneratorTable,
  GeneratorTableSummary
} from "./types";
import { suggestClassName } from "./utils";

/** 解包 { data } 或直连数据 */
export function unwrapApiData(res: unknown): any {
  if (res == null) return null;
  if (
    typeof res === "object" &&
    res !== null &&
    "data" in res &&
    (res as { data: unknown }).data !== undefined
  ) {
    return (res as { data: unknown }).data;
  }
  return res;
}

export function extractTableList(raw: unknown): any[] {
  const d = unwrapApiData(raw);
  if (Array.isArray(d)) return d;
  if (
    d &&
    typeof d === "object" &&
    Array.isArray((d as { list: unknown }).list)
  ) {
    return (d as { list: any[] }).list;
  }
  if (
    d &&
    typeof d === "object" &&
    Array.isArray((d as { tables: unknown }).tables)
  ) {
    return (d as { tables: any[] }).tables;
  }
  return [];
}

export function rowToSummary(row: unknown): GeneratorTableSummary | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const tableName = String(r.tableName ?? r.name ?? "").trim();
  if (!tableName) return null;
  return {
    tableName,
    tableComment: String(r.tableComment ?? r.comment ?? r.table_comment ?? ""),
    className: r.className != null ? String(r.className) : undefined,
    moduleName: r.moduleName != null ? String(r.moduleName) : undefined
  };
}

const QUERY_OPS = new Set(["=", "<>", ">", ">=", "<", "<=", "between", "like"]);

const QUERY_CMPS = new Set(["input", "select", "radio", "checkbox", "date"]);

function normalizeQueryOperator(op: unknown): GeneratorField["queryOperator"] {
  const s = String(op ?? "=");
  return QUERY_OPS.has(s) ? (s as GeneratorField["queryOperator"]) : "=";
}

function normalizeQueryComponent(c: unknown): GeneratorField["queryComponent"] {
  const s = String(c ?? "input");
  return QUERY_CMPS.has(s) ? (s as GeneratorField["queryComponent"]) : "input";
}

function normalizeFormComponent(c: unknown): string {
  const s = String(c ?? "input");
  return s || "input";
}

function inferTsType(dbType: string): string {
  const t = (dbType || "").toLowerCase();
  if (t.includes("bigint") || (t.includes("int") && !t.includes("point"))) {
    return "number";
  }
  if (/decimal|numeric|float|double|real/.test(t)) return "number";
  if (t.includes("bool") || t === "bit(1)" || t === "bit") return "boolean";
  return "string";
}

export function normalizeField(f: unknown): GeneratorField {
  const x = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
  const name = String(x.name ?? "").trim();
  const dbType = String(x.dbType ?? x.columnType ?? x.type ?? "varchar");
  const len =
    x.length != null && x.length !== ""
      ? Number(x.length)
      : x.characterMaximumLength != null
        ? Number(x.characterMaximumLength)
        : undefined;
  return {
    name,
    dbType,
    tsType: String(x.tsType ?? "").trim() || inferTsType(dbType),
    length: Number.isFinite(len as number) ? (len as number) : undefined,
    comment: String(x.comment ?? x.columnComment ?? "").trim() || undefined,
    isInsert: !!x.isInsert,
    isUpdate: !!x.isUpdate,
    isList: x.isList !== false,
    isQuery: !!x.isQuery,
    isMultiSelect: !!x.isMultiSelect,
    queryOperator: normalizeQueryOperator(x.queryOperator),
    queryComponent: normalizeQueryComponent(x.queryComponent),
    formComponent: normalizeFormComponent(x.formComponent),
    dictCode:
      x.dictCode != null && String(x.dictCode) !== ""
        ? String(x.dictCode)
        : undefined
  };
}

/** code-table 无有效 fields 时走 columns */
export function isEmptyCodeTablePayload(d: unknown): boolean {
  if (d == null) return true;
  if (typeof d !== "object") return true;
  const fields = (d as { fields?: unknown }).fields;
  if (!Array.isArray(fields) || fields.length === 0) return true;
  return false;
}

export function mergeCodeTableToGeneratorTable(
  row: GeneratorTableSummary,
  code: Record<string, unknown>,
  defaultModule: (tableName: string) => string
): GeneratorTable {
  const key = row.tableName;
  const fields = (Array.isArray(code.fields) ? code.fields : []).map(
    normalizeField
  );
  return {
    tableName: String(code.tableName ?? key),
    tableComment: String(code.tableComment ?? row.tableComment ?? ""),
    className:
      String(code.className ?? row.className ?? "").trim() ||
      suggestClassName(key),
    moduleName:
      String(code.moduleName ?? row.moduleName ?? "").trim() ||
      defaultModule(key),
    fields
  };
}

export function extractColumnsArray(raw: unknown): any[] {
  const d = unwrapApiData(raw);
  if (Array.isArray(d)) return d;
  if (
    d &&
    typeof d === "object" &&
    Array.isArray((d as { list: unknown }).list)
  ) {
    return (d as { list: any[] }).list;
  }
  if (
    d &&
    typeof d === "object" &&
    Array.isArray((d as { columns: unknown }).columns)
  ) {
    return (d as { columns: any[] }).columns;
  }
  return [];
}

export function columnsRowToField(col: unknown): GeneratorField {
  const x = (col && typeof col === "object" ? col : {}) as Record<
    string,
    unknown
  >;
  const name = String(x.name ?? x.columnName ?? x.field ?? "").trim();
  const dbType = String(
    x.dbType ?? x.dataType ?? x.columnType ?? x.type ?? "varchar"
  );
  const isPk =
    x.primaryKey === true ||
    x.columnKey === "PRI" ||
    x.key === "PRI" ||
    name.toLowerCase() === "id";
  const len =
    x.length != null && x.length !== ""
      ? Number(x.length)
      : x.characterMaximumLength != null
        ? Number(x.characterMaximumLength)
        : x.maxLength != null
          ? Number(x.maxLength)
          : undefined;
  return {
    name,
    dbType,
    tsType: String(x.tsType ?? "").trim() || inferTsType(dbType),
    length: Number.isFinite(len as number) ? (len as number) : undefined,
    comment: String(x.comment ?? x.columnComment ?? "").trim() || undefined,
    isInsert: !isPk,
    isUpdate: !isPk,
    isList: true,
    isQuery: false,
    isMultiSelect: false,
    queryOperator: "=",
    queryComponent: "input",
    formComponent: "input",
    dictCode: undefined
  };
}

export function buildTableFromColumns(
  row: GeneratorTableSummary,
  columns: unknown[],
  defaultModule: (tableName: string) => string
): GeneratorTable {
  const key = row.tableName;
  const fields = columns.map(columnsRowToField).filter(f => f.name);
  return {
    tableName: key,
    tableComment: row.tableComment,
    className: (row.className ?? "").trim() || suggestClassName(key),
    moduleName: (row.moduleName ?? "").trim() || defaultModule(key),
    fields
  };
}

export function toCodeTablePostBody(table: GeneratorTable) {
  return {
    tableName: table.tableName,
    tableComment: table.tableComment ?? "",
    className: table.className,
    moduleName: table.moduleName,
    fields: table.fields.map(f => ({
      name: f.name,
      dbType: f.dbType,
      tsType: f.tsType,
      length: f.length != null && Number.isFinite(f.length) ? f.length : null,
      comment: f.comment ?? "",
      isInsert: !!f.isInsert,
      isUpdate: !!f.isUpdate,
      isList: !!f.isList,
      isQuery: !!f.isQuery,
      isMultiSelect: !!f.isMultiSelect,
      queryOperator: f.queryOperator,
      queryComponent: f.queryComponent,
      formComponent: f.formComponent ?? "input",
      dictCode: f.dictCode ?? ""
    }))
  };
}

/** 业务层 success === false 时提示并返回 true */
export function isBizFailure(res: unknown): boolean {
  if (!res || typeof res !== "object") return false;
  const r = res as { success?: boolean; code?: number };
  if (r.success === false) return true;
  if (typeof r.code === "number" && r.code !== 0 && r.code !== 200) {
    return true;
  }
  return false;
}

export function bizMessage(res: unknown): string {
  if (!res || typeof res !== "object") return "操作失败";
  return String((res as { message?: string }).message ?? "操作失败");
}

/** 解析 GET templates 的多种返回结构，得到下拉选项 */
export function extractTemplateOptions(
  raw: unknown
): Array<{ value: string; label: string }> {
  const d = unwrapApiData(raw);
  let arr: unknown[] = [];
  if (Array.isArray(d)) arr = d;
  else if (
    d &&
    typeof d === "object" &&
    Array.isArray((d as { list: unknown }).list)
  ) {
    arr = (d as { list: unknown[] }).list;
  } else if (
    d &&
    typeof d === "object" &&
    Array.isArray((d as { templates: unknown }).templates)
  ) {
    arr = (d as { templates: unknown[] }).templates;
  } else if (
    d &&
    typeof d === "object" &&
    Array.isArray((d as { names: unknown }).names)
  ) {
    /** 后端常见：{ names: string[], rootHint?: string } */
    arr = (d as { names: unknown[] }).names;
  }
  const out: Array<{ value: string; label: string }> = [];
  for (const item of arr) {
    if (typeof item === "string") {
      const v = item.trim();
      if (v) out.push({ value: v, label: v });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const value = String(
      o.templateName ?? o.name ?? o.value ?? o.code ?? o.id ?? ""
    ).trim();
    if (!value) continue;
    const label = String(
      o.label ?? o.title ?? o.description ?? o.templateName ?? o.name ?? value
    ).trim();
    out.push({ value, label: label || value });
  }
  return out;
}

export type ResolvedGeneratePayload =
  | { kind: "zip"; zipBlob: Blob }
  | { kind: "files"; files: GeneratedFile[] }
  | { kind: "error"; message: string };

function base64ToBytes(b64: string): Uint8Array {
  const s = b64
    .replace(/\s/g, "")
    .replace(/^data:application\/zip;base64,/i, "")
    .replace(/^data:.*?;base64,/i, "");
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function normalizeFileListFromJson(arr: unknown[]): GeneratedFile[] {
  const out: GeneratedFile[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const path = String(o.path ?? o.name ?? o.relativePath ?? "").trim();
    const code = String(o.content ?? o.code ?? o.source ?? "");
    if (path) out.push({ path, code });
  }
  return out;
}

/**
 * 解析 POST /generator/generate 的响应体（Blob）：
 * - 标准二进制 zip（PK 头）
 * - 或统一 JSON：成功时从 data 取 base64 zip / 文件列表
 *
 * 注意：成功响应里也有 message（如「操作成功」），不能当作错误。
 */
export async function resolveGeneratorGenerateResponse(
  blob: Blob
): Promise<ResolvedGeneratePayload> {
  if (!blob || blob.size === 0) {
    return { kind: "error", message: "响应为空" };
  }

  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  const isZip =
    head.length >= 4 &&
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    (head[2] === 0x03 ||
      head[2] === 0x05 ||
      head[2] === 0x07 ||
      head[2] === 0x08);

  if (isZip) {
    return { kind: "zip", zipBlob: blob };
  }

  let text = await blob.text();
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = text.trimStart();
  if (!text.startsWith("{")) {
    return { kind: "zip", zipBlob: blob };
  }

  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { kind: "error", message: "响应既不是 zip 也不是合法 JSON" };
  }

  const okBiz = j.success === true || j.code === 200;
  if (!okBiz) {
    return { kind: "error", message: String(j.message ?? "生成失败") };
  }

  const data = j.data;

  if (typeof data === "string" && data.length > 0) {
    try {
      const bin = base64ToBytes(data);
      const copy = new Uint8Array(bin.length);
      copy.set(bin);
      return {
        kind: "zip",
        zipBlob: new Blob([copy], { type: "application/zip" })
      };
    } catch {
      return {
        kind: "error",
        message: "接口返回 JSON 成功，但 data 不是有效的 base64 zip"
      };
    }
  }

  if (Array.isArray(data)) {
    const files = normalizeFileListFromJson(data);
    if (files.length) return { kind: "files", files };
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    const nested = o.files ?? o.list ?? o.items;
    if (Array.isArray(nested)) {
      const files = normalizeFileListFromJson(nested);
      if (files.length) return { kind: "files", files };
    }
    const b64 = o.base64 ?? o.zipBase64 ?? o.zip ?? o.content;
    if (typeof b64 === "string" && b64.length > 0) {
      try {
        const bin = base64ToBytes(b64);
        const copy = new Uint8Array(bin.length);
        copy.set(bin);
        return {
          kind: "zip",
          zipBlob: new Blob([copy], { type: "application/zip" })
        };
      } catch {
        /* fall */
      }
    }
  }

  return {
    kind: "error",
    message:
      "生成成功但未解析到 zip 或文件列表（请确认 data 为 base64 或 files 数组）"
  };
}
