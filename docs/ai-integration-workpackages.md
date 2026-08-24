# Epic-Designer AI 集成 — 并行工作包任务书

> 纯前端轻量方案，不依赖后端服务。
> 每个工作包独立成章，包含「问题清单 → 修复方案 → 验收标准 → 涉及文件」四要素。
> 文件零冲突的工作包可并行执行。

---

## 总览

| 批次 | 工作包 | 文件冲突 | 说明 |
|---|---|---|---|
| **批次 1** | W1, W2, W3 | 无 | 类型定义 + 核心基础设施，全部可并行 |
| **批次 2** | W4, W5, W6 | 无 | 三个 UI 包的组件元数据补充，互不干扰 |
| **批次 3** | W7, W8, W9, W10, W11, W12, W13 | 无 | AI 服务 + 面板 + 集成，全部可并行 |
| **批次 4** | W14, W15 | 无 | 全局配置 + 撤销集成，依赖批次 1-3 |

---

# W1. 扩展 ComponentConfigModel 添加 `ai` 可选字段

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 1.1 | `ComponentConfigModel` 接口缺少 `ai` 字段，组件无法携带 AI 元数据 | `packages/types/src/pluginManager.ts:59-89` | P0 | 架构分析 |
| 1.2 | AI 无法理解组件的语义用途、适用场景、数据类型 | 同上 | P0 | 组件元数据分析 |

## 修复方案

在 `ComponentConfigModel` 接口末尾添加可选字段 `ai?: ComponentAiMetadata`。

```typescript
// packages/types/src/pluginManager.ts  ComponentConfigModel 接口

export interface ComponentConfigModel {
  bindModel?: string;
  component: ComponentType;
  config: {
    action?: ActionModel[];
    attribute?: ComponentSchema[];
    event?: EventModel[];
    style?: ComponentSchema[];
  };
  defaultSchema: ComponentSchema;
  editConstraints?: EditConstraintsModel;
  groupName?: string;
  icon?: string;
  isSubTable?: boolean;
  priority?: number;
  sort?: number;

  // ──────────────────────────────────────────
  // AI 增强元数据（新增，可选，向后兼容）
  // ──────────────────────────────────────────
  ai?: ComponentAiMetadata;
}
```

> 注意：此处仅添加字段引用，`ComponentAiMetadata` 类型由 W2 定义。

## 验收标准

- `packages/types/src/pluginManager.ts` 编译通过（`vue-tsc` / `tsc --noEmit`）
- `ComponentConfigModel` 的 `ai` 字段为可选类型
- 未提供 `ai` 字段的组件配置仍可正常编译运行（向后兼容）

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/types/src/pluginManager.ts` | 第 89 行后添加 `ai?: ComponentAiMetadata;` |

---

# W2. 定义 ComponentAiMetadata 类型

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 2.1 | 缺少 AI 友好的组件元数据结构定义 | `packages/types/src/pluginManager.ts` 无相关类型 | P0 | 架构分析 |
| 2.2 | AI 无法通过类型系统感知组件的 description、aliases、dataType、valueRange、relations 等语义信息 | 同上 | P0 | 组件元数据分析 |

## 修复方案

在 `packages/types/src/pluginManager.ts` 末尾新增以下类型定义：

```typescript
// ============================================================
// AI Component Metadata — 新增类型定义（W2）
// ============================================================

/** 组件的业务领域分类 */
export type ComponentDomain =
  | 'form'
  | 'layout'
  | 'navigation'
  | 'feedback'
  | 'data-display'
  | 'upload'
  | 'action';

/** 组件的输入数据类型 */
export type ComponentDataType =
  | 'string' | 'number' | 'boolean'
  | 'date' | 'time' | 'datetime' | 'dateRange'
  | 'file' | 'image'
  | 'option' | 'option-multi'
  | 'color' | 'slider' | 'richtext'
  | 'any';

/** 值域约束描述 */
export interface ValueRangeModel {
  min?: number | string;
  max?: number | string;
  enum?: Array<{ label: string; value: any }>;
  pattern?: string;
  maxLength?: number;
  minLength?: number;
  format?: string;
  accept?: string[];
  maxFileSizeMB?: number;
  validation?: string;
}

/** 父子组件关系约束 */
export interface ComponentRelationModel {
  allowedParents?: string[];
  allowedChildren?: string[];
  requireChildren?: boolean;
  maxChildren?: number;
  minChildren?: number;
  recommendedChildren?: string[];
  incompatibleWith?: string[];
}

/** 典型用法示例 */
export interface ComponentUsageExampleModel {
  description: string;
  scenario: string[];
  schema: ComponentSchema;
}

/** 语义别名 */
export interface SemanticAliasModel {
  synonyms: string[];
  en?: string[];
  industryTerms?: Record<string, string[]>;
}

/**
 * AI 增强的组件元数据
 * 作为 ComponentConfigModel 的可选扩展
 */
export interface ComponentAiMetadata {
  /** 组件功能描述（面向 AI 理解组件用途） */
  description: string;

  /** 语义别名（用于 AI 语义匹配和自然语言理解） */
  aliases?: SemanticAliasModel;

  /** 业务领域分类 */
  domain?: ComponentDomain;

  /** 场景标签（用于 AI 按场景筛选组件） */
  tags?: string[];

  /** 组件输入的数据类型 */
  dataType?: ComponentDataType;

  /** 值域约束 */
  valueRange?: ValueRangeModel;

  /** 组件关系约束 */
  relations?: ComponentRelationModel;

  /** 典型用法示例 */
  examples?: ComponentUsageExampleModel[];

  /** AI 生成时的推荐属性默认值 */
  recommendedDefaults?: Record<string, any>;

  /** 自然语言提示模板 */
  promptTemplate?: {
    intentMapping: string;
    attributeHints: string[];
  };
}
```

## 验收标准

- `packages/types/src/pluginManager.ts` 编译通过
- `ComponentAiMetadata` 接口完整导出（通过 `packages/types/src/index.ts` 的 `export *`）
- 在业务项目中可以 `import type { ComponentAiMetadata } from '@aigen-designer/types'`

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/types/src/pluginManager.ts` | 第 107 行后新增全部 AI 元数据类型（约 90 行） |
| `packages/types/src/index.ts` | 无需变更（已有 `export * from './pluginManager'`） |

---

