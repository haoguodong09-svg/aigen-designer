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
});
