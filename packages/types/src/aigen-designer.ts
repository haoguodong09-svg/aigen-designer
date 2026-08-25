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
  methodName: string;
  /** 动作命名（人话，用于摘要/搜索/下拉展示），可选 */
  name?: string;
  /** 备注，可选 */
  remark?: string;
  type: 'component' | 'custom' | 'public';
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
        operator: '!=' | '<' | '<=' | '==' | '>' | '>=' | 'empty' | 'in';
        /** 比较值（'empty' 等一元运算符可缺省），可选 */
        value?: unknown;
      }
    | ConditionGroup
  >;
  /** 组合逻辑：AND（全部满足）/ OR（任一满足） */
  logic: 'AND' | 'OR';
}

export interface RenderCallbackParams {
  tableMeta?: TableMeta;
  // TODO: 第二期收敛为 Record<string, unknown>。
  // 当前 antd/elementPlus/naiveUi 的组件配置 show/onChange 回调仍依赖 any 索引访问 values.props。
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
  // 是否无需表单项，可选
  noFormItem?: boolean;
  // 事件绑定
  on?: {
    [eventName: string]: ActionsModel[];
  };
  // 组件属性，可选（透传给 UI 库组件的属性集合）
  // TODO: 第二期改为泛型 ComponentSchema<TProps> 以彻底消除 any
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
export type FormDataModel = Record<string, any>;

export interface DesignerState {
  disabledHover: boolean;
  hoverNode: ComponentSchema | null;
  matched: ComponentSchema[];
  selectedNode: ComponentSchema | null;
}

export interface PageSchema {
  canvas?: {
    height?: string;
    mode?: 'desktop' | 'mobile' | 'pad' | 'pc' | 'tablet'; // 支持新旧模式  'pad' | 'pc' 为旧数据
    width?: string;
  };
  schemas: ComponentSchema[];
  script?: string;
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
