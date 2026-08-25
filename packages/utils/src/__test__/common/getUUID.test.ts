import { describe, expect, it } from 'vitest';

import { getUUID } from '../../';

describe('getUUID 函数测试', () => {
  it('应该生成指定长度的 UUID', () => {
    const length = 10;
    const uuid = getUUID(length);
    expect(uuid.length).toBe(length);
    expect(uuid).toMatch(/^[a-z0-9]+$/); // 验证 UUID 是由小写字母和数字组成
  });

  it('应该生成长度在 1 到 11 之间的 UUID', () => {
    for (let length = 1; length <= 11; length++) {
      const uuid = getUUID(length);
      expect(uuid.length).toBe(length);
    }
  });

  it('生成的 UUID 应该是唯一的', () => {
    const numTests = 1000; // 测试生成 UUID 的数量
    const uuids = new Set<string>();

    for (let i = 0; i < numTests; i++) {
      const uuid = getUUID();
      uuids.add(uuid);
    }

    expect(uuids.size).toBe(numTests);
  });

  it('数值类型 UUID 长度为 1 时应覆盖 0-9（边界修复）', () => {
    const results = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      results.add(getUUID(1, 'number'));
    }
    expect([...results].every((value) => /^[0-9]$/.test(value))).toBe(true);
    expect(results.has('0')).toBe(true);
  });

  it('数值类型 UUID 应生成指定长度的数字', () => {
    for (let length = 2; length <= 11; length++) {
      const uuid = getUUID(length, 'number');
      expect(uuid).toMatch(new RegExp(`^[1-9]\\d{${length - 1}}$`));
    }
  });
});
