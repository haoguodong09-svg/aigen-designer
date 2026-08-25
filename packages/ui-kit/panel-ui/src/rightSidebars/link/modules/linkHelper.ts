import type {
  ActionsModel,
  ComponentSchema,
  FieldLink,
  PageSchema,
} from '@aigen-designer/types';

import { findSchemas } from '@aigen-designer/utils';

/**
 * 「关联与计算」面板共享的纯函数助手（WP-B）。
 * 仅做设计态数据聚合 / 解析 / 扫描，不触发任何运行时事件（设计态安全约定）。
 */

/** 字段联动条件中使用的比较运算符（简单版，不含 empty / in） */
export type ConditionOperator = '!=' | '<' | '<=' | '==' | '>' | '>=';

/** 事件总线广播方法名（P3 运行时由 WP-C 注册到 publicMethods） */
export const EVENT_EMIT_METHOD = 'emitEvent';

/** 事件总线监听方法名（P3 运行时由 WP-C 注册到 publicMethods） */
export const EVENT_ON_METHOD = 'onEvent';

/**
 * 编译动作与联动规则的关联标识：ActionsModel 扩展字段。
 * 契约：WP-C 的 compileLink 产出的动作携带 linkId = FieldLink.id，
 * 删除联动规则时按该字段过滤源元素 on[change] 中的编译动作（linkId 由本包约定）。
 */
export const LINK_ACTION_ID_FIELD = 'linkId';

/** 字段联动行为 → 中文名（B4.2 行为映射表） */
export const LINK_BEHAVIOR_LABELS: Record<FieldLink['behavior'], string> = {
  CLEAR: '清空',
  DISABLE: '禁用',
  HIDE: '隐藏',
  READ: '只读',
  SET_VALUE: '赋值',
  SHOW: '显示',
};

/** 字段联动行为下拉选项（供新建/编辑表单使用） */
export const LINK_BEHAVIOR_OPTIONS: Array<{
  label: string;
  value: FieldLink['behavior'];
}> = (Object.keys(LINK_BEHAVIOR_LABELS) as FieldLink['behavior'][]).map(
  (value) => ({ label: LINK_BEHAVIOR_LABELS[value], value }),
);

/** 联动条目：links 存储在源元素 schema 上，聚合视图携带所属元素信息 */
export interface LinkEntry {
  link: FieldLink;
  /** 源元素 id（link 所在 schema 的 id） */
  ownerId: string;
}

/**
 * 遍历页面 schema（含 children / slots），聚合所有元素上配置的联动规则。
 * 说明：FieldLink 挂在源元素 schema.links 上（ComponentSchema.links），
 * 列表视图按「当 X 变化 → 行为 Y」平铺展示，保存时按 ownerId 定位回源元素。
 */
export function collectLinkEntries(pageSchema: PageSchema): LinkEntry[] {
  const entries: LinkEntry[] = [];
  const schemas = findSchemas(
    pageSchema.schemas,
    (item) => Array.isArray(item.links) && item.links.length > 0,
  ) as ComponentSchema[];
  schemas.forEach((schema) => {
    (schema.links ?? []).forEach((link) => {
      entries.push({ link, ownerId: schema.id ?? '' });
    });
  });
  return entries;
}

/** 元素展示名：label ?? type ?? id，兜底为「未命名元素」 */
export function getSchemaLabel(schema: ComponentSchema): string {
  return schema.label ?? schema.type ?? schema.id ?? '未命名元素';
}

/**
 * 解析计算字段公式中的 $formData.* 依赖字段（去重、保序）。
 * 示例：'$formData.qty * $formData.price + $formData.user.score' →
 * ['qty', 'price', 'user.score']
 */
export function parseComputedDependencies(expression: string): string[] {
  const deps = new Set<string>();
  // 每次调用新建正则实例，避免模块级 /g 正则的 lastIndex 状态残留
  const regex = /\$formData\.([\w.]+)/g;
  let match = regex.exec(expression);
  while (match !== null) {
    deps.add(match[1]);
    match = regex.exec(expression);
  }
  return [...deps];
}

/** 事件总线动作扫描结果（单条广播 / 监听动作） */
export interface EventBusAction {
  action: ActionsModel;
  /** 动作绑定的事件类型（on 的 key，如 click / change / aigenReady） */
  boundEvent: string;
  /** 事件名：取 args[0]，缺省回退 methodName */
  eventName: string;
  /** emit：广播；listen：监听 */
  kind: 'emit' | 'listen';
  /** 所属元素 id */
  ownerId: string;
  /** 所属元素展示名 */
  ownerLabel: string;
}

/** 从动作参数中提取事件名（emitEvent('orderChanged', payload) → orderChanged） */
function getActionEventName(action: ActionsModel): string {
  const methodName = action.methodName ?? '';
  if (!action.args) return methodName;
  try {
    const parsed = JSON.parse(action.args) as unknown;
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
      return parsed[0];
    }
  } catch {
    // 非法 JSON 忽略，回退 methodName
  }
  return methodName;
}

/**
 * 扫描页面内已配置的事件总线动作（仅设计态静态扫描，不执行任何动作）：
 * - methodName 含 emitEvent → 广播动作；
 * - methodName 含 onEvent → 监听动作。
 * P3 运行时由 WP-C 提供 emitEvent / onEvent 公共方法，本模块只做一览展示。
 */
export function scanEventBusActions(pageSchema: PageSchema): EventBusAction[] {
  const result: EventBusAction[] = [];
  const schemas = findSchemas(pageSchema.schemas, (item) =>
    Boolean(item.on),
  ) as ComponentSchema[];
  schemas.forEach((schema) => {
    const on = schema.on as Record<string, ActionsModel[]> | undefined;
    if (!on) return;
    Object.entries(on).forEach(([boundEvent, actions]) => {
      (actions ?? []).forEach((action) => {
        const methodName = action.methodName ?? '';
        let kind: EventBusAction['kind'] | null = null;
        if (methodName.includes(EVENT_EMIT_METHOD)) {
          kind = 'emit';
        } else if (methodName.includes(EVENT_ON_METHOD)) {
          kind = 'listen';
        }
        if (!kind) return;
        result.push({
          action,
          boundEvent,
          eventName: getActionEventName(action),
          kind,
          ownerId: schema.id ?? '',
          ownerLabel: getSchemaLabel(schema),
        });
      });
    });
  });
  return result;
}
