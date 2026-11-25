<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { PropType } from 'vue';

import { computed, useSlots } from 'vue';

import { Button } from 'ant-design-vue';

const props = defineProps({
  componentSchema: {
    default: () => ({}),
    type: Object as PropType<ComponentSchema>,
  },
});

const slots = useSlots();
const hasIconSlot = computed(() =>
  Boolean(slots.icon || props.componentSchema?.slots?.icon),
);
const iconSlotNodes = computed(() => props.componentSchema?.slots?.icon ?? []);
</script>
<template>
  <Button v-bind="props.componentSchema?.props">
    <template v-if="hasIconSlot" #icon>
      <slot name="icon">
        <slot
          v-for="node in iconSlotNodes"
          name="node"
          :component-schema="node"
        ></slot>
      </slot>
    </template>
    <slot>{{ props.componentSchema?.label }}</slot>
  </Button>
</template>
