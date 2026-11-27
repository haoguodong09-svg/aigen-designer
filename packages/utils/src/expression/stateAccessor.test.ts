import { describe, expect, it, vi } from 'vitest';

import {
  compileAccessorFunction,
  isJSExpressionVar,
  isStateAccessorVar,
  unwrapVarDefaultValue,
  validateAccessorCode,
} from './stateAccessor';

describe('stateAccessor 工具函数', () => {
  it('正确识别 JSExpressionVar 与 StateAccessorVar', () => {
    const exprVar = { type: 'JSExpression', value: 'vars.price * 2' };
    const accessorVar = {
      accessor: {
        getter: {
          type: 'JSFunction',
          value: 'function getter() { return vars.a + vars.b; }',
        },
      },
      defaultValue: 0,
    };

    expect(isJSExpressionVar(exprVar)).toBe(true);
    expect(isJSExpressionVar({ type: 'other', value: 'x' })).toBe(false);

    expect(isStateAccessorVar(accessorVar)).toBe(true);
    expect(isStateAccessorVar(exprVar)).toBe(false);
    expect(isStateAccessorVar(123)).toBe(false);
    expect(unwrapVarDefaultValue(accessorVar)).toBe(0);
    expect(unwrapVarDefaultValue('plain')).toBe('plain');
  });

  it('validateAccessorCode 校验合法函数声明、箭头函数与非法输入', () => {
    expect(
      validateAccessorCode('function getter() { return vars.a + 1; }'),
    ).toBeNull();
    expect(validateAccessorCode('(value) => setVar("x", value)')).toBeNull();
    expect(validateAccessorCode('')).not.toBeNull();
    expect(validateAccessorCode('123')).not.toBeNull();
    expect(validateAccessorCode('function getter( {')).not.toBeNull();
  });

  it('compileAccessorFunction 支持 function 声明与箭头函数并注入稳定上下文', () => {
    const setVar = vi.fn();
    const vars = { count: 3, price: 25 };
    const ctx = {
      formData: { discount: 5 },
      funcs: { double: (n: number) => n * 2 },
      getVar: (key: string) => (vars as Record<string, unknown>)[key],
      setVar,
      vars,
    };

    const getter = compileAccessorFunction(
      'function getter() { return funcs.double(vars.price) * vars.count - formData.discount; }',
    );
    expect(getter).not.toBeNull();
    expect(getter?.(ctx)).toBe(145);

    const setter = compileAccessorFunction(
      '(val) => { setVar("firstName", String(val).split(" ")[0]); }',
    );
    expect(setter).not.toBeNull();
    setter?.(ctx, 'Ada Lovelace');
    expect(setVar).toHaveBeenCalledWith('firstName', 'Ada');
  });

  it('语法错误时返回 null 而不抛出异常', () => {
    expect(compileAccessorFunction('function broken( {')).toBeNull();
  });
});
