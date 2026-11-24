/**
 * 几何碰撞检测算法与防环死锁引擎（对标 OpenTiny TinyEngine container.ts）
 */
import type { ComponentSchema } from '@aigen-designer/types';

export const POSITION = Object.freeze({
  BOTTOM: 'bottom',
  IN: 'in',
  LEFT: 'left',
  RIGHT: 'right',
  TOP: 'top',
} as const);

export type PositionType = (typeof POSITION)[keyof typeof POSITION];

export interface CollisionRect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

export interface PosLineResult {
  forbidden: boolean;
  type: PositionType;
}

/**
 * 碰撞位置判定（完全对标 TinyEngine getPosLine 算法）
 * @param rect 目标元素相对于视口或画布容器的包围盒
 * @param mousePos 鼠标当前坐标
 * @param options 容器与内联选项
 */
export function calculatePosLine(
  rect: CollisionRect,
  mousePos: { x: number; y: number },
  options: {
    isContainer: boolean;
    isInline?: boolean;
  },
): PosLineResult {
  const lineAbs = 20;
  // 阈值自适应收敛：高度或宽度的三分之一，最高不超过 20px
  const yAbs = Math.min(lineAbs, rect.height / 3);
  const xAbs = Math.min(lineAbs, rect.width / 3);

  let type: PositionType;

  // 1. 上下边缘判定（高优先级）
  if (mousePos.y < rect.top + yAbs) {
    type = POSITION.TOP;
  } else if (mousePos.y > rect.bottom - yAbs) {
    type = POSITION.BOTTOM;
  }
  // 2. 内联/流式组件的左右边缘判定
  else if (options.isInline && mousePos.x < rect.left + xAbs) {
    type = POSITION.LEFT;
  } else if (options.isInline && mousePos.x > rect.right - xAbs) {
    type = POSITION.RIGHT;
  }
  // 3. 中心区域判定容器穿透（直接拖入容器内部）
  else if (options.isContainer) {
    type = POSITION.IN;
  } else {
    // 默认回退为底部放置
    type = POSITION.BOTTOM;
  }

  return {
    forbidden: false,
    type,
  };
}

/**
 * 递归判断 descendantId 是否为 ancestorId 的自身或后代（防环死锁检测）
 * @param schemas 根 Schema 树列表
 * @param ancestorId 被拖拽的祖先节点 ID
 * @param descendantId 目标放置节点 ID
 */
export function isAncestor(
  schemas: ComponentSchema[],
  ancestorId: string,
  descendantId: string,
): boolean {
  if (!ancestorId || !descendantId) return false;
  // 自身不能拖入自身
  if (ancestorId === descendantId) return true;

  // 深度优先查找节点
  function findNode(
    list: ComponentSchema[],
    targetId: string,
  ): ComponentSchema | null {
    for (const item of list) {
      if (item.id === targetId) return item;
      if (item.children?.length) {
        const found = findNode(item.children, targetId);
        if (found) return found;
      }
      if (item.slots) {
        for (const slotKey of Object.keys(item.slots)) {
          const slotList = item.slots[slotKey];
          if (slotList?.length) {
            const found = findNode(slotList, targetId);
            if (found) return found;
          }
        }
      }
    }
    return null;
  }

  const ancestorNode = findNode(schemas, ancestorId);
  if (!ancestorNode) return false;

  // 检查 descendantId 是否在 ancestorNode 的子树或 slots 中
  const inChildren = ancestorNode.children?.length
    ? Boolean(findNode(ancestorNode.children, descendantId))
    : false;
  if (inChildren) return true;

  if (ancestorNode.slots) {
    for (const slotKey of Object.keys(ancestorNode.slots)) {
      const slotList = ancestorNode.slots[slotKey];
      if (slotList?.length && findNode(slotList, descendantId)) {
        return true;
      }
    }
  }

  return false;
}
