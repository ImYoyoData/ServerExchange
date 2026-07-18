<!--
  ScanInput 组件说明
  作者：雷强

  组件定位：
  - 专门为扫码场景设计的编辑框（输入组件）
  - 主要用于稳定接收扫码枪快速输入的英文/数字内容

  解决的问题：
  - 在扫码过程中，中文输入法可能触发联想或组合输入
  - 这会导致扫码内容中的英文字母出现异常（丢字、错字、顺序异常等）
  - 本组件通过扫码输入处理流程，降低输入法干扰，保证扫码结果稳定

  使用教程（最小示例）：
  1) 在页面中引入组件并使用 v-model 绑定扫码值
  2) 监听 @scan 事件接收一次完整扫码结果
  3) 可按业务配置结束键（endKeys）、扫码后是否清空（clearOnScan）、自动聚焦（autofocus）

  示例：
  <ScanInput
    v-model="scanCode"
    :end-keys="['Enter']"
    autofocus
    placeholder="请扫码"
    @scan="handleScan"
  />

  const scanCode = ref('');
  const handleScan = (value: string) => {
    // value 为一次完整扫码内容
    console.log('扫码结果：', value);
  };
-->
<script setup lang="ts">
import {
  computed,
  mergeProps,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  useAttrs,
  type StyleValue
} from "vue";
import { Close } from '@element-plus/icons-vue'

defineOptions({
  name: "ScanInput",
  inheritAttrs: false
});

const props = withDefaults(
  defineProps<{
    /** 结束一次扫码的按键，默认 Enter */
    endKeys?: string[];
    /** 触发 scan 后是否清空 */
    clearOnScan?: boolean;
    placeholder?: string;
    /**
     * 根容器额外 class（与父级透传的 class 会合并）。
     * 若透传 class 在构建中未进 attrs，可改用此项写 Tailwind。
     */
    wrapperClass?: unknown;
    /** 根容器额外 style */
    wrapperStyle?: StyleValue;
    /** placeholder 字色（任意合法 CSS 颜色），写入 --scan-input-placeholder-color */
    placeholderColor?: string;
    /** 挂载后自动聚焦 */
    autofocus?: boolean;
  }>(),
  {
    endKeys: () => ["Enter"],
    clearOnScan: false,
    placeholder: "",
    autofocus: false
  }
);

const modelValue = defineModel<string>({ default: "" });

const emit = defineEmits<{
  scan: [value: string];
}>();

const attrs = useAttrs();

/** 父级透传 + wrapper：同时挂到根与内部 input，避免 bg/text 只在外层、真看见的是 input 导致「不生效」 */
const passedVisualAttrs = computed(() =>
  mergeProps(
    {
      class: attrs.class as unknown,
      style: attrs.style as StyleValue | undefined
    },
    {
      class: props.wrapperClass as unknown,
      style: props.wrapperStyle
    }
  )
);

const rootAttrs = computed(() =>
  mergeProps({ class: "scan-input" }, passedVisualAttrs.value)
);

/** 除 class/style 外给 input（id、name、data-*、aria-* 等） */
const inputAttrs = computed(() => {
  const {
    class: _c,
    style: _s,
    ...rest
  } = attrs as Record<string, unknown> & {
    class?: unknown;
    style?: unknown;
  };
  return rest;
});

/** 合并透传 class/style 与其余属性，避免模板重复 v-bind */
const inputBind = computed(() =>
  mergeProps(
    passedVisualAttrs.value,
    inputAttrs.value,
    props.placeholderColor
      ? {
        style: {
          "--scan-input-placeholder-color": props.placeholderColor
        } as Record<string, string>
      }
      : {}
  )
);

const rootRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

// 模拟光标位置：在 modelValue 内的插入/删除下标
const cursorPos = ref(0);
// 自定义光标相对输入框左侧的像素位置
const cursorLeft = ref(0);
// 仅在聚焦时显示光标
const cursorVisible = ref(false);

let measureCtx: CanvasRenderingContext2D | null = null;
function getTextWidth(text: string): number {
  const el = inputRef.value;
  if (!el) return 0;
  if (!measureCtx) {
    const canvas = document.createElement("canvas");
    measureCtx = canvas.getContext("2d");
  }
  if (!measureCtx) return 0;
  const style = getComputedStyle(el);
  measureCtx.font = style.font;
  return measureCtx.measureText(text).width;
}

function isFocusInside(): boolean {
  const root = rootRef.value;
  const ae = document.activeElement;
  return !!(root && ae && root.contains(ae));
}

