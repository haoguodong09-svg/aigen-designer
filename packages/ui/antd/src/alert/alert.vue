<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { PropType } from 'vue';

import { Alert } from 'ant-design-vue';

defineOptions({
  name: 'AigenAlert',
});

const props = defineProps({
  componentSchema: {
    default: () => ({}),
    type: Object as PropType<ComponentSchema>,
  },
});
</script>
<template>
  <Alert v-bind="props.componentSchema?.props" />
</template>
