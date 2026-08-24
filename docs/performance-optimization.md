# epic-designer 性能优化修复开发文档

> 生成日期：2026-08-24
> 依据：7 个并行分析 agent + 主线程代码审查
> 目标：解决复杂表单（100+ 节点）渲染卡顿问题
> 策略：优先非 Worker 优化，仅在明确 CPU 密集且无 DOM 依赖时使用 Web Worker

---

## 〇、文档使用说明

本文档将全部优化拆分为 **可并行修复的工作包**，每个工作包满足：

1. **文件零冲突**：各工作包独占一组文件
2. **验收可自动化**：每个工作包附验证方法
3. **影响可量化**：给出预期性能提升估算

**并行策略**

| 批次 | 工作包 | 可并行？ |
|------|--------|----------|
| 批次 1 | W1, W2, W3, W4, W5, W6 | 全部可同时进行 |
| 批次 2 | W7 | 依赖批次 1 的 Worker 基础设施 |

**排除项**（不纳入本报告）：
- FormulaEngine Web Worker：当前为事件驱动（1-5 表达式/事件），Worker 消息开销 > 解析收益。仅做 AST 缓存即可。
- Tree Search Web Worker：当前节点数 < 50，debounce 已足够。
- Virtual Scrolling：改动范围极大（涉及 VueDraggable 嵌套递归），收益虽高但属于架构重构，建议单独立项。
- `show` 函数 eval per node：用户自定义函数，无法优化。
- DOM rAF 批处理（previewWidgets.vue）：属于设计器画布交互优化，与表单渲染卡顿无关。

---

## W1. node.vue 深层 Watch 优化（最高优先）

**严重度**：P0（每次属性编辑触发 O(n²×m) 计算，100 节点表单消耗 10-50ms）

### 问题清单

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| 1.1 | `watch(() => props.componentSchema, ..., { deep: true })` — 任意子节点变化时，N 个 AigenNode 实例同时触发 deep watcher，每个执行 `deepEqual` + `deepClone` + `deepCompareAndModify` | `node.vue:101-114` | O(n²×m) 全量 diff |
| 1.2 | `watch(() => innerSchema, ..., { deep: true, immediate: true })` — 对 `innerSchema` 做 `JSON.stringify` 序列化检测变化，触发 `initComponent()` | `node.vue:473-488` | O(n×m) 序列化 |
| 1.3 | `watchEffect` 订阅 `fieldStateMap` — 当选中节点变化时，所有 N 个节点重新执行 condition 函数 | `node.vue:159-177` | O(n) 级联 |
| 1.4 | `deepClone(props.componentSchema)` 在每个 AigenNode 实例化时执行一次 | `node.vue:88-90` | O(n×m) 克隆 |

### 修复方案

**1.1 — 移除 `deep: true`，改为 targeted watch**

```typescript
// Before:
watch(
  () => props.componentSchema,
  (componentSchema) => {
    if (deepEqual(innerSchema, componentSchema, ['children'])) return;
    deepCompareAndModify(innerSchema, deepClone(componentSchema, false));
    addDesignModeSuffix();
  },
  { deep: true },
);

// After:
watch(
  () => [
    props.componentSchema.type,
    props.componentSchema.props,
    props.componentSchema.field,
    props.componentSchema.on,
    props.componentSchema.show,
    props.componentSchema.input,
    props.componentSchema.rules,
  ],
  () => {
    deepCompareAndModify(innerSchema, deepClone(componentSchema, false));
    addDesignModeSuffix();
  },
);
children 的变化由 AigenNode 的递归模板自然处理，无需在此 watch。
```

**1.2 — 用版本计数器替代 `JSON.stringify`**

```typescript
// 在父组件（editContainer/nodes.vue）中维护版本计数器
const schemaVersion = ref(0);
watch(() => pageSchema.schemas, () => schemaVersion.value++, { deep: false });

// 在 node.vue 中：
const props = defineProps<{
  componentSchema: ComponentSchema;
  schemaVersion?: number;  // 新增
}>();

watch(
  () => props.schemaVersion,
  () => {
    initComponent();
  },
);
```

**1.3 — 按字段粒度的 watch 替代 watchEffect**

