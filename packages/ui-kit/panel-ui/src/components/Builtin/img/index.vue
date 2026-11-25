<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { CSSProperties } from 'vue';

import { computed } from 'vue';

import { DEFAULT_IMG_PLACEHOLDER } from '../shared';

const props = defineProps<{
  componentSchema?: ComponentSchema;
}>();

const imgSrc = computed(
  () => props.componentSchema?.props?.src || DEFAULT_IMG_PLACEHOLDER,
);

const imgAlt = computed(() => props.componentSchema?.props?.alt ?? '图片');

const imgStyle = computed<CSSProperties>(() => {
  const componentProps = props.componentSchema?.props ?? {};
  return {
    display: 'block',
    height: componentProps.height || '120px',
    maxWidth: '100%',
    objectFit: componentProps.objectFit || 'cover',
    width: componentProps.width || '120px',
  };
});
</script>
<template>
  <img
    class="aigen-builtin-img"
    :src="imgSrc"
    :alt="imgAlt"
    :style="imgStyle"
  />
</template>
