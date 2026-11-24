<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { nextTick, ref, watch } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';

defineOptions({
  name: 'CanvasBreadcrumb',
});

const designer = useDesignerContext();
const breadcrumbContainerRef = ref<HTMLDivElement | null>(null);

function getNodeLabel(schema: ComponentSchema) {
  if (!schema) return '';
  if (schema.id === 'root') return '页面';
  return (
    schema.label ??
    pluginManager.component.getConfigByType(schema.type)?.defaultSchema
      ?.label ??
    schema.type ??
    '未命名组件'
  );
}

function handleSelect(schema: ComponentSchema) {
  designer.setSelectedNode(schema);
}

// 自动滚动到末尾最新选中的节点
watch(
  () => designer.state.selectedNode?.id,
  () => {
    nextTick(() => {
      if (breadcrumbContainerRef.value) {
        breadcrumbContainerRef.value.scrollLeft =
          breadcrumbContainerRef.value.scrollWidth;
      }
    });
  },
);
</script>

<template>
  <div
    v-if="designer.state.selectedNode && designer.state.matched.length > 0"
    ref="breadcrumbContainerRef"
    class="aigen-canvas-bottom-breadcrumb flex select-none items-center overflow-x-auto px-3"
  >
    <div
      v-for="(item, index) in designer.state.matched"
      :key="item.id || index"
      class="aigen-breadcrumb-item flex flex-shrink-0 cursor-pointer items-center"
      :class="{
        'is-active': index === designer.state.matched.length - 1,
      }"
      @click="handleSelect(item)"
      @mouseenter.stop="designer.setHoverNode(item)"
      @mouseleave.stop="designer.setHoverNode(null)"
    >
      <span
        class="aigen-breadcrumb-text rounded px-1.5 py-0.5 text-xs transition-colors"
      >
        {{ getNodeLabel(item) }}
      </span>
      <AigenIcon
        v-if="index < designer.state.matched.length - 1"
        name="icon--aigen--arrow-forward-ios-rounded"
        class="aigen-breadcrumb-separator mx-1 text-[10px] opacity-40"
      />
    </div>
  </div>
  <div
    v-else
    class="aigen-canvas-bottom-breadcrumb flex select-none items-center px-3"
  >
    <span class="text-xs text-[var(--aigen-muted-foreground)] opacity-60">
      未选中任何节点
    </span>
  </div>
</template>
