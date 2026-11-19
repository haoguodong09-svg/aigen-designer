<script setup lang="ts">
import { ref } from 'vue';

import { ElInput } from 'element-plus';

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

const inputRef = ref();

defineExpose({
  blur: () => inputRef.value?.blur?.(),
  clear: () => inputRef.value?.clear?.(),
  focus: () => inputRef.value?.focus?.(),
  getNativeRef: () => inputRef.value,
  select: () => inputRef.value?.select?.(),
});
</script>

<template>
  <ElInput ref="inputRef" :placeholder="props.placeholder" />
</template>
