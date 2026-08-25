import { afterEach, describe, expect, it, vi } from 'vitest';
import jsep from 'jsep';

import { FormulaEngine } from '../../';

// 统计 jsep 解析调用次数，验证 AST 缓存生效
vi.mock('jsep', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jsep')>();
  // jsep 通过 export = 导出，ESM 互操作下 default 指向函数本身
  const jsepImpl =
    (actual as unknown as { default: typeof jsep }).default ?? actual;
  return {
    ...actual,
    default: vi.fn(jsepImpl),
  };
});

describe('FormulaEngine', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('应正确计算基础表达式', () => {
    const engine = new FormulaEngine({ formData: { qty: 2, price: 5 } });
    expect(engine.calculate('$formData.qty * $formData.price')).toBe(10);
    expect(engine.calculate('SUM(1, 2, 3)')).toBe(6);
    expect(engine.calculate('1 + 2 * 3')).toBe(7);
  });

  it('运行时上下文应覆盖构造时的上下文', () => {
    const engine = new FormulaEngine({ formData: { qty: 2 } });
    expect(engine.calculate('$formData.qty', { formData: { qty: 10 } })).toBe(
      10,
    );
  });

  it('非法表达式应返回 null 而不是抛错', () => {
    const engine = new FormulaEngine();
    expect(engine.calculate('1 +')).toBeNull();
    expect(engine.calculate('')).toBeNull();
  });

  it('相同表达式第二次 calculate 不应再次触发 jsep 解析（AST 缓存）', () => {
    const engine = new FormulaEngine({ formData: { qty: 3 } });
    const expr = 'SUM(1, 2) + $formData.qty * 2';

    expect(engine.calculate(expr, { formData: { qty: 5 } })).toBe(13);
    expect(engine.calculate(expr, { formData: { qty: 7 } })).toBe(17);
    // 相同表达式两次计算只解析一次
    expect(jsep).toHaveBeenCalledTimes(1);
  });

  it('不同的表达式应分别解析', () => {
    const engine = new FormulaEngine();
    engine.calculate('1 + 1');
    engine.calculate('2 + 2');
    expect(jsep).toHaveBeenCalledTimes(2);
  });

  it('逻辑运算符 && 应正确计算（jsep 输出为 BinaryExpression）', () => {
    const engine = new FormulaEngine({ formData: { a: 3, b: 5 } });
    expect(engine.calculate('$formData.a > 0 && $formData.b > 0')).toBe(true);
    expect(engine.calculate('$formData.a > 10 && $formData.b > 0')).toBe(false);
  });

  it('逻辑运算符 || 应正确计算（jsep 输出为 BinaryExpression）', () => {
    const engine = new FormulaEngine({ formData: { a: 3, b: 5 } });
    expect(engine.calculate('$formData.a > 10 || $formData.b > 0')).toBe(true);
    expect(engine.calculate('$formData.a > 10 || $formData.b > 10')).toBe(
      false,
    );
  });

  it('混合优先级 &&/|| 与比较运算应正确计算', () => {
    const engine = new FormulaEngine({ formData: { a: 3, b: 5 } });
    expect(
      engine.calculate(
        '$formData.a > 0 && $formData.b > 10 || $formData.a > 0',
      ),
    ).toBe(true);
    expect(
      engine.calculate(
        '$formData.a > 10 || $formData.b > 10 && $formData.a > 0',
      ),
    ).toBe(false);
  });

  it('一元运算符 ! 应正确取反', () => {
    const engine = new FormulaEngine({ formData: { a: 0, b: 2 } });
    expect(engine.calculate('!$formData.a')).toBe(true);
    expect(engine.calculate('!$formData.b')).toBe(false);
    expect(engine.calculate('-$formData.b')).toBe(-2);
  });
});
