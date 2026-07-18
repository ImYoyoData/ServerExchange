<script setup lang="ts">
defineOptions({ name: "FileMediaPreviewDialog" });

const visible = defineModel<boolean>({ default: false });

const props = defineProps<{
  title: string;
  type: "image" | "video" | "audio";
  url: string;
}>();
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="props.title"
    width="760px"
    destroy-on-close
  >
    <div class="media-preview-wrap">
      <el-image
        v-if="props.type === 'image'"
        :src="props.url"
        fit="contain"
        class="media-preview-image"
      />
      <video
        v-else-if="props.type === 'video'"
        :src="props.url"
        controls
        class="media-preview-video"
      />
      <audio
        v-else-if="props.type === 'audio'"
        :src="props.url"
        controls
        class="media-preview-audio"
      />
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.media-preview-wrap {
  width: 100%;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-preview-image,
.media-preview-video {
  width: 100%;
  max-height: 70vh;
}

.media-preview-audio {
  width: 100%;
}
</style>

