<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

const props = defineProps<{
  componentSchema?: ComponentSchema;
}>();
</script>
<template>
  <span class="aigen-builtin-span">{{
    props.componentSchema?.props?.text
  }}</span>
</template>
