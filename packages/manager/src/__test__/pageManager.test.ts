// 先触发 @aigen-designer/manager 侧求值（hooks ↔ utils ↔ base-ui ↔ manager 存在
// 循环依赖，与 hooks/__test__ 下既有测试的 workaround 一致），避免 useFormSchema 等
// hooks 导出在循环中拿到未初始化绑定
import '@aigen-designer/manager';

import type { ConditionGroup } from '@aigen-designer/types';

import { describe, expect, it, vi } from 'vitest';

import { createPageManager } from '../pageManager';

describe('pageManager.doActions 动作级启停用（enabled）', () => {
  it('enabled === false 的动作被跳过，其余动作照常执行', () => {
    const pageManager = createPageManager();
    const calls: string[] = [];
    pageManager.funcs.value = {
      record: () => {
        calls.push('record');
      },
    };

    pageManager.doActions([
      { enabled: false, methodName: 'record', type: 'custom' },
      { methodName: 'record', type: 'custom' },
      { enabled: true, methodName: 'record', type: 'custom' },
    ]);

    expect(calls).toEqual(['record', 'record']);
  });

  it('缺省 enabled（undefined）视为启用，兼容旧数据', () => {
    const pageManager = createPageManager();
    let called = 0;
    pageManager.funcs.value = {
      bump: () => {
        called += 1;
      },
    };

    pageManager.doActions([{ methodName: 'bump', type: 'custom' }]);

    expect(called).toBe(1);
  });

  it('全部停用时整条动作链不执行任何动作', () => {
    const pageManager = createPageManager();
    let called = 0;
    pageManager.funcs.value = {
      bump: () => {
        called += 1;
      },
    };

    pageManager.doActions([
      { enabled: false, methodName: 'bump', type: 'custom' },
      { enabled: false, methodName: 'bump', type: 'custom' },
    ]);

    expect(called).toBe(0);
  });
});

describe('pageManager.doActions 延迟执行（delay）', () => {
  it('delay 动作延迟执行，动作链其他动作不受影响', () => {
    vi.useFakeTimers();
    try {
      const pageManager = createPageManager();
      const calls: string[] = [];
      pageManager.funcs.value = {
        record: () => {
          calls.push('record');
        },
      };

      pageManager.doActions([
        { delay: 100, methodName: 'record', type: 'custom' },
        { methodName: 'record', type: 'custom' },
      ]);

      // 未推进时钟前：仅立即动作执行
      expect(calls).toEqual(['record']);
      // 推进 100ms：延迟动作执行
      vi.advanceTimersByTime(100);
      expect(calls).toEqual(['record', 'record']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('delay 为 0 或缺省时不延迟，立即执行', () => {
    vi.useFakeTimers();
    try {
      const pageManager = createPageManager();
      let called = 0;
      pageManager.funcs.value = {
        bump: () => {
          called += 1;
        },
      };

      pageManager.doActions([
        { delay: 0, methodName: 'bump', type: 'custom' },
        { methodName: 'bump', type: 'custom' },
      ]);

      expect(called).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('pageManager.doActions 条件求值（condition）', () => {
  it('condition 不满足时动作被跳过，满足时执行', () => {
    const pageManager = createPageManager();
    const calls: string[] = [];
    pageManager.funcs.value = {
      record: () => {
        calls.push('record');
      },
    };
    pageManager.setFormData({ amount: 5 });

    pageManager.doActions([
      {
        condition: {
          items: [{ field: 'amount', operator: '>', value: 10 }],
          logic: 'AND',
        },
        methodName: 'record',
        type: 'custom',
      },
      {
        condition: {
          items: [{ field: 'amount', operator: '>', value: 1 }],
          logic: 'AND',
        },
        methodName: 'record',
        type: 'custom',
      },
    ]);

    // 仅第二个动作（条件满足）执行
    expect(calls).toEqual(['record']);
  });

  it('condition 结构非法（fail-safe）时跳过该动作，不中断动作链', () => {
    const pageManager = createPageManager();
    const calls: string[] = [];
    pageManager.funcs.value = {
      record: () => {
        calls.push('record');
      },
    };

    pageManager.doActions([
      {
        condition: { items: 'bad', logic: 'AND' } as unknown as ConditionGroup,
        methodName: 'record',
        type: 'custom',
      },
      { methodName: 'record', type: 'custom' },
    ]);

    expect(calls).toEqual(['record']);
  });

  it('无条件动作照常执行（兼容旧数据）', () => {
    const pageManager = createPageManager();
    let called = 0;
    pageManager.funcs.value = {
      bump: () => {
        called += 1;
      },
    };

    pageManager.doActions([{ methodName: 'bump', type: 'custom' }]);

    expect(called).toBe(1);
  });
});

describe('pageManager 全局变量（vars）', () => {
  it('setVar/getVar 读写全局变量', () => {
    const pageManager = createPageManager();

    expect(pageManager.getVar('a')).toBeUndefined();

    pageManager.setVar('a', 1);
    expect(pageManager.getVar('a')).toBe(1);

    pageManager.setVar('a', { nested: true });
    expect(pageManager.getVar('a')).toEqual({ nested: true });
  });

  it('doActions 表达式计算可读取 $vars 上下文', () => {
    const pageManager = createPageManager();
    const calls: unknown[] = [];
    pageManager.funcs.value = {
      record: (value: unknown) => {
        calls.push(value);
      },
    };
    pageManager.setVar('discount', 0.5);

    pageManager.doActions([
      {
        args: JSON.stringify([
          { __isExpression__: true, content: '$vars.discount' },
        ]),
        methodName: 'record',
        type: 'custom',
      },
    ]);

    expect(calls).toEqual([0.5]);
  });
});

describe('pageManager 页面事件总线（emitEvent/onEvent）', () => {
  it('注册 handler 后 emit 触发，携带 payload', () => {
    const pageManager = createPageManager();
    const received: unknown[] = [];
    pageManager.onEvent('order-changed-test', (payload) => {
      received.push(payload);
    });

    pageManager.emitEvent('order-changed-test', { id: 1 });

    expect(received).toEqual([{ id: 1 }]);
  });

  it('未监听的事件 emit 不报错', () => {
    const pageManager = createPageManager();

    expect(() => pageManager.emitEvent('no-listener-test', 1)).not.toThrow();
  });
});
