<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, inject, onMounted, onUnmounted, ref } from 'vue';

import {
  useCanvasDrag,
  useDesignerContext,
  useLinkMode,
  usePageManager,
} from '@aigen-designer/hooks';
import {
  findSchemaById,
  findSchemaInfoById,
  isPointerOutsideElement,
} from '@aigen-designer/utils';

import AigenCanvasNodeOverlay from './CanvasNodeOverlay.vue';
import {
  commitCanvasDrop,
  updateContainerFallbackDragOver,
} from './dragDropHelper';
import AigenEditScreenContainer from './editScreenContainer.vue';
import AigenNodeItem from './nodeItem.vue';
import AigenPreviewWidgets from './previewWidgets.vue';
import AigenQuickLinkPopover from './QuickLinkPopover.vue';

const aigenEditRangeRef = ref<HTMLDivElement | null>(null);
const aigenPreviewWidgetsRef = ref<null | typeof AigenPreviewWidgets>(null);

const designer = useDesignerContext();
const { pageSchema, props, setSelectedNode } = designer;
const pageManager = usePageManager();
const linkMode = useLinkMode();
const canvasDrag = useCanvasDrag();
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
 * 关联模式激活期间禁止画布拖拽（防御守卫；拖拽本体已在 nodes.vue 禁用，此处兜底阻止 dragstart 冒泡）
 */
function handleRangeDragStart(event: DragEvent) {
  if (linkMode.isActive.value) {
    event.preventDefault();
  }
}

/**
 * 画布外框兜底 dragover：当指针落在 .aigen-edit-range 内边距或底部空白外沿时
 * 仍允许以根页面末尾子节点或根容器完成放置
 */
function handleRangeDragOver(event: DragEvent) {
  if (
    pageManager.isInteractiveMode?.value === true ||
    linkMode.isActive.value ||
    !canvasDrag.dragState.isDragging ||
    !aigenEditRangeRef.value ||
    !rootSchema.value
  ) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect =
      canvasDrag.dragState.dragType === 'new' ? 'copy' : 'move';
  }
  const rootDraggableRange = aigenEditRangeRef.value.querySelector(
    '[data-container-id="root"]',
  ) as HTMLElement | null;
  updateContainerFallbackDragOver({
    canvasDrag,
    clientX: event.clientX,
    clientY: event.clientY,
    containerEl: rootDraggableRange || aigenEditRangeRef.value,
    containerSchema: rootSchema.value,
    pageSchemas: pageSchema.schemas,
  });
}

/**
 * 画布外框兜底 drop：在根画布内边距或底部边缘释放时仍能正常提交放置
 */
function handleRangeDrop(event: DragEvent) {
  if (!canvasDrag.dragState.isDragging) return;
  event.preventDefault();
  event.stopPropagation();
  commitCanvasDrop(canvasDrag, designer);
}

/**
 * 指针真正离开画布编辑区时清理落点指示线，防止移至侧栏后仍残留高亮线
 */
function handleRangeDragLeave(event: DragEvent) {
  if (!canvasDrag.isDragging.value || !aigenEditRangeRef.value) return;
  if (isPointerOutsideElement(aigenEditRangeRef.value, event)) {
    canvasDrag.clearDragOver();
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

  // 1. 优先从物理点击位置下的所有元素中，查找最深层具体的 data-aigen-id（对标 TinyEngine 深度优先命中）
  let aigenId: null | string = null;
  if (event.clientX && event.clientY) {
    const elements = document.elementsFromPoint(event.clientX, event.clientY);
    for (const elem of elements) {
      if (elem instanceof HTMLElement) {
        // 排除操作栏本身
        if (elem.closest('.aigen-selected-widget')) continue;
        const candidateId =
          elem.dataset?.aigenId ||
          elem.closest('[data-aigen-id]')?.getAttribute('data-aigen-id');
        if (candidateId && candidateId !== 'root') {
          aigenId = candidateId;
          break;
        }
      }
    }
  }

  // 2. 回退机制：若 elementsFromPoint 未命中，通过 target 向上查询最近的祖先 aigenId
  if (!aigenId) {
    aigenId = target.dataset?.aigenId || null;
    if (!aigenId) {
      const parent = target.closest('[data-aigen-id]') as HTMLElement | null;
      if (parent?.dataset?.aigenId) {
        aigenId = parent.dataset.aigenId;
      }
    }
  }

  if (!aigenId || aigenId === 'root') {
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
        @dragover="handleRangeDragOver"
        @drop="handleRangeDrop"
        @dragleave="handleRangeDragLeave"
      >
        <AigenNodeItem :schema="rootSchema" :draggable="false" />
        <AigenPreviewWidgets ref="aigenPreviewWidgetsRef" />
        <AigenCanvasNodeOverlay :container-ref="aigenEditRangeRef" />
      </div>
    </AigenEditScreenContainer>
    <!-- 快速关联气泡：Teleport 到 body，锚定目标元素（随模式退出自动隐藏） -->
    <AigenQuickLinkPopover />
  </section>
</template>