async function moveCaretToEnd() {
  await nextTick();
  const el = inputRef.value;
  if (!el) return;
  const len = modelValue.value.length;
  // cursorPos 需始终保持在字符串边界内
  cursorPos.value = Math.max(0, Math.min(cursorPos.value, len));
  const pos = cursorPos.value;
  try {
    el.setSelectionRange(pos, pos);
  } catch {
    /* ignore */
  }

  // 根据光标位置计算宽度，并尽量让光标可见（横向滚动）
  const before = modelValue.value.slice(0, pos);
  const w = getTextWidth(before);

  const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
  const visibleStart = el.scrollLeft;
  const visibleEnd = el.scrollLeft + el.clientWidth;
  if (w < visibleStart) {
    el.scrollLeft = Math.max(0, Math.min(w, maxScrollLeft));
  } else if (w > visibleEnd) {
    const target = Math.max(0, w - el.clientWidth + 1);
    el.scrollLeft = Math.max(0, Math.min(target, maxScrollLeft));
  }

  // 光标覆盖层定位：border + padding + (内容宽度 - 滚动距离)
  const style = getComputedStyle(el);
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const paddingRight = parseFloat(style.paddingRight) || 0;
  const borderLeft = parseFloat(style.borderLeftWidth) || 0;
  const borderRight = parseFloat(style.borderRightWidth) || 0;
  const xInView = w - el.scrollLeft;
  const cursorMin = borderLeft + paddingLeft;
  const visibleContentWidth = Math.max(0, el.clientWidth - borderLeft - borderRight - paddingLeft - paddingRight);
  const cursorMax = cursorMin + visibleContentWidth;
  cursorLeft.value = Math.max(cursorMin, Math.min(cursorMax, cursorMin + xInView));
}

/**
 * 禁止框内直接输入/IME：在 window 捕获阶段消费 keydown，仅由本逻辑改 model。
 * 需先点击框获得焦点，扫码枪按键才会进入本组件。
 */
function onGlobalKeyDown(e: KeyboardEvent) {
  if (!isFocusInside()) return;

  if (e.isComposing || e.keyCode === 229) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  if (props.endKeys.includes(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    // 调用：解url 追溯码
    const v = modelValue.value;
    emit("scan", v);
    if (props.clearOnScan) {
      modelValue.value = "";
      cursorPos.value = 0;
    } else {
      cursorPos.value = modelValue.value.length;
    }
    void moveCaretToEnd();
    return;
  }

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    e.stopPropagation();
    cursorPos.value = Math.max(0, cursorPos.value - 1);
    void moveCaretToEnd();
    return;
  }

  if (e.key === "ArrowRight") {
    e.preventDefault();
    e.stopPropagation();
    cursorPos.value = Math.min(modelValue.value.length, cursorPos.value + 1);
    void moveCaretToEnd();
    return;
  }

  if (e.key === "Backspace") {
    e.preventDefault();
    e.stopPropagation();
    const pos = cursorPos.value;
    if (pos <= 0) return;
    modelValue.value =
      modelValue.value.slice(0, pos - 1) + modelValue.value.slice(pos);
    cursorPos.value = pos - 1;
    void moveCaretToEnd();
    return;
  }

  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    modelValue.value = "";
    cursorPos.value = 0;
    void moveCaretToEnd();
    return;
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    e.stopPropagation();
    const pos = cursorPos.value;
    modelValue.value =
      modelValue.value.slice(0, pos) + e.key + modelValue.value.slice(pos);
    cursorPos.value = pos + e.key.length;
    void moveCaretToEnd();
  }
}

function onCompositionBlock(e: CompositionEvent) {
  e.preventDefault();
}

function onCompositionEnd() {
  void moveCaretToEnd();
}

function onFieldBeforeInput(e: InputEvent) {
  // 允许 paste 自行触发 @paste，再在 onFieldPaste 里写入 modelValue
  if (e.inputType === "insertFromPaste") return;
  e.preventDefault();
}

function onFieldPaste(e: ClipboardEvent) {
  // 组件本身是 readonly，默认粘贴不会生效；这里手动把剪贴板写入，并插入到模拟光标位置
  e.preventDefault();
  const text = (e.clipboardData?.getData("text") ?? "").trim();
  if (!text) return;
  const pos = cursorPos.value;
  modelValue.value =
    modelValue.value.slice(0, pos) + text + modelValue.value.slice(pos);
  cursorPos.value = pos + text.length;
  void moveCaretToEnd();
  inputRef.value?.focus();
}

function onFieldInput(e: Event) {
  const el = e.target as HTMLInputElement;
  if (el.value !== modelValue.value) {
    el.value = modelValue.value;
    void moveCaretToEnd();
  }
}

function onFieldFocus() {
  cursorVisible.value = true;
  // 聚焦时默认把光标放到末尾
  cursorPos.value = modelValue.value.length;
  void moveCaretToEnd();
}

