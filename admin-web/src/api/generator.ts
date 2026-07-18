import { http } from "@/utils/http";
import { baseUrlApi } from "./utils";
import { formatToken, getToken } from "@/utils/auth";

export type TypeormEntityStreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-start"; toolName: string }
  | {
      type: "ask";
      question: string;
      hint?: string;
      options?: Array<{ id: string; label: string }>;
    }
  | {
      type: "web-info";
      toolName: string;
      ok: boolean;
      title?: string;
      url?: string;
      summary: string;
    }
  | {
      type: "entity";
      code: string;
      validationReason?: string;
      attempts?: number;
    }
  | {
      type: "done";
      kind: "chat" | "entity";
      message?: string;
      code?: string;
      validationReason?: string;
      attempts?: number;
    }
  | { type: "error"; message: string };

/** TypeORM Entity AI 生成（对话） */
export function postTypeormEntityAgent(data: {
  message: string;
  userContext: string;
}) {
  /** AI 生成耗时较长，单独延长超时（默认 10s 不够） */
  const timeoutMs = 5 * 60 * 1000;
  return http.request<any>("post", baseUrlApi("admin/agent/typeorm-entity"), {
    data,
    timeout: timeoutMs
  });
}

/** TypeORM Entity AI 流式生成（SSE） */
export async function streamTypeormEntityAgent(
  data: { message: string; userContext: string },
  onEvent: (event: TypeormEntityStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const tokenInfo = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream"
  };
  if (tokenInfo?.accessToken) {
    headers.Authorization = formatToken(tokenInfo.accessToken);
  }

  const res = await fetch(baseUrlApi("admin/agent/typeorm-entity/stream"), {
    method: "POST",
    headers,
    body: JSON.stringify(data),
    signal
  });

  if (!res.ok) {
    let errMsg = res.statusText || "请求失败";
    try {
      const json = await res.json();
      errMsg = String(json?.message || json?.data?.message || errMsg);
    } catch {
      /* ignore */
    }
    throw new Error(errMsg);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("浏览器不支持流式响应");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        onEvent(JSON.parse(payload) as TypeormEntityStreamEvent);
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
}

/** 将内容写入项目源码路径（相对路径，由后端解析） */
export function saveSrcFile(data: { relativePath: string; content: string }) {
  return http.request<any>("post", baseUrlApi("admin/utils/save-src-file"), {
    data
  });
}

/** 列出目录；可选 fileName，有则 isExist 表示「目录 + 该文件」是否存在 */
export function getSrcList(path: string, fileName?: string) {
  return http.request<any>("get", baseUrlApi("admin/utils/src-list"), {
    params: {
      path: path || "/",
      ...(fileName ? { fileName } : {})
    }
  });
}

// ---------------------------------------------------------------------------
// 代码生成器（表 / 已存配置 / 列元数据）
// ---------------------------------------------------------------------------

/** 数据表列表（无字段） */
export function getGeneratorTables(params?: { keyword?: string }) {
  return http.request<any>("get", baseUrlApi("admin/generator/tables"), {
    params
  });
}

/**
 * 获取已保存的生成配置（含 fields）。
 * 返回 null / 空 fields 时需再调 getGeneratorColumns 拼装默认配置。
 */
export function getGeneratorCodeTable(table: string | number) {
  return http.request<any>("get", baseUrlApi("admin/generator/code-table"), {
    params: { table }
  });
}

/** 表列元数据（code-table 无配置时使用） */
export function getGeneratorColumns(table: string | number) {
  return http.request<any>("get", baseUrlApi("admin/generator/columns"), {
    params: { table }
  });
}

/** 保存生成配置 */
export function postGeneratorCodeTable(data: object) {
  return http.request<any>("post", baseUrlApi("admin/generator/code-table"), {
    data
  });
}

/** 后端代码生成器可用模板列表 */
export function getGeneratorTemplates() {
  return http.request<any>("get", baseUrlApi("admin/generator/templates"));
}

export type GeneratorGenerateBody = {
  templateName: string;
  tableName: string;
  apiPathPrefix: string;
};

/**
 * 按模板生成代码包（通常为 zip 二进制）。
 * 失败时走 HTTP 错误拦截；若后端以 200 + JSON 表示错误，需在业务里解析 Blob。
 */
export function postGeneratorGenerate(data: GeneratorGenerateBody) {
  const timeoutMs = 5 * 60 * 1000;
  return http.request<Blob>("post", baseUrlApi("admin/generator/generate"), {
    data,
    responseType: "blob",
    timeout: timeoutMs
  });
}
