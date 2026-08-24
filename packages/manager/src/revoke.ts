import type {
  ComponentSchema,
  DesignerState,
  PageSchema,
} from '@aigen-designer/types';
import type { DiffOp } from '@aigen-designer/utils';

import { ref } from 'vue';

import {
  applyPatch,
  createPatch,
  debounce,
  deepClone,
  deepCompareAndModify,
  deepToRaw,
  findSchemaById,
} from '@aigen-designer/utils';

/**
 * 历史记录模型 - 用于存储页面状态的快照或差异
 * @description 为避免大型表单全量快照的内存压力，历史记录采用「基线快照 + 差异」存储：
 * 历史链首记录保存完整快照（snapshot），后续记录只保存相对上一状态的差异（diff）。
 */
export interface RecordModel {
  /** 相对上一状态的差异操作列表（JSON 字符串） */
  diff?: string;
  /** 旧版本兼容字段：历史版本保存的全量快照（JSON 字符串），导入时转换为 snapshot */
  pageSchema?: string;
  /** 当前选中组件的ID，用于恢复选中状态 */
  selectedId?: string;
  /** 完整快照（JSON 字符串），链首基线记录使用 */
  snapshot?: string;
  /** 记录创建时间戳 */
  timestamp: number;
  /** 操作类型描述，如"添加组件"、"删除组件"等 */
  type: string;
}

/**
 * 撤销重做功能 - 提供完整的操作历史管理
 * @description 通过保存页面状态的快照与差异实现撤销和重做功能
 * @param pageSchema - 当前页面架构对象（响应式）
 * @param state - 设计器状态对象
 * @param setSelectedNode - 设置当前选中节点的回调函数
 * @returns 撤销重做相关的操作方法和状态
 */
