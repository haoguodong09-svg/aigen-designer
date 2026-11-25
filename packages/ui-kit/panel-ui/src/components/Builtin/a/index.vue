<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed } from 'vue';

import { usePageManager } from '@aigen-designer/hooks';

const props = defineProps<{
  componentSchema?: ComponentSchema;
  href?: string;
  target?: string;
  text?: string;
  underline?: boolean;
}>();

const pageManager = usePageManager();

const resolvedText = computed(
  () => props.text ?? props.componentSchema?.props?.text ?? '超链接',
);
const resolvedHref = computed(
  () => props.href ?? props.componentSchema?.props?.href ?? '#',
);
const resolvedTarget = computed(
  () => props.target ?? props.componentSchema?.props?.target ?? '_self',
);
const resolvedUnderline = computed(
  () => props.underline ?? props.componentSchema?.props?.underline ?? false,
);

function handleClick(event: MouseEvent) {
  // 设计态下阻止链接直接跳转，避免打断画布选中与属性配置
  if (pageManager.isDesignMode.value && !pageManager.isInteractiveMode?.value) {
    event.preventDefault();
  }
}
</script>
<template>
  <a
    class="aigen-builtin-a"
    :class="{ 'is-underline': resolvedUnderline }"
    :href="resolvedHref"
    :target="resolvedTarget"
    rel="noopener noreferrer"
    @click="handleClick"
  >
    {{ resolvedText }}
  </a>
</template>
<style scoped>
.aigen-builtin-a {
  color: var(--aigen-primary, #1677ff);
  text-decoration: none;
  cursor: pointer;
}

.aigen-builtin-a.is-underline,
.aigen-builtin-a:hover {
  text-decoration: underline;
}
</style>
