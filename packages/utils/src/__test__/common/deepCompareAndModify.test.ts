import { describe, expect, it } from 'vitest';

import { deepCompareAndModify } from '../../';

describe('deepCompareAndModify', () => {
  it('应该将 obj2 的属性复制给 obj1', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 10, c: 3 };

    deepCompareAndModify(obj1, obj2);

    expect(obj1).toEqual({ a: 10, c: 3 });
  });

  it('应该递归复制嵌套对象的属性', () => {
    const obj1 = { a: { b: 1 } };
    const obj2 = { a: { b: 2, c: 3 } };

    deepCompareAndModify(obj1, obj2);

    expect(obj1).toEqual({ a: { b: 2, c: 3 } });
  });

  it('应该处理数组属性并递归复制', () => {
    const obj1 = { a: [1, 2] };
    const obj2 = { a: [3, 4, 5] };

    deepCompareAndModify(obj1, obj2);

    expect(obj1).toEqual({ a: [3, 4, 5] });
  });

  it('如果 shouldDelete 为 true，应该删除 obj1 中 obj2 不存在的属性', () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { a: 10, c: 30 };

    deepCompareAndModify(obj1, obj2, true);

    expect(obj1).toEqual({ a: 10, c: 30 });
  });

  it('如果 shouldDelete 为 false，不应删除 obj1 中 obj2 不存在的属性', () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { a: 10, c: 30 };

    deepCompareAndModify(obj1, obj2, false);

    expect(obj1).toEqual({ a: 10, b: 2, c: 30 });
  });

  it('应该正确处理 obj1 是数组的情况', () => {
    const obj1 = [1, 2, 3];
    const obj2 = [3, 4, 5];

    deepCompareAndModify(obj1, obj2);

    expect(obj1).toEqual([3, 4, 5]);
  });

  it('如果 obj1 的属性 a 是数组且 obj2 的属性 a 是对象，应将 obj1.a 变为对象', () => {
    const obj1 = { a: [1, 2, 3], b: 4 };
    const obj2 = { a: { x: 10, y: 20 } };

    deepCompareAndModify(obj1, obj2, false);
    expect(obj1).toEqual({ a: { x: 10, y: 20 }, b: 4 });
  });

  it('如果 obj1 的属性 a 是数组且 obj2 的属性 a 是对象，且 shouldDelete 为 true，应删除 obj1 中不在 obj2 中的属性', () => {
    const obj1 = { a: [1, 2, 3], b: 4, c: 5 };
    const obj2 = { a: { x: 10, y: 20 } };

    deepCompareAndModify(obj1, obj2, true);

    expect(obj1).toEqual({ a: { x: 10, y: 20 } });
  });

  it('如果 obj1 的属性 a 是数组且 obj2 的属性 a 是对象，且 shouldDelete 为 false，应保留 obj1 中不在 obj2 中的属性', () => {
    const obj1 = { a: [1, 2, 3], b: 4, c: 5 };
    const obj2 = { a: { x: 10, y: 20 } };

    deepCompareAndModify(obj1, obj2, false);

    expect(obj1).toEqual({ a: { x: 10, y: 20 }, b: 4, c: 5 });
  });

  it('Date 值应整体更新而不是静默忽略', () => {
    const obj1 = { time: new Date('2024-01-01T00:00:00Z') };
    const obj2 = { time: new Date('2024-02-01T00:00:00Z') };

    deepCompareAndModify(obj1, obj2);

    expect(obj1.time).toBe(obj2.time);
    expect(obj1.time.getTime()).toBe(obj2.time.getTime());
  });

  it('Map/Set 值应整体更新而不是静默忽略', () => {
    const obj1 = { map: new Map([['a', 1]]), set: new Set([1]) };
    const obj2 = { map: new Map([['a', 2]]), set: new Set([1, 2]) };

    deepCompareAndModify(obj1, obj2);

    expect(obj1.map).toBe(obj2.map);
    expect(obj1.set).toBe(obj2.set);
  });

  it('循环引用不应导致栈溢出', () => {
    const obj1: any = { name: 'a' };
    obj1.self = obj1;
    const obj2: any = { name: 'b' };
    obj2.self = obj2;

    deepCompareAndModify(obj1, obj2);

    expect(obj1.name).toBe('b');
    expect(obj1.self).toBe(obj1);
  });

  it('同一对象在两侧同时出现（共享引用）不应导致无限递归', () => {
    const shared1: any = { v: 1 };
    const shared2: any = { v: 2 };
    const obj1 = { a: shared1, b: shared1 };
    const obj2 = { a: shared2, b: shared2 };

    deepCompareAndModify(obj1, obj2);

    expect(obj1.a).toEqual({ v: 2 });
    expect(obj1.b).toEqual({ v: 2 });
  });
});
