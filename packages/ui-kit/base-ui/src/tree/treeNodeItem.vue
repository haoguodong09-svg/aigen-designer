<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, defineComponent, h, watch } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';

import AigenTreeNodes from './treeNodes.vue';
import { useTreeContext } from './useTreeContext';

defineOptions({
  name: 'AigenTreeNodeItem',
});

const props = defineProps<{
  schema: ComponentSchema;
}>();

const treeContext = useTreeContext();
const { pageSchema } = useDesignerContext();

const expanded = computed(() => {
  return treeContext!.expandedKeys.value.includes(props.schema.id ?? '');
});

const slotNames = computed(() => {
  return props.schema.slots ? Object.keys(props.schema.slots) : [];
});

const hasSubNodes = computed(() => {
  return Boolean(props.schema.children?.length || slotNames.value.length > 0);
});

const TreeNodeText = defineComponent({
  setup() {
    return () =>
      h(
        'span',
        {
          class: {
            checked: treeContext!.selectedKeys.value.includes(props.schema.id!),
            hover: treeContext!.treeProps.hoverKey === props.schema.id,
            text: true,
          },
          onClick: () =>
            treeContext!.handleSelect(props.schema.id!, props.schema),
        },
        treeContext!.slots['tree-node']?.(props) ??
          h(
            'span',
            { class: 'aigen-text-padding flex' },
            {
              default: () => [
                h(
                  'span',
                  { class: 'max-w-full truncate' },
                  props.schema.label ??
                    pluginManager.component.getConfigByType(props.schema.type)
                      ?.defaultSchema.label,
                ),
                h(
                  'span',
                  { class: 'aigen-node-type-text flex-1 w-0 truncate' },
                  props.schema.id,
                ),
              ],
            },
          ),
      );
  },
});

function handleExpanded() {
  const id = props.schema.id;
  if (!id) {
    return false;
  }

  if (treeContext!.expandedKeys.value.includes(id)) {
    treeContext!.expandedKeys.value = treeContext!.expandedKeys.value.filter(
      (item) => item !== id,
    );
  } else {
    treeContext!.expandedKeys.value.push(id);
  }
}

watch(
  hasSubNodes,
  (val) => {
    const id = props.schema.id;
    if (val && id && !treeContext!.expandedKeys.value.includes(id)) {
      treeContext!.expandedKeys.value.push(id);
    }
  },
  { immediate: true },
);
</script>
<template>
  <li
    class="aigen-tree-node"
    :class="{
      expanded: hasSubNodes,
      'is-locked': pluginManager.component.getLocked(props.schema.type),
      'level-1': props.schema.id === pageSchema.schemas[0]?.id,
    }"
  >
    <a>
      <span
        v-if="hasSubNodes && props.schema.id !== pageSchema.schemas[0]?.id"
        class="icon-expanded"
        :class="{ expanded }"
        @click="handleExpanded"
      >
        <AigenIcon name="icon--aigen--caret-right-outlined" />
      </span>
      <TreeNodeText />
    </a>
    <AigenTreeNodes
      v-if="props.schema.children?.length"
      v-model:schemas="props.schema.children"
      class="aigen-tree-sublist"
      :class="{ expanded }"
      :parent-schema="props.schema"
    />
    <div
      v-if="props.schema.slots && slotNames.length > 0"
      class="aigen-tree-sublist aigen-tree-slots"
      :class="{ expanded }"
    >
      <div
        v-for="slotName in slotNames"
        :key="slotName"
        class="aigen-tree-slot-group"
      >
        <div class="aigen-tree-slot-header node-drag-disabled">
          #{{ slotName }}
        </div>
        <AigenTreeNodes
          v-model:schemas="props.schema.slots[slotName]"
          :parent-schema="props.schema"
        />
      </div>
    </div>
  </li>
</template>
<style scoped lang="less">
.aigen-tree-slot-header {
  padding-left: 16px;
  font-size: var(--aigen-text-sm);
  line-height: 22px;
  color: var(--aigen-text-helper);
  cursor: default;
  user-select: none;
}
</style>
