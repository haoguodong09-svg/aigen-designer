<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { CSSProperties } from 'vue';

import { computed } from 'vue';

const props = defineProps<{
  borderStyle?: 'dashed' | 'dotted' | 'solid';
  color?: string;
  componentSchema?: ComponentSchema;
  thickness?: number;
}>();

const hrStyle = computed<CSSProperties>(() => {
  const borderStyle =
    props.borderStyle ?? props.componentSchema?.props?.borderStyle ?? 'solid';
  const color = props.color ?? props.componentSchema?.props?.color ?? '#e2e8f0';
  const thickness =
    Number(props.thickness ?? props.componentSchema?.props?.thickness ?? 1) ||
    1;
  return {
    border: 'none',
    borderTop: `${thickness}px ${borderStyle} ${color}`,
    margin: '8px 0',
    width: '100%',
  };
});
</script>
<template>
  <hr class="aigen-builtin-hr" :style="hrStyle" />
</template>
