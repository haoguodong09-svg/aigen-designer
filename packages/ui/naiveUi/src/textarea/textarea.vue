<script lang="ts" setup>
import { NInput } from 'naive-ui';

const props = withDefaults(
  defineProps<{
    placeholder?: string;
  }>(),
  {
    placeholder: '请输入',
  },
);
</script>

<template>
  <NInput type="textarea" :placeholder="props.placeholder" />
</template>
