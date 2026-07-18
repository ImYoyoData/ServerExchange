import { http } from "@/utils/http";
import { baseUrlApi } from "./utils";

type Result = {
  code: number;
  success: boolean;
  message: string;
  data?: Array<any>;
};

type ResultTable = {
  code: number;
  message: string;
  success: boolean;
  data?: {
    /** 列表数据 */
    list: Array<any>;
    /** 总条目数 */
    total?: number;
    /** 每页显示条目个数 */
    pageSize?: number;
    /** 当前页数 */
    currentPage?: number;
  };
};

/** 获取系统管理-用户管理列表 */
export const getUserList = (params?: object) => {
  return http.request<ResultTable>("get", baseUrlApi("admin/user"), { params });
};

/** 系统管理-用户管理-获取所有角色列表 */
export const getAllRoleList = () => {
  return http.request<Result>("get", baseUrlApi(`admin/listAllRole`));
};

/** 系统管理-用户管理-根据userId，获取对应角色id列表（userId：用户id） */
export const getRoleIds = (userId?: number) => {
  return http.request<Result>("get", baseUrlApi(`admin/listRoleIds/${userId}`));
};

// 系统管理-用户管理-添加用户
export const addUser = (data?: object) => {
  return http.request<Result>("post", baseUrlApi("admin/addUser"), {
    data
  });
};

// 系统管理-用户管理-修改用户
export const updateUser = (data?: object) => {
  return http.request<Result>("put", baseUrlApi("admin/updateUser"), {
    data
  });
};

// 系统管理-用户管理-批量删除用户
export const deleteUsers = (ids: number[]) => {
  return http.request<Result>("post", baseUrlApi(`admin/deleteUsers`), {
    data: ids
  });
};

// 系统管理-用户管理-分配角色
export const assignRole = (userId: number, roleIds?: object) => {
  return http.request<Result>("put", baseUrlApi(`admin/assignRole/${userId}`), {
    data: roleIds
  });
};

// 系统管理-用户管理-重置用户密码
export const resetPassword = (id: number, password: string) => {
  return http.request<Result>("put", baseUrlApi(`admin/resetPassword/${id}`), {
    data: { password }
  });
};

/** 获取系统管理-菜单管理列表 */
export const getMenuList = () => {
  return http.request<Result>("get", baseUrlApi("admin/menu"));
};

export const addMenu = (data?: object) => {
  return http.request<Result>("post", baseUrlApi("admin/menu"), {
    data
  });
};

export const updateMenu = (data?: object) => {
  return http.request<Result>("put", baseUrlApi("admin/menu"), {
    data
  });
};

export const deleteMenu = (id: number) => {
  return http.request<Result>("delete", baseUrlApi(`admin/menu/${id}`));
};

/** 获取系统管理-角色管理列表 */
export const getRoleList = (params?: object) => {
  return http.request<ResultTable>("get", baseUrlApi(`admin/role`), { params });
};

export const addRole = (data?: object) => {
  return http.request<Result>("post", baseUrlApi(`admin/role`), {
    data
  });
};

export const updateRole = (data?: object) => {
  return http.request<Result>("put", baseUrlApi(`admin/role`), {
    data
  });
};

export const deleteRole = (id: number) => {
  return http.request<Result>("delete", baseUrlApi(`admin/role/${id}`));
};

/** 获取角色管理-权限-菜单权限 */
export const getRoleMenu = () => {
  return http.request<Result>("get", baseUrlApi(`admin/role/roleMenu`));
};

/** 获取角色管理-权限-菜单权限-根据角色 id 查对应菜单 */
export const getRoleMenuIds = (id: number) => {
  return http.request<Result>(
    "get",
    baseUrlApi(`admin/role/roleMenuIds/${id}`)
  );
};

// /** 角色管理-权限-菜单权限-更新角色菜单权限 */
export const updateRoleMenu = (id: number, data?: object) => {
  return http.request<Result>(
    "put",
    baseUrlApi(`admin/role/roleMenuIds/${id}`),
    {
      data
    }
  );
};

// 字典管理相关
/**
 * 字典分页查询
 * @param query .
 * @returns .
 */
export function pageDict(params?: any) {
  return http.request<Result>("get", baseUrlApi(`admin/dict/page`), { params });
}

/**
 * 字典列表
 * @param query .
 * @returns
 */
export function listDict(params?: any) {
  return http.request<Result>("get", baseUrlApi(`admin/dict`), { params });
}

/**
 * 字典树（用于级联/下拉树选择）
 * @param code 字典编码（后端按需使用）
 */
export function getDictTree(code?: string | number) {
  return http.request<Result>("get", baseUrlApi(`admin/dict/tree`), {
    params: {
      code
    }
  });
}

/**
 * 获取字典树（批量预加载）
 * @param codes 字典编码列表
 */
export function dictTrees(codes: Array<string | number>) {
  // 后端返回格式示例：{ "aa": [], "bb": [] }
  return http.request<Record<string, Array<any>>>(
    "post",
    baseUrlApi(`admin/dict/trees`),
    {
      data: { codes }
    }
  );
}

/**
 * 字典保存
 * @param data .
 * @returns .
 */
export function saveDict(data: any) {
  return http.request<Result>("post", baseUrlApi(`admin/dict`), { data });
}

/**
 * 字典更新
 * @param data .
 * @returns .
 */
export function updateDict(data: any) {
  return http.request<Result>("put", baseUrlApi(`admin/dict`), { data });
}

/**
 * 字典删除
 * @param id .
 * @returns .
 */
export function delDict(id: string) {
  return http.request<Result>("delete", baseUrlApi(`admin/dict/${id}`));
}

/** 清除字典树 Redis 缓存 */
export function clearDictCache() {
  return http.request<Result>("post", baseUrlApi("admin/dict/cache/clear"));
}

/**
 * 字典项分页查询
 *
 * @param query .
 * @returns
 */
export function pageDictItem(params?: any) {
  return http.request<Result>("get", baseUrlApi(`admin/dict/item/page`), {
    params
  });
}

/**
 * 字典项列表
 *
 * @param query .
 * @returns
 */
export function listDictItem(params?: any) {
  return http.request<Result>("get", baseUrlApi(`admin/dict/item`), { params });
}

/**
 * 字典项保存
 *
 * @param data .
 * @returns
 */
export function saveDictItem(data: any) {
  return http.request<Result>("post", baseUrlApi(`admin/dict/item`), { data });
}

/**
 * 字典项更新
 *
 * @param data .
 * @returns
 */
export function updateDictItem(data: any) {
  return http.request<Result>("put", baseUrlApi(`admin/dict/item`), { data });
}

/**
 * 字典项删除
 *
 * @param id .
 * @returns
 */
export function delDictItem(id: string) {
  return http.request<Result>("delete", baseUrlApi(`admin/dict/item/${id}`));
}
