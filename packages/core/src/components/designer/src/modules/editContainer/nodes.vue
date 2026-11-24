<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, inject, onMounted, onUnmounted } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import {
  useCanvasDrag,
  useDesignerContext,
  useLinkMode,
  usePageManager,
} from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import {
  findSchemaById,
  generateNewSchema,
  insertSchema,
  moveSchema,
} from '@aigen-designer/utils';

import EventBadge from './EventBadge.vue';
import AigenNodeItem from './nodeItem.vue';

defineOptions({
  name: 'EditNodeItem',
});
const props = withDefaults(
  defineProps<{
    containerSchema?: ComponentSchema;
    schemas: ComponentSchema[];
  }>(),
  {
    containerSchema: undefined,
  },
);
const emit = defineEmits(['update:schemas']);
const designer = useDesignerContext();
const revoke = designer.revoke;
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

  // 1. 优先命中当前容器内部的直接子节点元素 (.aigen-node-item)
  // 注意：必须严格确保命中的子节点是当前容器 currentContainerEl 的后代元素！
  // 绝对不能跨出当前容器，向上查找到外部祖先节点的 .aigen-node-item（否则会导致子容器落点被提升到父容器）
  let childItemEl: HTMLElement | null = null;
  if (currentContainerEl && target !== currentContainerEl) {
    const candidate = target.closest('.aigen-node-item') as HTMLElement | null;
    if (candidate && currentContainerEl.contains(candidate)) {
      childItemEl = candidate;
    }
  }

  if (childItemEl && childItemEl.dataset.aigenId) {
    const targetId = childItemEl.dataset.aigenId;
    const targetSchema = findSchemaById(designer.pageSchema.schemas, targetId);
    if (!targetSchema) return;

    const config = pluginManager.component.getConfigByType(targetSchema.type);
    const isInlineNode = isInline(targetSchema);
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

    const config = pluginManager.component.getConfigByType(
      containerSchema.type,
    );
    const rect = (
      containerEl || (event.currentTarget as HTMLElement)
    ).getBoundingClientRect();

    // 对标 TinyEngine：若当前容器已有子节点，以最后一个子节点为参照物进行底部放置
    const children = containerSchema.children || [];
    if (children.length > 0) {
      const lastChild = children[children.length - 1];
      if (lastChild?.id) {
        const lastChildEl = containerEl?.querySelector(
          `[data-aigen-id="${lastChild.id}"]`,
        ) as HTMLElement | null;
        if (lastChildEl) {
          const lastRect = lastChildEl.getBoundingClientRect();
          const lastConfig = pluginManager.component.getConfigByType(
            lastChild.type,
          );
          canvasDrag.updateDragOver(
            lastChild.id,
            {
              bottom: lastRect.bottom,
              height: lastRect.height,
              left: lastRect.left,
              right: lastRect.right,
              top: lastRect.top,
              width: lastRect.width,
            },
            { x: event.clientX, y: event.clientY },
            {
              componentName:
                lastConfig?.defaultSchema?.label ||
                lastChild.label ||
                lastChild.type,
              isContainer: false,
              isInline: isInline(lastChild),
              schemas: designer.pageSchema.schemas,
            },
          );
          return;
        }
      }
    }

    // 若当前容器为空（例如空的 Col、空的 TabPane、空的 Card、空的 Form）：
    // 直接进入容器穿透放置 (POSITION.IN)
    canvasDrag.updateDragOver(
      containerId,
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
          containerSchema.label ||
          containerSchema.type,
        isContainer: true,
        isInline: false,
        schemas: designer.pageSchema.schemas,
      },
    );
  }
}

/**
 * 放置落点处理（原子化更新 JSON Schema 树，触发撤销历史记录）
 */
function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();

  const { dragData, dragType, lineState } = canvasDrag.endDrag();
  if (
    !dragData ||
    !lineState.id ||
    !lineState.position ||
    lineState.forbidden
  ) {
    return;
  }

  if (dragType === 'new') {
    const newSchema = generateNewSchema(dragData);
    const success = insertSchema(
      designer.pageSchema.schemas,
      lineState.id,
      newSchema,
      lineState.position,
    );
    if (success) {
      designer.setSelectedNode(newSchema);
      revoke.push('插入组件', true);
    }
  } else if (dragType === 'move' && dragData.id) {
    const success = moveSchema(
      designer.pageSchema.schemas,
      dragData.id,
      lineState.id,
      lineState.position,
    );
    if (success) {
      designer.setSelectedNode(dragData);
      revoke.push('移动组件', true);
    }
  }
}

/**
 * 获取节点的schema
 * @param {Element} target 节点元素
 * @returns {ComponentSchema | null} 节点的schema
 */
