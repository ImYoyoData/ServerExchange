<script setup lang="ts">
/**
 * DictTag 字典标签展示组件
 *
 * 用途：
 * - 用统一方式渲染“字典项展示文案 + 标签风格（tagType）”。
 * - 当 tagType = "default" 时按普通文本渲染；否则按 Element Plus 的 ElTag 渲染。
 *
 * tagType 规则（内置写死）：
 * - default
 * - primary|success|info|warning|danger + "_dark|_light|_plain"
 *   例如：primary_dark、success_light、warning_plain
 *
 * 渲染优先级：
 * 1) 传入 code + value：自动从字典项中匹配 label/tagType
 * 2) 传入 label + tagType：使用显式传参
 * 3) 都未命中时显示 fallback（默认 "--"）
 *
 * 使用示例：
 * - 直接传文案和类型：
 *   <DictTag label="已启用" tag-type="success_plain" />
 *
 * - 对接字典自动展示（推荐）：
 *   <DictTag code="sys_user_status" :value="row.status" />
 *
 * - default 文本展示：
 *   <DictTag label="普通文本" tag-type="default" />
 */
import { computed } from "vue";
import { ElTag } from "element-plus";
import { GetDict } from "@/hooks/dict";

type ElTagType = "primary" | "success" | "info" | "warning" | "danger";
type ElTagEffect = "dark" | "light" | "plain";

const DEFAULT_TAG_TYPE = "default";
const VALID_TAG_TYPES: ElTagType[] = [
  "primary",
  "success",
  "info",
  "warning",
  "danger"
];
const VALID_TAG_EFFECTS: ElTagEffect[] = ["dark", "light", "plain"];

const props = withDefaults(
  defineProps<{
    /** 字典编码（传了 code+value 时自动取 label 与 tagType） */
    code?: string | number;
    /** 字典值 */
    value?: unknown;
    /** 显示文案（优先级低于 code+value 命中结果） */
    label?: string;
    /** 直接指定 tagType（优先级低于字典项自带 tagType） */
    tagType?: string;
    /** 兜底文案 */
    fallback?: string;
  }>(),
  {
    code: undefined,
    value: undefined,
    label: "",
    tagType: DEFAULT_TAG_TYPE,
    fallback: "--"
  }
);

const dictHit = computed(() => {
  if (!props.code) return null;
  const dictValue =
    props.value === undefined || props.value === null
      ? ""
      : String(props.value);
  const flat = flattenDictTree(GetDict(props.code) || []);
  return flat.find(x => String(x.value ?? "") === dictValue) ?? null;
});

const text = computed(() => {
  const fromDict = String(dictHit.value?.label ?? "").trim();
  if (fromDict) return fromDict;
  const fromProp = String(props.label ?? "").trim();
  return fromProp || props.fallback;
});

const normalizedTagType = computed(() => {
  const raw = String(
    dictHit.value?.tagType ?? props.tagType ?? DEFAULT_TAG_TYPE
  )
    .trim()
    .toLowerCase();
  if (!raw) return DEFAULT_TAG_TYPE;
  return raw;
});

const shouldUseTag = computed(
  () => normalizedTagType.value !== DEFAULT_TAG_TYPE
);

const parsedTag = computed(() => {
  const [rawType, rawEffect] = normalizedTagType.value.split("_");
  const type = VALID_TAG_TYPES.includes(rawType as ElTagType)
    ? (rawType as ElTagType)
    : "info";
  const effect = VALID_TAG_EFFECTS.includes(rawEffect as ElTagEffect)
    ? (rawEffect as ElTagEffect)
    : "plain";
  return { type, effect };
});

function flattenDictTree(nodes: any[]): any[] {
  const result: any[] = [];
  const walk = (list: any[]) => {
    for (const node of list || []) {
      result.push(node);
      if (Array.isArray(node?.children) && node.children.length) {
        walk(node.children);
      }
    }
  };
  walk(nodes || []);
  return result;
}
</script>

<template>
  <span v-if="!shouldUseTag">{{ text }}</span>
  <ElTag v-else :type="parsedTag.type" :effect="parsedTag.effect">
    {{ text }}
  </ElTag>
</template>
