<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, inject, onMounted, onUnmounted, ref } from 'vue';

import { useDesignerContext, useLinkMode } from '@aigen-designer/hooks';
import { findSchemaById } from '@aigen-designer/utils';

import AigenEditScreenContainer from './editScreenContainer.vue';
import AigenNodeItem from './nodeItem.vue';
import AigenPreviewWidgets from './previewWidgets.vue';
import AigenQuickLinkPopover from './QuickLinkPopover.vue';

const aigenEditRangeRef = ref<HTMLDivElement | null>(null);
const aigenPreviewWidgetsRef = ref<null | typeof AigenPreviewWidgets>(null);

const { pageSchema, props, setSelectedNode } = useDesignerContext();
const linkMode = useLinkMode();
const contextMenu = inject('contextMenu', {
  close: () => {},
  open: (_event: Event, _schema: ComponentSchema) => {},
});
const rootSchema = computed(() => {
  return pageSchema.schemas[0];
});

const getEditRangestyle = computed(() => {
  const padding =
    typeof props.canvasPadding === 'number'
      ? `${props.canvasPadding}px`
      : props.canvasPadding;
  return {
    height: '100%',
    padding,
    width: '100%',
  };
});

function setSelectedNodeById(aigenId: string | undefined) {
  const schema = findSchemaById(pageSchema.schemas, aigenId as string);
  setSelectedNode(schema);
  contextMenu.close();
}

/**
 * 关联模式激活期间禁止画布拖拽（防御守卫；拖拽本体已在 nodes.vue 通过
 * VueDraggable :disabled 禁用，此处兜底阻止 dragstart 冒泡）
 */
function handleRangeDragStart(event: DragEvent) {
  if (linkMode.isActive.value) {
    event.preventDefault();
  }
}

function handleEditRangeClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  event.stopPropagation();
  let aigenId = target.dataset?.aigenId;
  if (!aigenId) {
    // 查询其父级的 aigenId
    let parent = target.parentElement;
    while (parent) {
      if (parent.dataset?.aigenId) {
        aigenId = parent.dataset.aigenId;
        break;
      }
      parent = parent.parentElement;

      // 如果是点击操作栏，不处理
      if (parent?.classList?.contains('aigen-selected-widget')) {
        return;
      }
    }
  }
  setSelectedNodeById(aigenId);
}

onMounted(() => {
  aigenPreviewWidgetsRef.value?.handleInit(aigenEditRangeRef.value);

  // 监听 aigenEditRangeRef 点击事件（命名函数便于卸载时移除，避免监听器残留）
  aigenEditRangeRef.value?.addEventListener('click', handleEditRangeClick);
});

onUnmounted(() => {
  aigenEditRangeRef.value?.removeEventListener('click', handleEditRangeClick);
});
</script>
<template>
  <section class="aigen-edit-canvas">
    <AigenEditScreenContainer>
      <div
        ref="aigenEditRangeRef"
        class="aigen-edit-range relative overflow-auto rounded-md"
        :style="getEditRangestyle"
        @dragstart="handleRangeDragStart"
      >
        <AigenNodeItem :schema="rootSchema" />
        <AigenPreviewWidgets ref="aigenPreviewWidgetsRef" />
      </div>
    </AigenEditScreenContainer>
    <!-- 快速关联气泡：Teleport 到 body，锚定目标元素（随模式退出自动隐藏） -->
    <AigenQuickLinkPopover />
  </section>
</template>
