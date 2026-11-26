<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, inject, onMounted, onUnmounted } from 'vue';

import {
  useCanvasDrag,
  useDesignerContext,
  useLinkMode,
  usePageManager,
} from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { findSchemaById } from '@aigen-designer/utils';

import {
  commitCanvasDrop,
  findDirectChildNodeElFromTarget,
  isSchemaInline,
  updateContainerFallbackDragOver,
} from './dragDropHelper';
import AigenNodeItem from './nodeItem.vue';

defineOptions({
  name: 'EditNodeItem',
});
const props = withDefaults(
  defineProps<{
    containerSchema?: ComponentSchema;
    schemas: ComponentSchema[];
    slotName?: string;
  }>(),
  {
    containerSchema: undefined,
    slotName: undefined,
  },
);
const emit = defineEmits(['update:schemas']);
const designer = useDesignerContext();
const pageManager = usePageManager();
const linkMode = useLinkMode();
const canvasDrag = useCanvasDrag();
const contextMenu = inject('contextMenu', {
  close: () => {},
  open: (_event: Event, _schema: ComponentSchema) => {},
});

// 画布交互演练模式：禁用拖拽与节点级点击遮罩，让组件接收真实交互事件
const interactiveMode = computed(
  () => pageManager.isInteractiveMode?.value === true,
);
const modelSchemas = computed({
  get: () => props.schemas,
  set: (val) => emit('update:schemas', val.filter(Boolean)),
});

/**
 * 判断节点是否支持被抓取拖拽移动
 */
function isElementDraggable(element: ComponentSchema): boolean {
  if (interactiveMode.value || linkMode.isActive.value) return false;
  if (element.id === designer.pageSchema.schemas[0]?.id) return false;
  const config = pluginManager.component.getConfigByType(element.type);
  if (config?.editConstraints?.immovable || config?.editConstraints?.locked) {
    return false;
  }
  return true;
}

/**
 * 原生拖拽发起（完全解耦 DOM，仅向全局状态机注册）
 */
function handleNodeDragStart(element: ComponentSchema, event: DragEvent) {
  if (!isElementDraggable(element)) {
    event.preventDefault();
    return;
  }
  event.stopPropagation();
  if (event.dataTransfer && element.id) {
    event.dataTransfer.setData('text/plain', element.id);
    event.dataTransfer.effectAllowed = 'move';
  }
  canvasDrag.startDrag(
    element,
    'move',
    event.currentTarget as HTMLElement,
    event,
  );
}

function handleNodeDragEnd() {
  canvasDrag.endDrag();
}

/**
 * 拖拽移动经过监听：几何碰撞判定与虚拟指示线更新（全盘对标 TinyEngine 容器判定与参照物定位）
 */
function handleDragOver(event: DragEvent) {
  if (interactiveMode.value || linkMode.isActive.value) return;
  if (!canvasDrag.dragState.isDragging) return;

  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect =
      canvasDrag.dragState.dragType === 'new' ? 'copy' : 'move';
  }

  const target = event.target as HTMLElement | null;
  if (!target) return;

  // 当前监听此事件的容器元素 (.aigen-draggable-range)
  const currentContainerEl = event.currentTarget as HTMLElement | null;

  // 1. 优先命中当前容器内部的直接子节点真实 DOM（[data-aigen-id]）
  // 严格限定在当前容器 direct children 集合内，避免跨容器误命中祖先节点
  let childItemEl: HTMLElement | null = null;
  if (currentContainerEl && target !== currentContainerEl) {
    const childIds = new Set(
      modelSchemas.value.map((item) => item.id).filter(Boolean),
    );
    childItemEl = findDirectChildNodeElFromTarget(
      target,
      currentContainerEl,
      childIds,
    );
  }

  if (childItemEl && childItemEl.dataset.aigenId) {
    const targetId = childItemEl.dataset.aigenId;
    const targetSchema = findSchemaById(designer.pageSchema.schemas, targetId);
    if (!targetSchema) return;

    const config = pluginManager.component.getConfigByType(targetSchema.type);
    const isInlineNode = isSchemaInline(targetSchema);
    const rect = childItemEl.getBoundingClientRect();

    // 检查此子节点是否本身是一个可放置容器（例如卡片、栅格列等，但排除 childImmovable 的 row/tabs）
    const isTargetAContainer = Boolean(
      (targetSchema.children !== undefined ||
        config?.defaultSchema?.children !== undefined ||
        (config as any)?.isContainer) &&
        !config?.editConstraints?.childImmovable,
    );

    canvasDrag.updateDragOver(
      targetId,
      {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      },
      { x: event.clientX, y: event.clientY },
      {
        componentName:
          config?.defaultSchema?.label ||
          targetSchema.label ||
          targetSchema.type,
        isContainer: isTargetAContainer,
        isInline: isInlineNode,
        schemas: designer.pageSchema.schemas,
        slotName: props.slotName,
      },
    );
    return;
  }

  // 2. 如果未命中当前容器内的任何子节点（例如空容器 Col、空 TabPane，或鼠标处于容器内子节点下方的空白区域）：
  // 此时命中当前容器本身 (aigen-draggable-range)
  const containerEl =
    currentContainerEl ||
    (target.closest('.aigen-draggable-range') as HTMLElement | null);
  const containerId =
    props.containerSchema?.id ||
    containerEl?.dataset.containerId ||
    containerEl?.dataset.aigenId;

  if (containerId) {
    const containerSchema = findSchemaById(
      designer.pageSchema.schemas,
      containerId,
    );
    if (!containerSchema) return;

    updateContainerFallbackDragOver({
      canvasDrag,
      clientX: event.clientX,
      clientY: event.clientY,
      containerEl: containerEl || (event.currentTarget as HTMLElement),
      containerSchema,
      pageSchemas: designer.pageSchema.schemas,
      slotName: props.slotName,
    });
  }
}

