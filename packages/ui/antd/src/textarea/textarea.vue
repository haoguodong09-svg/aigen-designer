<script setup lang="ts">
import { ref } from 'vue';

import { Textarea } from 'ant-design-vue';

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

const textareaRef = ref();

defineExpose({
  blur: () => textareaRef.value?.blur?.(),
  clear: () => {
    // 触发底层清除
    if (textareaRef.value?.resizableTextArea?.textArea) {
      textareaRef.value.resizableTextArea.textArea.value = '';
    }
  },
  focus: (options?: any) => textareaRef.value?.focus?.(options),
  getNativeRef: () => textareaRef.value,
  select: () => textareaRef.value?.select?.(),
});
</script>

<template>
  <Textarea ref="textareaRef" :placeholder="props.placeholder" />
</template>
