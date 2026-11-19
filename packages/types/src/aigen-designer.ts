import type { TableMeta } from './designer';
import type { FormItemRule } from './rules';

/**
 * 动作模型（在 types 包内定义，避免反向依赖 manager 包）。
 * manager 包通过 re-export 复用本类型（单一数据源），两包 barrel 导出同一声明，
 * 不会产生命名冲突。若 manager 调整结构，需同步更新此处。
 */
export interface ActionsModel {
  args?: string;
  componentId?: null | string;
  /** 条件（纯 JSON DSL 对象而非函数——函数不可序列化），可选，P1 仅存储，P3 运行时生效 */
  condition?: ConditionGroup;
  /** 延迟执行毫秒数，可选，P1 仅存储，P3 运行时生效 */
  delay?: number;
  /** 启停用，缺省视为 true（undefined 视为启用，兼容旧数据），P1 仅存储，P3 运行时生效 */
  enabled?: boolean;
  /** 动作分组名（行为流分组），可选，P1 先存字段 P3 生效 */
  group?: string;
  /** 稳定身份：拖拽 key、复制、条件引用、日志定位；旧数据缺省，读取层（normalizeAction）补 UUID */
  id?: string;
  /** 字段联动编译标识（P3）：linkCompiler 编译 FieldLink 时写入，供联动规则删除/更新的精确定位，可选 */
  linkId?: string;
  methodName: string;
  /** 动作命名（人话，用于摘要/搜索/下拉展示），可选 */
  name?: string;
  /** 错误处理策略：中断(abort) / 忽略继续(continue) / 重试(retry) */
  onError?: 'abort' | 'continue' | 'retry';
  /** 备注，可选 */
  remark?: string;
  /** 目标标识（如组件 ID、API URL 或事件名） */
  target?: string;
  type: 'api' | 'component' | 'custom' | 'event' | 'navigate' | 'public';
}

export type ParamDataType =
  | 'boolean'
  | 'expression'
  | 'json'
  | 'number'
  | 'object'
  | 'string';

export interface MethodParamSchema {
  /** 默认值 */
  defaultValue?: unknown;
  /** 描述说明 */
  description?: string;
  /** 参数展示标签（中文人话） */
  label: string;
  /** 参数名（语义化 key，如 targetDate, message, options） */
  name: string;
  /** 占位提示文案 */
  placeholder?: string;
  /** 是否必填，默认 false */
  required?: boolean;
  /** 参数数据类型 */
  type: ParamDataType;
  /** 渲染该参数所使用的控件类型 */
  widget?:
    | 'code-editor'
    | 'input'
    | 'input-number'
    | 'json'
    | 'select'
    | 'switch';
  /** 控件专用配置（如下拉选项 options） */
  widgetProps?: Record<string, unknown>;
}

export interface StandardActionModel {
  /** 详细功能说明 */
  description: string;
  /** 是否为异步方法（返回 Promise） */
  isAsync?: boolean;
  /** 描述文案 */
  label: string;
  /** 方法名（如 reload, open, insertText, setOptions） */
  methodName: string;
  /** 参数定义列表 */
  parameters?: MethodParamSchema[];
  /** 返回值类型说明 */
  returnType?: 'array' | 'boolean' | 'object' | 'string' | 'void';
}

export interface TraceContext {
  causalChain: string[];
  depth: number;
  traceId: string;
}

export interface PipelineContext {
  activeStack: string[];
  causalChain: string[];
  formData: Record<string, unknown>;
  prevResult: unknown;
  stepResults: Record<string, unknown>;
  traceId: string;
  triggerEvent: unknown[];
  vars: Record<string, unknown>;
}

export interface PipelineResult {
  error?: unknown;
  failedActionId?: string;
  finalResult?: unknown;
  stepResults?: Record<string, unknown>;
  success: boolean;
}

/**
 * 动作条件组（纯 JSON DSL，不存函数，保证可序列化），P1 仅存储，P3 运行时求值生效。
 * 支持 AND/OR 逻辑组合与嵌套，示例：
 * { logic: 'AND', items: [{ field: 'name', operator: '==', value: '张三' }, { logic: 'OR', items: [...] }] }
 */
export interface ConditionGroup {
  /** 条件项列表：可为字段比较条件，也可为嵌套的条件组 */
  items: Array<
    | {
        /** 取值字段（formData 等上下文中的字段路径） */
        field: string;
        /** 比较运算符 */
        operator:
          | '!='
          | '<'
          | '<='
          | '=='
          | '>'
          | '>='
          | 'contains'
          | 'empty'
          | 'in'
          | 'notEmpty';
        /** 比较值（'empty' 等一元运算符可缺省），可选 */
        value?: unknown;
      }
    | ConditionGroup
  >;
  /** 组合逻辑：AND（全部满足）/ OR（任一满足） */
  logic: 'AND' | 'OR';
}

/**
 * 表达式模型（运行时 doActions 表达式参数对象，与 pageManager 的 __isExpression__ 约定一致）。
 * 设计态仅存储，运行时由表达式引擎识别并求值后替换为实际值。
 */
export interface ExpressionModel {
  /** 表达式标记，与 pageManager 约定一致：值为 true 时按表达式处理而非常量 */
  __isExpression__: true;
  /** 表达式内容（jsep 公式，如 "$formData.name"） */
  content: string;
}

/**
 * 设计态字段联动视图模型（P2 画布关联模式）。
 * 运行时经 linkCompiler 编译到目标元素的 on 事件，不新增运行时机制。
 */
