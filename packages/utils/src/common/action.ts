import type { ActionsModel } from '@aigen-designer/types';

import { getUUID } from './string';

/**
 * 读取层动作归一化：兼容旧数据，为动作对象补齐稳定身份与启停用缺省值。
 * - 入参非对象（null/undefined/原始值/数组）返回 null；
 * - 浅拷贝，不迁移、不重写旧 schema 的其余字段；
 * - id 缺省补 getUUID()（拖拽 key、复制、条件引用需要稳定身份）；
 * - enabled 缺省视为 true（undefined 视为启用，兼容旧数据）。
 * 注：P1 仅做读取层归一化，不写回；写回时由保存流程增量补齐 id。
 * @param action 原始动作对象
 * @returns 归一化后的动作对象；入参非法时返回 null
 */
export function normalizeAction(
  action: ActionsModel | null | undefined,
): ActionsModel | null {
  if (
    action === null ||
    action === undefined ||
    typeof action !== 'object' ||
    Array.isArray(action)
  ) {
    return null;
  }
  return {
    ...action,
    enabled: action.enabled ?? true,
    id: action.id ?? getUUID(),
  };
}

/**
 * 读取层动作列表归一化：逐条调用 normalizeAction 并过滤非法项。
 * @param actions 原始动作列表
 * @returns 归一化后的动作列表；入参为 null/undefined 或非数组时返回空数组
 */
export function normalizeActions(
  actions: ActionsModel[] | null | undefined,
): ActionsModel[] {
  if (actions === null || actions === undefined || !Array.isArray(actions)) {
    return [];
  }
  const result: ActionsModel[] = [];
  for (const action of actions) {
    const normalized = normalizeAction(action);
    if (normalized !== null) {
      result.push(normalized);
    }
  }
  return result;
}
