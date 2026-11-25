<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed } from 'vue';

const props = defineProps<{
  componentSchema?: ComponentSchema;
}>();

const tag = computed(() => props.componentSchema?.props?.tag || 'div');
const children = computed(() => props.componentSchema?.children ?? []);
</script>
<template>
  <component :is="tag" class="aigen-builtin-div box-border">
    <slot name="edit-node">
      <slot
        v-for="(item, index) in children"
        :key="item.id ?? index"
        name="node"
        :component-schema="item"
      ></slot>
    </slot>
  </component>
</template>
