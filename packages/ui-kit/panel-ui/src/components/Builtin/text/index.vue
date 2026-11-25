<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { CSSProperties } from 'vue';

import { computed } from 'vue';

const props = defineProps<{
  componentSchema?: ComponentSchema;
}>();

const textStyle = computed<CSSProperties>(() => {
  const componentProps = props.componentSchema?.props ?? {};
  return {
    color: componentProps.color || undefined,
    fontSize: componentProps.fontSize || '14px',
    fontWeight: componentProps.fontWeight || '400',
  };
});
</script>
<template>
  <span class="aigen-builtin-text" :style="textStyle">{{
    props.componentSchema?.props?.text
  }}</span>
</template>
