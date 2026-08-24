import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignerState } from '@aigen-designer/types';

import { useRevoke } from '../../';
// 旧版实现（git HEAD 快照）：生成真实的旧格式历史数据
import { useRevoke as useLegacyRevoke } from './legacyRevoke';

describe('旧格式 importHistory 完全可替换（旧代码生成 → 新代码消费）', () => {
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

  /** 用旧版实现执行一段完整操作序列，返回 { 导出数据, 每步状态快照, 旧实现引用 } */
  const buildLegacyHistory = () => {
    const legacyPage: any = { schemas: [] };
    const legacy = useLegacyRevoke(legacyPage, mockState, mockSetSelectedNode);
    const states: any[] = [];

    const commit = (type: string, mutate: () => void) => {
      mutate();
      legacy.push(type);
      vi.advanceTimersByTime(200);
      states.push(JSON.parse(JSON.stringify(legacyPage.schemas)));
    };

    // 初始记录（基线）
    legacy.push('初始化');
    vi.advanceTimersByTime(200);
    states.push(JSON.parse(JSON.stringify(legacyPage.schemas))); // S0=[]

    commit('添加组件1', () => {
      legacyPage.schemas.push({ id: '1', type: 'input', v: 'a' });
    }); // S1
    commit('修改属性', () => {
      legacyPage.schemas[0].v = 'b';
    }); // S2
    commit('添加组件2', () => {
      legacyPage.schemas.push({ id: '2', type: 'input', v: 'x' });
    }); // S3
    commit('删除组件', () => {
      legacyPage.schemas.splice(0, 1);
    }); // S4

    return { legacy, legacyPage, states };
  };

  it('完整操作序列：导入后状态/计数/类型一致，逐步撤销重做一致，可继续混链新操作', () => {
    const { legacy, legacyPage, states } = buildLegacyHistory();

    // 撤销+重做各一步（验证旧实现 undoList 分支也导出旧格式）
    legacy.undo();
    legacy.redo();
    const exported = legacy.exportHistory();
    expect(JSON.parse(JSON.stringify(exported.recordList[0])).pageSchema).toBeDefined();
    expect(legacyPage.schemas).toEqual(states[4]);

    // 新实现消费旧数据
    const newPage: any = { schemas: [] };
    const revoke = useRevoke(newPage, mockState, mockSetSelectedNode);
    revoke.importHistory(JSON.parse(JSON.stringify(exported)));

    // 页面同步为链尾状态
    expect(newPage.schemas).toEqual(states[4]);
    // 计数与旧实现一致
    expect(revoke.getUndoCount()).toBe(legacy.getUndoCount());
    expect(revoke.getRedoCount()).toBe(legacy.getRedoCount());
    // 链首已归一化为 snapshot，旧字段被清除
    expect(revoke.recordList.value[0].snapshot).toBeDefined();
    expect(revoke.recordList.value[0].pageSchema).toBeUndefined();
    // 记录类型序列一致
    expect(revoke.recordList.value.map((r) => r.type)).toEqual(
      legacy.recordList.value.map((r) => r.type),
    );

    // 逐步撤销到基线
    revoke.undo();
    expect(newPage.schemas).toEqual(states[3]);
    revoke.undo();
    expect(newPage.schemas).toEqual(states[2]);
    revoke.undo();
    expect(newPage.schemas).toEqual(states[1]);
    revoke.undo();
    expect(newPage.schemas).toEqual(states[0]);
    expect(revoke.undo()).toBe(false);

    // 逐步重做回来
    revoke.redo();
    expect(newPage.schemas).toEqual(states[1]);
    revoke.redo();
    expect(newPage.schemas).toEqual(states[2]);
    revoke.redo();
    expect(newPage.schemas).toEqual(states[3]);
    revoke.redo();
    expect(newPage.schemas).toEqual(states[4]);

    // 导入后继续提交新 diff 记录，与旧记录混链一致
    newPage.schemas.push({ id: '9', type: 'input' });
    revoke.push('新操作');
    vi.advanceTimersByTime(200);
    expect(revoke.currentRecord.value?.diff).toBeDefined();
    revoke.undo();
    expect(newPage.schemas).toEqual(states[4]);
    revoke.redo();
    expect(newPage.schemas).toEqual([...states[4], { id: '9', type: 'input' }]);
  });

  it('撤销到中间状态（undoList 含旧格式记录）导出后导入', () => {
    const { legacy, states } = buildLegacyHistory();
    legacy.undo(); // 回到 S3，undoList=[S4]
    const exported = legacy.exportHistory();

    const newPage: any = { schemas: [] };
    const revoke = useRevoke(newPage, mockState, mockSetSelectedNode);
    revoke.importHistory(JSON.parse(JSON.stringify(exported)));

    expect(newPage.schemas).toEqual(states[3]);
    expect(revoke.getUndoCount()).toBe(3);
    expect(revoke.getRedoCount()).toBe(1);

    // 重做可回到 S4（undoList 中的旧格式记录被正确归一化回放）
    revoke.redo();
    expect(newPage.schemas).toEqual(states[4]);
    expect(revoke.undoList.value[0]?.pageSchema).toBeUndefined();
  });

  it('撤销到底（recordList 为空、undoList 全旧格式）导出后导入', () => {
    const { legacy, states } = buildLegacyHistory();
    for (let i = 0; i < 4; i++) {
      legacy.undo();
    }
    expect(legacy.getUndoCount()).toBe(0);
    expect(legacy.getRedoCount()).toBe(4);
    const exported = legacy.exportHistory();

    const newPage: any = { schemas: [] };
    const revoke = useRevoke(newPage, mockState, mockSetSelectedNode);
    revoke.importHistory(JSON.parse(JSON.stringify(exported)));

    expect(newPage.schemas).toEqual(states[0]);
    expect(revoke.getUndoCount()).toBe(0);
    expect(revoke.getRedoCount()).toBe(4);

    revoke.redo();
    expect(newPage.schemas).toEqual(states[1]);
    revoke.redo();
    expect(newPage.schemas).toEqual(states[2]);
    revoke.redo();
    expect(newPage.schemas).toEqual(states[3]);
    revoke.redo();
    expect(newPage.schemas).toEqual(states[4]);
    expect(revoke.redo()).toBe(false);
  });

  it('空历史导出（reset 后）导入不改变页面', () => {
    const { legacy } = buildLegacyHistory();
    legacy.reset();
    const exported = legacy.exportHistory();
    expect(exported.currentRecord).toBeNull();
    expect(exported.recordList).toHaveLength(0);

    const newPage: any = { schemas: [{ id: 'keep', type: 'x' }] };
    const revoke = useRevoke(newPage, mockState, mockSetSelectedNode);
    revoke.importHistory(JSON.parse(JSON.stringify(exported)));

    expect(newPage.schemas).toEqual([{ id: 'keep', type: 'x' }]);
    expect(revoke.getUndoCount()).toBe(0);
    expect(revoke.getRedoCount()).toBe(0);

    // 后续提交生成新基线
    revoke.push('初始化');
    vi.advanceTimersByTime(200);
    expect(revoke.currentRecord.value?.snapshot).toBeDefined();
  });

  it('旧格式导入 → 新格式导出 → 再次导入，数据等价且自洽', () => {
    const { legacy, states } = buildLegacyHistory();
    const oldExport = JSON.parse(JSON.stringify(legacy.exportHistory()));

    const newPage1: any = { schemas: [] };
    const revoke1 = useRevoke(newPage1, mockState, mockSetSelectedNode);
    revoke1.importHistory(oldExport);
    // 新格式导出
    const newExport = JSON.parse(JSON.stringify(revoke1.exportHistory()));

    // 再导入新格式
    const newPage2: any = { schemas: [] };
    const revoke2 = useRevoke(newPage2, mockState, mockSetSelectedNode);
    revoke2.importHistory(newExport);

    expect(newPage2.schemas).toEqual(states[4]);
    expect(revoke2.getUndoCount()).toBe(revoke1.getUndoCount());
    expect(revoke2.getRedoCount()).toBe(revoke1.getRedoCount());
    // 状态序列完全一致
    revoke2.undo();
    expect(newPage2.schemas).toEqual(states[3]);
    revoke2.undo();
    revoke2.undo();
    revoke2.undo();
    expect(newPage2.schemas).toEqual(states[0]);
  });
});
