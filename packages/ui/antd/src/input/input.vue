<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, ref, useSlots } from 'vue';

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
const slots = useSlots();
const hasPrefixSlot = computed(() =>
  Boolean(slots.prefix || props.componentSchema?.slots?.prefix),
);
const hasSuffixSlot = computed(() =>
  Boolean(slots.suffix || props.componentSchema?.slots?.suffix),
);
const prefixSlotNodes = computed(
  () => props.componentSchema?.slots?.prefix ?? [],
);
const suffixSlotNodes = computed(
  () => props.componentSchema?.slots?.suffix ?? [],
);
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
    <template v-if="hasPrefixSlot" #prefix>
      <slot name="prefix">
        <slot
          v-for="node in prefixSlotNodes"
          name="node"
          :component-schema="node"
        ></slot>
      </slot>
    </template>
    <template v-if="props.dataSelector || hasSuffixSlot" #suffix>
      <span
        v-if="props.dataSelector"
        class="iconfont icon--aigen icon--aigen--search-rounded"
        @click="handleDataSelector"
      ></span>
      <slot name="suffix">
        <slot
          v-for="node in suffixSlotNodes"
          name="node"
          :component-schema="node"
        ></slot>
      </slot>
    </template>
  </Input>
</template>
