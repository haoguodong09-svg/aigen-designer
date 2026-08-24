<script lang="ts" setup>
import { computed } from 'vue';

import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { ComponentSchema } from '@aigen-designer/types';

import AigenAttributeItem from '../attribute/modules/attributeItem.vue';

const designer = useDesignerContext();
const componentConfigs = pluginManager.component.getComponentConfigs();

const selectedNode = computed(() => {
  return designer.state.selectedNode;
});

const defaultStyle = [
  {
    field: 'props.style.width',
    label: '宽度',
    type: 'AigenInputSize',
  },
  {
    field: 'props.style.height',
    label: '高度',
    type: 'AigenInputSize',
  },
  {
    field: 'props.style.padding',
    label: '内边距',
    type: 'AigenInputSize',
  },
  {
    field: 'props.style.margin',
    label: '外边距',
    type: 'AigenInputSize',
  },
  {
    field: 'props.style.backgroundColor',
    label: '背景色',
    props: {
      style: {
        // width: '60px'
      },
      type: 'color',
    },
    type: 'color-picker',
  },
];

// 获取组件样式配置
const componentStyles = computed<ComponentSchema[]>(() => {
  if (!selectedNode.value || !selectedNode.value.type) {
    return [];
  }
  const style = componentConfigs[selectedNode.value.type]?.config?.style ?? [];
  return [...defaultStyle, ...style];
});
</script>
<template>
  <div :key="selectedNode?.id" class="aigen-style-view">
    <div v-for="item in componentStyles" :key="item.field">
      <AigenAttributeItem :schema="item" />
    </div>
  </div>
</template>