export function useRevoke(
  pageSchema: PageSchema,
  state: DesignerState,
  setSelectedNode: (schema?: ComponentSchema) => void,
) {
  /** 历史记录列表，按时间顺序存储所有操作记录 */
  const recordList = ref<RecordModel[]>([]);

  /** 撤销记录列表，用于重做操作（存储被撤销的记录） */
  const undoList = ref<RecordModel[]>([]);

  /**
   * 当前暂存记录
   * @description 用于临时存储当前状态，当有新操作时再正式推入历史记录
   */
  const currentRecord = ref<null | RecordModel>(null);

  /**
   * 上一提交状态的普通对象副本，作为计算下一次提交差异的基准。
   * 约定：prevState 始终与 currentRecord 表示的状态保持一致。
   */
  let prevState: null | Record<string, unknown> = null;

  /** 最大历史记录数量限制，防止内存占用过大 */
  const MAX_RECORDS = 60;

  /** 防抖时间间隔，避免频繁记录（毫秒） */
  const DEBOUNCE_TIME = 200;

  /**
   * 获取按状态先后顺序排列的完整历史链：recordList + currentRecord + undoList(逆序)。
   * 说明：undoList 按撤销顺序存储（后撤销的先入栈），状态顺序与存储顺序相反，
   * 因此回放时需要逆序，保证每条 diff 都应用于正确的上一状态。
   * 链首记录始终是基线快照，其余记录为相对上一状态的差异。
   */
  const getChain = (): RecordModel[] => [
    ...recordList.value,
    ...(currentRecord.value ? [currentRecord.value] : []),
    ...undoList.value.slice().reverse(),
  ];

  /**
   * 从基线快照开始回放差异，还原指定记录对应的页面状态
   * @param record - 历史链中的记录（需为历史列表中的记录对象）
   * @returns 该记录对应的完整页面状态（普通对象）
   */
  const materializeState = (record: RecordModel): Record<string, unknown> => {
    const chain = getChain();
    const index = chain.indexOf(record);
    if (index === -1) {
      throw new Error(
        '记录不在历史链中，请使用历史记录列表中的记录对象（recordList/undoList/currentRecord）',
      );
    }
    const first = chain[0];
    if (!first || !first.snapshot) {
      throw new Error('历史链缺少基线快照，无法还原状态');
    }
    let state = JSON.parse(first.snapshot) as Record<string, unknown>;
    for (let i = 1; i <= index; i++) {
      const item = chain[i];
      if (item.diff) {
        applyPatch(state, JSON.parse(item.diff) as DiffOp[]);
      } else if (item.snapshot) {
        // 防御性处理：链中允许出现完整快照记录
        state = JSON.parse(item.snapshot) as Record<string, unknown>;
      } else {
        throw new Error('历史记录缺少差异数据，无法还原状态');
      }
    }
    return state;
  };

  /**
   * 将当前页面状态转为普通对象（剥离 Vue 响应式代理）
   */
  const rawPageSchema = (): Record<string, unknown> =>
    deepToRaw(pageSchema) as unknown as Record<string, unknown>;

  /**
   * 克隆页面状态，作为下一次差异计算的基准
   * @param raw - 可传入已剥离代理的状态，避免重复遍历
   */
  const cloneCurrentState = (
    raw?: Record<string, unknown>,
  ): Record<string, unknown> =>
    deepClone(raw ?? rawPageSchema()) as unknown as Record<string, unknown>;

  /**
   * 创建当前状态的记录
   * @param type - 操作类型描述
   * @param raw - 已剥离代理的当前页面状态
   * @param ops - 相对上一状态的差异操作；null 表示保存完整快照（链首基线）
   * @returns 历史记录对象
   */
  const createRecord = (
    type: string,
    raw: Record<string, unknown>,
    ops: DiffOp[] | null,
  ): RecordModel => {
    const record: RecordModel = {
      selectedId: state.selectedNode?.id,
      timestamp: Date.now(),
      type,
    };
    if (ops === null) {
      // 链首基线记录：保存完整快照
      record.snapshot = JSON.stringify(raw);
    } else {
      // 后续记录：只保存与上一状态的差异
      record.diff = JSON.stringify(ops);
    }
    return record;
  };

  /**
   * 应用历史记录到当前页面
   * @description 从基线快照回放差异还原目标状态，并恢复选中状态
   * @param record - 要应用的历史记录对象
   * @returns 是否应用成功；失败时页面保持不变（调用方决定是否回滚记录移动）
   */
  const applyRecord = (record: RecordModel): boolean => {
    try {
      // 回放差异链，还原目标状态
      const parsedSchema = materializeState(record);

      // 使用深度比较和修改算法，高效更新页面架构
      deepCompareAndModify(pageSchema, parsedSchema);

      // 恢复历史记录时的选中状态
      const selectedNode = record.selectedId
        ? findSchemaById(pageSchema.schemas, record.selectedId)
        : undefined;

      // 通过回调通知外部更新选中节点
      setSelectedNode(selectedNode ?? undefined);
      return true;
    } catch (error) {
      console.error('解析历史记录失败:', error);
      return false;
    }
  };

  // 防抖处理：忽略过于频繁的操作记录（重要操作跳过防抖）
  const debounceCommit = debounce<(type: any) => void>(
    commitCurrentState,
    DEBOUNCE_TIME,
  );

  /**
   * 添加新的历史记录
   * @description 将当前状态保存为历史记录，支持防抖和数量限制
   * @param type - 操作类型描述，默认为"插入组件"
   * @param isImportant - 是否为重要操作，重要操作会跳过防抖直接记录，默认为false
   */
  function push(type = '插入组件', isImportant = false): void {
    // 特殊处理：如果是加载数据操作且当前只有初始化记录
    if (type === '加载数据' && currentRecord.value?.type === '初始化') {
      // 替换基线记录为加载后的完整快照，并同步差异基准；
      // 加载数据是分支截断操作，必须作废旧的重做记录，否则 redo 会把旧 diff 打到新页面上
      const raw = rawPageSchema();
      const nextPrev = cloneCurrentState(raw);
      currentRecord.value = createRecord(type, raw, null);
      prevState = nextPrev;
      undoList.value = [];
      return;
    }

    if (isImportant) {
      commitCurrentState(type);
      return;
    }
    debounceCommit(type);
  }

  /**
   * 移除最旧记录后，如果新的链首不是基线快照，则将其重编码为完整快照
   * @description 保证链首始终是完整快照，使差异回放在任何时候都能从基线开始
   */
  const rebaseAfterShift = (): void => {
    const shifted = recordList.value.shift() as RecordModel;
    const next = recordList.value[0];
    if (next && !next.snapshot) {
      // 新链首是差异记录，基于被移除记录的完整快照重编码
      if (!shifted.snapshot) {
        console.error('历史记录重编码失败：缺少基线快照');
        return;
      }
      const state = JSON.parse(shifted.snapshot) as Record<string, unknown>;
      if (next.diff) {
        applyPatch(state, JSON.parse(next.diff) as DiffOp[]);
      }
      next.snapshot = JSON.stringify(state);
      delete next.diff;
    }
  };

  /**
   * 提交当前状态到历史记录
   * @description 将当前暂存的状态正式记录到历史记录中，并创建新的暂存记录
   * @param type - 操作类型描述
   */
  function commitCurrentState(type: string): void {
    // 无条件作废重做列表（历史分支已改变；导入/reset 后也不允许旧分支重做）
    undoList.value = [];

    // 剥离一次代理，供快照/差异/差异基准复用
    const raw = rawPageSchema();

    if (currentRecord.value === null || prevState === null) {
      // 链首基线记录：完整快照（先克隆基准，失败时不破坏现有链）
      const nextPrev = cloneCurrentState(raw);
      currentRecord.value = createRecord(type, raw, null);
      prevState = nextPrev;
    } else {
      // 后续记录：相对上一状态的差异
      const ops = createPatch(prevState, raw);
      const nextPrev = cloneCurrentState(raw);
      recordList.value.push(currentRecord.value);
      currentRecord.value = createRecord(type, raw, ops);
      prevState = nextPrev;
    }

    // 限制历史记录数量，超出时移除最早记录并重编码链首基线
    if (recordList.value.length > MAX_RECORDS) {
      rebaseAfterShift();
    }
  }

  /**
   * 撤销操作
   * @description 将页面状态回退到上一个历史记录点
   * @returns 是否成功撤销（有历史记录时返回true）；回放失败时回滚记录移动并返回false
   */
  function undo(): boolean {
    if (recordList.value.length === 0) {
      return false;
    }

    const previous = currentRecord.value;
    // 取出最后一条历史记录
    const recordObj = recordList.value.pop() as RecordModel;

    // 将当前状态保存到重做列表
    if (previous !== null) {
      undoList.value.push(previous);
    }
    currentRecord.value = recordObj;

    // 回放失败时回滚记录移动，保持历史链不变
    if (!applyRecord(recordObj)) {
      currentRecord.value = previous;
      if (previous !== null) {
        undoList.value.pop();
      }
      recordList.value.push(recordObj);
      return false;
    }
    prevState = cloneCurrentState();
    return true;
  }

  /**
   * 重做操作
   * @description 重新应用被撤销的操作
   * @returns 是否成功重做（有重做记录时返回true）；回放失败时回滚记录移动并返回false
   */
  function redo(): boolean {
    if (undoList.value.length === 0) {
      return false;
    }

    const previous = currentRecord.value;
    // 取出最后一条重做记录
    const recordObj = undoList.value.pop() as RecordModel;

    // 将当前状态保存回历史记录
    if (previous !== null) {
      recordList.value.push(previous);
    }
    currentRecord.value = recordObj;

    // 回放失败时回滚记录移动，保持历史链不变
    if (!applyRecord(recordObj)) {
      currentRecord.value = previous;
      if (previous !== null) {
        recordList.value.pop();
      }
      undoList.value.push(recordObj);
      return false;
    }
    prevState = cloneCurrentState();
    return true;
  }

  /**
   * 重置所有历史记录
   * @description 清空所有历史记录和重做记录，恢复到初始状态
   */
  function reset(): void {
    recordList.value = [];
    undoList.value = [];
    currentRecord.value = null;
    prevState = null;
  }

  /**
   * 获取可撤销的操作数量
   * @returns 当前可撤销的历史记录数量
   */
  const getUndoCount = (): number => recordList.value.length;

  /**
   * 获取可重做的操作数量
   * @returns 当前可重做的操作数量
   */
  const getRedoCount = (): number => undoList.value.length;

  /**
   * 导出历史记录数据
   * @description 将当前所有历史记录导出为可序列化的格式，用于存储到数据库。
   * 注意：返回的是内部记录的浅拷贝，仅用于序列化持久化，请勿修改
   */
  const exportHistory = (): {
    currentRecord: null | RecordModel;
    recordList: RecordModel[];
    undoList: RecordModel[];
  } => ({
    currentRecord: currentRecord.value,
    recordList: [...recordList.value],
    undoList: [...undoList.value],
  });

  /**
   * 兼容旧版本历史数据：将 pageSchema 全量快照转换为 snapshot 字段
   */
  const normalizeRecord = (record: RecordModel): RecordModel => {
    if (!record.snapshot && record.pageSchema) {
      const normalized: RecordModel = { ...record };
      normalized.snapshot = record.pageSchema;
      delete normalized.pageSchema;
      return normalized;
    }
    return record;
  };

  /**
   * 导入历史记录数据
   * @description 从数据库中恢复历史记录状态，兼容旧版全量快照格式。
   * 导入前会校验链结构（链首必须是基线快照）与数据可解析性，失败时整体拒绝导入，
   * 保证不会出现「列表已替换、页面未同步」的撕裂状态
   */
  const importHistory = (historyData: {
    currentRecord: null | RecordModel;
    recordList: RecordModel[];
    undoList: RecordModel[];
  }): void => {
    const normalizedRecordList = historyData.recordList.map(normalizeRecord);
    const normalizedUndoList = historyData.undoList.map(normalizeRecord);
    const normalizedCurrent = historyData.currentRecord
      ? normalizeRecord(historyData.currentRecord)
      : null;

    // 结构校验：链首必须是完整快照（旧格式 pageSchema 会归一化为 snapshot）
    const chainHead = normalizedRecordList[0] ?? normalizedCurrent;
    if (
      normalizedRecordList.length + (normalizedCurrent ? 1 : 0) > 0 &&
      !chainHead?.snapshot
    ) {
      console.error('导入历史记录失败：链首缺少基线快照，已取消导入');
      return;
    }

    // 数据校验：所有 snapshot/diff 必须是合法 JSON
    const allRecords = [
      ...normalizedRecordList,
      ...normalizedUndoList,
      ...(normalizedCurrent ? [normalizedCurrent] : []),
    ];
    for (const record of allRecords) {
      try {
        if (record.snapshot) {
          JSON.parse(record.snapshot);
        }
        if (record.diff) {
          JSON.parse(record.diff);
        }
      } catch {
        console.error('导入历史记录失败：存在无法解析的记录数据，已取消导入');
        return;
      }
    }

    // 备份现有状态，回放失败时整体回滚
    const previousRecordList = recordList.value;
    const previousUndoList = undoList.value;
    const previousCurrent = currentRecord.value;
    const previousPrev = prevState;

    recordList.value = normalizedRecordList;
    undoList.value = normalizedUndoList;
    currentRecord.value = normalizedCurrent;

    // 如果有当前记录，应用它以确保页面状态同步，并重置差异基准
    if (currentRecord.value) {
      if (!applyRecord(currentRecord.value)) {
        // 回放失败：回滚整个导入，保持原历史不变
        recordList.value = previousRecordList;
        undoList.value = previousUndoList;
        currentRecord.value = previousCurrent;
        prevState = previousPrev;
        return;
      }
      prevState = cloneCurrentState();
    } else {
      prevState = null;
    }
  };

  /**
   * 预览历史记录
   * @description 临时应用指定的历史记录，但不改变当前的历史记录栈。
   * 注意：预览期间请勿调用 push/undo/redo（会以预览状态作为提交基准），
   * 预览后务必调用返回的恢复函数
   * @param record - 要预览的历史记录（需为历史列表中的记录对象）
   * @returns 恢复函数，调用后可回到预览前的状态
   */
  const previewHistory = (record: RecordModel): (() => void) => {
    // 保存当前状态，以便后续恢复
    const tempCurrent = currentRecord.value;

    // 应用要预览的记录
    applyRecord(record);

    // 返回一个函数，用于恢复到预览前的状态
    return () => {
      if (tempCurrent) {
        applyRecord(tempCurrent);
      }
    };
  };

  return {
    currentRecord,
    exportHistory,
    getRedoCount,
    getUndoCount,
    importHistory,
    previewHistory,
    push,
    recordList,
    redo,
    reset,
    undo,
    undoList,
  };
}

export type Revoke = ReturnType<typeof useRevoke>;
