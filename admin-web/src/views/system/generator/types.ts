export type QueryOperator =
  | "="
  | "<>"
  | ">"
  | ">="
  | "<"
  | "<="
  | "between"
  | "like";

export type QueryComponent = "input" | "select" | "radio" | "checkbox" | "date";

export type GeneratorField = {
  name: string;
  dbType: string;
  tsType: string;
  length?: number;
  comment?: string;
  isInsert: boolean;
  isUpdate: boolean;
  isList: boolean;
  isQuery: boolean;
  /** 查询条件是否多选（与后端 isMultiSelect 对齐） */
  isMultiSelect?: boolean;
  queryOperator: QueryOperator;
  queryComponent: QueryComponent;
  /** 表单组件（后端字段，默认 input） */
  formComponent?: string;
  dictCode?: string;
};

export type GeneratorTable = {
  tableName: string;
  tableComment: string;
  className: string;
  moduleName: string;
  fields: GeneratorField[];
};

/** 接口1：表列表项（无字段，对应「列出表名」） */
export type GeneratorTableSummary = {
  tableName: string;
  tableComment: string;
  className?: string;
  moduleName?: string;
};

export type GeneratedFile = {
  path: string;
  code: string;
};