/**
 * 放置落点处理（原子化更新 JSON Schema 树，触发撤销历史记录）
 */
function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  commitCanvasDrop(canvasDrag, designer);
}

/**
 * 获取节点的schema
 * @param {Element} target 节点元素
 * @returns {ComponentSchema | null} 节点的schema
 */
function getNodeSchema(target: HTMLElement | null) {
  if (!target?.closest) return null;

  // 若鼠标直接落在空容器占位区 (.aigen-draggable-range) 上，通过 data-container-id 解析宿主容器
  if (
    target.classList.contains('aigen-draggable-range') &&
    target.dataset?.containerId
  ) {
    return getSchemaByAigenId(target.dataset.containerId);
  }

  // 优先检查当前元素
  if (target.dataset?.aigenId) {
    return getSchemaByAigenId(target.dataset.aigenId);
  }

  // 检查直接子元素（只向下查询一级）
  if (!target.classList.contains('aigen-draggable-range')) {
    const directChild = target.querySelector(
      ':scope > [data-aigen-id]',
    ) as HTMLElement | null;
    if (directChild?.dataset?.aigenId) {
      return getSchemaByAigenId(directChild.dataset.aigenId);
    }
  }

  // 向父级查找
  const parentElement = target.closest('[data-aigen-id]') as HTMLElement | null;
  if (parentElement?.dataset?.aigenId) {
    return getSchemaByAigenId(parentElement.dataset.aigenId);
  }

  return null;
}

/**
 * 根据aigenId获取schema的辅助函数
 */
function getSchemaByAigenId(aigenId: string) {
  const instance = pageManager.findInstance(aigenId);
  return instance?.exposed?.schema || null;
}

/** 关联模式点选：按 id 解析页面 schema */
function getSchemaForLinkPick(aigenId: string) {
  return findSchemaById(designer.pageSchema.schemas, aigenId);
}

function setHoverNode(event: Event) {
  if (linkMode.isActive.value) return;
  const schema = getNodeSchema(event.target as HTMLElement | null);
  event.stopPropagation();
  designer.setHoverNode(schema);
}

// 关联模式画布点选：nodes.vue 为递归组件，模块级计数保证 document 委托监听只注册一次
let linkPickerCount = 0;

function handleLinkModeClick(event: MouseEvent) {
  if (!linkMode.isActive.value) return;
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (!target.closest('.aigen-edit-range')) return;
  if (target.closest('.aigen-event-badge, .aigen-selected-widget')) return;
  const nodeElement = target.closest('[data-aigen-id]') as HTMLElement | null;
  const aigenId = nodeElement?.dataset.aigenId;
  if (aigenId) {
    const schema = getSchemaForLinkPick(aigenId);
    if (schema) {
      event.stopPropagation();
      linkMode.pick(schema);
      return;
    }
  }
  event.stopPropagation();
  linkMode.handleBlankClick();
}

onMounted(() => {
  linkPickerCount++;
  if (linkPickerCount === 1) {
    document.addEventListener('click', handleLinkModeClick, true);
  }
});

onUnmounted(() => {
  linkPickerCount--;
  if (linkPickerCount === 0) {
    document.removeEventListener('click', handleLinkModeClick, true);
  }
});
</script>

<template>
  <div
    class="aigen-draggable-range"
    :class="{
      'aigen-interactive-mode': interactiveMode,
      'is-contents':
        modelSchemas.length > 0 &&
        props.containerSchema?.id !== designer.pageSchema.schemas[0]?.id,
      'is-empty': modelSchemas.length === 0,
    }"
    :data-container-id="props.containerSchema?.id"
    :data-slot-name="props.slotName || undefined"
    @mouseover.stop="setHoverNode"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <AigenNodeItem
      v-for="element in modelSchemas"
      :key="element.id"
      :schema="element"
      :draggable="isElementDraggable(element)"
      :class="{
        'aigen-inline': isSchemaInline(element),
        'is-dragging-source': canvasDrag.dragState.dragData?.id === element.id,
        'aigen-node--link-active': linkMode.isActive.value,
        'aigen-node--link-phase-target':
          linkMode.state.value === 'select-target',
      }"
      @dragstart="handleNodeDragStart(element, $event)"
      @dragend="handleNodeDragEnd"
      @contextmenu.stop="contextMenu.open($event, element)"
    />
  </div>
</template>

<style scoped>
/* 关联模式：候选节点悬停交互预览 */
[data-aigen-id].aigen-node--link-active {
  outline: 1px dashed transparent;
  outline-offset: -1px;
}

[data-aigen-id].aigen-node--link-active:hover {
  border-radius: 6px;
  outline-color: rgba(22, 119, 255, 0.75);
  cursor: pointer;
}

[data-aigen-id].aigen-node--link-active.aigen-node--link-phase-target:hover {
  border-radius: 6px;
  outline-color: rgba(82, 196, 26, 0.85);
  cursor: pointer;
}
</style>
