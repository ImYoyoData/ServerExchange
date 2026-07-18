/** 与前端/生成器约定一致（校验与响应结构） */

export const QUERY_OPERATORS = [
  '=',
  '<>',
  '>',
  '>=',
  '<',
  '<=',
  'between',
  'like',
] as const;

export type QueryOperator = (typeof QUERY_OPERATORS)[number];

export const QUERY_COMPONENTS = [
  'input',
  'select',
  'radio',
  'checkbox',
  'date',
] as const;

export type QueryComponent = (typeof QUERY_COMPONENTS)[number];

export type GeneratorField = {
  name: string;
  dbType: string;
  tsType: string;
  /** 主键列；未设时模板侧常以 name==='id' 兜底 */
  isPrimary?: boolean;
  /** 可空；DTO zod 等会参考 */
  isNullable?: boolean;
  length?: number;
  comment?: string;
  isInsert: boolean;
  isUpdate: boolean;
  isList: boolean;
  isQuery: boolean;
  /** 为 true 时 DTO/前端为数组；查询条件用 IN（query_component=checkbox 的查询默认按多值数组处理） */
  isMultiSelect?: boolean;
  queryOperator: QueryOperator;
  queryComponent: QueryComponent;
  /** 表单组件；与 queryOperator=between 且为 date 时 → 日期范围查询（Begin/End） */
  formComponent: QueryComponent;
  dictCode?: string;
};

export type GeneratorTable = {
  tableName: string;
  tableComment: string;
  className: string;
  moduleName: string;
  /** 当前保存的模板包名（仅当有 code-table 行时可能有值） */
  templateName?: string;
  fields: GeneratorField[];
  /**
   * 前端 @/api 下生成文件相对路径前缀（无首尾 /），供 baseUrlApi。
   * 例：文件将写到 `api/admin/system/user.ts` → `admin/system/user`。
   * 未传时模板回退使用 moduleName。
   */
  apiPathPrefix?: string;
};

/** 表列表项（无字段，对应「列出表名」） */
export type GeneratorTableSummary = {
  tableName: string;
  tableComment: string;
  className?: string;
  moduleName?: string;
  templateName?: string;
};

export type TemplateKind = 'classic' | 'admin-pro';

export type GeneratedFileCategory = 'nest-backend' | 'web-ts' | 'web-vue';

export type GeneratedFile = {
  /** 相对生成根目录的建议路径（如 dto/xxx.dto.ts、web/api/xxx.ts） */
  path: string;
  code: string;
  /** nest 后端 ts / 前端 api ts / 前端 vue */
  category: GeneratedFileCategory;
};
