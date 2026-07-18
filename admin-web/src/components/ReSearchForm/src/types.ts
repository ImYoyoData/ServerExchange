export interface SearchFormSelectOption {
  /**
   * 选项标签
   */
  label: string;
  /**
   * 选项值
   */
  value: string | number;
  /**
   * 选项 key
   */
  prop: string;
}
export interface SearchFormItemOptions {
  /**
   * 是否隐藏
   */
  hide?: boolean;
  /**
   * 表单项字段
   */
  prop?: string;
  /**
   * 默认值
   */
  defaultValue?: string | number | any[];
  /**
   * 输入框占位文本
   */
  placeholder?: string;
  /**
   * 是否可清空
   */
  clearable?: boolean;
  /**
   * 最大长度
   */
  maxlength?: number;
  /**
   * 最小长度
   */
  minlength?: number;
  /**
   * 是否多选
   */
  multiple?: boolean;
  /**
   * 是否可搜索
   */
  filterable?: boolean;
  /**
   * select 数据源
   */
  dataSourceKey?: string;
  /**
   * select option key
   */
  selectOptionKey?: SearchFormSelectOption;
  /**
   * 显示类型, 默认 【date】
   */
  dateType?: "year" | "month" | "date" | "dates" | "datetime";
  /**
   * 显示格式 默认 【YYYY-MM-DD】
   */
  format?: string;
  /**
   * 值格式 默认 【YYYY-MM-DD】
   */
  valueFormat?: string;
  /**
   *一个用来判断该日期是否被禁用的函数，接受一个 Date 对象作为参数。 应该返回一个 Boolean 值。
   */
  disabledDate?: (date: Date) => boolean;
  /**
   * 范围选择时开始日期的占位内容, 有效类型: 【date-cycle】
   */
  startPlaceholder?: string;
  /**
   * 范围选择时结束日期的占位内容, 有效类型: 【date-cycle】
   */
  endPlaceholder?: string;
  /**
   * 开始日期是否允许清理,有效类型: 【date-cycle】
   */
  startClearable?: boolean;
  /**
   * 开始日期是否允许清理,有效类型: 【date-cycle】
   */
  endClearable?: boolean;
  /**
   * 用来判断开始是否被禁用的函数,有效类型: 【date-cycle】
   */
  startDisabledDate?: (date: Date) => boolean;
  /**
   * 用来判断开始是否被禁用的函数,有效类型: 【date-cycle】
   */
  endDisabledDate?: (date: Date) => boolean;
}
export interface SearchFormItem {
  /**
   * 表单项标签
   */
  label: string;
  /**
   * 表单项类型
   */
  type: "input" | "select" | "date" | "date-cycle";
  /**
   * 可选项
   */
  options?: SearchFormItemOptions;
  /**
   * 是否隐藏
   */
  hide?: boolean;
}

export interface SearchFormItems extends Array<SearchFormItem> {}