# W3. 实现 AiComponentRegistry 类

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 3.1 | 缺少组件查询/推荐/验证能力，AI 无法知道"有什么组件可用" | 无相关代码 | P0 | 架构分析 |
| 3.2 | AI 生成 Schema 时需要组件知识库上下文，但当前没有结构化查询接口 | 同上 | P0 | Pipeline 设计 |

## 修复方案

新建 `packages/ai/src/registry/AiComponentRegistry.ts`，实现完整的组件注册表类：

```typescript
// packages/ai/src/registry/AiComponentRegistry.ts

import type {
  ComponentConfigModel,
  ComponentConfigModelRecords,
  ComponentSchema,
} from '@aigen-designer/types';
import type { ComponentAiMetadata } from '@aigen-designer/types';

// ─── 输出类型 ───

export interface AiComponentCapability {
  type: string;
  label: string;
  description: string;
  aliases: { synonyms: string[]; en?: string[] };
  domain: string;
  tags: string[];
  isInput: boolean;
  dataType: string;
  valueRange: Record<string, any>;
  configurableAttributes: AiAttributeDescriptor[];
  events: Array<{ type: string; description: string }>;
  actions: Array<{ type: string; description: string }>;
  relations: {
    allowedParents: string[];
    allowedChildren: string[];
    requireChildren: boolean;
    incompatibleWith: string[];
  };
  defaultSchema: ComponentSchema;
  examples: Array<{ description: string; scenario: string[]; schema: ComponentSchema }>;
  recommendedDefaults: Record<string, any>;
  sort: number;
  groupName: string;
}

export interface AiAttributeDescriptor {
  field: string;
  label: string;
  editorType: string;
  isProp: boolean;
  editorConfig?: any;
}

export interface AiComponentQueryFilter {
  domain?: string | string[];
  tags?: string[];
  isInput?: boolean;
  dataType?: string;
  keyword?: string;
  groupName?: string | string[];
  scenario?: string;
  limit?: number;
}

export interface AiComponentQueryResult {
  components: AiComponentCapability[];
  total: number;
  latencyMs: number;
}

export interface AiAttributeRecommendation {
  componentType: string;
  attributes: Array<{ field: string; value: any; reason: string; confidence: number }>;
}

// ─── 核心类 ───

export class AiComponentRegistry {
  private capabilities = new Map<string, AiComponentCapability>();
  private configs: ComponentConfigModelRecords = {};

  register(config: ComponentConfigModel): void { /* ... */ }
  registerAll(configs: ComponentConfigModelRecords): void { /* ... */ }

  query(filter: AiComponentQueryFilter = {}): AiComponentQueryResult { /* ... */ }
  getCapability(type: string): AiComponentCapability | undefined { /* ... */ }
  getAllTypes(): string[] { /* ... */ }
  getInputComponents(): AiComponentCapability[] { /* ... */ }
  getLayoutComponents(): AiComponentCapability[] { /* ... */ }

  recommendByScenario(scenario: string, limit = 5): AiComponentCapability[] { /* ... */ }
  recommendComposition(parentType: string): Array<{ parent: string; children: any[]; layoutHint?: string }> { /* ... */ }
  recommendAttributes(componentType: string, scenario?: string): AiAttributeRecommendation | null { /* ... */ }

  validateComposition(parentType: string, childTypes: string[]): { valid: boolean; violations: string[] } { /* ... */ }
  getStatistics(): Record<string, number> { /* ... */ }
  clear(): void { /* ... */ }

  // ─── 内部方法 ───
  private buildCapability(config: ComponentConfigModel): AiComponentCapability { /* ... */ }
  private inferFallback(config: ComponentConfigModel): Required<Pick<ComponentAiMetadata, 'description' | 'domain' | 'tags' | 'dataType'>> { /* ... */ }
}
```

**关键实现细节**：

1. `register()` — 从 `ComponentConfigModel` 构建 `AiComponentCapability`，优先使用 `config.ai`，否则调用 `inferFallback()` 自动推断
2. `inferFallback()` — 基于 `defaultSchema.type` + `groupName` 的规则推断表（覆盖 20+ 常见组件类型）
3. `query()` — 支持 domain / tags / dataType / keyword / scenario 多条件筛选
4. `recommendByScenario()` — 关键词打分匹配（description + tags + aliases + examples）
5. `validateComposition()` — 校验父子组件合法性 + 互斥关系

## 验收标准

