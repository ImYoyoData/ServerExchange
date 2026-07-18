<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import "@wangeditor/editor/dist/css/style.css";
import type { IDomEditor, IEditorConfig, IToolbarConfig } from "@wangeditor/editor";
import {
  createRichTextImageUploader,
  createRichTextVideoUploader,
  RICH_TEXT_IMAGE_MODULE,
  RICH_TEXT_VIDEO_MODULE
} from "./upload";
import {
  applyFullWidthToImage,
  applyFullWidthToVideo,
  ensureDefaultMediaWidth
} from "./mediaStyle";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    height?: string;
    disabled?: boolean;
    placeholder?: string;
    /** 图片上传 module（后端 sys_file.module） */
    uploadImageModule?: string;
    /** 视频上传 module */
    uploadVideoModule?: string;
    /** 图片最大体积 KB */
    maxImageSizeKB?: number;
    /** 视频最大体积 KB */
    maxVideoSizeKB?: number;
  }>(),
  {
    modelValue: "",
    height: "280px",
    disabled: false,
    placeholder: "请输入正文",
    uploadImageModule: RICH_TEXT_IMAGE_MODULE,
    uploadVideoModule: RICH_TEXT_VIDEO_MODULE,
    maxImageSizeKB: 5120,
    maxVideoSizeKB: 204800
  }
);

const emit = defineEmits<{ "update:modelValue": [v: string] }>();

const editorRef = shallowRef<IDomEditor>();
const normalizingMedia = ref(false);

const html = computed({
  get: () => props.modelValue ?? "",
  set: (v: string) => emit("update:modelValue", v)
});

const toolbarConfig: Partial<IToolbarConfig> = {
  excludeKeys: ["fullScreen"]
};

const editorInnerConfig = computed<Partial<IEditorConfig>>(() => ({
  placeholder: props.placeholder,
  readOnly: props.disabled,
  MENU_CONF: {
    uploadImage: {
      maxFileSize: props.maxImageSizeKB * 1024,
      allowedFileTypes: ["image/*"],
      customUpload: createRichTextImageUploader(
        props.uploadImageModule,
        props.maxImageSizeKB
      )
    },
    uploadVideo: {
      maxFileSize: props.maxVideoSizeKB * 1024,
      allowedFileTypes: ["video/*"],
      customUpload: createRichTextVideoUploader(
        props.uploadVideoModule,
        props.maxVideoSizeKB
      )
    },
    insertImage: {
      onInsertedImage(imageElem) {
        applyFullWidthToImage(editorRef.value, imageElem.src);
      }
    },
    insertVideo: {
      onInsertedVideo(videoElem) {
        applyFullWidthToVideo(editorRef.value, videoElem.src);
      }
    }
  }
}));

function handleCreated(editor: IDomEditor) {
  editorRef.value = editor;
  ensureDefaultMediaWidth(editor);
}

function handleEditorChange(editor: IDomEditor) {
  if (normalizingMedia.value) return;
  normalizingMedia.value = true;
  try {
    ensureDefaultMediaWidth(editor);
  } finally {
    normalizingMedia.value = false;
  }
}

watch(
  () => props.disabled,
  v => {
    const ed = editorRef.value;
    if (!ed) return;
    if (v) ed.disable();
    else ed.enable();
  }
);

onBeforeUnmount(() => {
  const ed = editorRef.value;
  if (ed == null) return;
  ed.destroy();
  editorRef.value = undefined;
});
</script>

<template>
  <div
    class="re-rich-text-editor border border-[var(--el-border-color)] rounded overflow-hidden bg-[var(--el-bg-color)]"
  >
    <Toolbar
      class="border-b border-[var(--el-border-color)]"
      style="border-bottom: 1px solid var(--el-border-color)"
      :editor="editorRef"
      :default-config="toolbarConfig"
      mode="default"
    />
    <Editor
      v-model="html"
      :default-config="editorInnerConfig"
      mode="default"
      :style="{ height, overflowY: 'hidden' }"
      @on-created="handleCreated"
      @on-change="handleEditorChange"
    />
  </div>
</template>

<style scoped>
.re-rich-text-editor :deep(.w-e-text-container img),
.re-rich-text-editor :deep(.w-e-text-container video) {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>
