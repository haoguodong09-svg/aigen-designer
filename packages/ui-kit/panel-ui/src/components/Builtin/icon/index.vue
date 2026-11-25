<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { CSSProperties } from 'vue';

import { computed } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';

const props = defineProps<{
  componentSchema?: ComponentSchema;
}>();

const iconName = computed(
  () => props.componentSchema?.props?.name || 'icon--aigen--add-rounded',
);

const iconStyle = computed<CSSProperties>(() => {
  const componentProps = props.componentSchema?.props ?? {};
  return {
    color: componentProps.color || undefined,
    fontSize: componentProps.fontSize || '20px',
  };
});
</script>
<template>
  <AigenIcon class="aigen-builtin-icon" :name="iconName" :style="iconStyle" />
</template>