- 新建 `packages/ai/src/registry/AiComponentRegistry.ts` 编译通过
- 注册 3 个测试组件后，`query()` / `getAllTypes()` / `recommendByScenario()` 返回正确结果
- 未提供 `ai` 字段的组件能通过 `inferFallback()` 自动生成基础元数据
- `validateComposition('row', ['input'])` 返回 `{ valid: false, violations: [...] }`

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/ai/src/registry/AiComponentRegistry.ts` | **新增**，约 350 行 |

---

# W4. antd 组件补充 ai 元数据（24 个组件）

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 4.1 | antd 24 个组件注册文件均缺少 `ai` 元数据对象，AI 无法理解组件语义 | `packages/ui/antd/src/*/index.ts` | P0 | 组件元数据分析 |
| 4.2 | 无 aliases / dataType / valueRange / relations / examples 等元数据 | 同上 | P0 | 同上 |

## 修复方案

在 antd 每个组件的注册文件末尾（`} as ComponentConfigModel;` 之前）添加 `ai` 对象。

以 `packages/ui/antd/src/input/index.ts` 为例：

```typescript
// 在 defaultSchema / groupName / icon / sort 之后，as ComponentConfigModel 之前
ai: {
  description: '单行文本输入框，用于采集用户的短文本信息，如姓名、手机号、地址、备注等。',
  aliases: {
    synonyms: ['文本框', '输入框', '单行输入', '文本字段'],
  },
  domain: 'form',
  tags: ['常用', '文本采集', '单行', '基础组件'],
  dataType: 'string',
  valueRange: {
    maxLength: 255,
    pattern: 'string',
  },
  relations: {
    allowedParents: ['form', 'row', 'col', 'card', 'modal', 'tab-pane', 'form-item'],
    incompatibleWith: ['textarea', 'input-number', 'date-picker', 'upload-file'],
  },
  examples: [
    {
      description: '采集用户姓名',
      scenario: ['个人信息', '人员登记'],
      schema: {
        type: 'input',
        field: 'name',
        label: '姓名',
        input: true,
        props: { placeholder: '请输入姓名', maxlength: 50 },
        rules: [{ required: true, message: '请输入姓名' }],
      },
    },
  ],
  recommendedDefaults: {
    placeholder: '请输入',
    maxlength: 255,
    allowClear: true,
  },
},
```

### 需要补充 ai 元数据的 24 个组件

| 组件类型 | 组件路径 | dataType | 关键 aliases |
|---|---|---|---|
| input | `antd/src/input/index.ts` | string | 文本框, 输入框, 姓名 |
| textarea | `antd/src/textarea/index.ts` | richtext | 多行文本, 备注 |
| input-number | `antd/src/input-number/index.ts` | number | 数字, 数量, 金额 |
| select | `antd/src/select/index.ts` | option | 下拉框, 选择框, 枚举 |
| checkbox | `antd/src/checkbox/index.ts` | option-multi | 多选框, 复选 |
| radio | `antd/src/radio/index.ts` | option | 单选框 |
| switch | `antd/src/switch/index.ts` | boolean | 开关, 是否 |
| date-picker | `antd/src/date-picker/index.ts` | date | 日期, 日期选择 |
| time-picker | `antd/src/time-picker/index.ts` | time | 时间, 时间选择 |
| cascader | `antd/src/cascader/index.ts` | option | 级联, 树形选择 |
| color-picker | `antd/src/color-picker/index.ts` | color | 颜色选择 |
| slider | `antd/src/slider/index.ts` | number | 滑动条, 滑块 |
| upload-file | `antd/src/upload-file/index.ts` | file | 文件上传, 附件 |
| upload-image | `antd/src/upload-image/index.ts` | image | 图片上传 |
| form | `antd/src/form/index.ts` | any | 表单容器 |
| form-item | `antd/src/form-item/index.ts` | any | 表单项 |
| row | `antd/src/row/index.ts` | any | 栅格行 |
| col | `antd/src/col/index.ts` | any | 栅格列 |
| card | `antd/src/card/index.ts` | data-display | 卡片 |
| tabs | `antd/src/tabs/index.ts` | navigation | 标签页 |
| tab-pane | `antd/src/tab-pane/index.ts` | navigation | 标签面板 |
| modal | `antd/src/modal/index.ts` | feedback | 弹窗, 对话框 |
| button | `antd/src/button/index.ts` | action | 按钮 |
| collapse / collapse-item | `antd/src/collapse/*` | navigation | 折叠面板 |

每个组件的 `ai` 对象至少包含 `description` + `domain` + `dataType`，其他字段可选。

## 验收标准

- antd 24 个组件的 `index.ts` 均包含 `ai` 对象
- 每个 `ai` 对象至少包含 `description`（非空字符串）
- `packages/ui/antd/src/index.ts` 中 `setupAntd` 调用 `registerComponent` 后，`pluginManager.component.getComponentConfigs()` 返回的每个配置包含 `ai` 字段
- antd 构建/启动正常

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/ui/antd/src/input/index.ts` | 添加 `ai` 对象 |
| `packages/ui/antd/src/textarea/index.ts` | 同上 |
| `packages/ui/antd/src/input-number/index.ts` | 同上 |
| `packages/ui/antd/src/select/index.ts` | 同上 |
| `packages/ui/antd/src/checkbox/index.ts` | 同上 |
| `packages/ui/antd/src/radio/index.ts` | 同上 |
| `packages/ui/antd/src/switch/index.ts` | 同上 |
| `packages/ui/antd/src/date-picker/index.ts` | 同上 |
| `packages/ui/antd/src/time-picker/index.ts` | 同上 |
| `packages/ui/antd/src/cascader/index.ts` | 同上 |
| `packages/ui/antd/src/color-picker/index.ts` | 同上 |
| `packages/ui/antd/src/slider/index.ts` | 同上 |
| `packages/ui/antd/src/upload-file/index.ts` | 同上 |
| `packages/ui/antd/src/upload-image/index.ts` | 同上 |
| `packages/ui/antd/src/form/index.ts` | 同上 |
| `packages/ui/antd/src/form-item/index.ts` | 同上 |
| `packages/ui/antd/src/row/index.ts` | 同上 |
| `packages/ui/antd/src/col/index.ts` | 同上 |
| `packages/ui/antd/src/card/index.ts` | 同上 |
| `packages/ui/antd/src/tabs/index.ts` | 同上 |
| `packages/ui/antd/src/tab-pane/index.ts` | 同上 |
| `packages/ui/antd/src/modal/index.ts` | 同上 |
| `packages/ui/antd/src/button/index.ts` | 同上 |
| `packages/ui/antd/src/collapse/index.ts` | 同上（cover collapse + collapse-item） |

> **并行策略**：24 个文件零冲突，可分配给多个 agent 同时修改。每个 agent 负责 4-6 个文件。

---

# W5. element-plus 组件补充 ai 元数据（25 个组件）

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 5.1 | element-plus 25 个组件注册文件均缺少 `ai` 元数据对象 | `packages/ui/elementPlus/src/*/index.ts` | P1 | 组件元数据分析 |

## 修复方案

与 W4 相同，在 element-plus 每个组件的注册文件末尾添加 `ai` 对象。元数据内容与 antd 对应组件一致（组件类型相同，仅 label 描述用 element-plus 的中文命名）。

### 需要补充 ai 元数据的 25 个组件

| 组件类型 | 组件路径 |
|---|---|
| input | `elementPlus/src/input/index.ts` |
| textarea | `elementPlus/src/input/index.ts` 或独立文件 |
| input-number | `elementPlus/src/input-number/index.ts` |
| select | `elementPlus/src/select/index.ts` |
| checkbox | `elementPlus/src/checkbox/index.ts` |
| radio | `elementPlus/src/radio/index.ts` |
| switch | `elementPlus/src/switch/index.ts` |
| date-picker | `elementPlus/src/date-picker/index.ts` |
| time-picker | `elementPlus/src/time-picker/index.ts` |
| cascader | `elementPlus/src/cascader/index.ts` |
| color-picker | `elementPlus/src/color-picker/index.ts` |
| slider | `elementPlus/src/slider/index.ts` |
| upload-file | `elementPlus/src/upload-file/index.ts` |
| upload-image | `elementPlus/src/upload-image/index.ts` |
| form | `elementPlus/src/form/index.ts` |
| form-item | `elementPlus/src/form-item/index.ts` |
| row | `elementPlus/src/row/index.ts` |
| col | `elementPlus/src/col/index.ts` |
| card | `elementPlus/src/card/index.ts` |
| tabs | `elementPlus/src/tabs/index.ts` |
| tab-pane | `elementPlus/src/tab-pane/index.ts` |
| modal | `elementPlus/src/modal/index.ts` |
| button | `elementPlus/src/button/index.ts` |
| collapse | `elementPlus/src/collapse/index.ts` |
| collapse-item | `elementPlus/src/collapse-item/index.ts` |

## 验收标准

- element-plus 25 个组件注册文件均包含 `ai` 对象
- 每个 `ai` 对象至少包含 `description` + `domain` + `dataType`
- element-plus 构建/启动正常

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/ui/elementPlus/src/input/index.ts` | 添加 `ai` 对象 |
| `packages/ui/elementPlus/src/input-number/index.ts` | 同上 |
| ... (共 25 个文件) | 同上 |