function getNodeSchema(target: HTMLElement | null) {
  if (!target?.closest) return null;

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

function isInline(schema: ComponentSchema) {
  const config = pluginManager.component.getComponentConfigByType(schema.type);
  return config?.editConstraints?.inline || false;
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
      'is-empty': modelSchemas.length === 0,
    }"
    :data-container-id="props.containerSchema?.id"
    :data-aigen-id="props.containerSchema?.id"
    @mouseover.stop="setHoverNode"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <div
      v-for="element in modelSchemas"
      :key="element.id"
      class="aigen-node-item"
      :class="{
        'aigen-inline': isInline(element),
        'is-dragging-source': canvasDrag.dragState.dragData?.id === element.id,
        'aigen-node--link-source': linkMode.source.value?.id === element.id,
        'aigen-node--link-target': linkMode.target.value?.id === element.id,
        'aigen-node--link-active': linkMode.isActive.value,
        'aigen-node--link-phase-target':
          linkMode.state.value === 'select-target',
      }"
      :data-aigen-id="element.id"
      :draggable="isElementDraggable(element)"
      @dragstart="handleNodeDragStart(element, $event)"
      @dragend="handleNodeDragEnd"
      @contextmenu.stop="contextMenu.open($event, element)"
    >
      <div class="aigen-node-badge-wrap">
        <!-- 关联模式：源与目标语义标签 -->
        <div
          v-if="linkMode.source.value?.id === element.id"
          class="aigen-link-role-badge aigen-link-role-badge--source"
        >
          <AigenIcon
            name="icon--behavior--thunderbolt"
            class="mr-1 text-[11px]"
          />
          <span>触发源</span>
        </div>
        <div
          v-if="linkMode.target.value?.id === element.id"
          class="aigen-link-role-badge aigen-link-role-badge--target"
        >
          <AigenIcon
            name="icon--behavior--experiment"
            class="mr-1 text-[11px]"
          />
          <span>关联目标</span>
        </div>

        <AigenNodeItem :schema="element" />
        <EventBadge :schema="element" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 角标叠加层定位容器：仅提供相对定位，不影响节点自身布局 */
.aigen-node-badge-wrap {
  position: relative;
}

/* 内联组件（如按钮）保持行内布局 */
.aigen-node-item.aigen-inline > .aigen-node-badge-wrap {
  display: inline-block;
}

/* 关联模式：源组件高亮样式 */
.aigen-node-item.aigen-node--link-source {
  position: relative;
  border-radius: 6px;
  outline: 2px solid #1677ff;
  outline-offset: -1px;
  box-shadow:
    inset 0 0 0 1px rgba(22, 119, 255, 0.2),
    0 2px 8px rgba(22, 119, 255, 0.12);
  background-color: rgba(22, 119, 255, 0.035);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 关联模式：目标组件高亮样式 */
.aigen-node-item.aigen-node--link-target {
  position: relative;
  border-radius: 6px;
  outline: 2px solid #52c41a;
  outline-offset: -1px;
  box-shadow:
    inset 0 0 0 1px rgba(82, 196, 26, 0.2),
    0 2px 8px rgba(82, 196, 26, 0.12);
  background-color: rgba(82, 196, 26, 0.035);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 关联模式：候选节点基础状态 */
.aigen-node-item.aigen-node--link-active {
  outline: 1px dashed transparent;
  outline-offset: -1px;
}

/* 关联模式：候选节点悬停交互预览 */
.aigen-node-item.aigen-node--link-active:not(.aigen-node--link-source):not(
    .aigen-node--link-target
  ):hover {
  border-radius: 6px;
  outline-color: rgba(22, 119, 255, 0.75);
  background-color: rgba(22, 119, 255, 0.02);
  cursor: pointer;
}

.aigen-node-item.aigen-node--link-active.aigen-node--link-phase-target:not(
    .aigen-node--link-source
  ):not(.aigen-node--link-target):hover {
  border-radius: 6px;
  outline-color: rgba(82, 196, 26, 0.85);
  background-color: rgba(82, 196, 26, 0.02);
  cursor: pointer;
}

/* 浮动语义徽标：源 / 目标 */
.aigen-link-role-badge {
  position: absolute;
  top: 4px;
  right: 8px;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  pointer-events: none;
  white-space: nowrap;
  animation: aigen-badge-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.aigen-link-role-badge--source {
  background: #e6f4ff;
  border: 1px solid #91caff;
  color: #0958d9;
  box-shadow: 0 1px 3px rgba(22, 119, 255, 0.12);
}

.aigen-link-role-badge--target {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #389e0d;
  box-shadow: 0 1px 3px rgba(82, 196, 26, 0.12);
}

@keyframes aigen-badge-pop {
  0% {
    transform: scale(0.7) translateY(4px);
    opacity: 0;
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
</style>
