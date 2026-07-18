import { http } from "@/utils/http";
import { baseUrlApi } from "./utils";

type Result = {
  code?: number;
  success?: boolean;
  message?: string;
  data?: any;
};

type ResultTable = {
  code?: number;
  success?: boolean;
  message?: string;
  data?: {
    list?: Array<any>;
    total?: number;
    pageSize?: number;
    currentPage?: number;
  };
};

export function pageAdminFile(params?: {
  page?: number;
  pageSize?: number;
  fileName?: string;
  fileType?: string;
  module?: string;
  fileSizeMin?: number;
  fileSizeMax?: number;
}) {
  return http.request<ResultTable>("get", baseUrlApi("admin/file/page"), {
    params
  });
}

export function removeAdminFile(
  id: string | number,
  params?: { removeDiskFile?: boolean }
) {
  return http.request<Result>("delete", baseUrlApi(`admin/file/${id}`), {
    params
  });
}

export function removeAdminFileBatch(data: {
  ids: Array<string | number>;
  removeDiskFile?: boolean;
}) {
  return http.request<Result>("delete", baseUrlApi("admin/file/batch"), {
    data
  });
}

export function uploadAdminFile(file: File, module?: string) {
  const formData = new FormData();
  formData.append("file", file);
  const mod = String(module ?? "").trim();
  if (mod) {
    formData.append("module", mod);
  }
  return http.request<Result>("post", baseUrlApi("admin/file/upload"), {
    data: formData,
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
}

export function initChunkUpload(data: object) {
  return http.request<Result>("post", baseUrlApi("admin/file/chunk/init"), {
    data
  });
}

export function uploadChunk(
  fileHash: string,
  index: string | number,
  data: FormData | object
) {
  return http.request<Result>(
    "post",
    baseUrlApi(`admin/file/chunk/${fileHash}/${index}`),
    {
      data,
      ...(data instanceof FormData
        ? {
            headers: {
              "Content-Type": "multipart/form-data"
            }
          }
        : {})
    }
  );
}

export function mergeChunkUpload(data: object) {
  return http.request<Result>("post", baseUrlApi("admin/file/chunk/merge"), {
    data
  });
}
