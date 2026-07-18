export const queryOperatorOptions = [
  { label: "等于（=）", value: "=" },
  { label: "不等于（<>）", value: "<>" },
  { label: "大于（>）", value: ">" },
  { label: "大于等于（>=）", value: ">=" },
  { label: "小于（<）", value: "<" },
  { label: "小于等于（<=）", value: "<=" },
  { label: "范围（between）", value: "between" },
  { label: "包含（like）", value: "like" }
] as const;

export const queryComponentOptions = [
  { label: "输入框", value: "input" },
  { label: "下拉框", value: "select" },
  { label: "单选", value: "radio" },
  { label: "多选", value: "checkbox" },
  { label: "日期", value: "date" }
] as const;
