<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed } from 'vue';

const props = defineProps<{
  componentSchema?: ComponentSchema;
  tag?: string;
  text?: string;
}>();

const VALID_HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const resolvedTag = computed(() => {
  const raw = props.tag ?? props.componentSchema?.props?.tag ?? 'h2';
  return VALID_HEADING_TAGS.has(raw) ? raw : 'h2';
});

const resolvedText = computed(
  () => props.text ?? props.componentSchema?.props?.text ?? '标题文本',
);
</script>
<template>
  <component :is="resolvedTag" class="aigen-builtin-heading m-0">
    {{ resolvedText }}
  </component>
</template>
<style scoped>
.aigen-builtin-heading {
  font-weight: 600;
  line-height: 1.4;
  color: var(--aigen-text-main, #1e293b);
}
</style>
