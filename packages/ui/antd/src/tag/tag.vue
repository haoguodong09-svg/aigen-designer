<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { PropType } from 'vue';

import { Tag } from 'ant-design-vue';

defineOptions({
  name: 'AigenTag',
});

const props = defineProps({
  componentSchema: {
    default: () => ({}),
    type: Object as PropType<ComponentSchema>,
  },
});
</script>
<template>
  <Tag v-bind="props.componentSchema?.props">
    {{ props.componentSchema?.label }}
  </Tag>
</template>
