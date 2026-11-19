<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { ref } from 'vue';

import { useEventBus, useFormItem } from '@aigen-designer/hooks';
import { Input } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    componentSchema?: ComponentSchema;
    dataSelector?: boolean;
    options?: any[];
    placeholder?: string;
  }>(),
  {
    componentSchema: () => ({
      field: '',
      type: 'input',
    }),
    dataSelector: false,
    options: () => [],
    placeholder: '请输入',
  },
);

const inputRef = ref();
const { formData } = useFormItem();
const eventBus = useEventBus();

const handleDataSelector = () => {
  eventBus?.emit('openDataSelector', props.componentSchema, props.options);
};

eventBus?.on('dataSelector:selected', (data: any) => {
  if (data.nodeId !== props.componentSchema.id) {
    return;
  }

  const dataFieldMap = props.componentSchema.props?.dataFieldMap ?? [];
  dataFieldMap.forEach((item: any) => {
    formData[item.formField] = data.record[item.dataField];
  });
});

defineExpose({
  blur: () => inputRef.value?.blur?.(),
  clear: () => {
    if (props.componentSchema?.field && formData) {
      formData[props.componentSchema.field] = '';
    }
  },
  focus: (options?: any) => inputRef.value?.focus?.(options),
  getNativeRef: () => inputRef.value,
  select: () => inputRef.value?.select?.(),
});
</script>

<template>
  <Input ref="inputRef" :placeholder="props.placeholder">
    <template #suffix>
      <span
        v-if="props.dataSelector"
        class="iconfont icon--aigen icon--aigen--search-rounded"
        @click="handleDataSelector"
      ></span>
      <slot name="suffix"></slot>
    </template>
  </Input>
</template>
