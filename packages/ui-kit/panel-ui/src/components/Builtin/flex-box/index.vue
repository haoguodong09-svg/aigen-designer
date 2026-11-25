<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { CSSProperties } from 'vue';

import { computed } from 'vue';

const props = defineProps<{
  componentSchema?: ComponentSchema;
}>();

const children = computed(() => props.componentSchema?.children ?? []);

const flexStyle = computed<CSSProperties>(() => {
  const componentProps = props.componentSchema?.props ?? {};
  return {
    alignItems: componentProps.alignItems ?? 'stretch',
    display: 'flex',
    flexDirection: componentProps.flexDirection ?? 'row',
    flexWrap: componentProps.flexWrap ?? 'nowrap',
    gap: componentProps.gap ?? '8px',
    justifyContent: componentProps.justifyContent ?? 'flex-start',
    padding: componentProps.padding ?? '8px',
  };
});
</script>
<template>
  <div class="aigen-builtin-flex box-border" :style="flexStyle">
    <slot name="edit-node">
      <slot
        v-for="(item, index) in children"
        :key="item.id ?? index"
        name="node"
        :component-schema="item"
      ></slot>
    </slot>
  </div>
</template>
