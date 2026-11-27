import type {
  JSExpressionValue,
  JSFunctionValue,
  StateAccessorVariable,
} from '@aigen-designer/types';

export interface AccessorRuntimeContext {
  formData: Record<string, unknown>;
  funcs: Record<string, unknown>;
  getVar: (key: string) => unknown;
  setVar: (key: string, value: unknown) => void;
  vars: Record<string, unknown>;
}

export type CompiledAccessorRunner = (
  ctx: AccessorRuntimeContext,
  ...args: unknown[]
) => unknown;

const ACCESSOR_FACTORY_CACHE_MAX = 500;
const accessorFactoryCache = new Map<string, Function>();

/**
 * 判断变量值是否为 JSExpression 初值结构
 */
export function isJSExpressionVar(val: unknown): val is JSExpressionValue {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    (val as Record<string, unknown>).type === 'JSExpression' &&
    typeof (val as Record<string, unknown>).value === 'string'
  );
}

/**
 * 判断变量值是否为 JSFunction 结构
 */
export function isJSFunctionValue(val: unknown): val is JSFunctionValue {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    (val as Record<string, unknown>).type === 'JSFunction' &&
    typeof (val as Record<string, unknown>).value === 'string'
  );
}

/**
 * 判断变量定义是否包含 getter 或 setter 访问器
 */
export function isStateAccessorVar(val: unknown): val is StateAccessorVariable {
  if (!val || typeof val !== 'object') {
    return false;
  }
  const accessor = (val as Record<string, unknown>).accessor as
    | Record<string, unknown>
    | undefined;
  if (!accessor || typeof accessor !== 'object') {
    return false;
  }
  return (
    isJSFunctionValue(accessor.getter) || isJSFunctionValue(accessor.setter)
  );
}

/**
 * 提取变量定义中的原始 defaultValue（若非访问器则原样返回）
 */
export function unwrapVarDefaultValue(val: unknown): unknown {
  if (isStateAccessorVar(val)) {
    return val.defaultValue;
  }
  return val;
}

function normalizeFunctionCode(code: string): string {
  return code.trim().replace(/;+\s*$/, '');
}

function getOrCompileFactory(normalizedCode: string): Function {
  const cached = accessorFactoryCache.get(normalizedCode);
  if (cached) {
    return cached;
  }
  // 统一通过显式参数注入稳定上下文，支持 function getter()/setter(v) 与箭头函数
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'vars',
    'formData',
    'funcs',
    'setVar',
    'getVar',
    `"use strict"; return (${normalizedCode});`,
  );
  if (accessorFactoryCache.size >= ACCESSOR_FACTORY_CACHE_MAX) {
    accessorFactoryCache.clear();
  }
  accessorFactoryCache.set(normalizedCode, factory);
  return factory;
}

/**
 * 校验访问器函数源码语法是否合法（须为函数声明/函数表达式/箭头函数）
 */
export function validateAccessorCode(code: string): null | string {
  const normalized = normalizeFunctionCode(code);
  if (!normalized) {
    return '函数代码不能为空';
  }
  try {
    const factory = getOrCompileFactory(normalized);
    const noop = () => undefined;
    const probe = factory({}, {}, {}, noop, noop);
    if (typeof probe !== 'function') {
      return '请输入有效的函数定义，例如：function getter() { return ...; }';
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * 编译 getter / setter JSFunction 源码为可执行 runner。
 * 语法非法或空字符串返回 null，不向外抛异常。
 */
export function compileAccessorFunction(
  code: string,
): CompiledAccessorRunner | null {
  const normalized = normalizeFunctionCode(code);
  if (!normalized) {
    return null;
  }
  try {
    const factory = getOrCompileFactory(normalized);
    return (ctx: AccessorRuntimeContext, ...args: unknown[]) => {
      const innerFn = factory(
        ctx.vars,
        ctx.formData,
        ctx.funcs,
        ctx.setVar,
        ctx.getVar,
      );
      if (typeof innerFn !== 'function') {
        return undefined;
      }
      return innerFn(...args);
    };
  } catch (error) {
    console.warn('[Aigen: StateAccessor] 函数编译失败：', error);
    return null;
  }
}
