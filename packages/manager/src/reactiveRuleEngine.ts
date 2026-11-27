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
  isFormulaExpressionModel,
  resolveBoundValue,
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

  // 记录每个规则上一次是否命中及其生效的属性集合，用于条件反转时准确复位。
  // assignedOriginal：常量 computedValue 首次写入前捕获的目标字段原值，
  // 条件失效时用于「撤销赋值、物归原主」。
  const activeRuleEffectsMap = new Map<
    string,
    {
      assignedOriginal?: {
        scopeName: string;
        targetField: string;
        value: unknown;
      };
      keys: (keyof ComponentDerivedState)[];
      targetKeys: string[];
    }
  >();

  let isEvaluating = false;
  let hasPendingEvaluation = false;

  function getScopeKeys(targetField: string, scopeName = 'default'): string[] {
    return [`${scopeName}:${targetField}`, targetField];
  }

  function resolveValue(value: any, context: Record<string, unknown>): any {
    const engine =
      options.formulaEngine ||
      pageManager.formulaEngine ||
      defaultFormulaEngine;
    return resolveBoundValue(value, {
      formulaContext: context,
      formulaEngine: engine,
    });
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

  /** 统一解析字段读写器：优先使用注入选项，回退 pageManager，再回退表单快照 */
  function resolveFieldAccessor() {
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
    return { getValue, setValue };
  }

  /** 是否为表达式对象（与 resolveValue 的判定保持一致） */
  function isExpressionValue(
    value: unknown,
  ): value is { __isExpression__: true; content: string } {
    return isFormulaExpressionModel(value);
  }

  /**
   * 写入 computedValue 派生值（带严格脏检查，只有值真正变化才写，杜绝 watch 递归更新）。
   * 供「条件命中」与「条件由命中转失效」两条路径复用。
   *
   * @param activation 命中记录；常量赋值首次写入前在其中捕获目标字段原值，
   * 条件失效时据此「撤销赋值」
   */
  function applyComputedValue(
    rule: ReactiveRule,
    context: Record<string, unknown>,
    scopeName: string,
    formData: Record<string, unknown>,
    activation?: {
      assignedOriginal?: {
        scopeName: string;
        targetField: string;
        value: unknown;
      };
    },
  ) {
    if (rule.effects.computedValue === undefined) return;
    const newVal = resolveValue(rule.effects.computedValue, context);
    const { getValue, setValue } = resolveFieldAccessor();
    const currentVal = getValue
      ? getValue(rule.targetField, scopeName)
      : formData?.[rule.targetField];

    if (!deepEqual(currentVal, newVal)) {
      // 常量赋值：首次写入前记录原值（表达式赋值走「失效重算」路径，无需记录）
      if (
        activation &&
        !activation.assignedOriginal &&
        !isExpressionValue(rule.effects.computedValue)
      ) {
        activation.assignedOriginal = {
          scopeName,
          targetField: rule.targetField,
          value: currentVal,
        };
      }
      if (setValue) {
        setValue(rule.targetField, newVal, scopeName);
      } else if (formData && rule.targetField in formData) {
        formData[rule.targetField] = newVal;
      }
    }
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
            // 条件赋值规则自愈：命中→失效的瞬间不能让目标值冻结在旧结果——
            // 表达式赋值：以当前数据重算一次（公式的 else 分支生效，如 IF(开关,'123','456') 失效时算出 '456'）；
            // 常量赋值：撤销赋值，恢复写入前的原值（与 hidden/disabled 的复位自愈对称）
            if (rule.effects.computedValue !== undefined) {
              const { getValue, setValue } = resolveFieldAccessor();
              if (isExpressionValue(rule.effects.computedValue)) {
                applyComputedValue(rule, context, scopeName, formData);
              } else if (previousActivation.assignedOriginal) {
                const original = previousActivation.assignedOriginal;
                const currentVal = getValue
                  ? getValue(original.targetField, original.scopeName)
                  : formData?.[original.targetField];
                if (!deepEqual(currentVal, original.value)) {
                  if (setValue) {
                    setValue(
                      original.targetField,
                      original.value,
                      original.scopeName,
                    );
                  } else if (formData && original.targetField in formData) {
                    formData[original.targetField] = original.value;
                  }
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

        // 记录本规则施加的派生属性，供后续条件失效时精准复位。
        // assignedOriginal 跨评估轮次保留：常量赋值只在首次写入时捕获一次原值
        const previous = activeRuleEffectsMap.get(rule.id);
        const activation = {
          assignedOriginal: previous?.assignedOriginal,
          keys: appliedKeys,
          targetKeys,
        };
        activeRuleEffectsMap.set(rule.id, activation);

        // 3. 派生值计算 (computedValue) 并带严格脏检查
        applyComputedValue(rule, context, scopeName, formData, activation);
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