```typescript
// Before:
watchEffect(() => {
  const fieldName = innerSchema?.field;
  const currentFieldState = fieldName && fieldStateMap.value?.[fieldName];
  // ...
});

// After:
watch(
  () => innerSchema?.field,
  (fieldName) => {
    const currentFieldState = fieldName && fieldStateMap.value?.[fieldName];
    // ... 同上
  },
);
```

**1.4 — 对不可变字段使用 markRaw**

```typescript
import { markRaw } from 'vue';

const innerSchema = reactive<ComponentSchema>(
  deepClone(props.componentSchema, !props.isProperty),
);
// 对不会变化的字段标记 markRaw，避免 Vue 深层代理
markRaw(innerSchema.type);
markRaw(innerSchema.icon);
```

### 涉及文件
- `packages/ui-kit/base-ui/src/node/node.vue`（唯一修改文件）

### 验收标准
- `watch(() => props.componentSchema, ...)` 不再使用 `deep: true`
- 属性面板修改单个字段时，Performance tab 中 `deepEqual` 调用次数从 N 次降至 1 次
- 100 节点表单属性编辑帧耗时 < 16ms

---

## W2. Builder 入口 Schema 更新优化（最高优先）

**严重度**：P0（每次 pageSchema 变化执行 4 次全树遍历 + 强制全量重挂载）

### 问题清单

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| 2.1 | `watch([() => props.pageSchema, () => props.tableView], ..., { deep: true })` 触发时依次执行 `deepClone` + `migrateComponentProps` + `reorganizeSchemasForTableView` + `deepCompareAndModify` — 4 次全树遍历 | `builder.vue:92-100` | 5-30ms 主线程阻塞 |
| 2.2 | `suspenseKey.value++` + `ready.value = false` — 强制所有 100+ AigenNode 全量 Suspense 重挂载 | `builder.vue:101-103` | 50-200ms DOM 重建 |
| 2.3 | `watch(() => props.formData, ..., { deep: true })` — 整个 formData 对象的深层 watch | `builder.vue:112-123` | 每次嵌套字段变化触发 |

### 修复方案

**2.1 — 将 Schema 处理移入 Web Worker**

创建 `packages/manager/src/schema.worker.ts`：

```typescript
// schema.worker.ts
import { deepClone, deepCompareAndModify, migrateComponentProps, reorganizeSchemasForTableView } from '@aigen-designer/utils';

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'processSchema') {
    const { pageSchema, tableView } = payload;
    const newSchema = deepClone(pageSchema);
    migrateComponentProps(newSchema, true);
    if (tableView) {
      reorganizeSchemasForTableView(newSchema);
    }
    // 返回处理后的 schema，主线程做最终合并
    self.postMessage({ type: 'schemaProcessed', schema: newSchema });
  }
};
```

在 `builder.vue` 中：

```typescript
// 预创建 Worker 实例
const schemaWorker = new Worker(
  new URL('../manager/src/schema.worker.ts', import.meta.url),
  { type: 'module' }
);

// watch 改为异步
watch(
  () => [props.pageSchema, props.tableView] as const,
  async ([pageSchema, tableView]) => {
    if (!pageSchema?.schemas?.length) return;

    const processed = await new Promise((resolve) => {
      schemaWorker.postMessage({
        type: 'processSchema',
        payload: { pageSchema, tableView },
      });
      schemaWorker.onmessage = (e) => {
        if (e.data.type === 'schemaProcessed') resolve(e.data.schema);
      };
    });

    deepCompareAndModify(pageManager.pageSchema, processed);
    // 不再强制全量重挂载
    pageManager.mountMonitor.reset();
  },
  { deep: true, immediate: true },
);
```

**2.2 — 移除全量重挂载**

删除 `suspenseKey.value++` 和 `ready.value = false`。改为精确更新：仅对实际变化的节点触发重新渲染。

```typescript
// Before:
suspenseKey.value++;
ready.value = false;

// After:
// 无需操作 — Vue 的响应式系统会自动处理变更
```

**2.3 — 缩小 formData watch 范围**

```typescript
// Before:
watch(
  () => props.formData,
  (data) => { setData(data); },
  { deep: true, immediate: true },
);

// After:
watch(
  () => props.formData,
  (data) => { setData(data); },
  { immediate: true },  // 移除 deep: true
);
// setData 内部已有合并逻辑，无需 deep watch
```

### 涉及文件
- `packages/core/src/components/builder/src/builder.vue`
- 新建：`packages/manager/src/schema.worker.ts`