function onFieldBlur() {
  cursorVisible.value = false;
}

function onFieldClick() {
  // 通过 input 的 selectionStart 反推模拟光标位置
  const el = inputRef.value;
  if (!el) return;
  const nextPos = el.selectionStart ?? 0;
  cursorPos.value = Math.max(0, Math.min(nextPos, modelValue.value.length));
  void moveCaretToEnd();
}

/** 父组件通过 ref 调用：聚焦到内部 input，便于扫码前抢焦点 */
function focus() {
  inputRef.value?.focus();
  cursorVisible.value = true;
  cursorPos.value = modelValue.value.length;
  void moveCaretToEnd();
}

/** 父组件通过 ref 调用：失焦 */
function blur() {
  inputRef.value?.blur();
}

function clearAll() {
  modelValue.value = "";
  cursorPos.value = 0;
  void moveCaretToEnd();
  inputRef.value?.focus();
}

defineExpose({
  focus,
  blur
});

onMounted(() => {
  window.addEventListener("keydown", onGlobalKeyDown, true);
  if (props.autofocus) {
    // 延迟500ms 这样即便其他组件获取焦点我也是最后一个 就是保证优先级
    setTimeout(() => focus(), 500)
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onGlobalKeyDown, true);
});
</script>

<template>
  <div ref="rootRef" v-bind="rootAttrs">
    <div class="scan-input__inner">
      <input ref="inputRef" class="scan-input__field" type="text" readonly :value="modelValue"
        :placeholder="placeholder" autocomplete="off" spellcheck="false" inputmode="none" lang="en" v-bind="inputBind"
        @focus="onFieldFocus" @blur="onFieldBlur" @click="onFieldClick" @input="onFieldInput"
        @compositionstart="onCompositionBlock" @compositionupdate="onCompositionBlock"
        @compositionend="onCompositionEnd" @beforeinput="onFieldBeforeInput" @paste="onFieldPaste" @drop.prevent
        @cut.prevent />
      <span v-show="cursorVisible" class="scan-input__cursor" :style="{ left: `${cursorLeft}px` }" />
      <button v-if="modelValue" type="button" class="scan-input__clear-icon" aria-label="清除" title="清除"
        @mousedown.prevent @click="clearAll">
        <el-icon :size="14">
          <Close />
        </el-icon>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.scan-input {
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  min-height: 0;
  /* 未单独给 input 设 bg 时，白底由外层提供 */
  background-color: var(--el-fill-color-blank, #fff);
}

.scan-input__inner {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: var(--el-component-size, 32px);
}

.scan-input__clear-icon {
  flex: 0 0 auto;
  align-self: stretch;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 100%;
  margin-left: 6px;
  color: var(--el-text-color-secondary, #909399);
  background: transparent;
  border: none;
  border-radius: var(--el-border-radius-base, 4px);
  cursor: pointer;
  z-index: 4;

  &:hover {
    color: var(--el-color-primary, #409eff);
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary, #409eff);
    outline-offset: 1px;
  }
}

.scan-input__field {
  box-sizing: border-box;
  width: auto;
  min-width: 0;
  min-height: var(--el-component-size, 32px);
  height: 100%;
  flex: 1 1 auto;
  margin: 0;
  font-size: var(--el-font-size-base, 14px);
  line-height: 1.5;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  /* 不设死背景/字色，避免 scoped 盖掉父级传入的 bg-*、text-*；未传时用透明+继承吃外层样式 */
  background-color: transparent;
  color: inherit;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: var(--el-border-radius-base, 4px);
  outline: none;
  cursor: text;
  caret-color: transparent;

  &:focus {
    border-color: var(--el-color-primary, #409eff);
    outline: 2px solid var(--el-color-primary, #409eff);
    outline-offset: 1px;
  }

  &:hover {
    border-color: var(--el-border-color-hover, #c0c4cc);
  }
}

.scan-input__cursor {
  position: absolute;
  top: 50%;
  z-index: 2;
  width: 2px;
  height: 1.2em;
  background: var(--el-color-primary, #409eff);
  transform: translateY(-50%);
  pointer-events: none;
  animation: scan-input-cursor-blink 1s steps(2, start) infinite;
}

@keyframes scan-input-cursor-blink {

  0%,
  49% {
    opacity: 1;
  }

  50%,
  100% {
    opacity: 0;
  }
}
</style>

<!-- 低优先级默认 placeholder，避免盖住 Tailwind 的 placeholder:text-*；可用 prop placeholderColor 或 class -->
<style lang="scss">
:where(.scan-input input.scan-input__field)::placeholder {
  color: var(--scan-input-placeholder-color,
      var(--el-text-color-placeholder, #a8abb2));
}
</style>
