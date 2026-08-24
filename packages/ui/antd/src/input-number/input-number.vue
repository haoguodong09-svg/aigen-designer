<script setup lang="ts">
import { InputNumber } from 'ant-design-vue';

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
  <InputNumber :placeholder="props.placeholder" />
</template>
