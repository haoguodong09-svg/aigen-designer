import type {
  FieldLink,
  PageSchema,
  ReactiveRule,
} from '@aigen-designer/types';

/**
 * 将旧版 FieldLink 转换为新版 ReactiveRule
 */
export function convertLegacyLinkToReactiveRule(
  link: FieldLink,
  sourceField: string,
): ReactiveRule {
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
      effects.computedValue = link.value;
      break;
    }
    case 'SHOW': {
      effects.hidden = false;
      break;
    }
  }

  return {
    condition: link.when,
    description: `Converted from link of ${sourceField}`,
    effects,
    enabled: link.enabled !== false,
    id:
      link.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    targetField: link.targetId,
  };
}

/**
 * 存量 Schema 零中断双轨兼容解析器
 * - 自动将旧版 schema.links 转换为 ReactiveRule
 * - 自动剥离 on[event] 中由旧编译器生成的 linkId 动作，根除双重执行
 */
export function adaptLegacySchema(pageSchema: any): PageSchema {
  if (!pageSchema) return pageSchema;

  const existingRules: ReactiveRule[] = pageSchema.reactiveRules || [];
  const convertedRules: ReactiveRule[] = [...existingRules];
  // 按 id 去重：同一份 schema 可能被多次升轨（设计器预览、运行态初始化等），
  // 防止每次调用都重复追加同一批规则造成状态重复计算。
  const ruleIds = new Set(existingRules.map((rule) => rule.id));

  function traverseComponents(components: any[]) {
    if (!Array.isArray(components)) return;

    for (const comp of components) {
      // 1. 若存在 links 数组，转换为 ReactiveRule
      if (Array.isArray(comp.links) && comp.links.length > 0) {
        for (const link of comp.links) {
          if (!link || !link.id) continue;
          if (ruleIds.has(link.id)) continue;
          const rule = convertLegacyLinkToReactiveRule(
            link,
            comp.field || comp.id,
          );
          convertedRules.push(rule);
          ruleIds.add(rule.id);
        }
      }

      // 2. 关键根除双重执行：无论 links 是否还在，都扫描并剥离 on[event] 中
      // 由旧编译器生成的 linkId 动作（编译产物可能比 links 存活更久）。
      if (comp.on && typeof comp.on === 'object') {
        for (const eventName of Object.keys(comp.on)) {
          if (Array.isArray(comp.on[eventName])) {
            comp.on[eventName] = comp.on[eventName].filter((action: any) => {
              // 剔除包含 linkId 的编译副产物，只保留用户真正手工配置的业务动作
              return action.linkId === undefined;
            });
          }
        }
      }

      if (comp.children) {
        traverseComponents(comp.children);
      }
    }
  }

  traverseComponents(pageSchema.schemas || []);
  pageSchema.reactiveRules = convertedRules;
  return pageSchema;
}
