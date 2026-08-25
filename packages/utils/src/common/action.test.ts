import type { ActionsModel } from '@aigen-designer/types';

import { describe, expect, it } from 'vitest';

import { normalizeAction, normalizeActions } from './action';

describe('normalizeAction 读取层动作归一化', () => {
  const base: ActionsModel = {
    componentId: 'component_1',
    methodName: 'setValue',
    type: 'component',
  };

  it('缺 id 时补 UUID，且两次调用值不同', () => {
    const a = normalizeAction(base);
    const b = normalizeAction(base);

    expect(a?.id).toBeDefined();
    expect(typeof a?.id).toBe('string');
    expect(a?.id).not.toBe(b?.id);
  });

  it('enabled 缺省为 true（undefined 视为启用，兼容旧数据）', () => {
    const result = normalizeAction(base);

    expect(result?.enabled).toBe(true);
  });

  it('已有 id/enabled 原样透传，不覆盖', () => {
    const input: ActionsModel = {
      ...base,
      enabled: false,
      id: 'fixed-id',
    };
    const result = normalizeAction(input);

    expect(result?.id).toBe('fixed-id');
    expect(result?.enabled).toBe(false);
  });

  it('null/undefined 输入返回 null', () => {
    expect(normalizeAction(null)).toBeNull();
    expect(normalizeAction(undefined)).toBeNull();
  });

  it('非对象输入（原始值/数组）返回 null', () => {
    expect(normalizeAction('custom' as unknown as ActionsModel)).toBeNull();
    expect(normalizeAction(123 as unknown as ActionsModel)).toBeNull();
    expect(normalizeAction([] as unknown as ActionsModel)).toBeNull();
  });

  it('多余字段透传（浅拷贝，不丢额外字段）', () => {
    const input = {
      ...base,
      remark: '联动备注',
      someExtra: 'keep-me',
    } as ActionsModel & { someExtra: string };
    const result = normalizeAction(input) as
      | (ActionsModel & { someExtra: string })
      | null;

    expect(result?.someExtra).toBe('keep-me');
    expect(result?.remark).toBe('联动备注');
    // 浅拷贝：返回新对象，不修改入参
    expect(result).not.toBe(input);
    expect(input.id).toBeUndefined();
  });

  it('保留现有字段（args/componentId/methodName/type）', () => {
    const input: ActionsModel = {
      args: '[{"__isExpression__":true,"content":"$formData.a"}]',
      componentId: null,
      methodName: 'getData',
      type: 'custom',
    };
    const result = normalizeAction(input);

    expect(result?.args).toBe(input.args);
    expect(result?.componentId).toBeNull();
    expect(result?.methodName).toBe('getData');
    expect(result?.type).toBe('custom');
  });
});

describe('normalizeActions 动作列表归一化', () => {
  const base: ActionsModel = {
    methodName: 'setValue',
    type: 'component',
  };

  it('null/undefined 输入返回空数组', () => {
    expect(normalizeActions(null)).toEqual([]);
    expect(normalizeActions(undefined)).toEqual([]);
  });

  it('逐条归一化并过滤非法项（null/undefined 元素被剔除）', () => {
    const list = [
      base,
      null,
      { methodName: 'getData', type: 'custom' },
      undefined,
      123,
    ] as unknown as ActionsModel[];
    const result = normalizeActions(list);

    expect(result).toHaveLength(2);
    for (const action of result) {
      expect(action.id).toBeDefined();
      expect(action.enabled).toBe(true);
    }
    expect(result[0]?.methodName).toBe('setValue');
    expect(result[1]?.methodName).toBe('getData');
  });

  it('返回新数组，不修改入参数组', () => {
    const list: ActionsModel[] = [base];
    const result = normalizeActions(list);

    expect(result).not.toBe(list);
    expect(list[0]?.id).toBeUndefined();
  });
});
