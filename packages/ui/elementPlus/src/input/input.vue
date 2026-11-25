<script setup lang="ts">
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, ref, useSlots } from 'vue';

import { ElInput } from 'element-plus';

const props = withDefaults(
  defineProps<{
    componentSchema?: ComponentSchema;
    placeholder?: string;
  }>(),
  {
    componentSchema: undefined,
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

defineExpose({
  blur: () => inputRef.value?.blur?.(),
  clear: () => inputRef.value?.clear?.(),
  focus: () => inputRef.value?.focus?.(),
  getNativeRef: () => inputRef.value,
  select: () => inputRef.value?.select?.(),
});
</script>

<template>
  <ElInput ref="inputRef" :placeholder="props.placeholder">
    <template v-if="hasPrefixSlot" #prefix>
      <slot name="prefix">
        <slot
          v-for="node in prefixSlotNodes"
          name="node"
          :component-schema="node"
        ></slot>
      </slot>
    </template>
    <template v-if="hasSuffixSlot" #suffix>
      <slot name="suffix">
        <slot
          v-for="node in suffixSlotNodes"
          name="node"
          :component-schema="node"
        ></slot>
      </slot>
    </template>
  </ElInput>
</template>