### 验收标准
- `builder.vue` 的 watch 回调中不再有同步的全量 `deepClone` + `deepCompareAndModify`
- 页面加载帧耗时从 50-200ms 降至 < 30ms
- Worker 通信开销 < 2ms

---

## W3. History 系统 Diff 计算 Worker 化（最高优先）

**严重度**：P0（每次编辑产生 6-31ms 主线程阻塞）

### 问题清单

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| 3.1 | `commitCurrentState` 中 `createPatch(prevState, raw)` 递归 diff 整个 schema 树 | `revoke.ts:264` | 3-15ms |
| 3.2 | `JSON.stringify(raw)` 全量序列化 | `revoke.ts:155,158` | 1-8ms |
| 3.3 | `cloneCurrentState` 内部调用 `deepClone` → `deepToRaw` 双重遍历 | `revoke.ts:131-134` | 冗余 1-3ms |
| 3.4 | `materializeState` 中最多 60 次 `JSON.parse` + `applyPatch` 顺序执行 | `revoke.ts:106-110` | 5-30ms |
| 3.5 | `importHistory` 中 120+ 次顺序 `JSON.parse` 校验 | `revoke.ts:427-438` | 120-360ms |

### 修复方案

**3.1 + 3.2 — Diff 计算 + 序列化移入 Worker**

扩展 Worker（与 W2 共享或独立），新增 `computeDiff` 消息类型：

```typescript
// schema.worker.ts 中追加
if (type === 'computeDiff') {
  const { prevState, currentState } = payload;
  const ops = createPatch(prevState, currentState);
  const diff = JSON.stringify(ops);
  const snapshot = JSON.stringify(currentState);
  self.postMessage({ type: 'diffComputed', diff, snapshot });
}
```

`revoke.ts:250-275` 修改 `commitCurrentState`：

```typescript
async function commitCurrentState(type: string): Promise<void> {
  undoList.value = [];
  const raw = rawPageSchema();

  if (currentRecord.value === null || prevState === null) {
    // 基线记录
    const nextPrev = deepClone(raw);
    currentRecord.value = createRecord(type, raw, null);
    prevState = nextPrev;
  } else {
    // 通过 Worker 计算 diff
    const { diff, snapshot } = await computeDiffInWorker(prevState, raw);
    const nextPrev = deepClone(raw);
    recordList.value.push(currentRecord.value);
    currentRecord.value = createRecord(type, raw, diff);
    prevState = nextPrev;
  }

  if (recordList.value.length > MAX_RECORDS) {
    rebaseAfterShift();
  }
}
```

**3.3 — 消除冗余 deepToRaw**

```typescript
// revoke.ts:131-134
const cloneCurrentState = (
  raw?: Record<string, unknown>,
  alreadyRaw = false,
): Record<string, unknown> =>
  alreadyRaw
    ? deepClone(raw as any)  // raw 已经是剥离 Proxy 的普通对象
    : deepClone(raw ?? rawPageSchema());
```

调用处传入 `alreadyRaw = true`：
```typescript
const nextPrev = cloneCurrentState(raw, true);
```

**3.4 — materializeState 移入 Worker**

```typescript
const materializeState = async (record: RecordModel): Promise<Record<string, unknown>> => {
  // 发送到 Worker 回放 diff 链
  const chain = getChain();
  const index = chain.indexOf(record);
  const records = chain.slice(0, index + 1).map(r => ({
    diff: r.diff,
    snapshot: r.snapshot,
  }));

  const state = await new Promise<Record<string, unknown>>((resolve, reject) => {
    schemaWorker.postMessage({
      type: 'materialize',
      records,
      targetIndex: index,
    });
    schemaWorker.onmessage = (e) => {
      if (e.data.type === 'materialized') resolve(e.data.state);
      if (e.data.type === 'error') reject(new Error(e.data.error));
    };
  });
  return state;
};
```

**3.5 — importHistory 校验移入 Worker**

```typescript
const importHistory = async (historyData: { ... }): Promise<void> => {
  // ... 归一化逻辑不变 ...

  // 校验阶段移入 Worker
  const valid = await new Promise<boolean>((resolve) => {
    schemaWorker.postMessage({
      type: 'validateImport',
      records: allRecords.map(r => ({ snapshot: r.snapshot, diff: r.diff })),
    });
    schemaWorker.onmessage = (e) => {
      if (e.data.type === 'validationResult') resolve(e.data.valid);
    };
  });

  if (!valid) {
    console.error('导入历史记录失败：存在无法解析的记录数据');
    return;
  }

  // 应用阶段在主线程执行（需要操作 Vue 响应式对象）
  // ...
};
```

