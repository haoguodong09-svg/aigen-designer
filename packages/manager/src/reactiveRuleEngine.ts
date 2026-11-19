import type {
  ComponentDerivedState,
  PageSchema,
  ReactiveRule,
} from '@aigen-designer/types';

import { effectScope, reactive, watch } from 'vue';

import {
  deepEqual,
  evaluateCondition,
  FormulaEngine,
} from '@aigen-designer/utils';

export interface ReactiveEngineOptions {
  /** 具名表单数据容器（pageManager.forms） */
  forms?: any;
  formulaEngine?: any;
  getFieldValue?: (target: string, scopeName?: string) => unknown;
  /** 合并后的表单数据快照（页面级 + 各表单） */
  getFormData?: () => Record<string, unknown>;
  /** 页面级共享表单数据（无 form 时使用） */
  pageFormData?: Record<string, unknown>;
  setFieldValue?: (target: string, value: unknown, scopeName?: string) => void;
  /** 全局变量容器（pageManager.vars） */
  vars?: any;
}

export function createReactiveEngine(
  pageSchema: PageSchema,
  pageManager: any,
  options: ReactiveEngineOptions = {},
) {
  const defaultFormulaEngine = new FormulaEngine();
  const formsRef = options.forms ?? pageManager.forms;
  const varsRef = options.vars ?? pageManager.vars;
  const pageFormData =
    options.pageFormData ?? pageManager.pageFormData ?? undefined;
  // 复合作用域状态字典: key 为 `${scopeName}:${field}`、`${scopeName}:${id}`、或直接 `${targetField}`
  const reactiveStateMap = reactive<Record<string, ComponentDerivedState>>({});
  const scope = effectScope();

  // 记录每个规则上一次是否命中及其生效的属性集合，用于条件反转时准确复位
  const activeRuleEffectsMap = new Map<
    string,
    { keys: (keyof ComponentDerivedState)[]; targetKeys: string[] }
  >();

  let isEvaluating = false;
  let hasPendingEvaluation = false;

  function getScopeKeys(targetField: string, scopeName = 'default'): string[] {
    return [`${scopeName}:${targetField}`, targetField];
  }

  function resolveValue(value: any, context: Record<string, unknown>): any {
    if (value && typeof value === 'object' && value.__isExpression__) {
      const engine =
        options.formulaEngine ||
        pageManager.formulaEngine ||
        defaultFormulaEngine;
      if (engine?.calculate) {
        try {
          return engine.calculate(value.content, context);
        } catch (error) {
          console.error(
            `[Aigen Reactive Error] 规则表达式计算失败: ${value.content}`,
            error,
          );
          return undefined;
        }
      }
    }
    return value;
  }

  function getFormDataSnapshot(): Record<string, unknown> {
    if (typeof options.getFormData === 'function') {
      return options.getFormData();
    }
    if (typeof pageManager.getFormData === 'function') {
      return pageManager.getFormData() as Record<string, unknown>;
    }
    if (pageFormData) return pageFormData;
    const formNames = Object.keys(formsRef?.value ?? {});
    return (
      formNames.length === 1
        ? formsRef.value[formNames[0]]
        : (formsRef?.value ?? {})
    ) as Record<string, unknown>;
  }

  function evaluateAllRules() {
    isEvaluating = true;
    try {
      const rules: ReactiveRule[] = pageSchema.reactiveRules ?? [];

      for (const rule of rules) {
        if (rule.enabled === false) {
          continue;
        }

        const scopeName = rule.scopeName || 'default';
        const targetKeys = getScopeKeys(rule.targetField, scopeName);

        const formData = getFormDataSnapshot();

        const context = {
          $formData: formData,
          $vars: varsRef?.value ?? {},
          formData,
          vars: varsRef?.value ?? {},
        };

        // 1. 判定先验条件是否命中
        const isMatched = rule.condition
          ? evaluateCondition(rule.condition, context)
          : true;

        if (!isMatched) {
          // 状态复位自愈逻辑: 若之前命中过该规则，现条件失效，必须主动清除派生状态！
          const previousActivation = activeRuleEffectsMap.get(rule.id);
          if (previousActivation) {
            for (const tKey of previousActivation.targetKeys) {
              const currentDerived = reactiveStateMap[tKey];
              if (currentDerived) {
                for (const effectKey of previousActivation.keys) {
                  delete (currentDerived as any)[effectKey];
                }
                if (Object.keys(currentDerived).length === 0) {
                  delete reactiveStateMap[tKey];
                }
              }
            }
            activeRuleEffectsMap.delete(rule.id);
          }
          continue;
        }

        // 2. 条件命中，计算派生效应
        const appliedKeys: (keyof ComponentDerivedState)[] = [];

        for (const tKey of targetKeys) {
          const targetState = (reactiveStateMap[tKey] ??= {});

          if (rule.effects.hidden !== undefined) {
            targetState.hidden = resolveValue(rule.effects.hidden, context);
            if (!appliedKeys.includes('hidden')) appliedKeys.push('hidden');
          }
          if (rule.effects.disabled !== undefined) {
            targetState.disabled = resolveValue(rule.effects.disabled, context);
            if (!appliedKeys.includes('disabled')) appliedKeys.push('disabled');
          }
          if (rule.effects.readonly !== undefined) {
            targetState.readonly = resolveValue(rule.effects.readonly, context);
            if (!appliedKeys.includes('readonly')) appliedKeys.push('readonly');
          }
          if (rule.effects.required !== undefined) {
            targetState.required = resolveValue(rule.effects.required, context);
            if (!appliedKeys.includes('required')) appliedKeys.push('required');
          }
          if (rule.effects.options !== undefined) {
            targetState.options = resolveValue(rule.effects.options, context);
            if (!appliedKeys.includes('options')) appliedKeys.push('options');
          }
        }

        // 记录本规则施加的派生属性，供后续条件失效时精准复位
        activeRuleEffectsMap.set(rule.id, { keys: appliedKeys, targetKeys });

        // 3. 派生值计算 (computedValue) 并带严格脏检查
        if (rule.effects.computedValue !== undefined) {
          const newVal = resolveValue(rule.effects.computedValue, context);
          const getValue =
            options.getFieldValue ??
            (typeof pageManager.getFieldValue === 'function'
              ? pageManager.getFieldValue.bind(pageManager)
              : undefined);
          const setValue =
            options.setFieldValue ??
            (typeof pageManager.setFieldValue === 'function'
              ? pageManager.setFieldValue.bind(pageManager)
              : undefined);
          const currentVal = getValue
            ? getValue(rule.targetField, scopeName)
            : formData?.[rule.targetField];

          // 严格脏检查拦截：只有值真正发生改变时才写入表单，杜绝 watch 递归更新！
          if (!deepEqual(currentVal, newVal)) {
            if (setValue) {
              setValue(rule.targetField, newVal, scopeName);
            } else if (formData && rule.targetField in formData) {
              formData[rule.targetField] = newVal;
            }
          }
        }
      }
    } finally {
      isEvaluating = false;
      if (hasPendingEvaluation) {
        hasPendingEvaluation = false;
        evaluateAllRules();
      }
    }
  }

  scope.run(() => {
    // 监听全表单数据、页面级共享表单数据与全局变量，immediate: true 确保首屏同步执行计算。
    // 注意：依赖必须以显式注入的 ref/对象为准——pageManager 组装完成前其属性尚不存在，
    // 直接读 pageManager.forms 会得到 undefined，导致后续数据变化完全不被追踪。
    watch(
      [() => formsRef?.value, () => pageFormData, () => varsRef?.value],
      () => {
        if (isEvaluating) {
          hasPendingEvaluation = true;
          return;
        }
        evaluateAllRules();
      },
      { deep: true, immediate: true },
    );
  });

  return {
    destroy: () => scope.stop(),
    evaluateAllRules,
    reactiveStateMap,
  };
}
