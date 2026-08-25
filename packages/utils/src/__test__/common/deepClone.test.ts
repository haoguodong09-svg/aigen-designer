import { describe, expect, it } from 'vitest';

import { deepClone } from '../../';

describe('deepClone', () => {
  it('应正确拷贝基本数据类型', () => {
    const num = 42;
    const str = 'hello';
    const bool = true;

    expect(deepClone(num)).toBe(num);
    expect(deepClone(str)).toBe(str);
    expect(deepClone(bool)).toBe(bool);
  });

  it('应正确拷贝对象和数组', () => {
    const obj = { a: 1, b: [2, 3], c: { d: 4 } };
    const clonedObj = deepClone(obj);

    expect(clonedObj).toEqual(obj);
    expect(clonedObj).not.toBe(obj); // 确保是深拷贝
    expect(clonedObj.b).not.toBe(obj.b);
    expect(clonedObj.c).not.toBe(obj.c);
  });

  it('应处理循环引用', () => {
    const obj: any = { a: 1 };
    obj.b = obj; // 循环引用

    const clonedObj = deepClone(obj);

    expect(clonedObj).toEqual(obj);
    expect(clonedObj).not.toBe(obj); // 确保是深拷贝
    expect(clonedObj.b).toBe(clonedObj); // 确保循环引用被正确处理
  });

  it('应处理空对象和空数组', () => {
    expect(deepClone({})).toEqual({});
    expect(deepClone([])).toEqual([]);
  });

  it('手动克隆路径应正确处理 Date/RegExp/Map/Set（useStructuredClone=false）', () => {
    const obj = {
      date: new Date('2024-01-01T00:00:00Z'),
      re: /ab/g,
      map: new Map([['a', 1]]),
      set: new Set([1, 2]),
    };

    const cloned = deepClone(obj, false);

    expect(cloned).toEqual(obj);
    expect(cloned.date).not.toBe(obj.date);
    expect(cloned.date.getTime()).toBe(obj.date.getTime());
    expect(cloned.re).not.toBe(obj.re);
    expect(cloned.re.source).toBe('ab');
    expect(cloned.map).not.toBe(obj.map);
    expect(cloned.map.get('a')).toBe(1);
    expect(cloned.set).not.toBe(obj.set);
    expect(cloned.set.has(1)).toBe(true);
  });

  it('手动克隆路径应保留函数引用', () => {
    const fn = () => true;
    const obj = { fn, data: { a: 1 } };

    const cloned = deepClone(obj, false);

    expect(cloned.fn).toBe(fn);
    expect(cloned.data).toEqual({ a: 1 });
    expect(cloned.data).not.toBe(obj.data);
  });

  it('包含函数时默认路径应自动回退到手动克隆并保留函数', () => {
    const fn = () => true;
    const obj = { show: fn, a: 1 };

    const cloned = deepClone(obj); // 默认 useStructuredClone=true

    expect(cloned.show).toBe(fn);
    expect(cloned.a).toBe(1);
  });

  it('手动克隆路径应处理 Proxy 包装的对象', () => {
    const target = { a: 1, nested: { b: 2 } };
    const proxy = new Proxy(target, {});

    const cloned = deepClone(proxy, false);

    expect(cloned).toEqual({ a: 1, nested: { b: 2 } });
    expect(cloned).not.toBe(target);
    expect(cloned.nested).not.toBe(target.nested);
  });

  it('手动克隆路径应处理循环引用', () => {
    const obj: any = { a: 1 };
    obj.b = obj;

    const cloned = deepClone(obj, false);

    expect(cloned).toEqual(obj);
    expect(cloned.b).toBe(cloned);
  });
});