> **并行策略**：25 个文件零冲突，可分配给多个 agent 同时修改。每个 agent 负责 5-6 个文件。

---

# W6. naive-ui 组件补充 ai 元数据（25 个组件）

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 6.1 | naive-ui 25 个组件注册文件均缺少 `ai` 元数据对象 | `packages/ui/naiveUi/src/*/index.ts` | P2 | 组件元数据分析 |

## 修复方案

与 W4 相同，在 naive-ui 每个组件的注册文件末尾添加 `ai` 对象。

### 需要补充 ai 元数据的 25 个组件

| 组件类型 | 组件路径 |
|---|---|
| input | `naiveUi/src/input/index.ts` |
| input-number | `naiveUi/src/input-number/index.ts` |
| select | `naiveUi/src/select/index.ts` |
| checkbox | `naiveUi/src/checkbox/index.ts` |
| radio | `naiveUi/src/radio/index.ts` |
| switch | `naiveUi/src/switch/index.ts` |
| date-picker | `naiveUi/src/date-picker/index.ts` |
| time-picker | `naiveUi/src/time-picker/index.ts` |
| cascader | `naiveUi/src/cascader/index.ts` |
| color-picker | `naiveUi/src/color-picker/index.ts` |
| slider | `naiveUi/src/slider/index.ts` |
| upload-file | `naiveUi/src/upload-file/index.ts` |
| upload-image | `naiveUi/src/upload-image/index.ts` |
| form | `naiveUi/src/form/index.ts` |
| form-item | `naiveUi/src/form-item/index.ts` |
| row | `naiveUi/src/row/index.ts` |
| col | `naiveUi/src/col/index.ts` |
| card | `naiveUi/src/card/index.ts` |
| tabs | `naiveUi/src/tabs/index.ts` |
| tab-pane | `naiveUi/src/tab-pane/index.ts` |
| modal | `naiveUi/src/modal/index.ts` |
| button | `naiveUi/src/button/index.ts` |
| collapse | `naiveUi/src/collapse/index.ts` |
| collapse-item | `naiveUi/src/collapse-item/index.ts` |

## 验收标准

- naive-ui 25 个组件注册文件均包含 `ai` 对象
- 每个 `ai` 对象至少包含 `description` + `domain` + `dataType`
- naive-ui 构建/启动正常

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/ui/naiveUi/src/input/index.ts` | 添加 `ai` 对象 |
| `packages/ui/naiveUi/src/input-number/index.ts` | 同上 |
| ... (共 25 个文件) | 同上 |

> **并行策略**：25 个文件零冲突，可分配给多个 agent 同时修改。

---

# W7. useComponentManager 集成 AiComponentRegistry

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 7.1 | `useComponentManager` 的 `registerComponent` 在注册组件时不同步注册 AI 能力 | `packages/hooks/src/plugin/useComponentManager.ts:270` | P0 | 架构分析 |
| 7.2 | AI 无法通过统一入口查询所有已注册组件的元数据 | 同上 | P0 | 同上 |

## 修复方案

在 `useComponentManager.ts` 中：

1. 导入 `AiComponentRegistry`
2. 在函数内部创建 `aiRegistry` 实例
3. 在 `registerComponent()` 末尾调用 `aiRegistry.register(componentConfig)`
4. 在返回值中暴露 `aiRegistry`

```typescript
// packages/hooks/src/plugin/useComponentManager.ts

import { AiComponentRegistry } from '@aigen-designer/types';  // W2 完成后可用

export function useComponentManager() {
  // ... 现有代码 ...

  const aiRegistry = new AiComponentRegistry();

  function registerComponent(componentConfig: ComponentConfigModel): void {
    // ... 原有 270-356 行逻辑不变 ...

    // 同步注册 AI 能力
    aiRegistry.register(componentConfig);
  }

  return {
    // ... 原有返回值 ...
    aiRegistry,  // 新增
  };
}
```

## 验收标准

- `packages/hooks/src/plugin/useComponentManager.ts` 编译通过
- 调用 `pluginManager.component.register(config)` 后，`pluginManager.component.aiRegistry.getCapability(type)` 返回非 undefined
- 未显式提供 `ai` 元数据的组件，`getCapability` 返回通过 `inferFallback` 生成的元数据

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/hooks/src/plugin/useComponentManager.ts` | 第 1 行添加 import，函数体内创建 `aiRegistry`，`registerComponent` 第 ~356 行后添加同步注册，return 中暴露 `aiRegistry` |

---

# W8. 扩展 SetupConfig 添加 dataDictionary

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 8.1 | `SetupConfig` 缺少数据字典配置项，业务项目无法向 AI 注册枚举数据 | `packages/types/src/setupUi.ts:2-7` | P1 | 数据字典分析 |
| 8.2 | AI 生成 select/radio 等枚举组件时，无法自动填充业务数据字典中的选项值 | 同上 | P1 | 同上 |

## 修复方案

扩展 `SetupConfig` 接口，添加 `dataDictionary` 和 `dataDictionaryLoader` 字段：

