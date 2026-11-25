<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

defineProps<{
  componentSchema?: ComponentSchema;
}>();
</script>
<template>
  <div class="aigen-builtin-slot">
    <slot></slot>
  </div>
</template>
