import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignerState } from '@aigen-designer/types';

import { createPageManager, useRevoke } from '../../';

/**
 * W6 修复回归测试：
 * - 6.1 非法 JSON args 的动作不中断整条动作链
 * - 6.2 防抖窗口内撤销后，防抖回调不产生「幽灵空记录」（diff: []）
 * - 6.4 dispose 后防抖回调不再对已卸载状态提交
 */
describe('W6 manager 修复回归', () => {
  const mockState: DesignerState = {
    disabledHover: false,
    hoverNode: null,
    matched: [],
    selectedNode: null,
  };
  const mockSetSelectedNode = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('6.1 doActions 非法 JSON args 不中断动作链', () => {
    it('非法 JSON 的动作被跳过，后续合法动作仍执行', () => {
      const pageManager = createPageManager();
      const calls: unknown[][] = [];
      // 注册一个组件实例，其 exposed 提供 log 方法供 component 类型动作调用
      pageManager.addComponentInstance('c1', {
        exposed: {
          log: (...args: unknown[]) => calls.push(args),
        },
      } as any);

      pageManager.doActions([
        // 第一个动作：args 为非法 JSON，应被跳过并告警，不中断链
        {
          componentId: 'c1',
          methodName: 'log',
          type: 'component',
          args: '{bad json',
        },
        // 第二个动作：合法数组参数，应正常执行
        {
          componentId: 'c1',
          methodName: 'log',
          type: 'component',
          args: '["ok"]',
        },
        // 第三个动作：非数组 JSON（对象字面量），应包装为数组正常执行
        {
          componentId: 'c1',
          methodName: 'log',
          type: 'component',
          args: '{"a":1}',
        },
      ]);

      // 非法动作被跳过，其余动作依次执行
      expect(calls).toEqual([['ok'], [{ a: 1 }]]);
    });

    it('全部动作合法时行为不变', () => {
      const pageManager = createPageManager();
      const calls: unknown[][] = [];
      pageManager.addComponentInstance('c1', {
        exposed: {
          log: (...args: unknown[]) => calls.push(args),
        },
      } as any);
      pageManager.doActions([
        {
          componentId: 'c1',
          methodName: 'log',
          type: 'component',
          args: '[1]',
        },
        {
          componentId: 'c1',
          methodName: 'log',
          type: 'component',
          args: '["a","b"]',
        },
      ]);
      expect(calls).toEqual([[1], ['a', 'b']]);
    });
  });

  describe('6.2 防抖竞态：撤销后不产生幽灵空记录', () => {
    it('push 后防抖窗口内撤销，防抖回调触发不产生 diff: [] 空记录', () => {
      const pageSchema: any = { schemas: [] };
      const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

      revoke.push('初始化');
      vi.advanceTimersByTime(200);
      pageSchema.schemas.push({ id: '1', type: 'input', v: 'a' });
      revoke.push('记录1');
      vi.advanceTimersByTime(200);

      // 修改但防抖未触发（100ms < 200ms），随后立即撤销
      pageSchema.schemas[0].v = 'b';
      revoke.push('修改属性');
      vi.advanceTimersByTime(100);
      revoke.undo();

      // 防抖回调随后触发（此时 live 已是撤销后的状态）
      vi.advanceTimersByTime(200);

      // 链上不存在 diff 为 '[]' 的幽灵空记录
      const allRecords = [
        ...revoke.recordList.value,
        ...(revoke.currentRecord.value ? [revoke.currentRecord.value] : []),
        ...revoke.undoList.value,
      ];
      expect(allRecords.filter((r) => r.diff === '[]')).toHaveLength(0);

      // 链仍然一致：继续提交新操作可正常撤销/重做
      pageSchema.schemas.push({ id: '9', type: 'input', v: 'c' });
      revoke.push('新修改');
      vi.advanceTimersByTime(200);
      expect(pageSchema.schemas).toHaveLength(1);
      revoke.undo();
      expect(pageSchema.schemas).toHaveLength(0);
      revoke.redo();
      expect(pageSchema.schemas).toHaveLength(1);
      expect(pageSchema.schemas[0].v).toBe('c');
    });
  });

  describe('6.4 dispose 后无提交', () => {
    it('dispose 取消挂起的防抖提交，卸载后定时器不执行', () => {
      const pageSchema: any = { schemas: [] };
      const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

      revoke.push('初始化');
      vi.advanceTimersByTime(200);
      expect(revoke.currentRecord.value?.type).toBe('初始化');

      // 提交一个防抖挂起的修改，然后立即 dispose（模拟组件卸载）
      pageSchema.schemas.push({ id: '1', type: 'input' });
      revoke.push('添加组件');
      revoke.dispose();
      vi.advanceTimersByTime(200);

      // 防抖提交被取消：未产生任何新记录
      expect(revoke.recordList.value).toHaveLength(0);
      expect(revoke.currentRecord.value?.type).toBe('初始化');
      expect(revoke.currentRecord.value?.diff).toBeUndefined();
    });

    it('dispose 之后实例仍可正常使用', () => {
      const pageSchema: any = { schemas: [] };
      const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);
      revoke.push('初始化');
      vi.advanceTimersByTime(200);
      revoke.dispose();

      pageSchema.schemas.push({ id: '1', type: 'input' });
      revoke.push('添加组件');
      vi.advanceTimersByTime(200);
      expect(revoke.recordList.value).toHaveLength(1);
      expect(revoke.currentRecord.value?.diff).toBeDefined();
      revoke.undo();
      expect(pageSchema.schemas).toHaveLength(0);
    });
  });
});
