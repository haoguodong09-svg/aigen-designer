import type { FormulaContext } from '../formula/formulaEngine';

import { FormulaEngine } from '../formula/formulaEngine';

export interface PropBindingScope {
  formData: Record<string, unknown>;
  funcs: Record<string, unknown>;
  state: unknown;
  vars: Record<string, unknown>;
}

export interface ResolveBoundValueContext {
  formData?: Record<string, unknown>;
  formulaContext?: FormulaContext;
  formulaEngine?: {
    calculate: (expression: string, context?: FormulaContext) => unknown;
  };
  funcs?: Record<string, unknown>;
  state?: unknown;
  vars?: Record<string, unknown>;
}

const JS_EXPR_CACHE_MAX = 500;
const jsExprCache = new Map<string, Function>();
const defaultFormulaEngine = new FormulaEngine();

/**
 * 判断是否为属性级 JSExpression 绑定协议 `{ type: 'JSExpression', value: string }`
 */
export function isJSExpressionBinding(
  val: unknown,
): val is { type: 'JSExpression'; value: string } {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    (val as Record<string, unknown>).type === 'JSExpression' &&
    typeof (val as Record<string, unknown>).value === 'string'
  );
}

/**
 * 判断是否为公式表达式协议 `{ __isExpression__: true, content: string }`
 */
export function isFormulaExpressionModel(
  val: unknown,
): val is { __isExpression__: true; content: string } {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    Boolean((val as Record<string, unknown>).__isExpression__) &&
    typeof (val as Record<string, unknown>).content === 'string'
  );
}

/**
 * 统一构造 props JSExpression 绑定求值上下文（形参顺序：formData, vars, funcs, state）
 */
export function createPropBindingScope(
  parts: Partial<PropBindingScope> = {},
): PropBindingScope {
  return {
    formData: parts.formData ?? {},
    funcs: parts.funcs ?? {},
    state: parts.state,
    vars: parts.vars ?? {},
  };
}

function compileJSExpression(expr: string): Function {
  const cached = jsExprCache.get(expr);
  if (cached) {
    return cached;
  }
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    'formData',
    'vars',
    'funcs',
    'state',
    `"use strict"; return (${expr});`,
  );
  if (jsExprCache.size >= JS_EXPR_CACHE_MAX) {
    jsExprCache.clear();
  }
  jsExprCache.set(expr, fn);
  return fn;
}

/**
 * 双协议统一求值入口：
 * - `{ type: 'JSExpression', value }`: 通过 `formData / vars / funcs / state` JS 直译求值
 * - `{ __isExpression__: true, content }`: 通过 FormulaEngine (jsep) 安全公式求值
 * - 其他常量值：原样返回
 * 异常 fail-safe 返回 undefined。
 */
export function resolveBoundValue(
  value: unknown,
  ctx: ResolveBoundValueContext = {},
): unknown {
  if (isJSExpressionBinding(value)) {
    const expr = value.value.trim();
    if (!expr) {
      return undefined;
    }
    const scope = createPropBindingScope(ctx);
    try {
      const fn = compileJSExpression(expr);
      return fn(scope.formData, scope.vars, scope.funcs, scope.state);
    } catch {
      return undefined;
    }
  }

  if (isFormulaExpressionModel(value)) {
    const engine = ctx.formulaEngine ?? defaultFormulaEngine;
    if (!engine?.calculate) {
      return undefined;
    }
    const formulaCtx: FormulaContext = ctx.formulaContext ?? {
      formData: ctx.formData ?? {},
      vars: ctx.vars ?? {},
    };
    try {
      return engine.calculate(value.content, formulaCtx);
    } catch {
      return undefined;
    }
  }

  return value;
}

/**
 * 设计态弹窗实时预览 JSExpression 表达式结果，返回求值状态与错误信息
 */
export function previewJSExpression(
  expr: string,
  parts: Partial<PropBindingScope> = {},
): { error?: string; ok: boolean; value?: unknown } {
  const trimmed = expr.trim();
  if (!trimmed) {
    return { error: '表达式为空', ok: false };
  }
  const scope = createPropBindingScope(parts);
  try {
    const fn = compileJSExpression(trimmed);
    const value = fn(scope.formData, scope.vars, scope.funcs, scope.state);
    return { ok: true, value };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  }
}
