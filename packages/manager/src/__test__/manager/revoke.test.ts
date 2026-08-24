import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignerState } from '@aigen-designer/types';

import { useRevoke } from '../../';

describe('useRevoke', () => {
  // 模拟页面Schema和设计器状态
  const mockPageSchema = { schemas: [] };
  const mockState: DesignerState = { disabledHover: false, hoverNode: null, matched: [], selectedNode: null };
  const mockSetSelectedNode = vi.fn();

  beforeEach(() => {
    // 在每个测试前启用假定时器
    vi.useFakeTimers();
    // 重置所有模拟函数
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 在每个测试后恢复真实定时器
    vi.useRealTimers();
  });

  it('应正确初始化', () => {
    const revoke = useRevoke(
      mockPageSchema,
      mockState,
      mockSetSelectedNode
    );
    
    expect(revoke.recordList.value).toHaveLength(0);
    expect(revoke.undoList.value).toHaveLength(0);
    expect(revoke.currentRecord.value).toBeNull();
  });

  it('应正确插入记录', () => {
    const revoke = useRevoke(
      mockPageSchema,
      mockState,
      mockSetSelectedNode
    );
    
    // 第一次push，currentRecord应该被设置，recordList应该为空
    revoke.push('插入组件');
    
    // 因为有防抖，所以需要等待200ms
    vi.advanceTimersByTime(200);

    expect(revoke.currentRecord.value).not.toBeNull();
    expect(revoke.currentRecord.value?.type).toBe('插入组件');
    expect(revoke.recordList.value).toHaveLength(0);
    
    // 模拟时间间隔
    vi.advanceTimersByTime(200);
    
    // 第二次push，之前的currentRecord应该被添加到recordList
    revoke.push('修改组件');
    vi.advanceTimersByTime(200);
    expect(revoke.currentRecord.value?.type).toBe('修改组件');
    expect(revoke.recordList.value).toHaveLength(1);
    expect(revoke.recordList.value[0].type).toBe('插入组件');
  });

  it('应正确撤销操作', () => {
    const revoke = useRevoke(
      mockPageSchema,
      mockState,
      mockSetSelectedNode
    );
    
    // 准备两条记录
    revoke.push('插入组件1');
    vi.advanceTimersByTime(200);
    revoke.push('插入组件2');
    vi.advanceTimersByTime(200);
    
    // 撤销操作
    revoke.undo();
    
    // 验证撤销结果
    expect(revoke.recordList.value).toHaveLength(0);
    expect(revoke.undoList.value).toHaveLength(1);
    expect(revoke.undoList.value[0].type).toBe('插入组件2');
    expect(revoke.currentRecord.value?.type).toBe('插入组件1');
    
    // 验证applyRecord被调用
    expect(mockSetSelectedNode).toHaveBeenCalled();
  });

  it('应正确重做操作', () => {
    const revoke = useRevoke(
      mockPageSchema,
      mockState,
      mockSetSelectedNode
    );
    
    // 准备记录并撤销
    revoke.push('插入组件1');
    vi.advanceTimersByTime(200);
    revoke.push('插入组件2');
    vi.advanceTimersByTime(200);
    revoke.undo();
    
    // 重置模拟函数计数
    mockSetSelectedNode.mockClear();
    
    // 执行重做
    revoke.redo();
    
    // 验证重做结果
    expect(revoke.recordList.value).toHaveLength(1);
    expect(revoke.recordList.value[0].type).toBe('插入组件1');
    expect(revoke.undoList.value).toHaveLength(0);
    expect(revoke.currentRecord.value?.type).toBe('插入组件2');
    
    // 验证applyRecord被调用
    expect(mockSetSelectedNode).toHaveBeenCalled();
  });

  it('当没有记录时撤销应返回false', () => {
    const revoke = useRevoke(
      mockPageSchema,
      mockState,
      mockSetSelectedNode
    );
    
    const result = revoke.undo();
    expect(result).toBe(false);
  });

  it('当没有重做记录时重做应返回false', () => {
    const revoke = useRevoke(
      mockPageSchema,
      mockState,
      mockSetSelectedNode
    );
    
    const result = revoke.redo();
    expect(result).toBe(false);
  });

  it('应正确重置所有记录', () => {
    const revoke = useRevoke(
      mockPageSchema,
      mockState,
      mockSetSelectedNode
    );
    
    // 准备记录
    revoke.push('插入组件1');
    vi.advanceTimersByTime(200);
    revoke.push('插入组件2');
    vi.advanceTimersByTime(200);
    // 执行重置
    revoke.reset();
    
    // 验证重置结果
    expect(revoke.recordList.value).toHaveLength(0);
    expect(revoke.undoList.value).toHaveLength(0);
    expect(revoke.currentRecord.value).toBeNull();
  });

  it('应处理加载数据的特殊情况', () => {
    const revoke = useRevoke(
      mockPageSchema,
      mockState,
      mockSetSelectedNode
    );
    
    // 先设置初始化记录
    revoke.push('初始化');
    // 然后加载数据
    revoke.push('加载数据');
    vi.advanceTimersByTime(200);
    
    // 验证结果 - 应该只更新currentRecord而不添加到recordList
    expect(revoke.recordList.value).toHaveLength(0);
    expect(revoke.currentRecord.value?.type).toBe('加载数据');
  });

  it('应限制记录数量不超过60条', () => {
    const revoke = useRevoke(
      mockPageSchema,
      mockState,
      mockSetSelectedNode
    );
    
    // 添加61条记录
    revoke.push('初始记录');
    
    for (let i = 0; i < 61; i++) {
      vi.advanceTimersByTime(200);
      revoke.push(`记录${i}`);
    }
    vi.advanceTimersByTime(200);
    
    // 验证结果 - recordList应该只有60条，最早的记录应该被移除
    expect(revoke.recordList.value).toHaveLength(60);
    expect(revoke.recordList.value[0].type).toBe('记录0');
    expect(revoke.currentRecord.value?.type).toBe('记录60');
  });

  it('应忽略短时间内的重复记录', () => {
    const revoke = useRevoke(
      mockPageSchema,
      mockState,
      mockSetSelectedNode
    );
    
    // 添加第一条记录
    revoke.push('记录1');
    
    // 短时间内添加第二条记录（不到150ms）
    vi.advanceTimersByTime(100);
    revoke.push('记录2');
    
    vi.advanceTimersByTime(200);
    // 验证结果 - 第一条记录应该被忽略
    expect(revoke.recordList.value).toHaveLength(0);
    expect(revoke.currentRecord.value?.type).toBe('记录2');
    
    // 足够时间后添加第三条记录
    vi.advanceTimersByTime(200);
    revoke.push('记录3');
    vi.advanceTimersByTime(200);
    
    // 验证结果 - 第三条记录应该被添加
    expect(revoke.recordList.value).toHaveLength(1);
    expect(revoke.recordList.value[0].type).toBe('记录2');
    expect(revoke.currentRecord.value?.type).toBe('记录3');
  });

  it('应正确获取可撤销和可重做的操作数量', () => {
    const revoke = useRevoke(
      mockPageSchema,
      mockState,
      mockSetSelectedNode
    );
    
    // 初始状态
    expect(revoke.getUndoCount()).toBe(0);
    expect(revoke.getRedoCount()).toBe(0);
    
    // 添加记录,第一条属于初始化记录
    revoke.push('记录1');
    vi.advanceTimersByTime(200);
    revoke.push('记录2');
    vi.advanceTimersByTime(200);
    
    // 添加记录后 - 应该有一条记录可以撤销（记录2）
    expect(revoke.getUndoCount()).toBe(1);
    expect(revoke.getRedoCount()).toBe(0);
    
    // 撤销操作
    revoke.undo();
    
    // 撤销后 - 应该有一条可以重做
    expect(revoke.getUndoCount()).toBe(0);
    expect(revoke.getRedoCount()).toBe(1);
    
    // // 重做操作
    // revoke.redo();
    
    // // 重做后 - 应该回到两条记录可以撤销
    // expect(revoke.getUndoCount()).toBe(2);
    // expect(revoke.getRedoCount()).toBe(0);
  });

  it('应正确处理reset方法', () => {
    const revoke = useRevoke(
      mockPageSchema,
      mockState,
      mockSetSelectedNode
    );
    
    // 添加一些记录
    revoke.push('记录1');
    vi.advanceTimersByTime(200);
    revoke.push('记录2');
    vi.advanceTimersByTime(200);
    
    // 验证记录已添加
    expect(revoke.recordList.value).toHaveLength(1);
    expect(revoke.currentRecord.value).not.toBeNull();
    
    // 执行重置
    revoke.reset();
    
    // 验证所有记录都被清空
    expect(revoke.recordList.value).toHaveLength(0);
    expect(revoke.undoList.value).toHaveLength(0);
    expect(revoke.currentRecord.value).toBeNull();
  });

  it('应使用快照+差异存储历史记录', () => {
    const pageSchema: any = { schemas: [] };
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

    // 第一条记录是基线快照
    revoke.push('初始化');
    vi.advanceTimersByTime(200);
    expect(revoke.currentRecord.value?.snapshot).toBeDefined();
    expect(revoke.currentRecord.value?.diff).toBeUndefined();

    // 后续记录保存差异
    pageSchema.schemas.push({ id: '1', type: 'input' });
    revoke.push('添加组件');
    vi.advanceTimersByTime(200);
    expect(revoke.recordList.value[0].snapshot).toBeDefined();
    expect(revoke.currentRecord.value?.diff).toBeDefined();
    expect(revoke.currentRecord.value?.snapshot).toBeUndefined();
  });

  it('撤销与重做应正确还原页面状态', () => {
    const pageSchema: any = { schemas: [] };
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

    revoke.push('初始化');
    vi.advanceTimersByTime(200);

    pageSchema.schemas.push({ id: '1', type: 'input', props: { value: 'a' } });
    revoke.push('添加组件');
    vi.advanceTimersByTime(200);

    pageSchema.schemas[0].props.value = 'b';
    revoke.push('修改属性');
    vi.advanceTimersByTime(200);
    expect(pageSchema.schemas[0].props.value).toBe('b');

    // 撤销两次，逐步还原
    revoke.undo();
    expect(pageSchema.schemas[0].props.value).toBe('a');
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(0);

    // 重做两次，逐步恢复
    revoke.redo();
    expect(pageSchema.schemas).toHaveLength(1);
    expect(pageSchema.schemas[0].props.value).toBe('a');
    revoke.redo();
    expect(pageSchema.schemas[0].props.value).toBe('b');
  });

  it('记录数超过上限时链首应重编码为基线快照', () => {
    const pageSchema: any = { schemas: [] };
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

    revoke.push('初始记录');
    for (let i = 0; i < 61; i++) {
      vi.advanceTimersByTime(200);
      pageSchema.schemas.push({ id: `id_${i}`, type: 'input' });
      revoke.push(`记录${i}`);
    }
    vi.advanceTimersByTime(200);

    expect(revoke.recordList.value).toHaveLength(60);
    // 链首必须是基线快照
    expect(revoke.recordList.value[0].snapshot).toBeDefined();
    expect(revoke.recordList.value[0].diff).toBeUndefined();

    // 重编码后撤销仍能正确还原状态
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(60);
  });

  it('导入旧版本全量快照历史数据应兼容', () => {
    const pageSchema: any = { schemas: [{ id: '1', type: 'input' }] };
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

    // 旧格式记录：pageSchema 全量快照
    const oldRecord: any = {
      pageSchema: JSON.stringify({ schemas: [{ id: '9', type: 'button' }] }),
      timestamp: Date.now(),
      type: '旧记录',
    };
    // 新格式记录：差异
    const newRecord: any = {
      diff: JSON.stringify([
        {
          op: 'add',
          path: '/schemas/1',
          value: { id: '2', type: 'input' },
        },
      ]),
      timestamp: Date.now(),
      type: '差异记录',
    };

    revoke.importHistory({
      currentRecord: newRecord,
      recordList: [oldRecord],
      undoList: [],
    });

    // 旧格式被转换为 snapshot，页面状态同步为链尾状态
    expect(revoke.recordList.value[0].snapshot).toBeDefined();
    expect(pageSchema.schemas).toHaveLength(2);
    expect(pageSchema.schemas[1].id).toBe('2');

    // 撤销应回到旧记录的状态
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(1);
    expect(pageSchema.schemas[0].id).toBe('9');
  });

  it('previewHistory 应能正确预览撤销列表中的记录（多次撤销后）', () => {
    const pageSchema: any = { schemas: [] };
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

    revoke.push('初始化');
    vi.advanceTimersByTime(200);

    pageSchema.schemas.push({ id: '1', type: 'input', v: 'a' });
    revoke.push('记录1');
    vi.advanceTimersByTime(200);

    pageSchema.schemas.push({ id: '2', type: 'input', v: 'b' });
    revoke.push('记录2');
    vi.advanceTimersByTime(200);

    pageSchema.schemas[1].v = 'c';
    revoke.push('记录3');
    vi.advanceTimersByTime(200);

    // 撤销两次：当前状态为记录1（1 个组件）
    revoke.undo();
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(1);

    // 预览 undoList 中的记录2（应恢复到 2 个组件，v='b'）
    const record2 = revoke.undoList.value[1];
    const restore = revoke.previewHistory(record2);
    expect(pageSchema.schemas).toHaveLength(2);
    expect(pageSchema.schemas[1].v).toBe('b');

    // 恢复预览前的状态
    restore();
    expect(pageSchema.schemas).toHaveLength(1);
  });

  it('撤销后提交新记录应清空重做列表并保持链一致', () => {
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

    // 撤销后提交新分支
    revoke.undo();
    expect(revoke.getRedoCount()).toBe(1);
    pageSchema.schemas.push({ id: '3', type: 'input' });
    revoke.push('记录3');
    vi.advanceTimersByTime(200);

    // 新提交应清空重做列表
    expect(revoke.getRedoCount()).toBe(0);
    expect(revoke.recordList.value).toHaveLength(2);

    // 新分支撤销/重做链应一致
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(1);
    expect(pageSchema.schemas[0].id).toBe('1');
    revoke.redo();
    expect(pageSchema.schemas).toHaveLength(2);
    expect(pageSchema.schemas[1].id).toBe('3');
  });

  it('previewHistory 应能正确预览 recordList 中的记录', () => {
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

    // 预览 recordList 中的记录1（1 个组件；recordList[0] 是"初始化"空状态）
    const record1 = revoke.recordList.value[1];
    const restore = revoke.previewHistory(record1);
    expect(pageSchema.schemas).toHaveLength(1);
    restore();
    expect(pageSchema.schemas).toHaveLength(2);
  });

});