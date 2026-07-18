<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from "vue";
import { SliderCaptcha, setLocale, type Locale } from "captcha-pro";

defineOptions({
  name: "ReSliderCaptcha"
});

const props = defineProps({
  width: {
    type: Number,
    default: 0
  },
  height: {
    type: Number,
    default: 132
  },
  precision: {
    type: Number,
    default: 5
  },
  showRefresh: {
    type: Boolean,
    default: true
  },
  dark: {
    type: Boolean,
    default: false
  },
  locale: {
    type: String as () => Locale | "zh" | "en" | "ru",
    default: "zh-CN"
  }
});

const emit = defineEmits<{
  (e: "success", data: { target: number[] | { x: number; y: number }[] }): void;
  (e: "fail", data?: any): void;
  (e: "reset"): void;
}>();

const wrapperRef = ref<HTMLDivElement>();
const containerRef = ref<HTMLDivElement>();
let captchaInstance: InstanceType<typeof SliderCaptcha> | null = null;

const captchaLocale = computed<Locale>(() => {
  if (props.locale === "zh" || props.locale === "zh-CN") return "zh-CN";
  return "en-US";
});

const resolveWidth = () => {
  const parentWidth = wrapperRef.value?.clientWidth ?? 0;
  if (parentWidth > 0) {
    // captcha-pro 容器宽度 = options.width + 20，左右各 10px 内边距
    return Math.max(parentWidth - 20, 260);
  }
  if (props.width > 0) return props.width;
  return 320;
};

const initCaptcha = () => {
  if (!containerRef.value) return;
  destroy();
  setLocale(captchaLocale.value);
  captchaInstance = new SliderCaptcha({
    el: containerRef.value,
    width: resolveWidth(),
    height: props.height,
    precision: props.precision,
    showRefresh: props.showRefresh,
    className: "re-slider-captcha__core",
    onSuccess: () => {
      const data = captchaInstance?.getData?.();
      emit("success", { target: data?.target ?? [] });
    },
    onFail: (data?: any) => {
      emit("fail", data);
    },
    onRefresh: () => {
      emit("reset");
    }
  });
};

const reset = () => {
  captchaInstance?.reset?.();
};

const destroy = () => {
  captchaInstance?.destroy?.();
  captchaInstance = null;
};

let resizeObserver: ResizeObserver | null = null;
let lastResolvedWidth = 0;

onMounted(async () => {
  await nextTick();
  if (!wrapperRef.value?.clientWidth) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  initCaptcha();
  lastResolvedWidth = resolveWidth();
  if (wrapperRef.value) {
    resizeObserver = new ResizeObserver(() => {
      const nextWidth = resolveWidth();
      if (Math.abs(nextWidth - lastResolvedWidth) >= 8) {
        lastResolvedWidth = nextWidth;
        initCaptcha();
      }
    });
    resizeObserver.observe(wrapperRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  destroy();
});

watch(
  () => [props.dark, props.locale, props.height] as const,
  () => initCaptcha()
);

defineExpose({
  reset,
  destroy
});
</script>

<template>
  <div
    ref="wrapperRef"
    class="re-slider-captcha"
    :class="dark ? 're-slider-captcha--dark' : 're-slider-captcha--light'"
  >
    <div ref="containerRef" />
  </div>
</template>

<style lang="scss">
.re-slider-captcha {
  width: 100%;

  &__core {
    max-width: 100%;
    margin: 0 auto;
    border-radius: 8px !important;
    box-shadow: none !important;
    overflow: hidden !important;
  }

  .captcha-image-container {
    border-radius: 8px !important;
    overflow: hidden !important;
  }

  .captcha-sr-only {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }

  .captcha-slider-track {
    height: 38px !important;
    margin-top: 8px !important;
    border-radius: 8px !important;
  }

  .captcha-slider-progress {
    height: 38px !important;
    border-radius: 8px !important;
  }

  .captcha-slider-btn {
    width: 34px !important;
    height: 34px !important;
    border-radius: 6px !important;
    box-shadow: 0 1px 4px rgb(15 23 42 / 12%);
  }

  .captcha-slider-hint {
    font-size: 13px !important;
    white-space: nowrap;
  }

  .captcha-refresh-btn {
    top: 8px !important;
    right: 8px !important;
    border-radius: 6px !important;
  }

  &--dark &__core {
    background: transparent !important;
  }

  &--dark {
    .captcha-image-container {
      border: 1px solid rgb(255 255 255 / 12%);
    }

    .captcha-slider-track {
      background: rgb(255 255 255 / 6%) !important;
      border: 1px solid rgb(255 255 255 / 10%);
    }

    .captcha-slider-progress {
      background: rgb(64 158 255 / 18%) !important;
      border-color: rgb(64 158 255 / 22%) !important;
    }

    .captcha-slider-btn {
      background: var(--el-color-primary) !important;
      border-color: transparent !important;
    }

    .captcha-slider-btn svg path {
      fill: #fff !important;
    }

    .captcha-slider-hint {
      color: rgb(255 255 255 / 42%) !important;
    }

    .captcha-refresh-btn {
      background: rgb(15 23 42 / 72%) !important;
      border: 1px solid rgb(255 255 255 / 12%);
    }

    .captcha-refresh-btn svg path {
      fill: rgb(255 255 255 / 72%) !important;
    }
  }

  &--light &__core {
    background: transparent !important;
  }

  &--light {
    .captcha-image-container {
      border: 1px solid var(--el-border-color-light);
    }

    .captcha-slider-track {
      background: var(--el-fill-color-light) !important;
      border: 1px solid var(--el-border-color-lighter);
    }

    .captcha-slider-progress {
      background: rgb(64 158 255 / 12%) !important;
      border-color: rgb(64 158 255 / 18%) !important;
    }

    .captcha-slider-btn {
      background: #fff !important;
      border-color: var(--el-border-color-light) !important;
    }

    .captcha-slider-hint {
      color: var(--el-text-color-secondary) !important;
    }
  }
}
</style>