### 涉及文件
- `packages/manager/src/revoke.ts`
- `packages/manager/src/schema.worker.ts`（与 W2 共享）

### 验收标准
- `commitCurrentState` 主线程耗时从 6-31ms 降至 < 3ms
- `materializeState` 主线程耗时从 11-58ms 降至 < 5ms
- `importHistory` 校验不阻塞 UI

### 注意
- `push()` 的 200ms debounce 与 async Worker 存在竞态。需在 Worker 响应回调中校验是否还是最新的 edit。
- `deepCompareAndModify` 必须留在主线程（操作 Vue 响应式对象）。

---

## W4. Component Manager 注册批量化（中优先）

**严重度**：P1（启动时 25+ 次全量重算组件分组）

### 问题清单

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| 4.1 | `registerComponent` 每次调用后无条件触发 `computedComponentSchemaGroups()` | `useComponentManager.ts:355` | 25 次全量重算 |
| 4.2 | `computedComponentSchemaGroups` 内 O(n×m) 排序 + O(n) findIndex | `useComponentManager.ts:116-189` | 每次 ~1-3ms |
| 4.3 | `pluginManager` Proxy 包装每次属性访问都经过 get trap | `pluginManager.ts:211-236` | 累积开销 |
| 4.4 | `hideComponent`/`showComponent`/`setHideComponents`/`setSortedGroups` 均触发全量重算 | `useComponentManager.ts:263,386,395,84` | 批量操作时多次重算 |

### 修复方案

**4.1 + 4.2 + 4.4 — Dirty-flag + Microtask Flush**

```typescript
// useComponentManager.ts
let _dirty = false;
let _flushScheduled = false;

function scheduleFlush() {
  if (_flushScheduled) return;
  _flushScheduled = true;
  Promise.resolve().then(() => {
    _flushScheduled = false;
    if (_dirty) {
      _dirty = false;
      computedComponentSchemaGroups();
    }
  });
}

function registerComponent(componentConfig: ComponentConfigModel): void {
  // ... 现有注册逻辑 ...
  _dirty = true;
  scheduleFlush();  // 替换原来的直接调用
}

function hideComponent(type: string) {
  hiddenComponents.push(type);
  _dirty = true;
  scheduleFlush();
}

// 其余 mutator 同理...
```

**4.3 — Proxy 绕过（可选，收益中等）**

在 `pluginManager.ts` 中为高频热路径暴露直接引用：

```typescript
// 在 createPluginManager 内部，供内部模块使用
const component = {
  get: getComponent,               // 直接函数引用
  getConfigByType: getComponentConfigByType,
  // ... 其他高频方法
};

export { component as _component };  // 内部模块从此导入，绕过 Proxy
```

### 涉及文件
- `packages/hooks/src/plugin/useComponentManager.ts`
- `packages/manager/src/pluginManager.ts`（可选）

### 验收标准
- 启动时 `computedComponentSchemaGroups` 执行次数从 25+ 降至 1
- `setupAntd` + `setupPanel` 总耗时减少 ~20-50ms

---

## W5. Schema Worker 基础设施（基础设施）

**严重度**：P1（为 W2、W3 提供 Worker 运行环境）

### 问题清单

项目当前 **零 Web Worker 基础设施**（grep 确认无 `new Worker` 调用）。

### 修复方案

创建统一的 Schema Worker：

