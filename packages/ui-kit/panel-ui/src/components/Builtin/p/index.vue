<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

const props = defineProps<{
  componentSchema?: ComponentSchema;
}>();
</script>
<template>
  <p class="aigen-builtin-p m-0">{{ props.componentSchema?.props?.text }}</p>
</template>
