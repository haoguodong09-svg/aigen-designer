import type { ConditionGroup } from '@aigen-designer/types';

import { getValueByPath } from './data';

/**
 * 条件求值上下文：表单数据 + 触发事件参数。
 * 与 doActions 表达式计算的 context（{ event, formData, vars }）同构，
 * 其中 vars 为全局状态（P3 运行时），条件求值暂只消费 formData / event。
 */
export interface ConditionContext {
  /** 触发事件参数（doActions 的 args） */
  event?: unknown[];
  /** 表单数据（formData 上下文） */
  formData?: Record<string, any>;
}

/**
 * 求值条件组（P3 运行时）：支持 AND/OR 组合与嵌套、字段比较。
 * 字段值经 getValueByPath 从 formData 提取，与公式 $formData.* 语义一致。
 * - 条件为 null/undefined 视为无限制，返回 true（动作无条件即执行，兼容旧数据）；
 * - fail-safe：结构非法或求值异常返回 false 并 console.warn，
 *   延续「单动作异常不中断动作链」的既有约定（pageManager doActions）。
 * @param condition 条件组（纯 JSON DSL）
 * @param context 求值上下文
 * @returns 是否满足条件
 */
export function evaluateCondition(
  condition: ConditionGroup | null | undefined,
  context: ConditionContext = {},
): boolean {
  // 无条件 = 不设限制
  if (condition === null || condition === undefined) {
    return true;
  }

  try {
    return evaluateGroup(condition, context);
  } catch (error) {
    console.warn('[Aigen：条件求值]异常，按不满足处理（fail-safe）', error);
    return false;
  }
}

/**
 * 递归求值条件组：AND（全部满足）/ OR（任一满足）。
 * @param group 条件组节点
 * @param context 求值上下文
 * @returns 是否满足
 */
function evaluateGroup(
  group: ConditionGroup,
  context: ConditionContext,
): boolean {
  const { logic, items } = group;
  // 结构 fail-safe：items 缺失或非数组视为不满足
  if (!Array.isArray(items)) {
    return false;
  }

  const results = items.map((item) => {
    // 嵌套条件组：递归求值
    if (isConditionGroup(item)) {
      return evaluateGroup(item, context);
    }
    return evaluateItem(item, context);
  });

  return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

/** 类型守卫：判断条件项是否为嵌套的条件组（含 logic/items 字段） */
function isConditionGroup(item: unknown): item is ConditionGroup {
  return (
    typeof item === 'object' &&
    item !== null &&
    'logic' in item &&
    'items' in item
  );
}

/** 字段比较条件项（与 types 包 ConditionGroup 的 items 元素一致，去嵌套组） */
interface ConditionItem {
  /** 取值字段（formData 中的字段路径） */
  field: string;
  /** 比较运算符 */
  operator: '!=' | '<' | '<=' | '==' | '>' | '>=' | 'empty' | 'in';
  /** 比较值（'empty' 等一元运算符可缺省） */
  value?: unknown;
}

/**
 * 求值单个字段比较条件。
 * @param item 字段比较条件项
 * @param context 求值上下文
 * @returns 是否满足
 */
function evaluateItem(item: ConditionItem, context: ConditionContext): boolean {
  const { field, operator, value } = item;
  // 从表单数据中提取字段值；字段缺失按 undefined 参与比较
  const actual = getValueByPath(context.formData ?? {}, field);

  switch (operator) {
    case '!=': {
      // 宽松不等：与 '==' 同语义（表单控件值多为字符串，与配置值比较更符合直觉）
      // eslint-disable-next-line eqeqeq
      return actual != value;
    }
    case '<': {
      return (actual as number) < (value as number);
    }
    case '<=': {
      return (actual as number) <= (value as number);
    }
    case '==': {
      // 宽松相等：表单控件值多为字符串，与配置的数值/字符串值比较时更符合直觉
      // eslint-disable-next-line eqeqeq
      return actual == value;
    }
    case '>': {
      return (actual as number) > (value as number);
    }
    case '>=': {
      return (actual as number) >= (value as number);
    }
    case 'empty': {
      // 空：undefined / null / 空字符串
      return actual === undefined || actual === null || actual === '';
    }
    case 'in': {
      // value 为数组时直接查成员；为字符串时按逗号分隔（兼容面板简化输入）
      const candidates = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(',').map((part) => part.trim())
          : [];
      // 字段值为数组（多选等）：任一候选命中即满足（交集语义）
      if (Array.isArray(actual)) {
        return actual.some((item) => candidates.includes(item));
      }
      return candidates.includes(actual);
    }
    default: {
      console.warn('[Aigen：条件求值]未知运算符', { field, operator });
      return false;
    }
  }
}