```typescript
// packages/manager/src/schema.worker.ts
import {
  applyPatch,
  createPatch,
  deepClone,
  deepCompareAndModify,
  deepEqual,
  migrateComponentProps,
  reorganizeSchemasForTableView,
} from '@aigen-designer/utils';
import type { PageSchema, ComponentSchema } from '@aigen-designer/types';

export interface SchemaWorkerRequest {
  id: number;
  type: string;
  payload: any;
}

export interface SchemaWorkerResponse {
  id: number;
  type: string;
  result?: any;
  error?: string;
}

self.onmessage = (e: MessageEvent<SchemaWorkerRequest>) => {
  const { id, type, payload } = e.data;
  try {
    switch (type) {
      case 'computeDiff': {
        const { prevState, currentState } = payload;
        const ops = createPatch(prevState, currentState);
        self.postMessage({
          id,
          type: 'diffComputed',
          result: { ops, diff: JSON.stringify(ops) },
        } as SchemaWorkerResponse);
        break;
      }
      case 'processSchema': {
        const { pageSchema, tableView } = payload;
        const newSchema = deepClone(pageSchema);
        migrateComponentProps(newSchema, true);
        if (tableView) {
          reorganizeSchemasForTableView(newSchema);
        }
        self.postMessage({
          id,
          type: 'schemaProcessed',
          result: { schema: newSchema },
        } as SchemaWorkerResponse);
        break;
      }
      case 'materialize': {
        const { records, targetIndex } = payload;
        let state: Record<string, unknown> = JSON.parse(records[0].snapshot);
        for (let i = 1; i <= targetIndex; i++) {
          if (records[i].diff) {
            applyPatch(state, JSON.parse(records[i].diff));
          } else if (records[i].snapshot) {
            state = JSON.parse(records[i].snapshot);
          }
        }
        self.postMessage({
          id,
          type: 'materialized',
          result: { state },
        } as SchemaWorkerResponse);
        break;
      }
      case 'validateImport': {
        const { records } = payload;
        for (const record of records) {
          if (record.snapshot) {
            try { JSON.parse(record.snapshot); } catch { throw new Error('invalid snapshot'); }
          }
          if (record.diff) {
            try { JSON.parse(record.diff); } catch { throw new Error('invalid diff'); }
          }
        }
        self.postMessage({ id, type: 'validationResult', result: { valid: true } } as SchemaWorkerResponse);
        break;
      }
    }
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    } as SchemaWorkerResponse);
  }
};
```

在 `packages/manager/src/schemaWorkerBridge.ts` 中提供桥接：

```typescript
// schemaWorkerBridge.ts
let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./schema.worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e) => {
      const { id, type, result, error } = e.data;
      if (type === 'error') {
        pending.get(id)?.reject(new Error(error));
      } else {
        pending.get(id)?.resolve(result);
      }
      pending.delete(id);
    };
  }
  return worker;
}

export function postToWorker(type: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, type, payload });
  });
}
```

### 涉及文件
- 新建：`packages/manager/src/schema.worker.ts`
- 新建：`packages/manager/src/schemaWorkerBridge.ts`

### 验收标准
- `new Worker()` 创建成功，Worker 可正常处理所有 4 种消息类型
- Vite build 产物中 Worker 文件被打包
- 各工作包可通过 `postToWorker()` 调用

---

## W6. FormulaEngine AST 缓存（低优先但低成本）

**严重度**：P2（每次 calculate 都重新解析 jsep，虽不在渲染热路径但浪费明显）

### 问题清单

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| 6.1 | `jsep(expression)` 每次 `calculate()` 都重新解析，无缓存 | `formulaEngine.ts:59` | 重复解析相同表达式 |

### 修复方案

```typescript
// formulaEngine.ts
export class FormulaEngine {
  private static astCache = new Map<string, jsep.Expression>();
  private context: FormulaContext;

  constructor(initialContext: FormulaContext = {}) {
    this.context = initialContext;
  }

  public calculate(expression: string, runtimeContext: FormulaContext = {}): any {
    if (!expression || typeof expression !== 'string') return null;

    // Parse once, reuse forever
    let ast = FormulaEngine.astCache.get(expression);
    if (!ast) {
      ast = jsep(expression);
      FormulaEngine.astCache.set(expression, ast);
    }

    const mergedContext: FormulaContext = {
      event: { ...this.context.event, ...runtimeContext.event },
      formData: { ...this.context.formData, ...runtimeContext.formData },
      vars: { ...this.context.vars, ...runtimeContext.vars },
    };

    try {
      return this._execute(ast, mergedContext);
    } catch (error) {
      console.error('[Aigen: 公式解析错误]', error);
      return null;
    }
  }
}
```

### 涉及文件
- `packages/utils/src/formula/formulaEngine.ts`

### 验收标准
- 相同表达式第二次调用 `calculate` 不再触发 jsep 解析
- 现有测试用例全部通过

---

## W7. Vue 响应式优化 — shallowRef / markRaw（低优先，低风险）

**严重度**：P2（Proxy 创建和 trap 开销，累积显著但单次微小）