```typescript
// packages/types/src/setupUi.ts

// 定义UI配置类型
export interface SetupConfig {
  /** 文件上传接口地址 */
  uploadFile?: string;
  /** 图片上传接口地址 */
  uploadImage?: string;

  // ──────────────────────────────────────────
  // AI 数据字典（新增）
  // ──────────────────────────────────────────
  /** 数据字典，AI 生成表单时自动使用其中的枚举值 */
  dataDictionary?: Record<string, DataDictionaryTable>;

  /** 动态加载数据字典的回调（返回 Promise），优先级高于 dataDictionary */
  dataDictionaryLoader?: () => Promise<Record<string, DataDictionaryTable>>;
}

/** 一张数据字典表 */
export interface DataDictionaryTable {
  /** 表名/字典名，如 "departments" */
  name: string;
  /** 字段列表，AI 通过字段描述匹配对应列 */
  columns: DataDictionaryColumn[];
  /** 枚举值列表（用于 select/radio 的选项） */
  enum?: Array<{ label: string; value: string | number }>;
}

/** 字典中的一列 */
export interface DataDictionaryColumn {
  /** 字段名，如 "name", "code" */
  name: string;
  /** 数据类型 */
  type?: 'string' | 'number' | 'boolean';
  /** 字段说明，AI 用此匹配业务字段 */
  description?: string;
  /** 是否是主键/显示字段 */
  isDisplay?: boolean;
}
```

## 验收标准

- `packages/types/src/setupUi.ts` 编译通过
- 业务项目可以 `import type { SetupConfig, DataDictionaryTable } from '@aigen-designer/types'`
- `SetupConfig.dataDictionary` 类型为 `Record<string, DataDictionaryTable>`

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/types/src/setupUi.ts` | 第 7 行后添加 `dataDictionary`、`dataDictionaryLoader` 字段，新增 `DataDictionaryTable`、`DataDictionaryColumn` 接口 |

---

# W9. 实现 AIAgentService（LLM 调用 + Prompt + 后处理）

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 9.1 | 缺少纯前端的 LLM 调用能力，无法调用 OpenAI/Claude API | 无相关代码 | P0 | 架构分析 |
| 9.2 | 缺少自然语言 → ComponentSchema 的生成逻辑 | 同上 | P0 | Pipeline 设计 |
| 9.3 | 缺少数据字典注入 Prompt 的逻辑 | 同上 | P1 | 数据字典分析 |

## 修复方案

新建 `packages/ai/src/service/AIAgentService.ts`，实现：

1. **AIProvider 接口**：统一的 LLM 调用抽象
2. **OpenAIProvider**：调用 OpenAI Chat Completions API（支持 JSON Mode + Function Calling）
3. **ClaudeProvider**：调用 Anthropic Messages API（支持 Tool Use）
4. **AIAgentService 主类**：
   - `configure()` — 配置 API Key 和模型
   - `generateFormSchema()` — 自然语言 → PageSchema
   - `refineSchema()` — 对话式微调
   - `buildComponentContext()` — 构建组件知识库 + 数据字典 Prompt 上下文
   - `buildSystemPrompt()` — NLU System Prompt
   - `postProcess()` — Schema 后处理（补全 id/field、校验类型合法性、options 格式标准化）

```typescript
// packages/ai/src/service/AIAgentService.ts 核心结构

export class AIAgentService {
  constructor(
    private componentRegistry: AiComponentRegistry,
    private dataDictionary?: Record<string, DataDictionaryTable>,
  ) {}

  configure(config: { provider: 'openai' | 'claude'; apiKey: string; model?: string }): void;
  async generateFormSchema(params: { description: string; uiFramework: string; existingSchema?: PageSchema }): Promise<{ schema: PageSchema; warnings: string[] }>;
  async refineSchema(params: { currentSchema: PageSchema; instruction: string; uiFramework: string }): Promise<{ schema: PageSchema; warnings: string[]; diff: any }>;
}
```

**关键 Prompt 构建逻辑**：

```
System Prompt = 
  "你是低代码表单设计器 AI 助手..." +
  "\n\n## 可用组件\n" + componentRegistry.query().components.map(c => `- ${c.type}: ${c.description}`).join('\n') +
  "\n\n## 数据字典\n" + Object.entries(dataDictionary).map(([k, v]) => `### ${v.name}\n  枚举值: ${v.enum?.map(e => `${e.label}: ${e.value}`).join(', ')}`).join('\n') +
  "\n\n## 输出格式\n{ schemas: [...] }"
```

## 验收标准

- `packages/ai/src/service/AIAgentService.ts` 编译通过
- 配置 OpenAI API Key 后，调用 `generateFormSchema({ description: '做一个请假表单', uiFramework: 'antd' })` 返回有效的 `PageSchema`
- 返回的 Schema 中包含 `schemas` 数组，根节点 `type: 'form'`
- 配置了 `dataDictionary` 后，生成的 select 组件 `props.options` 使用字典中的值
- `refineSchema()` 接受修改指令并返回更新后的 Schema

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/ai/src/service/AIAgentService.ts` | **新增**，约 400 行 |
| `packages/ai/src/index.ts` | 导出 `AIAgentService` |

---

# W10. 实现 AIAssistantPanel Vue 组件

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 10.1 | 缺少 AI 对话面板 UI，用户无法与 AI 交互 | 无相关代码 | P1 | 架构分析 |
| 10.2 | 缺少首次生成 → 预览 → 确认/微调 → 应用的交互流程 | 同上 | P1 | Pipeline 设计 |

## 修复方案

新建 `packages/ai/src/components/AIAssistantPanel.vue`：

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useDesignerContext } from '@aigen-designer/hooks';
import type { PageSchema } from '@aigen-designer/types';
import { AIAgentService } from '../service/AIAgentService';

// Props: 接收外部注入的 aiService（由 W11 注册面板时传入）
defineProps<{ aiService?: AIAgentService }>();

const { pageSchema, setFormSchema } = useDesignerContext();

const inputText = ref('');
const messages = ref<Array<{ role: 'user' | 'assistant'; content: string; warnings?: string[] }>>([]);
const isLoading = ref(false);
const previewSchema = ref<PageSchema | null>(null);

async function handleSend() {
  if (!inputText.value.trim() || isLoading.value) return;
  const userMsg = inputText.value.trim();
  messages.value.push({ role: 'user', content: userMsg });
  inputText.value = '';
  isLoading.value = true;

  try {
    const isFirst = messages.value.filter(m => m.role === 'assistant').length === 0;
    if (isFirst) {
      const result = await aiService.generateFormSchema({
        description: userMsg,
        uiFramework: 'antd',
        existingSchema: pageSchema.value,
      });
      messages.value.push({
        role: 'assistant',
        content: `已生成表单（${result.schema.schemas[0]?.children?.length ?? 0} 个字段）`,
        warnings: result.warnings,
      });
      previewSchema.value = result.schema;
    } else {
      const history = messages.value.map(m => ({ role: m.role, content: m.content }));
      const result = await aiService.refineSchema({
        currentSchema: previewSchema.value ?? pageSchema.value,
        instruction: userMsg,
        uiFramework: 'antd',
        conversationHistory: history,
      });
      messages.value.push({
        role: 'assistant',
        content: `已调整（+${result.diff.added} -${result.diff.removed} ~${result.diff.modified}）`,
        warnings: result.warnings,
      });
      previewSchema.value = result.schema;
    }
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `错误: ${e.message}` });
  } finally {
    isLoading.value = false;
  }
}

