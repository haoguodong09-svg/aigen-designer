<script lang="ts" setup>
import { NInput } from 'naive-ui';

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
  <NInput type="textarea" :placeholder="props.placeholder" />
</template>
