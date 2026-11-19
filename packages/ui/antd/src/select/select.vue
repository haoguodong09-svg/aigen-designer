<script setup lang="ts">
import { computed, ref } from 'vue';

import { Select } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    componentSchema?: any;
    options?: any[];
    placeholder?: string;
  }>(),
  {
    componentSchema: undefined,
    options: () => [],
    placeholder: '请选择',
  },
);

const selectRef = ref();
const dynamicOptions = ref<any[] | null>(null);

const currentOptions = computed(() => {
  return dynamicOptions.value ?? props.options ?? [];
});

defineExpose({
  blur: () => selectRef.value?.blur?.(),
  clear: () => {
    // antd select 支持直接重置或失焦
    selectRef.value?.blur?.();
  },
  focus: () => selectRef.value?.focus?.(),
  getNativeRef: () => selectRef.value,
  setOptions: (opts: any[]) => {
    dynamicOptions.value = opts;
    if (props.componentSchema?.props) {
      props.componentSchema.props.options = opts;
    }
  },
});
</script>

<template>
  <Select
    ref="selectRef"
    :options="currentOptions"
    :placeholder="props.placeholder"
  />
</template>
