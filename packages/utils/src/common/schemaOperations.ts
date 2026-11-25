/**
 * Schema 树原子化变换引擎（完全解耦 DOM，直接驱动响应式 Schema 树重排）
 */
import type { ComponentSchema } from '@aigen-designer/types';

import type { PositionType } from './dragCollision';

import { findSchemaById, findSchemaInfoById } from './data';
import { isAncestor, POSITION } from './dragCollision';

/**
 * 安全查找节点信息（将 findSchemaInfoById 未找到抛错转为返回 null）
 */
function safeFindSchemaInfoById(
  schemas: ComponentSchema[],
  id: string,
): null | ReturnType<typeof findSchemaInfoById> {
  try {
    return findSchemaInfoById(schemas, id);
  } catch {
    return null;
  }
}

/**
 * 根据 ID 查找并从 Schema 树中移除指定节点
 * @param schemas 根 Schema 列表
 * @param id 要移除的节点 ID
 * @returns 移除的节点对象，若未找到则返回 null
 */
export function removeSchemaById(
  schemas: ComponentSchema[],
  id: string,
): ComponentSchema | null {
  if (!id) return null;
  const info = safeFindSchemaInfoById(schemas, id);
  if (!info || info.index === -1) return null;

  const [removed] = info.list.splice(info.index, 1);
  return removed ?? null;
}

/**
 * 将节点按照指定方位插入到目标节点附近或容器内部
 * @param schemas 根 Schema 列表
 * @param targetId 目标节点 ID
 * @param nodeToInsert 待插入的 Schema 节点
 * @param position 插入方位 (top, bottom, left, right, in)
 * @returns 是否插入成功
 */
export function insertSchema(
  schemas: ComponentSchema[],
  targetId: string,
  nodeToInsert: ComponentSchema,
  position: PositionType,
  slotName?: string,
): boolean {
  if (!targetId || !nodeToInsert) return false;

  // 1. 如果是插入容器内部 (POSITION.IN)
  if (position === POSITION.IN) {
    const targetNode = findSchemaById(schemas, targetId);
    if (!targetNode) return false;

    if (slotName) {
      if (!targetNode.slots) {
        targetNode.slots = {};
      }
      if (!targetNode.slots[slotName]) {
        targetNode.slots[slotName] = [];
      }
      targetNode.slots[slotName].push(nodeToInsert);
      return true;
    }

    if (!targetNode.children) {
      targetNode.children = [];
    }
    targetNode.children.push(nodeToInsert);
    return true;
  }

  // 2. 插入到目标节点同级的前后位置
  const targetInfo = safeFindSchemaInfoById(schemas, targetId);
  if (!targetInfo || targetInfo.index === -1) return false;

  const { index, schema: targetSchema, list } = targetInfo;

  // 禁止在根页面节点 ('root' / 'page') 同级插入兄弟节点，保证单根页面结构不被破坏
  if (
    list === schemas &&
    (targetId === 'root' || targetSchema?.type === 'page')
  ) {
    return false;
  }

  if (position === POSITION.TOP || position === POSITION.LEFT) {
    list.splice(index, 0, nodeToInsert);
  } else {
    // POSITION.BOTTOM 或 POSITION.RIGHT
    list.splice(index + 1, 0, nodeToInsert);
  }

  return true;
}

/**
 * 画布内部已有节点移动操作（含严格防环死锁检查与原子化移动）
 * @param schemas 根 Schema 列表
 * @param sourceId 被移动的节点 ID
 * @param targetId 目标节点 ID
 * @param position 放置方位
 * @returns 是否成功移动
 */
export function moveSchema(
  schemas: ComponentSchema[],
  sourceId: string,
  targetId: string,
  position: PositionType,
  slotName?: string,
): boolean {
  if (!sourceId || !targetId || sourceId === targetId) return false;
  if (sourceId === 'root') return false;

  // 1. 严格防环死锁拦截：祖先节点不可移入自身后代
  if (isAncestor(schemas, sourceId, targetId)) {
    return false;
  }

  // 2. 先定位原父容器与索引，便于插入失败时精准原地回滚
  const sourceInfo = safeFindSchemaInfoById(schemas, sourceId);
  if (!sourceInfo || sourceInfo.index === -1) return false;

  const { index: originIndex, list: originList } = sourceInfo;
  const [removedNode] = originList.splice(originIndex, 1);
  if (!removedNode) return false;

  // 3. 插入到新位置
  const success = insertSchema(
    schemas,
    targetId,
    removedNode,
    position,
    slotName,
  );
  if (!success) {
    // 插入失败时精准还原回原父容器的原索引位置，避免污染根数组
    originList.splice(originIndex, 0, removedNode);
    return false;
  }

  return true;
}
