import { describe, expect, it } from 'vitest';

import { applyPatch, createPatch, deepEqual } from '../../';

// 简单的确定性伪随机数生成器（mulberry32）
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function randomValue(depth = 0): unknown {
  const r = rand();
  if (depth > 3 || r < 0.3) {
    const prims = [0, 1, -1, '', 'a', true, false, null, '中文', 'a/b', 'c~d', 3.14];
    return prims[Math.floor(rand() * prims.length)];
  }
  if (r < 0.65) {
    const len = Math.floor(rand() * 5);
    return Array.from({ length: len }, () => randomValue(depth + 1));
  }
  const obj: Record<string, unknown> = {};
  const keyCount = Math.floor(rand() * 5);
  for (let i = 0; i < keyCount; i++) {
    obj[`k${Math.floor(rand() * 8)}`] = randomValue(depth + 1);
  }
  return obj;
}

function mutate(value: unknown, depth = 0): unknown {
  const r = rand();
  if (r < 0.4 || depth > 3) {
    return randomValue(depth);
  }
  if (Array.isArray(value)) {
    const arr = value.map((v) => mutate(v, depth + 1));
    const action = rand();
    if (action < 0.3 && arr.length > 0) {
      arr.splice(Math.floor(rand() * arr.length), 1); // 删除
    } else if (action < 0.6) {
      arr.splice(Math.floor(rand() * (arr.length + 1)), 0, randomValue(depth + 1)); // 插入
    } else if (action < 0.8 && arr.length > 0) {
      const i = Math.floor(rand() * arr.length);
      const j = Math.floor(rand() * arr.length);
      [arr[i], arr[j]] = [arr[j], arr[i]]; // 交换
    }
    return arr;
  }
  if (typeof value === 'object' && value !== null) {
    const obj: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    const keys = Object.keys(obj);
    const action = rand();
    if (action < 0.3 && keys.length > 0) {
      delete obj[keys[Math.floor(rand() * keys.length)]]; // 删除键
    } else if (action < 0.6) {
      obj[`k${Math.floor(rand() * 8)}`] = randomValue(depth + 1); // 新增键
    } else if (keys.length > 0) {
      const k = keys[Math.floor(rand() * keys.length)];
      obj[k] = mutate(obj[k], depth + 1); // 修改
    }
    return obj;
  }
  return randomValue(depth);
}

describe('diff 引擎随机模糊测试（对象根）', () => {
  it('1000 组随机结构往返一致', () => {
    for (let i = 0; i < 1000; i++) {
      const before = randomValue();
      const after = mutate(before);
      const beforeRoot = { data: before };
      const afterRoot = { data: after };
      const ops = createPatch(beforeRoot, afterRoot);
      const target: Record<string, unknown> = JSON.parse(JSON.stringify(beforeRoot));
      applyPatch(target, ops);
      expect(target).toEqual(afterRoot);
    }
  });

  it('200 组三次连续变形往返一致', () => {
    for (let i = 0; i < 200; i++) {
      const before = randomValue(0);
      const after = mutate(mutate(mutate(before)));
      const beforeRoot = { data: before };
      const afterRoot = { data: after };
      const ops = createPatch(beforeRoot, afterRoot);
      const target: Record<string, unknown> = JSON.parse(JSON.stringify(beforeRoot));
      applyPatch(target, ops);
      expect(deepEqual(target, afterRoot)).toBe(true);
    }
  });

  it('500 组序列化往返（diff 存 JSON 字符串后解析再应用）一致', () => {
    for (let i = 0; i < 500; i++) {
      const before = randomValue();
      const after = mutate(before);
      const beforeRoot = { data: before };
      const afterRoot = { data: after };
      const ops = JSON.parse(JSON.stringify(createPatch(beforeRoot, afterRoot)));
      const target: Record<string, unknown> = JSON.parse(JSON.stringify(beforeRoot));
      applyPatch(target, ops);
      expect(target).toEqual(afterRoot);
    }
  });

  it('applyPatch 对根节点整体替换应给出明确错误（不支持原地替换根）', () => {
    const ops = createPatch({ a: 1 }, [1, 2]);
    expect(ops).toEqual([{ op: 'replace', oldValue: { a: 1 }, path: '', value: [1, 2] }]);
    expect(() =>
      applyPatch({ a: 1 } as Record<string, unknown>, ops),
    ).toThrow();
  });
});
