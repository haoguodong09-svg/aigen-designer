import { describe, expect, it } from 'vitest';

import { applyPatch, createPatch } from '../../';

/** 深拷贝（测试数据均为 JSON 兼容值） */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** 应用补丁后应与目标状态完全一致 */
const expectRoundTrip = <T, U>(before: T, after: U): void => {
  const target = clone(before) as unknown;
  applyPatch(target as Record<string, unknown>, createPatch(before, after));
  expect(target).toEqual(after);
};

describe('createPatch / applyPatch', () => {
  it('两个相等对象应生成空操作列表', () => {
    const obj = { a: 1, b: { c: 'x' } };
    const ops = createPatch(obj, clone(obj));
    expect(ops).toEqual([]);
  });

  it('应只记录属性修改，不生成多余操作', () => {
    const before = { a: 1, b: 2, c: { d: 3 } };
    const after = { a: 1, b: 9, c: { d: 3 } };
    const ops = createPatch(before, after);
    expect(ops).toEqual([{ op: 'replace', path: '/b', oldValue: 2, value: 9 }]);
  });

  it('应记录新增属性', () => {
    const before = { a: 1 };
    const after = { a: 1, b: 2 };
    const ops = createPatch(before, after);
    expect(ops).toEqual([{ op: 'add', path: '/b', value: 2 }]);
  });

  it('应记录删除属性并保留旧值', () => {
    const before = { a: 1, b: { x: 1 } };
    const after = { a: 1 };
    const ops = createPatch(before, after);
    expect(ops).toEqual([{ op: 'remove', path: '/b', oldValue: { x: 1 } }]);
  });

  it('嵌套对象修改应生成深层路径', () => {
    const before = { a: { b: { c: 1 } } };
    const after = { a: { b: { c: 2 } } };
    const ops = createPatch(before, after);
    expect(ops).toEqual([
      { op: 'replace', path: '/a/b/c', oldValue: 1, value: 2 },
    ]);
    expectRoundTrip(before, after);
  });

  it('数组末尾追加元素', () => {
    const before = { list: [1, 2] };
    const after = { list: [1, 2, 3] };
    expectRoundTrip(before, after);
  });

  it('数组中间插入元素', () => {
    const before = { list: ['a', 'b', 'c'] };
    const after = { list: ['a', 'x', 'b', 'c'] };
    const ops = createPatch(before, after);
    expect(ops).toContainEqual({ op: 'add', path: '/list/1', value: 'x' });
    expectRoundTrip(before, after);
  });

  it('数组中间删除元素', () => {
    const before = { list: ['a', 'b', 'c'] };
    const after = { list: ['a', 'c'] };
    const ops = createPatch(before, after);
    expect(ops).toContainEqual({ op: 'remove', path: '/list/1', oldValue: 'b' });
    expectRoundTrip(before, after);
  });

  it('数组元素修改应生成替换操作', () => {
    const before = { list: [{ id: 1, v: 'a' }, { id: 2, v: 'b' }] };
    const after = { list: [{ id: 1, v: 'x' }, { id: 2, v: 'b' }] };
    const ops = createPatch(before, after);
    expect(ops).toEqual([
      { op: 'replace', path: '/list/0/v', oldValue: 'a', value: 'x' },
    ]);
    expectRoundTrip(before, after);
  });

  it('数组元素整体替换（类型变化）', () => {
    const before = { list: [{ a: 1 }, { b: 2 }] };
    const after = { list: [{ c: 3 }, { b: 2 }] };
    expectRoundTrip(before, after);
  });

  it('数组与对象互变应生成替换操作', () => {
    const before = { data: [1, 2] };
    const after = { data: { a: 1 } };
    const ops = createPatch(before, after);
    expect(ops).toEqual([
      { op: 'replace', path: '/data', oldValue: [1, 2], value: { a: 1 } },
    ]);
    expectRoundTrip(before, after);
  });

  it('数组移动元素（删除+新增）', () => {
    const before = { list: ['a', 'b', 'c'] };
    const after = { list: ['c', 'a', 'b'] };
    expectRoundTrip(before, after);
  });

  it('键名包含特殊字符时应转义路径', () => {
    const before = { 'a/b': 1, 'c~d': 2 };
    const after = { 'a/b': 9, 'c~d': 2 };
    const ops = createPatch(before, after);
    expect(ops).toEqual([
      { op: 'replace', path: '/a~1b', oldValue: 1, value: 9 },
    ]);
    expectRoundTrip(before, after);
  });

  it('Date 值不同应生成替换，相同则无操作', () => {
    const before = { time: new Date('2024-01-01T00:00:00Z') };
    const after = { time: new Date('2024-01-02T00:00:00Z') };
    const ops = createPatch(before, after);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: 'replace', path: '/time' });

    const same = { time: new Date('2024-01-01T00:00:00Z') };
    const sameOps = createPatch(before, same);
    expect(sameOps).toEqual([]);
  });

  it('RegExp 值不同应生成替换，相同则无操作', () => {
    const before = { re: /abc/g };
    const after = { re: /abc/i };
    const ops = createPatch(before, after);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: 'replace', path: '/re' });
  });

  it('空对象与空数组', () => {
    expectRoundTrip({}, {});
    expectRoundTrip({ list: [] }, { list: [] });
    expectRoundTrip({}, { a: 1 });
    expectRoundTrip({ a: 1 }, {});
  });

  it('深层数组内嵌套对象修改', () => {
    const before = {
      schemas: [
        { id: '1', props: { title: { value: 'a' } } },
        { id: '2', props: {} },
      ],
    };
    const after = {
      schemas: [
        { id: '1', props: { title: { value: 'b' } } },
        { id: '2', props: {} },
      ],
    };
    expectRoundTrip(before, after);
  });

  it('应用补丁不应改变目标对象引用', () => {
    const before = { a: { b: 1 } };
    const after = { a: { b: 2 }, c: 3 };
    const target = clone(before);
    const ref = target;
    applyPatch(target, createPatch(before, after));
    expect(target).toBe(ref);
    expect(target).toEqual(after);
  });

  it('remove 操作保留的 oldValue 可用于反向恢复', () => {
    const before = { a: 1, removed: { x: [1, 2, 3] } };
    const after = { a: 1 };
    const ops = createPatch(before, after);
    expectRoundTrip(before, after);
    // 反向应用：先 add 回去
    const target = clone(after);
    const removeOp = ops.find((op) => op.op === 'remove');
    expect(removeOp).toBeDefined();
    applyPatch(target, [{ op: 'add', path: '/removed', value: removeOp!.oldValue }]);
    expect(target).toEqual(before);
  });

  it('循环引用数据应抛出明确错误而非栈溢出', () => {
    const a: any = { name: 'a' };
    a.self = a;
    const b: any = { name: 'b' };
    b.self = b;
    expect(() => createPatch(a, b)).toThrow(/循环引用/);
  });

  it('循环引用存在于 after 侧且被遍历到时抛出明确错误', () => {
    const a: any = { name: 'a' };
    a.self = a;
    const before = { self: {} };
    expect(() => createPatch(before, a)).toThrow(/循环引用/);
  });

  it('Map 内容不同应生成替换操作（与 deepEqual 一致）', () => {
    const before = { data: new Map([['a', 1]]) };
    const after = { data: new Map([['a', 2]]) };
    const ops = createPatch(before, after);
    expect(ops).toEqual([
      {
        oldValue: before.data,
        op: 'replace',
        path: '/data',
        value: after.data,
      },
    ]);
    // 内容相同则不产生操作
    const same = { data: new Map([['a', 1]]) };
    expect(createPatch(before, same)).toEqual([]);
  });

  it('Set 内容不同应生成替换操作', () => {
    const before = { data: new Set([1, 2]) };
    const after = { data: new Set([1, 3]) };
    const ops = createPatch(before, after);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: 'replace', path: '/data' });
  });

  it('applyPatch 应拒绝 __proto__ 等危险键名（防原型污染）', () => {
    const after = JSON.parse('{"a":{"__proto__":{"polluted":true}}}');
    const before = { a: {} };
    const ops = createPatch(before, after);
    // JSON.parse 会产生自有 __proto__ 键，diff 会生成 add 操作
    expect(ops.some((op) => op.path === '/a/__proto__')).toBe(true);
    const target: any = { a: {} };
    expect(() => applyPatch(target, ops)).toThrow(/危险键名/);
    // 原型未被污染
    expect(({} as any).polluted).toBeUndefined();
  });

  it('applyPatch 对越界的数组索引应抛出明确错误', () => {
    const target = { list: ['a', 'b'] };
    expect(() =>
      applyPatch(target, [
        { op: 'replace', path: '/list/5', oldValue: 'x', value: 'y' },
      ]),
    ).toThrow(/越界/);
    expect(() =>
      applyPatch(target, [{ op: 'remove', path: '/list/5', oldValue: 'x' }]),
    ).toThrow(/越界/);
    // add 在 length 处为合法追加
    applyPatch(target, [{ op: 'add', path: '/list/2', value: 'c' }]);
    expect(target.list).toEqual(['a', 'b', 'c']);
  });

});
