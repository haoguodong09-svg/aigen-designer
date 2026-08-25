import type { ConditionGroup } from '@aigen-designer/types';

import { describe, expect, it, vi } from 'vitest';

import { evaluateCondition } from './condition';

/** 构造条件组的便捷函数（保持测试可读性） */
function group(
  logic: 'AND' | 'OR',
  items: ConditionGroup['items'],
): ConditionGroup {
  return { logic, items };
}

describe('evaluateCondition 条件求值', () => {
  const formData: Record<string, any> = {
    age: 30,
    empty: '',
    name: '张三',
    nil: null,
    tags: ['a', 'b'],
  };

  it('无条件（null/undefined）视为无限制，返回 true', () => {
    expect(evaluateCondition(null, { formData })).toBe(true);
    expect(evaluateCondition(undefined, { formData })).toBe(true);
  });

  it('组合 AND：全部满足返回 true，任一不满足返回 false', () => {
    const cond = group('AND', [
      { field: 'name', operator: '==', value: '张三' },
      { field: 'age', operator: '>', value: 18 },
    ]);
    expect(evaluateCondition(cond, { formData })).toBe(true);

    const notMatch = group('AND', [
      { field: 'name', operator: '==', value: '张三' },
      { field: 'age', operator: '<', value: 18 },
    ]);
    expect(evaluateCondition(notMatch, { formData })).toBe(false);
  });

  it('组合 OR：任一满足返回 true，全部不满足返回 false', () => {
    const match = group('OR', [
      { field: 'name', operator: '==', value: '李四' },
      { field: 'age', operator: '>', value: 18 },
    ]);
    expect(evaluateCondition(match, { formData })).toBe(true);

    const notMatch = group('OR', [
      { field: 'name', operator: '==', value: '李四' },
      { field: 'age', operator: '>', value: 99 },
    ]);
    expect(evaluateCondition(notMatch, { formData })).toBe(false);
  });

  it('支持嵌套条件组（AND 内嵌 OR）', () => {
    const cond = group('AND', [
      { field: 'age', operator: '>', value: 18 },
      group('OR', [
        { field: 'name', operator: '==', value: '张三' },
        { field: 'name', operator: '==', value: '李四' },
      ]),
    ]);
    expect(evaluateCondition(cond, { formData })).toBe(true);
  });

  it('运算符 ==/!=/>/>=/</<=', () => {
    expect(
      evaluateCondition(
        group('AND', [{ field: 'age', operator: '==', value: 30 }]),
        { formData },
      ),
    ).toBe(true);
    // 宽松相等：数字 30 与字符串 '30' 视为相等（表单控件值多为字符串）
    expect(
      evaluateCondition(
        group('AND', [{ field: 'age', operator: '==', value: '30' }]),
        { formData },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        group('AND', [{ field: 'age', operator: '!=', value: 18 }]),
        { formData },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        group('AND', [{ field: 'age', operator: '>=', value: 30 }]),
        { formData },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        group('AND', [{ field: 'age', operator: '<=', value: 30 }]),
        { formData },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        group('AND', [{ field: 'age', operator: '<', value: 31 }]),
        { formData },
      ),
    ).toBe(true);
  });

  it('in：值在数组中为 true；字符串逗号分隔亦可', () => {
    expect(
      evaluateCondition(
        group('AND', [{ field: 'tags', operator: 'in', value: ['a', 'c'] }]),
        { formData },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        group('AND', [{ field: 'tags', operator: 'in', value: 'a,c' }]),
        { formData },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        group('AND', [{ field: 'tags', operator: 'in', value: ['x', 'c'] }]),
        { formData },
      ),
    ).toBe(false);
  });

  it('empty：undefined / null / 空字符串视为空', () => {
    expect(
      evaluateCondition(group('AND', [{ field: 'empty', operator: 'empty' }]), {
        formData,
      }),
    ).toBe(true);
    expect(
      evaluateCondition(group('AND', [{ field: 'nil', operator: 'empty' }]), {
        formData,
      }),
    ).toBe(true);
    expect(
      evaluateCondition(
        group('AND', [{ field: 'missing', operator: 'empty' }]),
        { formData },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(group('AND', [{ field: 'name', operator: 'empty' }]), {
        formData,
      }),
    ).toBe(false);
  });

  it('字段缺失（formData 中不存在）按 undefined 参与比较，与给定值不等', () => {
    expect(
      evaluateCondition(
        group('AND', [{ field: 'not-exists', operator: '==', value: 'x' }]),
        { formData },
      ),
    ).toBe(false);
  });

  it('fail-safe：结构非法（items 非数组）返回 false 且不抛异常', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = { logic: 'AND', items: 'oops' } as unknown as ConditionGroup;

    expect(evaluateCondition(bad, { formData })).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('fail-safe：未知运算符返回 false 并告警', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = group('AND', [
      { field: 'age', operator: 'like' as never, value: 1 },
    ]);

    expect(evaluateCondition(bad, { formData })).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('fail-safe：求值过程抛异常返回 false 并告警，不向上抛出', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 构造读取字段值即抛错的表单数据，模拟异常场景
    const throwingFormData = new Proxy({} as Record<string, any>, {
      get: () => {
        throw new Error('boom');
      },
    });

    expect(
      evaluateCondition(group('AND', [{ field: 'x', operator: '==' }]), {
        formData: throwingFormData,
      }),
    ).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('空 AND 组返回 true（无约束），空 OR 组返回 false', () => {
    expect(evaluateCondition(group('AND', []), { formData })).toBe(true);
    expect(evaluateCondition(group('OR', []), { formData })).toBe(false);
  });
});
