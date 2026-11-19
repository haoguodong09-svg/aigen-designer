import type {
  ComponentSchema,
  ConditionGroup,
  PageSchema,
  ReactiveRule,
} from '@aigen-designer/types';

import { getUUID } from '@aigen-designer/utils';

/**
 * 「字段联动」声明式规则助手。
 *
 * 新模型以 pageSchema.reactiveRules 为唯一真相源：
 * - 设计态只写 ReactiveRule，不再向 schema.links / on.change 双写编译动作；
 * - 运行时由 ReactiveRuleEngine 首屏求值、条件反转自愈，无需用户先触发一次事件。
 */

/** 规则可表达的行为 */
export type RuleBehavior =
  | 'CLEAR'
  | 'DISABLE'
  | 'EDIT'
  | 'ENABLE'
  | 'HIDE'
  | 'OPTIONAL'
  | 'READ'
  | 'REQUIRED'
  | 'SET_VALUE'
  | 'SHOW';

/** 条件运算符（always 表示无条件规则，不写入 condition） */
export type RuleOperator =
  | '!='
  | '<'
  | '<='
  | '=='
  | '>'
  | '>='
  | 'always'
  | 'contains'
  | 'empty'
  | 'in'
  | 'notEmpty';

export interface RuleBehaviorOption {
  description: string;
  icon: string;
  label: string;
  value: RuleBehavior;
}

/** 行为选项（图标 + 人话 + 一句解释，供胶囊/卡片选择） */
export const RULE_BEHAVIOR_OPTIONS: RuleBehaviorOption[] = [
  {
    description: '条件满足时显示目标元素',
    icon: 'icon--behavior--eye',
    label: '显示',
    value: 'SHOW',
  },
  {
    description: '条件满足时隐藏目标元素',
    icon: 'icon--aigen--visibility-off-outline-rounded',
    label: '隐藏',
    value: 'HIDE',
  },
  {
    description: '条件满足时启用目标元素',
    icon: 'icon--aigen--lock-open-outline',
    label: '启用',
    value: 'ENABLE',
  },
  {
    description: '条件满足时禁用目标元素',
    icon: 'icon--aigen--lock-outline',
    label: '禁用',
    value: 'DISABLE',
  },
  {
    description: '条件满足时目标元素只读',
    icon: 'icon--behavior--file-text',
    label: '只读',
    value: 'READ',
  },
  {
    description: '条件满足时取消目标元素的只读',
    icon: 'icon--behavior--edit',
    label: '可编辑',
    value: 'EDIT',
  },
  {
    description: '条件满足时目标元素必填',
    icon: 'icon--behavior--warning-circle',
    label: '必填',
    value: 'REQUIRED',
  },
  {
    description: '条件满足时取消目标元素的必填',
    icon: 'icon--behavior--check',
    label: '非必填',
    value: 'OPTIONAL',
  },
  {
    description: '条件满足时给目标赋值（常量或公式）',
    icon: 'icon--aigen--edit-square-outline-rounded',
    label: '赋值',
    value: 'SET_VALUE',
  },
  {
    description: '条件满足时清空目标的值',
    icon: 'icon--behavior--clear',
    label: '清空',
    value: 'CLEAR',
  },
];

/** 条件运算符选项 */
export const RULE_OPERATOR_OPTIONS: Array<{
  label: string;
  value: RuleOperator;
}> = [
  { label: '始终（不设条件）', value: 'always' },
  { label: '等于', value: '==' },
  { label: '不等于', value: '!=' },
  { label: '包含', value: 'contains' },
  { label: '为空', value: 'empty' },
  { label: '不为空', value: 'notEmpty' },
  { label: '大于', value: '>' },
  { label: '大于等于', value: '>=' },
  { label: '小于', value: '<' },
  { label: '小于等于', value: '<=' },
];

/** 一元运算符（无需输入比较值） */
export const UNARY_OPERATORS = new Set<RuleOperator>(['empty', 'notEmpty']);

/** 规则草稿（面板内编辑状态） */
export interface RuleDraft {
  behavior: '' | RuleBehavior;
  /** 比较值：文本输入为字符串，下拉选择可能是布尔/数字/对象值 */
  conditionValue: any;
  constantValue: string;
  expressionValue: string;
  operator: RuleOperator;
  sourceField: string;
  targetId: string;
  valueMode: 'constant' | 'expression';
}

export function createEmptyRuleDraft(): RuleDraft {
  return {
    behavior: '',
    conditionValue: '',
    constantValue: '',
    expressionValue: '',
    operator: '==',
    sourceField: '',
    targetId: '',
    valueMode: 'constant',
  };
}

