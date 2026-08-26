import type { PageSchema } from '@aigen-designer/types';

import { findSchemaById } from '@aigen-designer/utils';

/**
 * 动作对象的最小结构（宽松类型，兼容旧数据与任意扩展字段）
 */
interface ActionLike {
  args?: string;
  componentId?: null | string;
  methodName?: string;
  type?: string;
}

/**
 * 解析动作参数（args 为 JSON 数组字符串），解析失败返回空数组
 */
function getArgsList(args?: string): unknown[] {
  if (!args) return [];
  try {
    const parsed = JSON.parse(args) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 取 args 中指定下标的参数
 */
function getArgsItem(args?: string, index = 0): unknown {
  return getArgsList(args)[index];
}

/**
 * 生成「值」摘要：
 * - 表达式参数（__isExpression__ 为 true）显示为「表达式 {content}」
 * - 字符串原样展示，其余类型 JSON 序列化
 */
function getArgsValueSummary(args?: string): string {
  const first = getArgsItem(args, 0);
  if (first === undefined || first === null) {
    return '空值';
  }
  if (typeof first === 'object' && !Array.isArray(first)) {
    const expression = first as Record<string, unknown>;
    if (expression.__isExpression__ === true) {
      const content =
        typeof expression.content === 'string' ? expression.content : '';
      return `表达式 ${content}`;
    }
    return JSON.stringify(first);
  }
  if (typeof first === 'string') {
    return first;
  }
  return String(first);
}

/**
 * 生成动作人话摘要（B2.3 / WP1 约定）：
 * - component + setValue → 「把『{目标}』设置为 {值摘要}」
 * - component + setAttr  → 「设置『{目标}』的 {属性名} 属性」
 * - component 其他        → 「调用『{目标}』的 {方法名}」
 * - custom                → 「执行自定义函数 {方法名}」
 * - public                → 「执行公共函数 {方法名}」
 * 供 ActionSummary 组件展示与搜索过滤共用（设计态仅求值展示，不触发任何运行时事件）。
 */
export function getActionSummaryText(
  action: ActionLike | null | undefined,
  pageSchema?: null | PageSchema,
): string {
  if (!action || typeof action !== 'object') {
    return '';
  }

  const methodName = action.methodName ?? '';
  const type = action.type ?? '';

  if (type === 'component') {
    const targetId = action.componentId ?? null;
    // 目标组件 label：优先从页面 schema 解析，缺省回退为 componentId
    const targetLabel = pageSchema
      ? (findSchemaById(pageSchema.schemas, targetId ?? '')?.label ?? targetId)
      : targetId;
    const label = targetLabel ?? '未指定组件';

    if (methodName === 'setValue') {
      return `把「${label}」设置为 ${getArgsValueSummary(action.args)}`;
    }
    if (methodName === 'setAttr') {
      const attrName = getArgsItem(action.args, 0);
      return attrName
        ? `设置「${label}」的 ${String(attrName)} 属性`
        : `设置「${label}」的属性`;
    }
    return `调用「${label}」的 ${methodName}`;
  }

  if (type === 'custom') {
    return `执行自定义函数 ${methodName}`;
  }

  if (type === 'public') {
    return `执行公共函数 ${methodName}`;
  }

  return methodName || '未配置动作';
}
