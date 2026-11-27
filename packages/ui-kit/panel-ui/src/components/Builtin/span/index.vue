<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

const props = defineProps<{
  componentSchema?: ComponentSchema;
  text?: unknown;
}>();
</script>
<template>
  <span class="aigen-builtin-span">{{
    props.text ?? props.componentSchema?.props?.text
  }}</span>
</template>
