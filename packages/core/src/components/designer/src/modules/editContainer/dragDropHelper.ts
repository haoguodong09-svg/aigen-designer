import type { CanvasDrag } from '@aigen-designer/hooks';
import type { ComponentSchema } from '@aigen-designer/types';

import { pluginManager } from '@aigen-designer/manager';
import {
  generateNewSchema,
  insertSchema,
  moveSchema,
} from '@aigen-designer/utils';

export function isSchemaInline(schema: ComponentSchema): boolean {
  const display = schema.props?.style?.display;
  if (
    display === 'inline' ||
    display === 'inline-block' ||
    display === 'inline-flex' ||
    display === 'inline-grid'
  ) {
    return true;
  }
  if (display === 'block' || display === 'flex' || display === 'grid') {
    return false;
  }
  const config = pluginManager.component.getComponentConfigByType(schema.type);
  return Boolean(config?.editConstraints?.inline);
}

/**
 * 在容器 .aigen-draggable-range 内查找指定 id 的直接子组件真实 DOM 节点
 */
export function findDirectChildNodeEl(
  containerEl: HTMLElement,
  childId: string,
): HTMLElement | null {
  const direct = containerEl.querySelector(
    `:scope > [data-aigen-id="${childId}"]`,
  ) as HTMLElement | null;
  if (direct) return direct;

  const candidates = Array.from(
    containerEl.querySelectorAll(`[data-aigen-id="${childId}"]`),
  );
  for (const el of candidates) {
    if (el.closest('.aigen-draggable-range') === containerEl) {
      return el as HTMLElement;
    }
  }
  return (candidates[0] as HTMLElement | undefined) ?? null;
}

/**
 * 从拖拽事件 target 向上回溯，查找属于当前容器直接子节点层级的组件 DOM
 */
export function findDirectChildNodeElFromTarget(
  target: HTMLElement,
  currentContainerEl: HTMLElement,
  childIds: Set<string>,
): HTMLElement | null {
  let el = target.closest('[data-aigen-id]') as HTMLElement | null;
  while (el && currentContainerEl.contains(el)) {
    const id = el.dataset.aigenId;
    if (el !== currentContainerEl && id && childIds.has(id)) {
      return el;
    }
    el = el.parentElement?.closest('[data-aigen-id]') as HTMLElement | null;
  }
  return null;
}

/**
 * 获取容器的可测量边界矩形：当 .aigen-draggable-range 使用 display: contents 透传布局时，
 * 回退到真实宿主容器 [data-aigen-id] 或父元素进行几何测量。
 */
export function getContainerMeasureRect(
  containerEl: HTMLElement,
  containerId?: string,
): DOMRect {
  const style =
    typeof getComputedStyle === 'function'
      ? getComputedStyle(containerEl)
      : null;
  if (style?.display === 'contents') {
    const hostEl =
      (containerId
        ? (containerEl.closest(
            `[data-aigen-id="${containerId}"]`,
          ) as HTMLElement | null)
        : null) || containerEl.parentElement;
    if (hostEl) {
      return hostEl.getBoundingClientRect();
    }
  }
  return containerEl.getBoundingClientRect();
}

/**
 * 容器空白区域 / 根画布边缘兜底碰撞更新：
 * - 非空容器：以最后一个子节点为参照物进行底部/末尾放置判定
 * - 空容器：锁定 POSITION.IN 穿透放置，防止边缘触发兄节点插入
 */
export function updateContainerFallbackDragOver(options: {
  canvasDrag: CanvasDrag;
  clientX: number;
  clientY: number;
  containerEl: HTMLElement | null;
  containerSchema: ComponentSchema;
  pageSchemas: ComponentSchema[];
  slotName?: string;
}) {
  const {
    canvasDrag,
    clientX,
    clientY,
    containerEl,
    containerSchema,
    pageSchemas,
    slotName,
  } = options;
  const containerId = containerSchema.id;
  if (!containerId) return;

  const config = pluginManager.component.getConfigByType(containerSchema.type);
  const children = slotName
    ? containerSchema.slots?.[slotName] || []
    : containerSchema.children || [];

  if (children.length > 0) {
    const lastChild = children[children.length - 1];
    if (lastChild?.id && containerEl) {
      const lastChildEl = findDirectChildNodeEl(containerEl, lastChild.id);
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
          { x: clientX, y: clientY },
          {
            componentName:
              lastConfig?.defaultSchema?.label ||
              lastChild.label ||
              lastChild.type,
            isContainer: false,
            isInline: isSchemaInline(lastChild),
            schemas: pageSchemas,
            slotName,
          },
        );
        return;
      }
    }
  }

  if (!containerEl) return;
  const rect = getContainerMeasureRect(containerEl, containerId);
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
    { x: clientX, y: clientY },
    {
      componentName:
        config?.defaultSchema?.label ||
        containerSchema.label ||
        containerSchema.type,
      isContainer: true,
      isInline: false,
      onlyIn: true,
      schemas: pageSchemas,
      slotName,
    },
  );
}

/**
 * 统一提交画布放置结果（原子化更新 Schema 树并记录撤销历史）
 */
export function commitCanvasDrop(
  canvasDrag: CanvasDrag,
  designer: {
    pageSchema: { schemas: ComponentSchema[] };
    revoke: { push: (type: string, isSave?: boolean) => void };
    setSelectedNode: (schema?: ComponentSchema | null) => void;
  },
) {
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
    const newSchema = generateNewSchema(dragData, designer.pageSchema.schemas);
    const success = insertSchema(
      designer.pageSchema.schemas,
      lineState.id,
      newSchema,
      lineState.position,
      lineState.slotName || undefined,
    );
    if (success) {
      designer.setSelectedNode(newSchema);
      designer.revoke.push('插入组件', true);
    }
  } else if (dragType === 'move' && dragData.id) {
    const success = moveSchema(
      designer.pageSchema.schemas,
      dragData.id,
      lineState.id,
      lineState.position,
      lineState.slotName || undefined,
    );
    if (success) {
      designer.setSelectedNode(dragData);
      designer.revoke.push('移动组件', true);
    }
  }
}
