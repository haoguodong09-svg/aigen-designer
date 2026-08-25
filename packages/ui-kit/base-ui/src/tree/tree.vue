<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { TreeProps } from './types';

import { computed, provide, ref, useSlots, watch } from 'vue';

import { AigenIcon, useBindModel } from '@aigen-designer/base-ui';
import { pluginManager } from '@aigen-designer/manager';
import { debounce } from '@aigen-designer/utils';

import AigenTreeNodes from './treeNodes.vue';
import { TREE_CONTEXT_KEY } from './useTreeContext';

defineOptions({
  name: 'AigenTree',
});

const props = withDefaults(defineProps<TreeProps>(), {
  draggable: false,
  hoverKey: '',
  options: () => [],
  selectedKeys: () => [],
});

const emits = defineEmits(['update:selectedKeys', 'nodeClick']);
const slots = useSlots();

const Input = pluginManager.component.get('input');
const { bindModel } = useBindModel('input');

const keyword = ref('');
// 搜索关键字（防抖后用于过滤，避免每次按键递归过滤整棵树）
const filterKeyword = ref('');
const expandedKeys = ref([]);
const selectedKeysComputed = computed({
  get() {
    return props.selectedKeys;
  },
  set(value) {
    emits('update:selectedKeys', value);
  },
});

// 输入防抖 150ms 后进入过滤计算
const debouncedSetKeyword = debounce((value: string) => {
  filterKeyword.value = value;
}, 150);
watch(keyword, (value) => debouncedSetKeyword(value));

const getTreeData = computed({
  get() {
    return filterTreeByLabel(props.options, filterKeyword.value);
  },
  set() {
    // console.log(e);
  },
});

/**
 * 通过label 过滤节点
 * @param tree 节点树
 * @param labelToFilter 过滤关键字
 */
function filterTreeByLabel(tree, labelToFilter) {
  const filteredTree: ComponentSchema[] = [];

  tree.forEach((item: ComponentSchema) => {
    if (item.label?.includes(labelToFilter)) {
      filteredTree.push(item);
    } else if (item.children) {
      const filteredChildren = filterTreeByLabel(item.children, labelToFilter);
      if (filteredChildren.length > 0) {
        // Clone the item and replace its children
        const clonedItem = { ...item };
        clonedItem.children = filteredChildren;
        filteredTree.push(clonedItem);
      }
    }
  });

  return filteredTree;
}

function handleSelect(id: string, componentSchema: ComponentSchema) {
  selectedKeysComputed.value = [id];
  emits('nodeClick', { componentSchema, id });
}

provide(TREE_CONTEXT_KEY, {
  expandedKeys,
  handleSelect,
  selectedKeys: selectedKeysComputed,
  slots,
  treeProps: props,
});
</script>
<template>
  <div class="aigen-tree flex h-full flex-col">
    <!-- 搜素框 start -->
    <div class="aigen-search-box px-10px py-6px">
      <Input
        v-model:[bindModel]="keyword"
        placeholder="搜索节点"
        clearable
        allow-clear
      >
        <template #prefix>
          <AigenIcon name="icon--aigen--search-rounded" />
        </template>
      </Input>
    </div>
    <!-- 搜素框 end -->
    <div class="aigen-tree-main h-0 flex-1 overflow-auto">
      <AigenTreeNodes v-model:schemas="getTreeData" />
      <div
        v-show="getTreeData.length === 0"
        class="pt-42px text-center text-gray-400"
      >
        没有查询到的数据
      </div>
    </div>
  </div>
</template>