/** 常量输入的类型化解析：数字 / 布尔 / null 自动转换，其余按字符串 */
export function parseConstantValue(raw: string): unknown {
  const text = raw.trim();
  if (text === '') return '';
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return raw;
}

/** 判断表达式参数对象 */
function isExpressionValue(
  value: unknown,
): value is { __isExpression__: true; content: string } {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).__isExpression__ === true &&
    typeof (value as Record<string, unknown>).content === 'string'
  );
}

/** 根据行为构造 effects */
export function buildRuleEffects(
  draft: RuleDraft,
): null | ReactiveRule['effects'] {
  switch (draft.behavior) {
    case 'CLEAR': {
      return { computedValue: '' };
    }
    case 'DISABLE': {
      return { disabled: true };
    }
    case 'EDIT': {
      return { readonly: false };
    }
    case 'ENABLE': {
      return { disabled: false };
    }
    case 'HIDE': {
      return { hidden: true };
    }
    case 'OPTIONAL': {
      return { required: false };
    }
    case 'READ': {
      return { readonly: true };
    }
    case 'REQUIRED': {
      return { required: true };
    }
    case 'SET_VALUE': {
      return draft.valueMode === 'expression'
        ? {
            computedValue: {
              __isExpression__: true,
              content: draft.expressionValue.trim(),
            },
          }
        : { computedValue: parseConstantValue(draft.constantValue) };
    }
    case 'SHOW': {
      return { hidden: false };
    }
    default: {
      return null;
    }
  }
}

/** 根据草稿构造条件组（always / 空字段返回 undefined） */
export function buildRuleCondition(
  draft: RuleDraft,
): ConditionGroup | undefined {
  if (draft.operator === 'always' || !draft.sourceField) return undefined;
  const item: {
    field: string;
    operator: Exclude<RuleOperator, 'always'>;
    value?: unknown;
  } = {
    field: draft.sourceField,
    operator: draft.operator as Exclude<RuleOperator, 'always'>,
  };
  if (!UNARY_OPERATORS.has(draft.operator)) {
    item.value = draft.conditionValue;
  }
  return { logic: 'AND', items: [item] };
}

/** 根据草稿构造 ReactiveRule */
export function buildReactiveRule(
  draft: RuleDraft,
  editingId?: string,
): null | ReactiveRule {
  const effects = buildRuleEffects(draft);
  if (!effects) return null;
  const condition = buildRuleCondition(draft);
  return {
    condition,
    description: getBehaviorLabel(draft.behavior),
    effects,
    enabled: true,
    id: editingId || getUUID(),
    targetField: draft.targetId,
  };
}

/** 从规则中推断单一行为（用于回填编辑表单） */
export function inferRuleBehavior(rule: ReactiveRule): '' | RuleBehavior {
  const effects = rule.effects || {};
  if (effects.hidden !== undefined) {
    return isExpressionValue(effects.hidden)
      ? 'HIDE'
      : effects.hidden
        ? 'HIDE'
        : 'SHOW';
  }
  if (effects.disabled !== undefined) {
    return isExpressionValue(effects.disabled)
      ? 'DISABLE'
      : effects.disabled
        ? 'DISABLE'
        : 'ENABLE';
  }
  if (effects.readonly !== undefined) {
    return isExpressionValue(effects.readonly)
      ? 'READ'
      : effects.readonly
        ? 'READ'
        : 'EDIT';
  }
  if (effects.required !== undefined) {
    return isExpressionValue(effects.required)
      ? 'REQUIRED'
      : effects.required
        ? 'REQUIRED'
        : 'OPTIONAL';
  }
  if (effects.computedValue !== undefined) {
    return effects.computedValue === '' ? 'CLEAR' : 'SET_VALUE';
  }
  return '';
}

/** 行为中文名 */
export function getBehaviorLabel(behavior: '' | RuleBehavior): string {
  return (
    RULE_BEHAVIOR_OPTIONS.find((item) => item.value === behavior)?.label ??
    behavior
  );
}

/** 行为图标 */
export function getBehaviorIcon(behavior: '' | RuleBehavior): string {
  return (
    RULE_BEHAVIOR_OPTIONS.find((item) => item.value === behavior)?.icon ??
    'icon--behavior--thunderbolt'
  );
}

/** 规则条件的第一条简单条件项（复杂条件组返回 null） */
export function getRuleSimpleCondition(rule: ReactiveRule): null | {
  field: string;
  operator: RuleOperator;
  value?: unknown;
} {
  const first = rule.condition?.items?.[0];
  if (!first || !('field' in first)) return null;
  const operator = RULE_OPERATOR_OPTIONS.some(
    (item) => item.value === first.operator,
  )
    ? (first.operator as RuleOperator)
    : '==';
  return { field: first.field, operator, value: first.value };
}