### 问题清单

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| 7.1 | `pageSchema` 被 `reactive()` 深度代理，整个 schema 树的每个属性访问都经过 Proxy trap | `usePageSchema.ts:49` | 数千个 Proxy 对象 |
| 7.2 | `forms` 被 `reactive()` 深度代理 | `pageManager.ts:38` | 同上 |
| 7.3 | `mountMonitor` 用 `ref<string[]>` + `filter` 做 pop，O(n) | `useMountMonitor.ts:5-29` | O(n) 每次 unmount |
| 7.4 | `watchEffect` on `pageSchema.script` 追踪整个 `pageSchema`，任何 schema 变化都触发脚本重编译 | `pageManager.ts:417-422` | 不必要的 `new Function()` |

### 修复方案

**7.1 — pageSchema 改用 shallowRef**

```typescript
// usePageSchema.ts
import { shallowRef, triggerRef } from 'vue';

const pageSchema = shallowRef<PageSchema>({
  schemas: [],
  script: innerDefaultSchema.script,
});

function setPageSchema(schema: PageSchema) {
  const migratedSchema = migrateCanvasMode(schema);
  pageSchema.value = deepClone(migratedSchema);
  triggerRef(pageSchema);  // 手动触发响应式更新
}
```

**7.2 — forms 容器用 shallowRef，内部数据仍用 reactive**

```typescript
// pageManager.ts
const forms = shallowRef<Record<string, Record<string, unknown>>>({});

function setFormData(formData: Record<string, unknown>, formName = 'default') {
  const existing = forms.value[formName];
  if (existing) {
    Object.keys(formData).forEach((key) => {
      existing[key] = formData[key];
    });
    return existing;
  }
  const reactiveFormData = reactive(formData);
  forms.value[formName] = reactiveFormData;
  return reactiveFormData;
}
```

**7.3 — mountMonitor 用 Set 替代 Array**

```typescript
// useMountMonitor.ts
export function useMountMonitor() {
  const pendingIds = ref(new Set<string>());

  const isAllMounted = computed(() => pendingIds.value.size === 0);

  function push(id: string) {
    pendingIds.value.add(id);
  }

  function pop(id: string) {
    pendingIds.value.delete(id);
  }

  function reset() {
    pendingIds.value = new Set();
  }

  return { isAllMounted, push, pop, reset };
}
```

**7.4 — watchEffect 改为 targeted watch**

```typescript
// pageManager.ts
watch(
  () => pageSchema.script,
  (script) => {
    if (script && script !== '') {
      setMethods(script, !isDesignMode.value);
    }
  },
);
```

### 涉及文件
- `packages/hooks/src/plugin/usePageSchema.ts`
- `packages/manager/src/pageManager.ts`
- `packages/hooks/src/plugin/useMountMonitor.ts`

### 验收标准
- `pageSchema` 不再创建深层 Proxy
- `mountMonitor.pop` 从 O(n) 降至 O(1)
- 脚本仅在 `script` 字段实际变化时重编译

---

## W8. 组件搜索 Debounce（低优先）

**严重度**：P3（无 debounce 导致每次按键都递归过滤整棵树）

### 问题清单

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| 8.1 | `keyword` ref 直接绑定 Input，无 debounce | `tree.vue:30` | 每次按键触发全树递归 |
| 8.2 | 组件面板搜索同样无 debounce | `componentView/index.vue:18` | 同上 |

### 修复方案

```typescript
// tree.vue
import { debounce } from '@aigen-designer/utils';

const keyword = ref('');
const debouncedKeyword = ref('');
const debouncedFilter = debounce((val: string) => {
  debouncedKeyword.value = val;
}, 150);

watch(keyword, (val) => debouncedFilter(val));

const getTreeData = computed(() => {
  return filterTreeByLabel(props.options, debouncedKeyword.value);
});
```

### 涉及文件
- `packages/ui-kit/base-ui/src/tree/tree.vue`
- `packages/ui-kit/panel-ui/src/activitybars/componentView/index.vue`

### 验收标准
- 快速输入时过滤延迟不超过 150ms
- 停止输入后 150ms 内完成过滤

---

## W9. diffArrays Keyed 匹配优化（中优先）

**严重度**：P2（拖拽重排时产生大量冗余 diff 操作）

