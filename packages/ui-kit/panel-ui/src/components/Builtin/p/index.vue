<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

const props = defineProps<{
  componentSchema?: ComponentSchema;
  text?: unknown;
}>();
</script>
<template>
  <p class="aigen-builtin-p m-0">
    {{ props.text ?? props.componentSchema?.props?.text }}
  </p>
</template>
