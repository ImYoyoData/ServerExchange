import Storage from "responsive-storage";
import { ref, type Ref } from "vue";
import { responsiveStorageNameSpace } from "@/config";
import { dictTrees } from "@/api/system";
import dictCode from "@/config/dictCodes";
import { getToken } from "@/utils/auth";

export type DictTreeNode = {
  value: string;
  label: string;
  children?: DictTreeNode[];
};

const dictTreeCachePrefix = "dictTree:";
const getDictTreeCacheKey = (code: string | number) =>
  `${dictTreeCachePrefix}${code}`;
const EMPTY_DICT_REF = ref<DictTreeNode[]>([]);
const dictRefMap = new Map<string, Ref<DictTreeNode[]>>();

function readDictFromCache(code: string | number): DictTreeNode[] {
  const nameSpace = responsiveStorageNameSpace() || "rs-";
  const cacheKey = getDictTreeCacheKey(code);
  return (Storage.getData(cacheKey, nameSpace) ?? []) as DictTreeNode[];
}

/**
 * 初始化字典树：把指定 codes 的树数据预加载进本地响应式缓存
 * 然后 `GetDict` 走同步读取缓存，不再返回 Promise。
 */
/** 清除本地字典树缓存（responsive-storage + 内存 ref） */
export function ClearDictLocalCache(codes?: Array<string | number>) {
  const nameSpace = responsiveStorageNameSpace() || "rs-";
  const codeSet = new Set<string>();
  if (codes?.length) {
    codes.forEach(code => codeSet.add(String(code)));
  } else {
    dictRefMap.forEach((_, code) => codeSet.add(code));
    dictCode.forEach(code => codeSet.add(String(code)));
  }

  for (const code of codeSet) {
    Storage.set(
      Storage._getStaticKey(nameSpace, getDictTreeCacheKey(code)),
      [] as unknown as string
    );
    const dictRef = dictRefMap.get(code);
    if (dictRef) dictRef.value = [];
  }
}

export async function InitDict(codes: Array<string | number> = dictCode) {
  if (!codes?.length) return;
  if (!getToken()?.accessToken) return;

  const nameSpace = responsiveStorageNameSpace() || "rs-";
  const uniqueCodes = Array.from(new Set(codes.map(code => String(code))));

  try {
    const res: any = await dictTrees(uniqueCodes);
    const data = res?.data ?? res;

    if (data && typeof data === "object") {
      uniqueCodes.forEach(code => {
        const treeList = (data as Record<string, Array<any>>)?.[code] ?? [];
        Storage.set(
          Storage._getStaticKey(nameSpace, getDictTreeCacheKey(code)),
          treeList as unknown as string
        );
        const dictRef = dictRefMap.get(code);
        if (dictRef) dictRef.value = treeList as DictTreeNode[];
      });
    }
  } catch (err) {
    // 预加载失败不阻断主流程：GetDict 仍会返回空数组
    console.warn("[InitDict] preload dict trees failed:", err);
  }
}

function getDictRef(code?: string | number): Ref<DictTreeNode[]> {
  if (code === undefined || code === null || code === "") return EMPTY_DICT_REF;
  const cacheCode = String(code);
  const existed = dictRefMap.get(cacheCode);
  if (existed) return existed;

  const dictRef = ref<DictTreeNode[]>(readDictFromCache(cacheCode));
  dictRefMap.set(cacheCode, dictRef);
  return dictRef;
}

function getDictRefCall(this: unknown, code?: string | number) {
  void this;
  return getDictValue(code);
}

/** 按编码读 ref 的当前值（供 Proxy / 调用形态使用） */
function getDictValue(code?: string | number): DictTreeNode[] {
  return getDictRef(code).value;
}

/**
 * `GetDict` 的类型：既可函数调用 `(code?) => DictTreeNode[]`，也可按字典编码做属性访问。
 */
export type GetDictType = ((code?: string | number) => DictTreeNode[]) &
  Record<string, DictTreeNode[]>;

