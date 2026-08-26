<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { Divider } from 'ant-design-vue';

defineOptions({
  name: 'AigenDivider',
});

const props = withDefaults(
  defineProps<{
    componentSchema?: ComponentSchema;
  }>(),
  {
    componentSchema: () => ({
      field: '',
      type: 'divider',
    }),
  },
);
</script>
<template>
  <Divider v-bind="props.componentSchema?.props">
    {{ props.componentSchema?.label }}
  </Divider>
</template>
