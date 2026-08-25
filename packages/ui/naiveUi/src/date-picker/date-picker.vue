<script setup lang="ts">
import { computed } from 'vue';

import { NDatePicker } from 'naive-ui';

const props = withDefaults(
  defineProps<{
    /** 默认值（字符串格式）：仅用于拦截 schema 透传，避免字符串被当作时间戳 default-value 传给 NDatePicker */
    defaultValue?: null | string | string[];
    format?: string;
    placeholder?: string;
    valueFormat?: string;
  }>(),
  {
    defaultValue: undefined,
    format: 'yyyy-MM-dd',
    placeholder: '请选择',
    valueFormat: 'yyyy-MM-dd',
  },
);

// 统一值格式：valueFormat 未配置时回退到显示格式，
// 保证绑定值（formatted-value）始终为 valueFormat 对应的字符串
const mergedValueFormat = computed(() => props.valueFormat || props.format);
</script>

<template>
  <NDatePicker
    :format="props.format"
    :placeholder="props.placeholder"
    :value-format="mergedValueFormat"
  />
</template>
