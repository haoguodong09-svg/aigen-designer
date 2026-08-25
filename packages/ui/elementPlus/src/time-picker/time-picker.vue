<script setup lang="ts">
import { ElTimePicker } from 'element-plus';

// 二次封装组件，显式处理 modelValue 绑定，
// 配合 valueFormat 保证值与 antd 一致为字符串格式（如 HH:mm:ss）
const props = withDefaults(
  defineProps<{
    modelValue?: null | string | string[];
    placeholder?: string;
  }>(),
  {
    modelValue: null,
    placeholder: '请选择',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: null | string | string[]): void;
  (e: 'change', value: null | string | string[]): void;
}>();

// 统一处理值更新，确保上层拿到的是 valueFormat 格式的字符串值
function handleUpdate(value: null | string | string[]) {
  emit('update:modelValue', value);
  emit('change', value);
}
</script>

<template>
  <ElTimePicker
    :model-value="props.modelValue"
    :placeholder="props.placeholder"
    @update:model-value="handleUpdate"
  />
</template>