/** 收集页面全部声明式规则（保持存储顺序） */
export function collectReactiveRules(pageSchema: PageSchema): ReactiveRule[] {
  return [...(pageSchema.reactiveRules ?? [])];
}

/** 删除指定 id 的规则，返回是否删除 */
export function removeReactiveRule(pageSchema: PageSchema, ruleId: string) {
  const before = pageSchema.reactiveRules ?? [];
  const after = before.filter((rule) => rule.id !== ruleId);
  pageSchema.reactiveRules = after;
  return after.length !== before.length;
}

/**
 * 生成规则人话摘要，如：
 * 当「客户类型」等于「企业」时，显示「税号」
 */
export function getRuleSummary(
  rule: ReactiveRule,
  resolveFieldLabel: (field: string) => string,
  resolveTargetLabel: (targetId: string) => string,
): string {
  const behavior = inferRuleBehavior(rule);
  const target = resolveTargetLabel(rule.targetField);
  const effectText = getRuleEffectText(rule, behavior);
  const condition = rule.condition?.items?.[0];
  if (condition && 'field' in condition) {
    const fieldLabel = resolveFieldLabel(condition.field);
    const operatorLabel =
      RULE_OPERATOR_OPTIONS.find((item) => item.value === condition.operator)
        ?.label ?? condition.operator;
    const valueText =
      UNARY_OPERATORS.has(condition.operator as RuleOperator) ||
      condition.value === undefined ||
      condition.value === ''
        ? ''
        : `「${String(condition.value)}」`;
    return `当「${fieldLabel}」${operatorLabel}${valueText} 时，${effectText}「${target}」`;
  }
  return `${effectText}「${target}」`;
}

/** 规则效果的人话描述 */
function getRuleEffectText(
  rule: ReactiveRule,
  behavior: '' | RuleBehavior,
): string {
  if (behavior === 'SET_VALUE') {
    const value = rule.effects.computedValue;
    if (isExpressionValue(value))
      return `把对应值设为公式 ${value.content}，作用于`;
    return `把对应值设为「${String(value ?? '')}」，作用于`;
  }
  if (behavior === 'CLEAR') return '清空';
  return getBehaviorLabel(behavior);
}

/**
 * 旧版 FieldLink 升轨：把 schema.links 转成 reactiveRules，并清理旧编译产物。
 * 返回是否发生了迁移（供面板提示 / 撤销栈使用）。
 */
export function migrateLegacyLinksToRules(pageSchema: PageSchema): boolean {
  const existingIds = new Set(
    (pageSchema.reactiveRules ?? []).map((rule) => rule.id),
  );
  const converted: ReactiveRule[] = [];
  let changed = false;

  const traverse = (schemas: ComponentSchema[] | undefined) => {
    if (!Array.isArray(schemas)) return;
    for (const schema of schemas) {
      if (Array.isArray(schema.links) && schema.links.length > 0) {
        schema.links.forEach((link) => {
          if (!link?.id || existingIds.has(link.id)) return;
          existingIds.add(link.id);
          const effects: ReactiveRule['effects'] = {};
          switch (link.behavior) {
            case 'CLEAR': {
              effects.computedValue = '';
              break;
            }
            case 'DISABLE': {
              effects.disabled = true;
              break;
            }
            case 'HIDE': {
              effects.hidden = true;
              break;
            }
            case 'READ': {
              effects.readonly = true;
              break;
            }
            case 'SET_VALUE': {
              if (link.value !== undefined) effects.computedValue = link.value;
              break;
            }
            case 'SHOW': {
              effects.hidden = false;
              break;
            }
          }
          converted.push({
            condition: link.when,
            description: '由旧版字段联动规则升级',
            effects,
            enabled: link.enabled !== false,
            id: link.id,
            targetField: link.targetId,
          });
          changed = true;
        });
        // 迁移后移除旧视图模型，避免新旧两套规则同时展示
        delete schema.links;
      }
      // 清除旧编译器产物（带 linkId 的动作），杜绝与新引擎双重执行
      const on = schema.on;
      if (on && typeof on === 'object') {
        Object.keys(on).forEach((eventName) => {
          const list = on[eventName];
          if (!Array.isArray(list)) return;
          const filtered = list.filter((action) => action.linkId === undefined);
          if (filtered.length !== list.length) {
            on[eventName] = filtered;
            changed = true;
          }
        });
      }
      traverse(schema.children);
    }
  };

  traverse(pageSchema.schemas);
  if (converted.length > 0) {
    pageSchema.reactiveRules = [
      ...(pageSchema.reactiveRules ?? []),
      ...converted,
    ];
  }
  return changed;
}
