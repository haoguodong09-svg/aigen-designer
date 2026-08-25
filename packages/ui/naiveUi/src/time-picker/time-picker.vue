<script setup lang="ts">
import { NTimePicker } from 'naive-ui';

const props = withDefaults(
  defineProps<{
    placeholder?: string;
  }>(),
  {
    placeholder: '请选择',
  },
);
</script>

<template>
  <NTimePicker :placeholder="props.placeholder" />
</template>
