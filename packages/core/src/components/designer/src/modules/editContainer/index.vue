<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, inject, onMounted, onUnmounted, ref } from 'vue';

import { useDesignerContext, useLinkMode } from '@aigen-designer/hooks';
import { findSchemaById, findSchemaInfoById } from '@aigen-designer/utils';

import AigenEditScreenContainer from './editScreenContainer.vue';
import AigenNodeItem from './nodeItem.vue';
import AigenPreviewWidgets from './previewWidgets.vue';
import AigenQuickLinkPopover from './QuickLinkPopover.vue';

const aigenEditRangeRef = ref<HTMLDivElement | null>(null);
const aigenPreviewWidgetsRef = ref<null | typeof AigenPreviewWidgets>(null);

const designer = useDesignerContext();
const { pageSchema, props, setSelectedNode } = designer;
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
  // 关联模式期间不触发普通节点选中操作，避免常规编辑工具栏遮挡关联界面
  if (linkMode.isActive.value) return;

  const target = event.target as HTMLElement | null;
  if (!target) return;

  // 如果是点击操作栏或选中框控制柄，不重复处理
  if (target.closest('.aigen-selected-widget')) {
    return;
  }

  event.stopPropagation();
  let aigenId = target.dataset?.aigenId;
  if (!aigenId) {
    // 查询最近的拥有 aigenId 的祖先元素
    const parent = target.closest('[data-aigen-id]') as HTMLElement | null;
    if (parent?.dataset?.aigenId) {
      aigenId = parent.dataset.aigenId;
    }
  }

  if (!aigenId) {
    setSelectedNode(rootSchema.value);
    contextMenu.close();
    return;
  }

  const currentSelected = designer.state.selectedNode;

  // 1. Alt + Click 快捷强制选中直接父级
  if (event.altKey) {
    const info = findSchemaInfoById(pageSchema.schemas, aigenId);
    if (info?.parentSchema && info.parentSchema.id !== 'root') {
      setSelectedNode(info.parentSchema);
      contextMenu.close();
      return;
    }
  }

  // 2. 原地重复点击已选中组件：沿祖先链向上钻取（Drill-up）
  if (currentSelected && currentSelected.id === aigenId) {
    const matched = designer.state.matched;
    const currentIndex = matched.findIndex((item: any) => item.id === aigenId);
    if (currentIndex > 0) {
      const parentNode = matched[currentIndex - 1];
      if (parentNode && parentNode.id !== 'root') {
        setSelectedNode(parentNode);
        contextMenu.close();
        return;
      }
    }
  }

  setSelectedNodeById(aigenId);
}

/**
 * 键盘层级穿梭快捷键（对标 TinyEngine keyboard.ts）：
 * - Escape / ArrowLeft / Alt+ArrowUp：向上选择直接父级
 * - Enter / ArrowRight / Alt+ArrowDown：向下进入首个子级
 */
function handleCanvasKeyDown(event: KeyboardEvent) {
  const activeEl = document.activeElement as HTMLElement | null;
  if (
    activeEl &&
    (activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable)
  ) {
    return;
  }

  const current = designer.state.selectedNode;
  if (!current || current.id === 'root') return;

  const matched = designer.state.matched;
  const currentIndex = matched.findIndex((item: any) => item.id === current.id);

  if (
    event.key === 'Escape' ||
    event.key === 'ArrowLeft' ||
    (event.altKey && event.key === 'ArrowUp')
  ) {
    if (currentIndex > 0) {
      event.preventDefault();
      setSelectedNode(matched[currentIndex - 1]);
      contextMenu.close();
    }
  } else if (
    (event.key === 'Enter' ||
      event.key === 'ArrowRight' ||
      (event.altKey && event.key === 'ArrowDown')) &&
    current.children &&
    current.children.length > 0
  ) {
    event.preventDefault();
    setSelectedNode(current.children[0]);
    contextMenu.close();
  }
}

onMounted(() => {
  aigenPreviewWidgetsRef.value?.handleInit(aigenEditRangeRef.value);

  // 监听 aigenEditRangeRef 点击事件（命名函数便于卸载时移除，避免监听器残留）
  aigenEditRangeRef.value?.addEventListener('click', handleEditRangeClick);
  window.addEventListener('keydown', handleCanvasKeyDown);
});

onUnmounted(() => {
  aigenEditRangeRef.value?.removeEventListener('click', handleEditRangeClick);
  window.removeEventListener('keydown', handleCanvasKeyDown);
});
</script>
<template>
  <section class="aigen-edit-canvas">
    <AigenEditScreenContainer>
      <div
        ref="aigenEditRangeRef"
        class="aigen-edit-range relative overflow-y-auto overflow-x-hidden rounded-md"
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