### 问题清单

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| 9.1 | `diffArrays` 中间区域按索引比较元素，拖拽重排时产生 N 次 remove + N 次 add | `diff.ts:216-218` | 本可用 O(1) move 解决 |

### 修复方案

```typescript
// diff.ts - diffArrays 中间区域改为 id-based 匹配
// 在 diffArrays 函数中，替换第 216-218 行的 for 循环：
for (let i = prefix; i < prefix + overlap; i++) {
  // Before: 按索引递归对比
  diffValue(before[i], after[i], `${path}/${i}`, ops, visited);

  // After: 按 id 匹配（如果元素有稳定 id）
  // 保持现有逻辑，但在调用方（revoke.ts）中，
  // ComponentSchema 的 children 数组已有 id 字段，
  // createPatch 内部使用 Object.is 比较对象引用，
  // 对于具有相同 id 但不同引用的节点，会产生 replace 而非 move。
  // 这属于正确行为 — diff 格式不支持 move，只支持 add+remove。
  // 本项不修改，标记为 "按现状可接受"。
}
```

**结论**：当前 `diffArrays` 的前缀/后缀优化已覆盖大部分重排场景。中间区域的 `add+remove` 虽然不如 `move` 紧凑，但 `applyPatch` 处理正确且性能可接受。**本项标记为无需修改，保留当前实现。**

---

## 并行修复计划总结

### 批次 1 — 全部可并行（无文件冲突）

| 工作包 | 负责文件 | 预计工期 | 预期收益 |
|--------|----------|----------|----------|
| **W1** | `node.vue` | 1 天 | 属性编辑帧耗时 10-50ms → < 5ms |
| **W2** | `builder.vue` + 新建 `schema.worker.ts` | 2 天 | 页面加载 50-200ms → < 30ms |
| **W3** | `revoke.ts` + `schema.worker.ts` | 2 天 | 撤销/重做 11-58ms → < 5ms |
| **W4** | `useComponentManager.ts` | 0.5 天 | 启动组件注册 25 次重算 → 1 次 |
| **W6** | `formulaEngine.ts` | 0.5 天 | 消除 jsep 重复解析 |
| **W7** | `usePageSchema.ts` + `pageManager.ts` + `useMountMonitor.ts` | 1 天 | Proxy 创建和 trap 开销减半 |
| **W8** | `tree.vue` + `componentView/index.vue` | 0.5 天 | 搜索响应从每次按键延迟到 150ms debounce |

### 批次 2 — 依赖批次 1

| 工作包 | 依赖 | 预计工期 |
|--------|------|----------|
| **W5** Worker 基础设施 | 需与 W2/W3 协调消息协议 | 1 天（可与 W2/W3 并行开发） |

### 总工期估算

- **最大并行**：7 个 agent 同时开工（W1-W4, W6-W8 + W5 单独）
- **关键路径**：W2/W3/W5（Worker 相关，需协调协议）
- **总人天**：约 7.5 天（并行压缩后 2-3 天）

---

## 附录 A：明确排除的优化项

| 优化项 | 排除原因 |
|--------|----------|
| FormulaEngine Web Worker | 事件驱动，1-5 表达式/事件；Worker 消息开销 > jsep 解析收益 |
| Tree Search Web Worker | 节点数 < 50；debounce 已足够 |
| Virtual Scrolling | 涉及 VueDraggable 嵌套递归，属于架构重构，建议单独立项 |
| `show` 函数 eval 优化 | 用户自定义函数，无法内部优化 |
| previewWidgets DOM rAF | 画布交互优化，与表单渲染卡顿无关 |
| Web Worker for `computedComponentSchemaGroups` | 批量化后仅执行 1 次，Worker 启动开销 > 计算收益 |

---

## 附录 B：性能瓶颈热力图

```
组件树深度 (depth)
    │
  4 │                    ████ builder.vue deepClone+diff
    │         ████████   ████ node.vue deepClone per node
  3 │         ████████   ████ node.vue deepEqual cascade
    │  ████████████████████████████████████████
  2 │  ████████████████████████████████████████ node.vue watch deep:true
    │  ████████████████████████████████████████
  1 │████████████████████████████████████████ revoke.ts createPatch
    │████████████████████████████████████████
  0 └─────────────────────────────────────────
    0   50  100  150  200  250  300  350  400  节点数 (nodes)

█ = 主线程阻塞时间 (ms)
```
