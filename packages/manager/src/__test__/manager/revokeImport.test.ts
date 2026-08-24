import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignerState } from '@aigen-designer/types';

import { useRevoke } from '../../';

describe('历史记录导入兼容性（旧格式/导出往返）', () => {
  const mockState: DesignerState = { disabledHover: false, hoverNode: null, matched: [], selectedNode: null };
  const mockSetSelectedNode = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('旧格式（全部 pageSchema 快照）导入后可完整撤销/重做', () => {
    const pageSchema: any = { schemas: [] };
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

    // 模拟旧版本导出的数据：所有记录都是 pageSchema 全量快照
    const oldData = {
      currentRecord: {
        pageSchema: JSON.stringify({ schemas: [{ id: '3', type: 'input' }] }),
        timestamp: 1,
        type: '记录3',
      },
      recordList: [
        { pageSchema: JSON.stringify({ schemas: [] }), timestamp: 1, type: '初始化' },
        { pageSchema: JSON.stringify({ schemas: [{ id: '1', type: 'input' }] }), timestamp: 2, type: '记录1' },
        { pageSchema: JSON.stringify({ schemas: [{ id: '1' }, { id: '2' }] }), timestamp: 3, type: '记录2' },
      ],
      undoList: [],
    };

    revoke.importHistory(oldData as any);
    expect(pageSchema.schemas).toHaveLength(1);
    expect(pageSchema.schemas[0].id).toBe('3');

    // 逐级撤销到底
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(2);
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(1);
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(0);
    expect(revoke.undo()).toBe(false);

    // 全部重做回来
    revoke.redo();
    expect(pageSchema.schemas).toHaveLength(1);
    revoke.redo();
    expect(pageSchema.schemas).toHaveLength(2);
    revoke.redo();
    expect(pageSchema.schemas).toHaveLength(1);
    expect(pageSchema.schemas[0].id).toBe('3');

    // 再提交一条新记录，diff 应基于导入后的状态计算（链一致）
    pageSchema.schemas.push({ id: '4', type: 'input' });
    revoke.push('记录4');
    vi.advanceTimersByTime(200);
    // 导入的 3 条 + 提交时推入的"记录3" = 4 条
    expect(revoke.recordList.value).toHaveLength(4);
    expect(revoke.currentRecord.value?.diff).toBeDefined();
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(1);
  });

  it('exportHistory 导出后重新 import 状态一致', () => {
    const pageSchema: any = { schemas: [] };
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);
    revoke.push('初始化');
    vi.advanceTimersByTime(200);
    pageSchema.schemas.push({ id: '1', type: 'input', props: { a: 1 } });
    revoke.push('记录1');
    vi.advanceTimersByTime(200);
    pageSchema.schemas[0].props.a = 2;
    revoke.push('记录2');
    vi.advanceTimersByTime(200);

    const exported = revoke.exportHistory();
    const json = JSON.parse(JSON.stringify(exported)); // 模拟存库/取库

    // 新实例导入
    const pageSchema2: any = { schemas: [] };
    const revoke2 = useRevoke(pageSchema2, mockState, mockSetSelectedNode);
    revoke2.importHistory(json as any);
    expect(pageSchema2.schemas).toHaveLength(1);
    expect(pageSchema2.schemas[0].props.a).toBe(2);

    revoke2.undo();
    expect(pageSchema2.schemas[0].props.a).toBe(1);
    revoke2.undo();
    expect(pageSchema2.schemas).toHaveLength(0);
    revoke2.redo();
    revoke2.redo();
    expect(pageSchema2.schemas[0].props.a).toBe(2);
  });
});