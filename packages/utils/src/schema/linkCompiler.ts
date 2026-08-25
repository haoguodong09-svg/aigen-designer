import type {
  ActionsModel,
  ComponentSchema,
  FieldLink,
  PageSchema,
} from '@aigen-designer/types';

import { findSchemas } from '../common/data';

/**
 * 序列化动作参数为 JSON 数组字符串（ActionsModel.args 的约定格式）。
 * @param args 参数数组
 * @returns JSON 数组字符串
 */
export function stringifyArgs(args: unknown[]): string {
  return JSON.stringify(args);
}

/**
 * 编译一条字段联动规则（FieldLink）为源元素 on[change] 的动作（ActionsModel）。
 * 运行时复用 doActions 既有机制（组件实例方法调用 + 表达式求值），不新增运行时能力
 * （B4 双写策略：设计态视图模型 links + 运行时编译产物 on[change]）。
 *
 * 行为映射（B4.5 映射总表）：
 * - SHOW     → setAttr('hidden', false)
 * - HIDE     → setAttr('hidden', true)
 * - DISABLE  → setAttr('disabled', true)
 * - READ     → setAttr('readonly', true)
 * - SET_VALUE→ setValue(值；值为表达式对象则原样传递，运行时识别 __isExpression__ 求值，常量则直接使用)
 * - CLEAR    → setValue('')
 *
 * 产物额外携带 linkId（P3 字段联动编译标识），供联动规则删除/更新的精确定位；
 * link.when 可选条件编译到动作 condition，运行时满足条件才触发。
 *
 * @param link 字段联动规则
 * @param pageSchema 页面 schema（用于校验目标元素存在性）
 * @returns 编译后的动作；规则结构非法或目标元素不存在时返回 null（编译侧 fail-safe）
 */
export function compileLink(
  link: FieldLink,
  pageSchema: PageSchema,
): ActionsModel | null {
  // 结构校验：缺 id/targetId/behavior 的规则视为非法（fail-safe，不抛错）
  if (!link || !link.id || !link.targetId || !link.behavior) {
    return null;
  }

  // 目标元素必须存在且可写（过滤无效 target）
  const targetExists = findSchemas(
    pageSchema.schemas,
    (schema) => schema.id === link.targetId,
    true,
  );
  if (!targetExists) {
    return null;
  }

  let methodName = '';
  let args: unknown[] = [];

  switch (link.behavior) {
    case 'CLEAR': {
      methodName = 'setValue';
      args = [''];
      break;
    }
    case 'DISABLE': {
      methodName = 'setAttr';
      args = ['disabled', true];
      break;
    }
    case 'HIDE': {
      methodName = 'setAttr';
      args = ['hidden', true];
      break;
    }
    case 'READ': {
      methodName = 'setAttr';
      args = ['readonly', true];
      break;
    }
    case 'SET_VALUE': {
      methodName = 'setValue';
      // 表达式对象原样传递（运行时 doActions 识别 __isExpression__ 求值）；常量直接使用
      args = link.value === undefined ? [] : [link.value];
      break;
    }
    case 'SHOW': {
      methodName = 'setAttr';
      args = ['hidden', false];
      break;
    }
    default: {
      // 未知行为：不编译（fail-safe）
      return null;
    }
  }

  const action: ActionsModel = {
    args: stringifyArgs(args),
    componentId: link.targetId,
    // P3：可选条件编译到动作 condition，运行时满足条件才触发联动
    condition: link.when,
    enabled: link.enabled ?? true,
    // 字段联动编译标识（P3）：供联动规则删除/更新的精确定位
    linkId: link.id,
    methodName,
    type: 'component',
  };

  return action;
}

/**
 * 批量编译：把元素 schema.links 全部编译为 on[change] 的动作列表。
 * - enabled === false 的联动规则不编译（缺省视为启用，兼容旧数据）；
 * - 结构非法 / 目标元素不存在的规则被过滤（compileLink 返回 null）。
 * 产物供调用方追加到源元素 schema.on.change（设计态面板保存时写入）。
 * @param schema 源元素 schema（含 links 定义）
 * @param pageSchema 页面 schema（用于校验目标元素存在性）
 * @returns 编译后的动作列表
 */
export function compileLinks(
  schema: ComponentSchema,
  pageSchema: PageSchema,
): ActionsModel[] {
  if (!schema?.links || !Array.isArray(schema.links)) {
    return [];
  }

  const actions: ActionsModel[] = [];
  for (const link of schema.links) {
    // 启停用：enabled === false 的联动不编译
    if (link.enabled === false) {
      continue;
    }
    const action = compileLink(link, pageSchema);
    if (action) {
      actions.push(action);
    }
  }
  return actions;
}
