<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { PropType } from 'vue';

import { TypographyLink as Link } from 'ant-design-vue';

defineOptions({
  name: 'AigenLink',
});

const props = defineProps({
  componentSchema: {
    default: () => ({}),
    type: Object as PropType<ComponentSchema>,
  },
});
</script>
<template>
  <Link v-bind="props.componentSchema?.props">
    {{ props.componentSchema?.label }}
  </Link>
</template>