function handleApply() {
  if (previewSchema.value) {
    setFormSchema(previewSchema.value);
    messages.value.push({ role: 'assistant', content: '已应用到设计器' });
    previewSchema.value = null;
  }
}
</script>

<template>
  <div class="ai-assistant-panel">
    <div class="ai-messages">
      <div v-for="(msg, i) in messages" :key="i" :class="['ai-msg', msg.role]">
        <div class="ai-msg-content">{{ msg.content }}</div>
        <div v-if="msg.warnings?.length" class="ai-warnings">
          <div v-for="(w, j) in msg.warnings" :key="j" class="ai-warning">{{ w }}</div>
        </div>
      </div>
      <div v-if="previewSchema" class="ai-preview-actions">
        <button class="ai-btn-apply" @click="handleApply">应用到设计器</button>
        <button class="ai-btn-reset" @click="previewSchema = null">重新生成</button>
      </div>
    </div>
    <div class="ai-input-area">
      <textarea
        v-model="inputText"
        placeholder="描述你需要的表单，如：做一个员工请假申请表单..."
        @keydown.enter.ctrl="handleSend"
        rows="3"
      />
      <button @click="handleSend" :disabled="isLoading || !inputText.trim()">
        {{ isLoading ? '生成中...' : '发送' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 样式省略，使用现有 panel-ui 风格 */
</style>
```

## 验收标准

- `packages/ai/src/components/AIAssistantPanel.vue` 编译通过
- 面板通过 `useDesignerContext()` 获取当前 `pageSchema`
- 输入自然语言后调用 `aiService.generateFormSchema()` 生成预览
- 点击"应用到设计器"后调用 `setFormSchema()` 更新画布
- 支持对话式微调（第二次输入视为 refinement）

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/ai/src/components/AIAssistantPanel.vue` | **新增**，约 120 行 |
| `packages/ai/src/index.ts` | 导出 `AIAssistantPanel` |

---

# W11. Prompt 模板

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 11.1 | 缺少 NLU System Prompt，AI 无法理解组件知识库和生成规则 | 无相关代码 | P0 | Pipeline 设计 |
| 11.2 | 缺少 Schema 生成 Prompt，LLM 不知道输出格式 | 同上 | P0 | 同上 |
| 11.3 | 缺少对话微调 Prompt，AI 不知道如何修改现有 Schema | 同上 | P1 | 同上 |

## 修复方案

新建 `packages/ai/src/prompts/` 目录，包含三个 Prompt 文件：

### W11.1 `packages/ai/src/prompts/generation.ts`

```typescript
export function buildSystemPrompt(componentContext: string, dataDictionaryContext: string, uiFramework: string): string {
  return `你是低代码表单设计器 epic-designer 的 AI 助手。你将用户对表单的自然语言描述转换为标准的 ComponentSchema JSON。

## UI 框架
${uiFramework}

## 可用组件
${componentContext}

## 数据字典（枚举值必须从这里取值）
${dataDictionaryContext}

## 生成规则
1. type 必须匹配上方可用组件列表中的组件类型
2. field 使用 camelCase 命名，要有业务含义
3. label 使用中文，简洁明了
4. input 组件设置 input: true
5. 必填字段添加 rules: [{ required: true, message: '请输入XX' }]
6. 容器组件（form, row, col, card, tabs, tab-pane, collapse）使用 children 嵌套
7. 日期 → type: 'date-picker'，数字 → type: 'input-number'，布尔 → type: 'switch'
8. select 类型必须包含 props.options 数组，选项从数据字典取值
9. 两栏并排用 row/col 布局

## 输出格式
严格 JSON，不要 Markdown 标记：
{ "schemas": [{ "type": "form", "field": "...", "label": "...", "children": [...] }] }`;
}
```

### W11.2 `packages/ai/src/prompts/refinement.ts`

```typescript
export function buildRefinementPrompt(): string {
  return `你是表单设计器助手。用户会对当前表单提出修改指令。

## 修改规则
1. 只修改指令明确提到的部分，保持其他字段完全不变
2. 修改后输出完整的、有效的 ComponentSchema[] JSON
3. 如果指令无法执行，在 warnings 中说明原因

## 支持的修改
- "把XX改成多选" → select 加 props.mode: 'multiple'
- "XX必填" → 添加 required rule
- "加一个XX字段" → 在合适位置插入新组件
- "删除XX" → 移除对应组件
- "XX和XX放同一行" → 用 row/col 包裹

输出格式：
{ "schemas": [...], "warnings": ["..."] }`;
}
```

## 验收标准

- `packages/ai/src/prompts/generation.ts` 导出 `buildSystemPrompt()` 函数
- `packages/ai/src/prompts/refinement.ts` 导出 `buildRefinementPrompt()` 函数
- Prompt 中正确拼接了组件知识库和数据字典内容
- Prompt 文件纯字符串处理，不依赖任何运行时

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/ai/src/prompts/generation.ts` | **新增**，约 40 行 |
| `packages/ai/src/prompts/refinement.ts` | **新增**，约 30 行 |
| `packages/ai/src/index.ts` | 导出 prompt 函数 |

---

# W12. AI 面板注册到 PluginManager

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 12.1 | AIAssistantPanel 未注册到设计器的右侧栏，用户看不到 AI 面板 | `packages/hooks/src/plugin/usePanel.ts` | P1 | 架构分析 |
| 12.2 | AIAgentService 实例未注入到插件系统，面板无法调用 LLM | 同上 | P1 | 同上 |

## 修复方案

业务项目在使用 AigenDesigner 时执行以下注册代码：

```typescript
// 业务项目的入口文件

import { AigenDesigner } from 'aigen-designer';
import { AIAgentService, AiComponentRegistry, AiAssistantPanel } from '@aigen-designer/ai';
import { pluginManager } from '@aigen-designer/manager';

// 1. 初始化 AI 注册表
const aiRegistry = new AiComponentRegistry();
aiRegistry.registerAll(pluginManager.component.getComponentConfigs());

// 2. 初始化 AI 服务（用户配置自己的 API Key）
const aiService = new AIAgentService(aiRegistry);
aiService.configure({
  provider: 'openai',        // 或 'claude'
  apiKey: 'sk-xxxxx',        // 用户在前端配置自己的 Key
  model: 'gpt-4o',           // 可选，默认 gpt-4o / claude-sonnet-4
});

// 3. 注册 AI 面板到右侧栏
pluginManager.panel.registerRightSidebar({
  id: 'ai_assistant',
  title: 'AI 助手',
  component: () => import('@aigen-designer/ai').then(m => m.AIAssistantPanel),
  sort: 1,    // 排在最前面
  visible: true,
});

// 4. 使用设计器（AI 面板自动出现）
// <AigenDesigner />
```

**关键点**：
- `aiRegistry.registerAll()` 从 `pluginManager.component.getComponentConfigs()` 读取所有已注册组件的配置，构建 AI 能力索引
- `aiService` 的 `dataDictionary` 从 `pluginManager.global` 读取（见 W13）
- 面板通过 `props` 接收 `aiService` 实例

## 验收标准

- 在业务项目中执行注册代码后，设计器右侧栏出现"AI 助手"面板
- 面板中 AIAssistantPanel 正常渲染
- 输入自然语言描述后，面板调用 `aiService.generateFormSchema()` 生成预览
- 点击"应用到设计器"后，画布更新为 AI 生成的表单

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/ai/src/index.ts` | 导出 `AIAgentService`, `AiComponentRegistry`, `AIAssistantPanel` |
| （业务项目代码） | 执行注册代码（不属于本仓库修改范围） |

---

# W13. 数据字典存入 pluginManager.global

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 13.1 | `setupAntd(config)` 接收的 `dataDictionary` 未存入全局状态，AI 无法读取 | `packages/ui/antd/src/index.ts:37-39` + `packages/manager/src/pluginManager.ts:103` | P1 | 数据字典分析 |
| 13.2 | AIAgentService 没有渠道获取业务项目注册的数据字典 | 同上 | P1 | 同上 |

## 修复方案

### Step 1: 修改 `packages/ui/antd/src/index.ts`

在 `setupAntd` 函数中，将 `config.dataDictionary` 存入 `pluginManager.global`：

```typescript
// packages/ui/antd/src/index.ts

export function setupAntd(
  pluginManager: PluginManager = pManager,
  config: SetupConfig = {},
): void {
  // ... 现有版本兼容处理 ...

  // 存储数据字典到全局状态（新增）
  if (config.dataDictionary) {
    pluginManager.global.dataDictionary = config.dataDictionary;
  }
  if (config.dataDictionaryLoader) {
    pluginManager.global.dataDictionaryLoader = config.dataDictionaryLoader;
  }

  // ... 现有组件注册逻辑 ...
}
```

### Step 2: AIAgentService 读取数据字典

在 `AIAgentService` 的 `buildComponentContext()` 中，读取 `pluginManager.global.dataDictionary` 并注入 Prompt：

```typescript
// packages/ai/src/service/AIAgentService.ts

private buildDataDictionaryContext(): string {
  const dict = this.globalState?.dataDictionary;
  if (!dict || Object.keys(dict).length === 0) return '';

  const lines: string[] = ['## 数据字典（枚举值必须从这里取值）', ''];
  for (const [tableName, table] of Object.entries(dict)) {
    lines.push(`### ${table.name}（${tableName}）`);
    if (table.enum?.length) {
      lines.push('枚举值:');
      for (const item of table.enum) {
        lines.push(`  - ${item.label}: ${item.value}`);
      }
    }
    lines.push(`字段说明: ${table.columns.map(c => `${c.name}(${c.description ?? c.name})`).join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}
```

## 验收标准

- 业务项目 `setupAntd({ dataDictionary: { departments: { ... } } })` 后
- `pluginManager.global.dataDictionary.departments` 可访问
- AI 生成的 select 组件 `props.options` 使用字典中的 label/value
- 如果未注册 `dataDictionary`，AI 生成不受影响（字典部分为空字符串）

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/ui/antd/src/index.ts` | 第 ~45 行后添加 `dataDictionary` 存入 `pluginManager.global` |
| `packages/ai/src/service/AIAgentService.ts` | `buildComponentContext()` 中追加字典上下文 |
| （element-plus / naive-ui 的同名文件） | 同 antd 逻辑（可并行修改） |

---

# W14. 撤销系统集成 AI 批量操作

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 14.1 | AI 一次生成多个组件时，撤销栈会产生大量细粒度记录 | `packages/manager/src/revoke.ts` | P2 | 架构分析 |
| 14.2 | 用户撤销时无法区分"AI 生成的"和"手动拖入的"组件 | 同上 | P2 | 同上 |

## 修复方案

在 AI 面板的 `handleApply()` 中使用 `revoke.push('AI: ...', true)` 跳过防抖，一次性 commit：

```typescript
// 在 AIAssistantPanel.vue 的 handleApply 中

function handleApply() {
  if (previewSchema.value) {
    // 使用 isImportant=true 跳过 200ms 防抖，一次性 commit
    revoke.push(`AI: 根据"${lastUserInput}"生成表单`, true);
    setFormSchema(previewSchema.value);
    messages.value.push({ role: 'assistant', content: '已应用到设计器' });
    previewSchema.value = null;
  }
}
```

> 当前 `revoke.push(type, isImportant?)` 已支持 `isImportant` 参数，无需修改 revoke.ts。

## 验收标准

- AI 生成表单并确认后，撤销栈中只增加 1 条记录
- 撤销 1 次即可回退到 AI 生成前的状态
- 手动拖入组件仍产生独立的撤销记录

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/ai/src/components/AIAssistantPanel.vue` | `handleApply()` 中调用 `revoke.push('AI: ...', true)` |
| `packages/core/src/components/designer/hooks/useDesigner.ts` | 确保 `revoke` 通过 `DESIGNER_CONTEXT_KEY` 可被面板访问（已有，无需修改） |

---

# W15. AI 配置面板（用户输入 API Key）

## 问题清单

| # | 问题 | 位置 | 严重度 | 来源 |
|---|---|---|---|---|
| 15.1 | 用户没有地方输入自己的 OpenAI/Claude API Key | 无相关 UI | P3 | 架构分析 |
| 15.2 | 用户无法选择模型（GPT-4o / Claude Sonnet / 其他） | 同上 | P3 | 同上 |

## 修复方案

在 `AIAssistantPanel.vue` 的底部添加配置区域：

```vue
<!-- AIAssistantPanel.vue 底部 -->
<div class="ai-config">
  <div class="ai-config-item">
    <label>提供商</label>
    <select v-model="config.provider">
      <option value="openai">OpenAI (GPT-4o)</option>
      <option value="claude">Claude (Sonnet)</option>
    </select>
  </div>
  <div class="ai-config-item">
    <label>API Key</label>
    <input type="password" v-model="config.apiKey" placeholder="sk-..." />
  </div>
  <div class="ai-config-item">
    <label>模型</label>
    <input v-model="config.model" placeholder="gpt-4o（默认）" />
  </div>
  <button @click="applyConfig">保存配置</button>
</div>
```

> API Key 存储在浏览器 `localStorage` 中，不经过任何后端。

## 验收标准

- 面板底部显示提供商/API Key/模型配置项
- 输入 API Key 并保存后，下次打开面板自动恢复
- 切换提供商后，调用对应 API

## 涉及文件

| 文件 | 变更 |
|---|---|
| `packages/ai/src/components/AIAssistantPanel.vue` | 底部添加配置区域（约 30 行） |

---

# 依赖关系与并行策略总览

```
W1 (ComponentConfigModel 添加 ai 字段)
 │
 ├──→ W4 (antd 24 组件补充 ai)
 ├──→ W5 (element-plus 25 组件补充 ai)
 └──→ W6 (naive-ui 25 组件补充 ai)

W2 (ComponentAiMetadata 类型定义)
 │
 ├──→ W3 (AiComponentRegistry 实现)
 │      │
 │      └──→ W9 (AIAgentService，依赖 registry)
 │             │
 │             └──→ W10 (AIAssistantPanel，依赖 aiService)
 │                    │
 │                    └──→ W12 (面板注册)
 │
 └──→ W7 (useComponentManager 集成 registry)

W8 (SetupConfig dataDictionary)
 │
 └──→ W13 (存入 global + Prompt 注入)

W10 + W12 + W13
 │
 └──→ 业务项目可用的完整 AI 能力
```

### 批次执行计划

| 批次 | 工作包 | 并行度 | 预计时间 |
|---|---|---|---|
| **批次 1** | W1, W2, W3 | 3 个 agent 并行 | 1 天 |
| **批次 2** | W4 (24 文件), W5 (25 文件), W6 (25 文件) | 每个包可再分 4-5 个 agent，共 ~15 个 agent | 2-3 天 |
| **批次 3** | W7, W8, W9, W10, W11, W12, W13 | 7 个 agent 并行 | 2-3 天 |
| **批次 4** | W14, W15 | 2 个 agent 并行 | 0.5 天 |

**总计：约 6-7 天（最大并行度时）**

---

# 全局架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                   业务项目（使用方）                           │
│                                                             │
│  setupAntd({                                                │
│    dataDictionary: { departments: {...}, leaveTypes: {...} },│
│    uploadFile: '/api/upload'                                │
│  })                                                         │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────────────┐    ┌──────────────────────────┐       │
│  │ AigenDesigner    │    │  AIAssistantPanel         │       │
│  │                  │    │  (右侧栏)                  │       │
│  │ ┌──────────────┐ │    │                          │       │
│  │ │ 组件面板     │ │    │  用户: 做个请假表单       │       │
│  │ │              │ │    │                          │       │
│  │ │ input (ai)   │ │    │  AI: 已生成 5 个字段     │       │
│  │ │ select (ai)  │ │    │                          │       │
│  │ │ ...          │ │    │  [应用到设计器]           │       │
│  │ └──────────────┘ │    │  [重新生成]               │       │
│  │                  │    │                          │       │
│  │ ┌──────────────┐ │    │  配置: [GPT-4o] [sk-xxx] │       │
│  │ │ 画布编辑区   │ │    └──────────────────────────┘       │
│  │ │              │ │                                        │
│  │ │ [AI 生成]    │ │    ┌──────────────────────────┐       │
│  │ │ [手动调整]   │ │    │  AIAgentService          │       │
│  │ └──────────────┘ │    │  - fetch OpenAI/Claude   │       │
│  │                  │    │  - 构建 Prompt            │       │
│  └──────────────────┘    │  - 后处理 Schema           │       │
│       │                   └──────────────────────────┘       │
│       │  pluginManager                                       │
│       ▼                                                     │
│  ┌──────────────────┐                                       │
│  │ PluginManager    │                                       │
│  │                  │                                       │
│  │ component ───────┼──→ AiComponentRegistry               │
│  │   (24 antd)      │    - query / recommend / validate     │
│  │   (25 ep)        │                                       │
│  │   (25 naive)     │    ┌──────────────────────────┐       │
│  │                  │    │ AiComponentRegistry       │       │
│  │ designer         │    │ 每个组件:                 │       │
│  │   setFormSchema ←┘    │  ai.description           │       │
│  │                  │    │  ai.aliases               │       │
│  │ hook             │    │  ai.dataType              │       │
│  │   formChange     │    │  ai.valueRange            │       │
│  │   nodeRender     │    │  ai.relations             │       │
│  │                  │    │  ai.examples              │       │
│  │ panel            │    └──────────────────────────┘       │
│  │   registerRightSidebar                                     │
│  │                  │                                       │
│  │ global           │    dataDictionary ← W13               │
│  │   dataDictionary │                                       │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

---

# 最终验收标准

1. **编译通过**：所有新增/修改文件 `tsc --noEmit` 零错误
2. **组件元数据完整**：antd 24 + element-plus 25 + naive-ui 25 = 74 个组件均有 `ai` 元数据
3. **AI 生成可用**：用户输入"做个请假申请表单"，面板返回包含姓名/部门/请假类型/日期的表单 Schema
4. **数据字典生效**：注册 `dataDictionary.departments` 后，AI 生成的部门 select 自动使用字典中的 label/value
5. **对话微调可用**：用户说"把部门改成多选"，AI 在现有 Schema 基础上修改
6. **撤销正常**：AI 应用后撤销栈只有 1 条记录
7. **向后兼容**：未提供 `ai` 元数据的组件仍可正常注册和使用
