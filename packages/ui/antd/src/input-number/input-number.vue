<script setup lang="ts">
import { ref } from 'vue';

import { InputNumber } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    componentSchema?: any;
    placeholder?: string;
  }>(),
  {
    componentSchema: undefined,
    placeholder: '请输入',
  },
);

const inputNumberRef = ref();

defineExpose({
  blur: () => inputNumberRef.value?.blur?.(),
  focus: (options?: any) => inputNumberRef.value?.focus?.(options),
  getNativeRef: () => inputNumberRef.value,
});
</script>

<template>
  <InputNumber ref="inputNumberRef" :placeholder="props.placeholder" />
</template>