export interface FieldLink {
  /** 联动行为：显示 / 隐藏 / 禁用 / 只读 / 赋值 / 清空 */
  behavior: 'CLEAR' | 'DISABLE' | 'HIDE' | 'READ' | 'SET_VALUE' | 'SHOW';
  /** 启停用，缺省视为 true（undefined 视为启用），可选 */
  enabled?: boolean;
  /** 稳定身份：拖拽 key、复制、引用定位 */
  id: string;
  /** 源字段（formData 路径），联动触发源 */
  sourceField: string;
  /** 目标元素 id，联动作用对象 */
  targetId: string;
  /** SET_VALUE 时的赋值内容；可为常量或表达式模型（{ __isExpression__: true, content }），可选 */
  value?: unknown;
  /** 可选条件，P3 运行时求值，满足时才触发联动 */
  when?: ConditionGroup;
}

export interface RenderCallbackParams {
  tableMeta?: TableMeta;
  // TODO: 第二期收敛为 Record<string, unknown>。
  // 当前 antd/elementPlus/naiveUi 的组件配置 show/onChange 回调仍依赖 any 索引访问 values.props。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: Record<string, any>;
}

export interface ComponentSchema {
  // 其他未明确指定的属性（第一期由 any 收紧为 unknown，第二期计划改为泛型 ComponentSchema<TProps>）
  [fieldName: string]: unknown;
  // 子节点列表，可选
  children?: ComponentSchema[];
  // 兼容旧版的组件属性别名，已弃用，请使用 props 代替
  componentProps?: Record<string, unknown>;
  // 组件功能描述
  description?: string;
  // 编辑组件数据，可选（属性编辑另外绑定编辑的数据，默认则为当前选中组件数据）
  editData?: object;
  // 节点字段，可选
  field?: string;
  // 节点ID，可选
  id?: string;
  // 是否为表单输入组件，可选
  input?: boolean;
  // 节点标签，可选
  label?: string;
  // 设计态字段联动视图模型，运行时按需编译到 on，不新增运行时机制，可选
  links?: FieldLink[];
  // 是否无需表单项，可选
  noFormItem?: boolean;
  // 事件绑定
  on?: {
    [eventName: string]: ActionsModel[];
  };
  // 组件属性，可选（透传给 UI 库组件的属性集合）
  // TODO: 第二期改为泛型 ComponentSchema<TProps> 以彻底消除 any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props?: any;
  // 表单验证规则，可选
  rules?: FormItemRule[];
  // 是否显示（属性编辑组件可以添加函数动态显示隐藏），可选
  show?: ((renderCallbackParams: RenderCallbackParams) => boolean) | boolean;
  // 插槽名称（组件为插槽类型时，需要设置插槽name），可选
  slotName?: string;
  // 插槽列表，可选
  slots?: { [slotName: string]: ComponentSchema[] };
  // 设计态辅助状态（如锁定、隐藏等），可选
  status?: { lock?: boolean };
  // 节点类型，必选
  type: string;
}

export interface FormConfig {
  customStyle?: string;
  hideRequiredMark?: boolean;
  // 标签列/控件列配置（兼容 antd/element-plus 等 Col 属性的数字/字符串/对象写法）
  labelCol: number | Record<string, number | string> | string;
  labelLayout: 'fixed' | 'flex';
  labelWidth?: string;
  layout?: string;
  wrapperCol: number | Record<string, number | string> | string;
}

// TODO: 第二期将 FormDataModel 收敛为 Record<string, unknown>。
// 当前 aigenActionModal 等调用方仍依赖 any 索引访问，待调用方收敛后再收紧。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormDataModel = Record<string, any>;

export interface DesignerState {
  disabledHover: boolean;
  hoverNode: ComponentSchema | null;
  matched: ComponentSchema[];
  selectedNode: ComponentSchema | null;
}

export interface ReactiveRule {
  /** 先验触发条件 */
  condition?: ConditionGroup;
  /** 描述说明 */
  description?: string;
  /** 派生效应集合（属性覆盖或派生值） */
  effects: {
    computedValue?: unknown;
    disabled?: boolean | { __isExpression__: boolean; content: string };
    hidden?: boolean | { __isExpression__: boolean; content: string };
    options?: unknown[] | { __isExpression__: boolean; content: string };
    readonly?: boolean | { __isExpression__: boolean; content: string };
    required?: boolean | { __isExpression__: boolean; content: string };
  };
  /** 是否启用 */
  enabled?: boolean;
  /** 规则唯一 ID */
  id: string;
  /** 作用域，默认为 'root' 或 'default' */
  scopeName?: string;
  /** 目标字段标识（field 或 id） */
  targetField: string;
}

export interface ComponentDerivedState {
  disabled?: boolean;
  hidden?: boolean;
  options?: unknown[];
  readonly?: boolean;
  required?: boolean;
}

export interface PageSchema {
  canvas?: {
    height?: string;
    mode?: 'desktop' | 'mobile' | 'pad' | 'pc' | 'tablet'; // 支持新旧模式  'pad' | 'pc' 为旧数据
    width?: string;
  };
  /** 响应式联动规则（新一代声明式属性联动模型） */
  reactiveRules?: ReactiveRule[];
  schemas: ComponentSchema[];
  script?: string;
  // 全局状态初值（公式 $vars 上下文，P3 运行时），可选
  vars?: Record<string, unknown>;
}

export interface Designer {
  handleDelete: () => void;
  handleDuplicate: () => void;
  handleImported: (data: PageSchema) => void;
  handleToggleDeviceMode: (mode: string) => void;
  preview: () => void;
  reset: () => void;
  save: () => void;
  setDisabledHover: (disabledHover?: boolean) => void;
  setHoverNode: (schema: ComponentSchema | null) => void;
  setSelectedNode: (schema: ComponentSchema | null) => void;
  state: DesignerState;
  // schemas: ComponentSchema[];
}
