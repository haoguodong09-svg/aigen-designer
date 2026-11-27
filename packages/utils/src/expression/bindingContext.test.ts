import { describe, expect, it, vi } from 'vitest';

import { FormulaEngine } from '../formula/formulaEngine';
import {
  createPropBindingScope,
  isFormulaExpressionModel,
  isJSExpressionBinding,
  previewJSExpression,
  resolveBoundValue,
} from './bindingContext';

describe('bindingContext 统一表达式求值入口', () => {
  it('正确识别 JSExpression 与 __isExpression__ 双协议', () => {
    expect(
      isJSExpressionBinding({ type: 'JSExpression', value: 'vars.title' }),
    ).toBe(true);
    expect(isJSExpressionBinding({ type: 'JSExpression', value: 123 })).toBe(
      false,
    );
    expect(
      isFormulaExpressionModel({
        __isExpression__: true,
        content: '$vars.count + 1',
      }),
    ).toBe(true);
    expect(isFormulaExpressionModel({ content: '1+1' })).toBe(false);
  });

  it('jSExpression 求值支持 formData / vars / funcs / state 四个上下文形参', () => {
    const scope = createPropBindingScope({
      formData: { price: 10 },
      funcs: {
        double: (n: number) => n * 2,
      },
      state: { legacyFlag: true },
      vars: { greeting: 'hello', ratio: 3 },
    });

    expect(
      resolveBoundValue(
        { type: 'JSExpression', value: 'vars.greeting' },
        scope,
      ),
    ).toBe('hello');
    expect(
      resolveBoundValue(
        {
          type: 'JSExpression',
          value: 'funcs.double(formData.price) * vars.ratio',
        },
        scope,
      ),
    ).toBe(60);
    expect(
      resolveBoundValue(
        { type: 'JSExpression', value: 'state.legacyFlag' },
        scope,
      ),
    ).toBe(true);
  });

  it('__isExpression__ 协议走 FormulaEngine 求值并支持注入自定义引擎', () => {
    const engine = new FormulaEngine();
    expect(
      resolveBoundValue(
        { __isExpression__: true, content: '$vars.a + $formData.b' },
        {
          formulaContext: { formData: { b: 5 }, vars: { a: 7 } },
          formulaEngine: engine,
        },
      ),
    ).toBe(12);

    const mockEngine = { calculate: vi.fn(() => 99) };
    expect(
      resolveBoundValue(
        { __isExpression__: true, content: '$vars.x' },
        {
          formulaContext: { vars: { x: 1 } },
          formulaEngine: mockEngine,
        },
      ),
    ).toBe(99);
    expect(mockEngine.calculate).toHaveBeenCalledWith('$vars.x', {
      vars: { x: 1 },
    });
  });

  it('常量原样返回，非法表达式 fail-safe 返回 undefined', () => {
    expect(resolveBoundValue('plain text')).toBe('plain text');
    expect(resolveBoundValue(42)).toBe(42);
    expect(
      resolveBoundValue({ type: 'JSExpression', value: '   ' }),
    ).toBeUndefined();
    expect(
      resolveBoundValue({ type: 'JSExpression', value: 'a..b(' }),
    ).toBeUndefined();
    expect(
      resolveBoundValue(
        { __isExpression__: true, content: '$vars.x' },
        {
          formulaEngine: {
            calculate: () => {
              throw new Error('boom');
            },
          },
        },
      ),
    ).toBeUndefined();
  });

  it('previewJSExpression 返回求值预览或错误信息', () => {
    const okRes = previewJSExpression('vars.name + "!"', {
      vars: { name: 'World' },
    });
    expect(okRes).toEqual({ ok: true, value: 'World!' });

    const errRes = previewJSExpression('unknownVar.foo', {});
    expect(errRes.ok).toBe(false);
    expect(errRes.error).toBeTruthy();
  });
});
