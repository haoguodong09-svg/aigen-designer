<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { CSSProperties } from 'vue';

import { computed } from 'vue';

const props = defineProps<{
  autoplay?: boolean;
  componentSchema?: ComponentSchema;
  controls?: boolean;
  height?: string;
  loop?: boolean;
  muted?: boolean;
  src?: string;
  width?: string;
}>();

const resolvedSrc = computed(
  () => props.src ?? props.componentSchema?.props?.src ?? '',
);
const resolvedControls = computed(
  () => props.controls ?? props.componentSchema?.props?.controls ?? true,
);
const resolvedAutoplay = computed(
  () => props.autoplay ?? props.componentSchema?.props?.autoplay ?? false,
);
const resolvedLoop = computed(
  () => props.loop ?? props.componentSchema?.props?.loop ?? false,
);
const resolvedMuted = computed(
  () => props.muted ?? props.componentSchema?.props?.muted ?? false,
);

const boxStyle = computed<CSSProperties>(() => ({
  height: props.height ?? props.componentSchema?.props?.height ?? '180px',
  width: props.width ?? props.componentSchema?.props?.width ?? '100%',
}));
</script>
<template>
  <div class="aigen-builtin-video" :style="boxStyle">
    <video
      v-if="resolvedSrc"
      class="aigen-builtin-video__player"
      :src="resolvedSrc"
      :controls="resolvedControls"
      :autoplay="resolvedAutoplay"
      :loop="resolvedLoop"
      :muted="resolvedMuted"
    ></video>
    <div v-else class="aigen-builtin-video__placeholder">
      <span>视频占位（请配置视频地址）</span>
    </div>
  </div>
</template>
<style scoped>
.aigen-builtin-video {
  overflow: hidden;
  border-radius: 6px;
  background: #0f172a;
}

.aigen-builtin-video__player {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.aigen-builtin-video__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: #f1f5f9;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  font-size: 12px;
}
</style>
