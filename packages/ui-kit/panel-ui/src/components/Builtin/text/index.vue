<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { CSSProperties } from 'vue';

import { computed } from 'vue';

const props = defineProps<{
  color?: string;
  componentSchema?: ComponentSchema;
  fontSize?: string;
  fontWeight?: string;
  text?: unknown;
}>();

const textStyle = computed<CSSProperties>(() => {
  const componentProps = props.componentSchema?.props ?? {};
  return {
    color: props.color ?? componentProps.color ?? undefined,
    fontSize: props.fontSize ?? componentProps.fontSize ?? '14px',
    fontWeight: props.fontWeight ?? componentProps.fontWeight ?? '400',
  };
});
</script>
<template>
  <span class="aigen-builtin-text" :style="textStyle">{{
    props.text ?? props.componentSchema?.props?.text
  }}</span>
</template>
