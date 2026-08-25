import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyPatch,
  createPatch,
  deepClone,
  deepEqual,
} from '@aigen-designer/utils';

import { handleSchemaWorkerRequest } from '../../schema.worker';
import type {
  SchemaWorkerRequest,
  SchemaWorkerResponse,
} from '../../schema.worker';
import { disposeSchemaWorker, postToWorker } from '../../schemaWorkerBridge';

/**
 * W16 Schema Worker 基础设施测试：
 * - 纯函数处理器 handleSchemaWorkerRequest：直接验证 4 种消息协议（computeDiff /
 *   processSchema / materialize / validateImport）与错误分支；
 * - 桥接层 postToWorker：jsdom 无 Worker 全局，用 MockWorker 模拟往返，
 *   验证单例创建、请求 id 映射、错误透传与 dispose 清理。
 */

/** 模拟 Web Worker：记录实例与消息，异步回调 message 事件模拟真实往返 */
class MockWorker {
  static instances: MockWorker[] = [];

  private listeners: Record<string, Array<(e: any) => void>> = {};
  messages: any[] = [];
  terminated = false;

  constructor(
    public url: string | URL,
    public options?: WorkerOptions,
  ) {
    MockWorker.instances.push(this);
  }

  addEventListener(type: string, listener: (e: any) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  private emit(type: string, e: any) {
    this.listeners[type]?.forEach((listener) => listener(e));
  }

  postMessage(data: SchemaWorkerRequest) {
    this.messages.push(data);
    // 模拟异步往返：真实 Worker 的响应通过事件循环回到主线程
    queueMicrotask(() => {
      try {
        const response = handleSchemaWorkerRequest(data);
        this.emit('message', { data: response });
      } catch (error) {
        // 与真实 Worker 一致：异常包装为 error 响应
        this.emit('message', {
          data: {
            id: data.id,
            type: 'error',
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    });
  }

  terminate() {
    this.terminated = true;
  }
}

describe('schema.worker 纯函数处理器', () => {
  it('computeDiff：计算差异并返回序列化结果，可回放还原', () => {
    const prevState = { schemas: [{ id: '1', type: 'input' }] };
    const currentState = {
      schemas: [
        { id: '1', type: 'input' },
        { id: '2', type: 'button' },
      ],
    };
    const response = handleSchemaWorkerRequest({
      id: 1,
      type: 'computeDiff',
      payload: { prevState, currentState },
    });

    expect(response.type).toBe('diffComputed');
    expect(response.id).toBe(1);
    const result = response.result as { ops: any[]; diff: string };
    expect(Array.isArray(result.ops)).toBe(true);
    expect(JSON.parse(result.diff)).toEqual(result.ops);

    // 回放差异应还原出 currentState
    const target = deepClone(prevState, false);
    applyPatch(target as Record<string, unknown>, result.ops as any);
    expect(deepEqual(target, currentState)).toBe(true);
  });

  it('computeDiff：无差异时返回空操作列表', () => {
    const state = { schemas: [{ id: '1', type: 'input' }] };
    const response = handleSchemaWorkerRequest({
      id: 2,
      type: 'computeDiff',
      payload: { prevState: state, currentState: deepClone(state, false) },
    });
    const result = response.result as { ops: any[] };
    expect(result.ops).toEqual([]);
    expect(response.type).toBe('diffComputed');
  });

  it('processSchema：深拷贝语义，输入后续修改不影响结果', () => {
    const pageSchema: any = {
      schemas: [{ id: '1', type: 'input', props: { placeholder: '请输入' } }],
    };
    const response = handleSchemaWorkerRequest({
      id: 3,
      type: 'processSchema',
      payload: { pageSchema, tableView: false },
    });
    const result = response.result as { schema: any };

    expect(response.type).toBe('schemaProcessed');
    expect(result.schema).not.toBe(pageSchema);
    expect(result.schema.schemas[0]).not.toBe(pageSchema.schemas[0]);
    expect(deepEqual(result.schema, pageSchema)).toBe(true);

    // 修改输入不应影响已返回的结果（深拷贝隔离）
    pageSchema.schemas[0].props.placeholder = '被修改';
    expect(result.schema.schemas[0].props.placeholder).toBe('请输入');
  });

  it('processSchema：迁移旧版 componentProps 到 props', () => {
    // migrateComponentProps(shouldWarn=true) 会输出迁移警告，测试中静默
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pageSchema: any = {
      schemas: [
        { id: '1', type: 'input', componentProps: { placeholder: '旧属性' } },
      ],
    };
    const response = handleSchemaWorkerRequest({
      id: 4,
      type: 'processSchema',
      payload: { pageSchema, tableView: false },
    });
    const result = response.result as { schema: any };

    expect(result.schema.schemas[0].props).toEqual({ placeholder: '旧属性' });
    expect(result.schema.schemas[0].componentProps).toBeUndefined();
    // 原始输入不应被原地修改
    expect(pageSchema.schemas[0].componentProps).toBeDefined();
    warnSpy.mockRestore();
  });

  it('materialize：从链首快照回放 diff 链还原指定状态', () => {
    const s0 = { schemas: [{ id: '1', type: 'input' }] };
    const s1 = {
      schemas: [
        { id: '1', type: 'input' },
        { id: '2', type: 'button' },
      ],
    };
    const s2 = {
      schemas: [
        { id: '1', type: 'input' },
        { id: '2', type: 'button' },
        { id: '3', type: 'textarea' },
      ],
    };
    const records = [
      { snapshot: JSON.stringify(s0) },
      { diff: JSON.stringify(createPatch(s0, s1)) },
      { diff: JSON.stringify(createPatch(s1, s2)) },
    ];

    // 回放到索引 0：链首快照
    const r0 = handleSchemaWorkerRequest({
      id: 5,
      type: 'materialize',
      payload: { records, targetIndex: 0 },
    });
    expect(deepEqual((r0.result as any).state, s0)).toBe(true);

    // 回放到索引 2：完整还原最终状态
    const r2 = handleSchemaWorkerRequest({
      id: 6,
      type: 'materialize',
      payload: { records, targetIndex: 2 },
    });
    expect(r2.type).toBe('materialized');
    expect(deepEqual((r2.result as any).state, s2)).toBe(true);
  });

  it('materialize：链中允许出现完整快照记录（防御性回放）', () => {
    const s0 = { schemas: [] };
    const s2 = { schemas: [{ id: '9', type: 'input' }] };
    const records = [
      { snapshot: JSON.stringify(s0) },
      { snapshot: JSON.stringify(s2) }, // 中间快照
      { diff: '[]' }, // 空 diff 也应正常应用
    ];
    const response = handleSchemaWorkerRequest({
      id: 7,
      type: 'materialize',
      payload: { records, targetIndex: 2 },
    });
    expect(deepEqual((response.result as any).state, s2)).toBe(true);
  });

  it('materialize：缺少基线快照时抛错', () => {
    expect(() =>
      handleSchemaWorkerRequest({
        id: 8,
        type: 'materialize',
        payload: { records: [{ diff: '[]' }], targetIndex: 0 },
      }),
    ).toThrow(/基线快照/);
  });

  it('materialize：记录缺少差异数据时抛错', () => {
    const records = [
      { snapshot: JSON.stringify({ schemas: [] }) },
      { type: '无差异数据' } as any,
    ];
    expect(() =>
      handleSchemaWorkerRequest({
        id: 9,
        type: 'materialize',
        payload: { records, targetIndex: 1 },
      }),
    ).toThrow(/缺少差异数据/);
  });

  it('materialize：目标索引越界时抛错', () => {
    const records = [{ snapshot: JSON.stringify({ schemas: [] }) }];
    expect(() =>
      handleSchemaWorkerRequest({
        id: 10,
        type: 'materialize',
        payload: { records, targetIndex: 5 },
      }),
    ).toThrow(/超出历史链长度/);
  });

  it('validateImport：全部记录为合法 JSON 时返回 valid', () => {
    const response = handleSchemaWorkerRequest({
      id: 11,
      type: 'validateImport',
      payload: {
        records: [
          { snapshot: JSON.stringify({ schemas: [] }), diff: undefined },
          {
            snapshot: undefined,
            diff: JSON.stringify([{ op: 'add', path: '/a', value: 1 }]),
          },
        ],
      },
    });
    expect(response.type).toBe('validationResult');
    expect(response.result).toEqual({ valid: true });
  });

  it('validateImport：非法 snapshot 抛错', () => {
    expect(() =>
      handleSchemaWorkerRequest({
        id: 12,
        type: 'validateImport',
        payload: { records: [{ snapshot: '{broken' }] },
      }),
    ).toThrow('invalid snapshot');
  });

  it('validateImport：非法 diff 抛错', () => {
    expect(() =>
      handleSchemaWorkerRequest({
        id: 13,
        type: 'validateImport',
        payload: { records: [{ diff: 'not-json' }] },
      }),
    ).toThrow('invalid diff');
  });

  it('未知消息类型抛错，避免请求悬挂', () => {
    expect(() =>
      handleSchemaWorkerRequest({ id: 14, type: 'unknownType', payload: {} }),
    ).toThrow(/未知的消息类型/);
  });
});

describe('schemaWorkerBridge 桥接层', () => {
  beforeEach(() => {
    MockWorker.instances = [];
    vi.stubGlobal('Worker', MockWorker);
  });

  afterEach(() => {
    disposeSchemaWorker();
    vi.unstubAllGlobals();
  });

  it('new Worker 创建成功且 URL 指向 schema.worker.ts', async () => {
    const result = await postToWorker('computeDiff', {
      prevState: { a: 1 },
      currentState: { a: 2 },
    });
    expect(result).toBeDefined();

    expect(MockWorker.instances).toHaveLength(1);
    const url = String(MockWorker.instances[0].url);
    expect(url).toContain('schema.worker.ts');
  });

  it('4 种消息类型均可往返', async () => {
    // computeDiff
    const diff = await postToWorker('computeDiff', {
      prevState: { a: 1 },
      currentState: { a: 2, b: 3 },
    });
    expect((diff as any).ops).toHaveLength(2);

    // processSchema
    const processed = await postToWorker('processSchema', {
      pageSchema: { schemas: [] },
      tableView: false,
    });
    expect((processed as any).schema).toEqual({ schemas: [] });

    // materialize
    const materialized = await postToWorker('materialize', {
      records: [{ snapshot: JSON.stringify({ x: 1 }) }],
      targetIndex: 0,
    });
    expect((materialized as any).state).toEqual({ x: 1 });

    // validateImport
    const valid = await postToWorker('validateImport', {
      records: [{ snapshot: JSON.stringify({ x: 1 }) }],
    });
    expect(valid).toEqual({ valid: true });
  });

  it('单例 Worker：多次请求只创建一个实例', async () => {
    await postToWorker('computeDiff', { prevState: {}, currentState: {} });
    await postToWorker('processSchema', {
      pageSchema: { schemas: [] },
      tableView: false,
    });
    await postToWorker('validateImport', { records: [] });
    expect(MockWorker.instances).toHaveLength(1);
  });

  it('并发请求按 id 正确匹配响应', async () => {
    const results = await Promise.all([
      postToWorker('computeDiff', {
        prevState: { a: 1 },
        currentState: { a: 2 },
      }),
      postToWorker('validateImport', { records: [{ snapshot: '{}' }] }),
      postToWorker('materialize', {
        records: [{ snapshot: JSON.stringify({ n: 42 }) }],
        targetIndex: 0,
      }),
    ]);
    expect((results[0] as any).diff).toBeDefined();
    expect(results[1]).toEqual({ valid: true });
    expect((results[2] as any).state).toEqual({ n: 42 });
  });

  it('Worker 内错误以 Promise 拒绝透传（invalid snapshot）', async () => {
    await expect(
      postToWorker('validateImport', { records: [{ snapshot: '{bad' }] }),
    ).rejects.toThrow('invalid snapshot');
  });

  it('未知消息类型经桥接层以 Promise 拒绝', async () => {
    await expect(postToWorker('noSuchType', {})).rejects.toThrow(
      /未知的消息类型/,
    );
  });

  it('disposeSchemaWorker 终止 Worker，后续请求重新创建', async () => {
    await postToWorker('validateImport', { records: [] });
    const first = MockWorker.instances[0];
    expect(first.terminated).toBe(false);

    disposeSchemaWorker();
    expect(first.terminated).toBe(true);

    await postToWorker('validateImport', { records: [] });
    expect(MockWorker.instances).toHaveLength(2);
  });

  it('无 Worker 全局环境下 postToWorker 拒绝而非悬挂', async () => {
    vi.stubGlobal('Worker', undefined);
    await expect(
      postToWorker('computeDiff', { prevState: {}, currentState: {} }),
    ).rejects.toThrow();
  });
});
