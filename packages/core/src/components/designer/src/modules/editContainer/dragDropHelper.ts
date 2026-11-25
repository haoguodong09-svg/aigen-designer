import type { CanvasDrag } from '@aigen-designer/hooks';
import type { ComponentSchema } from '@aigen-designer/types';

import { pluginManager } from '@aigen-designer/manager';
import {
  generateNewSchema,
  insertSchema,
  moveSchema,
} from '@aigen-designer/utils';

export function isSchemaInline(schema: ComponentSchema): boolean {
  const config = pluginManager.component.getComponentConfigByType(schema.type);
  return Boolean(config?.editConstraints?.inline);
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
}) {
  const {
    canvasDrag,
    clientX,
    clientY,
    containerEl,
    containerSchema,
    pageSchemas,
  } = options;
  const containerId = containerSchema.id;
  if (!containerId) return;

  const config = pluginManager.component.getConfigByType(containerSchema.type);
  const children = containerSchema.children || [];

  if (children.length > 0) {
    const lastChild = children[children.length - 1];
    if (lastChild?.id && containerEl) {
      const lastChildEl = (containerEl.querySelector(
        `:scope > .aigen-node-item[data-aigen-id="${lastChild.id}"]`,
      ) ||
        containerEl.querySelector(
          `.aigen-node-item[data-aigen-id="${lastChild.id}"]`,
        )) as HTMLElement | null;
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
          },
        );
        return;
      }
    }
  }

  if (!containerEl) return;
  const rect = containerEl.getBoundingClientRect();
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
    );
    if (success) {
      designer.setSelectedNode(dragData);
      designer.revoke.push('移动组件', true);
    }
  }
}
