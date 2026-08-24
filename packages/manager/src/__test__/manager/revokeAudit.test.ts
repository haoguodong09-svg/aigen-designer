import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignerState } from '@aigen-designer/types';

import { reactive } from 'vue';

import { useRevoke } from '../../';

describe('useRevoke 审计回归', () => {
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

  it('含函数属性（show）的 schema 在 structuredClone 环境下提交/撤销不崩溃', () => {
    // 模拟真实浏览器：window.structuredClone 可用（Node 自带，等价现代浏览器）
    const original = (window as any).structuredClone;
    (window as any).structuredClone = globalThis.structuredClone;
    try {
      const pageSchema: any = reactive({
        schemas: [{ id: '1', type: 'input', show: () => true }],
      });
      const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

      revoke.push('初始化');
      vi.advanceTimersByTime(200);
      expect(revoke.currentRecord.value?.snapshot).toBeDefined();

      // 新增带函数属性的组件并提交
      pageSchema.schemas.push({
        id: '2',
        type: 'input',
        show: (params: any) => params?.values?.x,
      });
      revoke.push('添加组件');
      vi.advanceTimersByTime(200);
      expect(revoke.currentRecord.value?.diff).toBeDefined();

      // 提交不改变实时页面，函数属性保留在页面上
      expect(typeof pageSchema.schemas[1].show).toBe('function');
      expect(revoke.currentRecord.value?.diff).toBeDefined();

      // 撤销/重做不崩溃（函数经 JSON 序列化会丢失，与旧全量快照实现一致）
      revoke.undo();
      expect(pageSchema.schemas).toHaveLength(1);
      revoke.redo();
      expect(pageSchema.schemas).toHaveLength(2);
      expect(pageSchema.schemas[1].show).toBeUndefined();
    } finally {
      (window as any).structuredClone = original;
    }
  });

  it('加载数据替换基线后应作废旧重做记录，redo 不污染新页面', () => {
    const pageSchema: any = { schemas: [] };
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

    revoke.push('初始化');
    vi.advanceTimersByTime(200);
    pageSchema.schemas.push({ id: '1', type: 'input' });
    revoke.push('记录1');
    vi.advanceTimersByTime(200);
    pageSchema.schemas.push({ id: '2', type: 'input' });
    revoke.push('记录2');
    vi.advanceTimersByTime(200);

    // 撤销到底（undoList = [记录2, 记录1]）
    revoke.undo();
    revoke.undo();
    expect(revoke.recordList.value).toHaveLength(0);
    expect(revoke.getRedoCount()).toBe(2);

    // 加载全新数据（替换基线）
    pageSchema.schemas = [{ id: 'L1', type: 'table' }, { id: 'L2', type: 'table' }];
    revoke.push('加载数据');
    vi.advanceTimersByTime(200);

    // 旧重做记录必须被作废
    expect(revoke.getRedoCount()).toBe(0);
    expect(revoke.redo()).toBe(false);
    expect(pageSchema.schemas).toHaveLength(2);
    expect(pageSchema.schemas[0].id).toBe('L1');
  });

  it('使用真实 reactive() 页面驱动提交/撤销/重做', () => {
    const pageSchema: any = reactive({
      schemas: [],
      script: '',
    });
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

    revoke.push('初始化');
    vi.advanceTimersByTime(200);
    pageSchema.schemas.push({ id: '1', type: 'input', props: { a: 1 } });
    revoke.push('添加组件');
    vi.advanceTimersByTime(200);
    pageSchema.schemas[0].props.a = 2;
    revoke.push('修改属性');
    vi.advanceTimersByTime(200);

    expect(pageSchema.schemas[0].props.a).toBe(2);
    revoke.undo();
    expect(pageSchema.schemas[0].props.a).toBe(1);
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(0);
    revoke.redo();
    revoke.redo();
    expect(pageSchema.schemas[0].props.a).toBe(2);
  });

  it('isImportant 提交跳过防抖直接入链', () => {
    const pageSchema: any = { schemas: [] };
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

    revoke.push('初始化', true);
    expect(revoke.currentRecord.value?.type).toBe('初始化');

    pageSchema.schemas.push({ id: '1', type: 'input' });
    revoke.push('重要操作', true);
    expect(revoke.recordList.value).toHaveLength(1);
    expect(revoke.recordList.value[0].type).toBe('初始化');
    expect(revoke.currentRecord.value?.type).toBe('重要操作');
  });

  it('撤销/重做应恢复选中节点（selectedId）', () => {
    const pageSchema: any = { schemas: [] };
    const selectedNode = { id: '2', type: 'input' };
    const stateWithSelection: DesignerState = {
      ...mockState,
      selectedNode: selectedNode as any,
    };
    const revoke = useRevoke(pageSchema, stateWithSelection, mockSetSelectedNode);

    revoke.push('初始化');
    vi.advanceTimersByTime(200);
    pageSchema.schemas.push({ id: '1', type: 'input' });
    pageSchema.schemas.push({ id: '2', type: 'input' });
    revoke.push('添加组件');
    vi.advanceTimersByTime(200);

    mockSetSelectedNode.mockClear();
    revoke.undo();
    // 记录2 的 selectedId 指向已不存在的节点时回退（不崩溃）
    expect(mockSetSelectedNode).toHaveBeenCalledWith(undefined);
  });

  it('导入链首非快照的历史数据应被拒绝且不改变现有状态', () => {
    const pageSchema: any = { schemas: [{ id: 'live', type: 'x' }] };
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);
    revoke.push('初始化');
    vi.advanceTimersByTime(200);
    expect(revoke.recordList.value).toHaveLength(0);

    // 非法数据：recordList[0] 是 diff 记录（无基线快照）
    revoke.importHistory({
      currentRecord: {
        diff: JSON.stringify([{ op: 'add', path: '/schemas/0', value: { id: 'bad', type: 'x' } }]),
        timestamp: 1,
        type: '坏记录',
      },
      recordList: [],
      undoList: [],
    });

    // 导入被拒绝：页面与历史均不变
    expect(pageSchema.schemas).toHaveLength(1);
    expect(pageSchema.schemas[0].id).toBe('live');
    expect(revoke.currentRecord.value?.type).toBe('初始化');

    // 历史功能仍可用
    pageSchema.schemas.push({ id: '2', type: 'input' });
    revoke.push('添加组件');
    vi.advanceTimersByTime(200);
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(1);
  });

  it('导入含非法 JSON 的历史数据应被整体拒绝', () => {
    const pageSchema: any = { schemas: [] };
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

    revoke.importHistory({
      currentRecord: null,
      recordList: [
        {
          snapshot: '{"schemas":[]}',
          timestamp: 1,
          type: '合法',
        },
        {
          diff: '{invalid json',
          timestamp: 2,
          type: '非法',
        },
      ],
      undoList: [],
    });

    // 拒绝导入：recordList 保持为空
    expect(revoke.recordList.value).toHaveLength(0);
  });
});