/**
 * 同步读取字典树节点数组。数据须先由 {@link InitDict} 预载（有登录 token 时才会请求接口）。
 * 内部基于 Vue `ref`，在模板或 `setup` 中读取会自动收集依赖并随缓存更新，**无需再包 `computed(() => GetDict(...))`**。
 *
 * **推荐用法（按优先级，编写 / 生成代码时请遵守）：**
 *
 * 1. **`GetDict['xxx']`（最优先）**：方括号属性访问；**字面量或变量作键均可**（动态编码用 `GetDict[dictCode]`）。
 *    - 例：`GetDict['sys_message_type']`、`const code = 'sys_file_module'; GetDict[code]`
 *
 * 2. **`GetDict.xxx`（次之）**：仅当编码为**合法 JS 标识符**且**固定**时，图省事可用点号。
 *    - 例：`GetDict.sys_message_status`
 *
 * 3. **`GetDict('xxx')`（函数调用）**：与方括号一样**支持动态**，传入运行时得到的编码字符串/数字。
 *    - 例：`GetDict('sys_message_type')`、`GetDict(dynamicCode)`
 *
 * **注意：** 编码与函数原型同名（如 `toString`、`call`）或含非法标识符字符时，**禁用点号**，只用 **`GetDict['toString']`** 或 **`GetDict('toString')`**。
 *
 * @param code 调用形态下传入的字典编码；属性访问时由 Proxy 从属性名解析。
 * @returns `{ value, label, children? }[]`；未预载或失败时为 `[]`。
 *
 * @example
 * const list = GetDict["sys_message_status"];
 * // 或动态：GetDict[someCode]、GetDict(someCode)
 *
 * @example
 * // 不推荐：多余 computed（GetDict 已具备响应式）
 * // const opts = computed(() => GetDict.sys_message_status);
 */
export const GetDict: GetDictType = new Proxy(getDictRefCall, {
  apply(_target, _thisArg, argArray: [string | number | undefined]) {
    return getDictValue(argArray[0]);
  },
  get(target, prop, receiver) {
    if (typeof prop === "symbol") {
      return Reflect.get(target, prop, receiver);
    }
    const key = String(prop);
    if (key === "__proto__") {
      return Reflect.get(target, prop, receiver);
    }
    // length、name、call、toString 等走真实函数属性；否则把 key 当作字典编码
    if (key in target) {
      const v = Reflect.get(target, prop, receiver);
      return typeof v === "function" ? v.bind(target) : v;
    }
    return getDictValue(key);
  }
}) as GetDictType;

/** 字典树拍平为下拉选项（含子节点）通常不用这个 */
export function GetDictFlat(
  code?: string | number
): Array<{ value: string; label: string }> {
  const walk = (
    nodes: DictTreeNode[]
  ): Array<{ value: string; label: string }> => {
    const r: Array<{ value: string; label: string }> = [];
    for (const n of nodes || []) {
      r.push({
        value: String(n.value ?? ""),
        label: String(n.label ?? n.value ?? "")
      });
      if (n.children?.length) r.push(...walk(n.children));
    }
    return r;
  };
  return walk(getDictRef(code).value);
}

/** 按字典项 value 取展示文案 */
export function GetDictLabel(code: string | number, value: unknown): string {
  const vs = value === undefined || value === null ? "" : String(value);
  const hit = GetDictFlat(code).find(x => x.value === vs);
  return hit?.label ?? vs;
}

/**
 * 将字典项 value 解析为「是否已读」（用于 sys_message_status 与接口 status 布尔筛选）
 * 无法识别时返回 null
 */
export function parseDictValueAsReadFlag(v: unknown): boolean | null {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (/^(1|true|y|yes|read|readed)$/.test(s)) return true;
  if (/^(0|false|n|no|unread)$/.test(s)) return false;
  const n = Number(s);
  if (!Number.isNaN(n)) return n !== 0;
  return null;
}

/** 根据已读状态反查字典展示文案（用于表格列） */
export function GetDictLabelByReadFlag(
  code: string | number,
  read: boolean
): string {
  for (const o of GetDictFlat(code)) {
    const b = parseDictValueAsReadFlag(o.value);
    if (b === read) return o.label;
  }
  return read ? "已读" : "未读";
}
