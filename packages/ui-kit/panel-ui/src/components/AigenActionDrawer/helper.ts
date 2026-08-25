import type { ComponentSchema, ConditionGroup } from '@aigen-designer/types';

import { findSchemas } from '@aigen-designer/utils';

/** 动作类型：组件方法 / 自定义函数 / 公共函数 */
export type ActionType = 'component' | 'custom' | 'public';

/**
 * 动作配置草稿：向导各步骤共享的状态模型。
 * 与运行时 ActionsModel 对齐（P1 仅收集并保存字段，delay/condition 运行时在 P3 生效）。
 */
export interface ActionDraft {
  /** args 为 JSON 数组字符串；元素可为 { __isExpression__, content }（运行时已支持） */
  args: null | string;
  /** 目标组件 id（custom/public 类型为 null） */
  componentId: null | string;
  /** 条件（P3 运行时生效，P1 仅保存字段） */
  condition: ConditionGroup | null;
  /** 延迟执行毫秒数（P3 运行时生效） */
  delay: null | number;
  /** 启停用，缺省视为 true（兼容旧数据缺省语义） */
  enabled: boolean;
  /** 动作方法名 */
  methodName: string;
  /** 动作命名（人话，用于摘要/搜索），可选 */
  name: string;
  /** 备注，可选 */
  remark: string;
  /** 动作类型：'' 表示尚未选择 */
  type: '' | ActionType;
}

/** 表达式参数对象：与运行时 doActions 的 __isExpression__ 分支对齐（pageManager.ts:301-305） */
export interface ExpressionModel {
  __isExpression__: true;
  content: string;
}

/** 表达式插入器使用的表单字段描述 */
export interface ExpressionField {
  field: string;
  label: string;
  type?: string;
}

/** 新建动作时的默认草稿（enabled 默认 true，兼容旧数据缺省语义） */
export function createEmptyDraft(): ActionDraft {
  return {
    args: null,
    componentId: null,
    condition: null,
    delay: null,
    enabled: true,
    methodName: '',
    name: '',
    remark: '',
    type: '',
  };
}

/** 构造表达式参数对象 */
export function createExpressionValue(content: string): ExpressionModel {
  return { __isExpression__: true, content };
}

/** 判断参数值是否为表达式对象 */
export function isExpressionValue(value: unknown): value is ExpressionModel {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).__isExpression__ === true &&
    typeof (value as Record<string, unknown>).content === 'string'
  );
}

/** 解析 args JSON 数组字符串（非法 JSON 时返回空数组，不中断流程） */
export function getArgsArray(args: null | string | undefined): unknown[] {
  if (!args) return [];
  try {
    const parsed = JSON.parse(args) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

/** 将参数数组序列化为 args JSON 字符串 */
export function stringifyArgs(values: unknown[]): string {
  return JSON.stringify(values);
}

/** 设置指定下标（field）的参数值，返回新的 args 字符串 */
export function setArgsValue(
  args: null | string | undefined,
  field: number | string,
  value: unknown,
): string {
  const values = getArgsArray(args);
  values[Number(field)] = value;
  return stringifyArgs(values);
}

/** 参数缓存键：componentId + methodName（与旧 aigenActionModal 的缓存约定一致） */
export function buildCacheKey(
  componentId: null | string,
  methodName: string,
): string {
  return `${componentId ?? ''}${methodName}`;
}

const NUMBER_INPUT_TYPES = new Set([
  'input-number',
  'number',
  'rate',
  'slider',
]);
const BOOLEAN_INPUT_TYPES = new Set(['checkbox', 'switch']);
const DATE_INPUT_TYPES = new Set([
  'date',
  'date-picker',
  'datetime',
  'time',
  'time-picker',
]);
const OPTION_INPUT_TYPES = new Set(['cascader', 'radio', 'select']);
const UPLOAD_INPUT_TYPES = new Set(['upload-file', 'upload-image']);

/**
 * 构造表单模拟数据：供表达式插入器「实时预览」求值使用。
 * 说明：预览基于当前页面数据，仅做求值展示（设计态安全约定，不触发任何运行时事件）。
 */
export function buildMockFormData(
  fields: ExpressionField[],
): Record<string, unknown> {
  const formData: Record<string, unknown> = {};
  fields.forEach((field) => {
    if (!field.field) return;
    // 事件参数（$ 前缀）不进入 formData 模拟数据，由公式上下文的 event 提供
    if (field.field.startsWith('$')) return;
    const type = field.type ?? '';
    if (NUMBER_INPUT_TYPES.has(type)) {
      formData[field.field] = 100;
    } else if (BOOLEAN_INPUT_TYPES.has(type)) {
      formData[field.field] = true;
    } else if (DATE_INPUT_TYPES.has(type)) {
      formData[field.field] = '2024-01-01 12:00:00';
    } else if (OPTION_INPUT_TYPES.has(type)) {
      formData[field.field] = '选项1';
    } else if (UPLOAD_INPUT_TYPES.has(type)) {
      formData[field.field] = [];
    } else {
      formData[field.field] = '示例文本';
    }
  });
  return formData;
}

/**
 * 按关键字递归过滤 schema（匹配 label / id / type / 类型中文名）。
 * @param schemas 待过滤的 schema 树
 * @param keyword 搜索关键字
 * @param resolveTypeLabel 可选：type → 类型中文名解析器（如 pluginManager 默认 label）
 */
export function filterSchemasByKeyword(
  schemas: ComponentSchema[],
  keyword: string,
  resolveTypeLabel?: (type: string) => string,
): ComponentSchema[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) {
    return findSchemas(schemas, () => true) as ComponentSchema[];
  }
  return findSchemas(schemas, (schema) => {
    const typeLabel = resolveTypeLabel?.(schema.type) ?? '';
    return (
      (schema.label ?? '').toLowerCase().includes(kw) ||
      (schema.id ?? '').toLowerCase().includes(kw) ||
      schema.type.toLowerCase().includes(kw) ||
      typeLabel.toLowerCase().includes(kw)
    );
  }) as ComponentSchema[];
}

/** 组件展示名：label ?? 组件类型默认 label ?? '未命名组件' */
export function getComponentLabel(
  schema: ComponentSchema,
  resolveDefaultLabel?: (type: string) => string | undefined,
): string {
  return schema.label ?? resolveDefaultLabel?.(schema.type) ?? '未命名组件';
}

/** 表达式预览结果格式化 */
export function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return '空';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
