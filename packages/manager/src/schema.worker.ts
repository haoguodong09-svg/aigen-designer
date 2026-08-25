import type { PageSchema } from '@aigen-designer/types';

import { deepClone, migrateComponentProps } from '../../utils/src/common/data';
/**
 * Schema Worker：将 CPU 密集的 Schema 处理任务（diff 计算、schema 迁移、历史回放、导入校验）
 * 移入 Web Worker，避免阻塞设计器主线程。
 *
 * ⚠️ 约束说明（与 docs/performance-optimization.md P-W5 协议保持一致）：
 * - Worker 是纯函数环境：只允许 import @aigen-designer/utils 的纯函数
 *   （createPatch/applyPatch/deepClone/migrateComponentProps），禁止 import Vue/响应式/DOM。
 *   utils 内部 data.ts 虽在模块层引入了 Vue（deepToRaw 等仅调用时使用），但所有函数调用
 *   均不依赖 DOM，且 Vue 在无 document 环境下可安全加载（内部做了 typeof 守卫），
 *   因此本文件不会直接 import Vue。
 * - deepClone 必须传 useStructuredClone=false：Worker 环境没有 window，
 *   默认走 window.structuredClone 分支会抛 ReferenceError。
 * - reorganizeSchemasForTableView 依赖主线程 pluginManager 组件注册表
 *   （getConfigByType），Worker 内无注册数据时会清空 form.children，故 processSchema
 *   暂只实现 deepClone + migrateComponentProps 语义；W15 批次 2 联调时再决定是否
 *   抽取纯函数版本移入 Worker。
 * - deepCompareAndModify 涉及 Vue 响应式代理剥离语义，留主线程。
 */
// 深路径导入纯函数模块（diff/data），不经过 utils barrel：
// barrel 会传递引入 common/component.ts（→ base-ui 的 .vue）与 data.ts 的模块级依赖，
// 导致 worker 依赖图包含 Vue 组件与 manager 循环链（见 data.ts 注入式设计说明）
import { applyPatch, createPatch } from '../../utils/src/common/diff';

/** 主线程 → Worker 的请求消息 */
export interface SchemaWorkerRequest {
  id: number;
  payload: any;
  type: string;
}

/** Worker → 主线程的响应消息 */
export interface SchemaWorkerResponse {
  error?: string;
  id: number;
  result?: any;
  type: string;
}

/** 历史记录载荷（与 revoke.ts 的 RecordModel 字段对齐） */
export interface SchemaRecord {
  /** 相对上一状态的差异（JSON 字符串） */
  diff?: string;
  /** 完整快照（JSON 字符串），链首记录必须携带 */
  snapshot?: string;
}

/**
 * 纯函数处理器：根据请求计算响应，出错时抛出异常（由调用方统一包装为 error 响应）。
 * 导出该函数便于在不依赖 Worker 全局的单测中直接验证 4 种消息协议。
 */
export function handleSchemaWorkerRequest(
  request: SchemaWorkerRequest,
): SchemaWorkerResponse {
  const { id, payload, type } = request;
  switch (type) {
    // 16.1 computeDiff：createPatch 计算差异并序列化
    case 'computeDiff': {
      const { currentState, prevState } = payload;
      const ops = createPatch(prevState, currentState);
      return {
        id,
        result: { diff: JSON.stringify(ops), ops },
        type: 'diffComputed',
      } as SchemaWorkerResponse;
    }
    // 16.1 materialize：从链首快照开始回放差异，还原指定索引对应的页面状态
    case 'materialize': {
      const { records, targetIndex } = payload as {
        records: SchemaRecord[];
        targetIndex: number;
      };
      const first = records[0];
      if (!first || !first.snapshot) {
        throw new Error('历史链缺少基线快照，无法还原状态');
      }
      let state = JSON.parse(first.snapshot) as Record<string, unknown>;
      for (let i = 1; i <= targetIndex; i++) {
        const item = records[i];
        if (!item) {
          throw new Error('目标索引超出历史链长度，无法还原状态');
        }
        if (item.diff) {
          applyPatch(state, JSON.parse(item.diff));
        } else if (item.snapshot) {
          // 防御性处理：链中允许出现完整快照记录
          state = JSON.parse(item.snapshot) as Record<string, unknown>;
        } else {
          throw new Error('历史记录缺少差异数据，无法还原状态');
        }
      }
      return {
        id,
        result: { state },
        type: 'materialized',
      } as SchemaWorkerResponse;
    }
    // 16.1 processSchema：深拷贝 + 属性迁移（tableView 重组延后，见文件头约束）
    case 'processSchema': {
      const { pageSchema, tableView } = payload;
      // Worker 无 window，关闭 structuredClone 分支
      const newSchema = deepClone(pageSchema as PageSchema, false);
      migrateComponentProps(newSchema, true);
      // TODO(W15)：tableView 为 true 时重组 schema，需先抽取不依赖 pluginManager 的纯函数
      void tableView;
      return {
        id,
        result: { schema: newSchema },
        type: 'schemaProcessed',
      } as SchemaWorkerResponse;
    }
    // 16.1 validateImport：批量校验所有 snapshot/diff 均为合法 JSON
    case 'validateImport': {
      const { records } = payload as { records: SchemaRecord[] };
      for (const record of records) {
        if (record.snapshot) {
          try {
            JSON.parse(record.snapshot);
          } catch {
            throw new Error('invalid snapshot');
          }
        }
        if (record.diff) {
          try {
            JSON.parse(record.diff);
          } catch {
            throw new Error('invalid diff');
          }
        }
      }
      return {
        id,
        result: { valid: true },
        type: 'validationResult',
      } as SchemaWorkerResponse;
    }
    // 未知类型明确报错，避免请求悬挂
    default: {
      throw new Error(`未知的消息类型: ${type}`);
    }
  }
}

// Worker 全局入口：仅在 Worker 环境注册（Node 主线程 / jsdom / SSR 导入本文件不应报错）。
// 判别方式：Worker 内没有 window 且有 postMessage；避免 lint no-restricted-globals（self）
const workerGlobal = globalThis as typeof globalThis & {
  addEventListener: (
    type: 'message',
    listener: (e: MessageEvent<SchemaWorkerRequest>) => void,
  ) => void;
  postMessage: (message: SchemaWorkerResponse) => void;
};
if (
  typeof window === 'undefined' &&
  typeof workerGlobal.postMessage === 'function' &&
  typeof workerGlobal.addEventListener === 'function'
) {
  workerGlobal.addEventListener('message', (e) => {
    const { id, payload, type } = e.data;
    try {
      workerGlobal.postMessage(
        handleSchemaWorkerRequest({ id, payload, type }),
      );
    } catch (error) {
      workerGlobal.postMessage({
        error: error instanceof Error ? error.message : String(error),
        id,
        type: 'error',
      } as SchemaWorkerResponse);
    }
  });
}
