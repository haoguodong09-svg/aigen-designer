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
  deepCompareAndModify,
  deepToRaw,
  findSchemaById,
} from '@aigen-designer/utils';

import { postToWorker } from './schemaWorkerBridge';

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

  /**
   * 链版本号：undo/redo/reset/导入/加载数据等链变更时递增。
   * 用于作废防抖窗口内挂起的过期提交（防抖回调触发时校验版本，若链已被改变则放弃提交，
   * 避免基于已撤销状态产生「幽灵空记录」，对齐 revokeRace 语义）。
   */
  let chainVersion = 0;

  /**
   * 增量回放缓存：历史记录对象 → 该记录对应的完整页面状态（只读副本）。
   * 链结构变更（提交/重置/导入/加载数据）时清空；undo/redo 仅移动记录对象，
   * 记录内容不变，缓存可跨 undo/redo 复用，实现增量回放（性能文档 P-W3）。
   */
  const stateCache = new Map<RecordModel, Record<string, unknown>>();

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
   * 深度克隆已剥离代理的普通数据（内部实现）
   * @description 用于替代 deepClone：raw 数据经 rawPageSchema() 剥离代理后已无 Proxy，
   * 直接深克隆即可，避免 deepClone 内部对已 raw 数据再次 deepToRaw 的冗余遍历
   * （性能文档 P-W3：cloneCurrentState 内 deepClone→deepToRaw 双重遍历）。
   * 函数等不可 JSON 序列化的值按引用保留，与 deepClone 手动回退路径行为一致。
   */
  const cloneRawState = (
    value: unknown,
    cache = new WeakMap<object, unknown>(),
  ): unknown => {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (cache.has(value as object)) {
      return cache.get(value as object);
    }
    if (Array.isArray(value)) {
      const cloned = value.map((item) => cloneRawState(item, cache));
      cache.set(value as object, cloned);
      return cloned;
    }
    const cloned: Record<string, unknown> = {};
    cache.set(value as object, cloned);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      cloned[key] = cloneRawState(
        (value as Record<string, unknown>)[key],
        cache,
      );
    }
    return cloned;
  };

  /**
   * 从基线快照开始回放差异，还原指定记录对应的页面状态
   * @param record - 历史链中的记录（需为历史列表中的记录对象）
   * @returns 该记录对应的完整页面状态（普通对象）
   */
  const materializeState = (record: RecordModel): Record<string, unknown> => {
    // 命中缓存：直接返回只读状态副本（调用方仅读取，不会污染缓存）
    const cached = stateCache.get(record);
    if (cached !== undefined) {
      return cached;
    }

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

    // 增量回放（性能文档 P-W3）：从目标记录之前最近的一个已缓存状态开始，
    // 避免每次撤销/重做都从基线全量回放（最长 60 条 diff 顺序执行）
    let startIndex = 0;
    let state = JSON.parse(first.snapshot) as Record<string, unknown>;
    for (let i = 0; i < index; i++) {
      const cachedState = stateCache.get(chain[i]);
      if (cachedState !== undefined) {
        startIndex = i;
        // 克隆缓存状态再回放，避免 applyPatch 原地修改污染缓存
        state = cloneRawState(cachedState) as Record<string, unknown>;
      }
    }

    for (let i = startIndex + 1; i <= index; i++) {
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

    // 缓存目标记录对应的完整状态（只读副本），供后续增量回放复用
    stateCache.set(record, cloneRawState(state) as Record<string, unknown>);
    return state;
  };

  /**
   * 将当前页面状态转为普通对象（剥离 Vue 响应式代理）
   */
  const rawPageSchema = (): Record<string, unknown> =>
    deepToRaw(pageSchema) as unknown as Record<string, unknown>;

  /**
   * 克隆页面状态，作为下一次差异计算的基准
   * @param raw - 已剥离代理的当前页面状态（rawPageSchema() 的返回值，即 alreadyRaw）；
   * 省略时内部自动剥离代理
   */
  const cloneCurrentState = (
    raw?: Record<string, unknown>,
  ): Record<string, unknown> =>
    cloneRawState(raw ?? rawPageSchema()) as Record<string, unknown>;

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
    precomputedDiff?: string,
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
      // 后续记录：只保存与上一状态的差异。
      // W16 Worker 路径可传入已序列化的 diff，避免主线程重复 JSON.stringify（1-8ms）
      record.diff = precomputedDiff ?? JSON.stringify(ops);
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

  /** 防抖定时器句柄（可取消，见 clearPendingDebounce/dispose） */
  let debounceTimer: null | ReturnType<typeof setTimeout> = null;
  /** 防抖窗口内暂存的提交类型 */
  let pendingCommitType: null | string = null;
  /** 提交调度时的链版本号，回调触发时校验，防止基于已撤销状态提交 */
  let pendingCommitVersion = -1;

  /**
   * 取消挂起的防抖提交（卸载时由 dispose 调用，避免定时器对已卸载 pageSchema 执行）
   */
  const clearPendingDebounce = (): void => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pendingCommitType = null;
  };

  /**
   * 释放资源：取消挂起的防抖提交
   * @description ⚠️ core 接入点：设计器组件 onUnmounted 时应调用本方法（W6-6.4），
   * 否则组件卸载后防抖定时器仍会对已卸载的 pageSchema 执行提交。
   */
  const dispose = (): void => {
    clearPendingDebounce();
  };

  /**
   * 防抖处理：忽略过于频繁的操作记录（重要操作跳过防抖）
   * @description 修复防抖竞态（W6-6.2）：push 后防抖窗口内发生 undo/redo/reset/导入
   * 等链变更时，回调触发时校验链版本——若链已被改变则放弃本次提交（过期提交），
   * 避免基于已撤销状态产生「幽灵空记录」（diff: []）。
   */
  const debounceCommit = (type: string): void => {
    pendingCommitType = type;
    pendingCommitVersion = chainVersion;
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const capturedType = pendingCommitType;
      pendingCommitType = null;
      if (pendingCommitVersion !== chainVersion) {
        // 链已被改变：本次提交过期。与正常提交语义一致，作废旧的重做分支
        // （未落库的编辑意图会截断分支），但不产生空记录、不破坏链结构。
        undoList.value = [];
        return;
      }
      if (capturedType !== null) {
        commitCurrentState(capturedType);
      }
    }, DEBOUNCE_TIME) as unknown as ReturnType<typeof setTimeout>;
  };

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
      // 链已变化：取消挂起的防抖提交并递增版本号，作废防抖窗口内未落库的编辑
      clearPendingDebounce();
      chainVersion++;
      stateCache.clear();
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

  /** 提交序号：每次 commit 递增；异步 Worker 响应仅当序号仍为最新时才生效 */
  let commitSeq = 0;

  /**
   * 判断当前环境是否可用 Schema Worker
   * @description jsdom/无 Worker 环境（如部分测试与 SSR）回退同步计算，保证行为一致
   */
  const isWorkerAvailable = (): boolean => typeof Worker !== 'undefined';

  /**
   * 同步计算相对上一状态的差异（无 Worker 环境的回退路径）
   */
  const computeDiffSync = (
    prev: Record<string, unknown>,
    current: Record<string, unknown>,
  ): { diff: string; ops: DiffOp[] } => {
    const ops = createPatch(prev, current);
    return { diff: JSON.stringify(ops), ops };
  };

  /**
   * 异步计算相对上一状态的差异（移入 W16 Schema Worker，性能文档 P-W3）
   * @description createPatch 递归 diff（3-15ms）+ JSON.stringify 全量序列化（1-8ms）
   * 在 Worker 中执行，主线程仅做响应式合并；deepCompareAndModify 必须留主线程。
   */
  const computeDiffAsync = (
    prev: Record<string, unknown>,
    current: Record<string, unknown>,
  ): Promise<{ diff: string; ops: DiffOp[] }> =>
    postToWorker('computeDiff', { currentState: current, prevState: prev });

  /**
   * 异步预取指定历史记录的还原状态到增量回放缓存（性能文档 P-W3）
   * @description 将 applyPatch 链回放（11-58ms）移入 Worker 计算；响应经提交序号与
   * 链版本双重校验后回填缓存，undo/redo 保持同步 API（缓存命中即 O(1)）。
   * 无 Worker 环境或预取失败时静默忽略，undo 时回退同步增量回放。
   */
  const prefetchMaterialize = (record: RecordModel): void => {
    if (!isWorkerAvailable()) {
      return;
    }
    const chain = getChain();
    const index = chain.indexOf(record);
    if (index === -1) {
      return;
    }
    const seq = commitSeq;
    const version = chainVersion;
    const records = chain.map((r) => ({ diff: r.diff, snapshot: r.snapshot }));
    postToWorker('materialize', { records, targetIndex: index })
      .then((res: { state: Record<string, unknown> }) => {
        // 过期校验：期间发生新的提交或链变更则丢弃，避免缓存被污染
        if (seq !== commitSeq || version !== chainVersion) {
          return;
        }
        stateCache.set(record, res.state);
      })
      .catch(() => {
        // 预取失败静默处理：undo 时回退同步增量回放
      });
  };

  /**
   * 提交当前状态到历史记录
   * @description 将当前暂存的状态正式记录到历史记录中，并创建新的暂存记录
   * @param type - 操作类型描述
   */
  function commitCurrentState(type: string): void {
    // 取消仍挂起的防抖提交（重要操作直接提交时，防止旧的防抖回调重复提交）
    clearPendingDebounce();

    // 无条件作废重做列表（历史分支已改变；导入/reset 后也不允许旧分支重做）
    undoList.value = [];

    // 剥离一次代理，供快照/差异/差异基准复用（必须在主线程同步捕获当前状态）
    const raw = rawPageSchema();

    // 提交序号与链版本：异步 Worker 响应回调中校验，防止过期提交覆盖新编辑
    const seq = ++commitSeq;
    const versionAtCapture = chainVersion;

    // 链首基线记录：完整快照（无差异计算，保持同步；先序列化成功再入链）
    if (currentRecord.value === null || prevState === null) {
      const nextPrev = cloneCurrentState(raw);
      const record = createRecord(type, raw, null);
      currentRecord.value = record;
      prevState = nextPrev;
      stateCache.clear();
      if (recordList.value.length > MAX_RECORDS) {
        rebaseAfterShift();
      }
      return;
    }

    // 差异计算的基准：进入差异提交分支后 prevState 已保证非空（基线分支已提前返回），
    // 提取为 const 以便在异步回调闭包中保留类型收窄
    const diffBaseline = prevState;

    // 提交回调：主线程仅做响应式合并（创建记录/入链/更新差异基准）
    const applyCommit = (diffResult: { diff: string; ops: DiffOp[] }): void => {
      // 过期校验：期间发生更新的提交或链变更（undo/redo/reset/导入）则丢弃本次提交
      if (seq !== commitSeq || versionAtCapture !== chainVersion) {
        return;
      }
      const pushedRecord = currentRecord.value as RecordModel;
      // 注意（W6-6.3）：diff 为预序列化字符串，createRecord 在 recordList.push 之前
      // 完成记录构建，避免 ops 无法序列化抛错时「链已 push 而状态未更新」的损坏场景
      const nextPrev = cloneCurrentState(raw);
      const record = createRecord(type, raw, diffResult.ops, diffResult.diff);
      recordList.value.push(pushedRecord);
      currentRecord.value = record;
      prevState = nextPrev;

      // 链结构已变化：清空增量回放缓存，并异步预取被推入记录（下次 undo 目标）的还原状态
      stateCache.clear();
      prefetchMaterialize(pushedRecord);

      // 限制历史记录数量，超出时移除最早记录并重编码链首基线
      if (recordList.value.length > MAX_RECORDS) {
        rebaseAfterShift();
      }
    };

    if (isWorkerAvailable()) {
      // W16 Worker：diff 计算与序列化移入 Worker，响应后主线程合并
      computeDiffAsync(diffBaseline, raw).then(applyCommit, (error) => {
        console.warn('[revoke] Worker 计算差异失败，回退同步计算:', error);
        applyCommit(computeDiffSync(diffBaseline, raw));
      });
    } else {
      // 无 Worker 环境（jsdom 测试等）：同步计算，行为与旧实现一致
      applyCommit(computeDiffSync(diffBaseline, raw));
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
    // 链即将变化：递增版本号，作废防抖窗口内挂起的过期提交
    chainVersion++;

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
    // 链即将变化：递增版本号，作废防抖窗口内挂起的过期提交
    chainVersion++;

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
    // 链已变化：取消挂起的防抖提交、递增版本号、清空增量回放缓存
    clearPendingDebounce();
    chainVersion++;
    stateCache.clear();
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

    // 数据校验：所有 snapshot/diff 必须是合法 JSON。
    // 优先移入 Worker 异步校验（性能文档 P-W3：120+ 条顺序 JSON.parse 可达 120-360ms，
    // 会阻塞主线程），无 Worker 环境回退同步校验。
    const allRecords = [
      ...normalizedRecordList,
      ...normalizedUndoList,
      ...(normalizedCurrent ? [normalizedCurrent] : []),
    ];
    const seqAtCall = commitSeq;
    const versionAtCall = chainVersion;

    // 校验通过后的导入执行体：备份现有状态，回放失败时整体回滚
    const applyImport = (): void => {
      // 校验期间链已被修改（新的提交/撤销/重做/重置等）：放弃导入，避免覆盖新编辑
      if (seqAtCall !== commitSeq || versionAtCall !== chainVersion) {
        console.warn('导入历史记录失败：导入期间历史链已发生变化，已取消导入');
        return;
      }

      // 备份现有状态，回放失败时整体回滚
      const previousRecordList = recordList.value;
      const previousUndoList = undoList.value;
      const previousCurrent = currentRecord.value;
      const previousPrev = prevState;

      // 链即将整体替换：取消挂起的防抖提交、递增版本号、清空增量回放缓存
      clearPendingDebounce();
      chainVersion++;
      stateCache.clear();

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

    if (isWorkerAvailable()) {
      const records = allRecords.map((r) => ({
        diff: r.diff,
        snapshot: r.snapshot,
      }));
      postToWorker('validateImport', { records }).then(
        () => applyImport(),
        (error) => {
          console.error(
            '导入历史记录失败：存在无法解析的记录数据，已取消导入',
            error,
          );
        },
      );
    } else {
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
      applyImport();
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
    dispose,
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
