export interface RuleItem {
  enum?: Array<boolean | null | number | string | undefined>;
  isValidator?: boolean;
  len?: number;
  max?: number;
  message?: ((a?: string) => string) | string;
  min?: number;
  pattern?: RegExp | string;
  required?: boolean;
  type?: string;
  // 自定义校验函数（与 async-validator 等校验器兼容），或已注册校验函数名称字符串。
  // 使用 CallableFunction 而非具体签名：node.vue 等调用方会从 pageManager.funcs（Record<string, Function>）赋值。
  validator?: CallableFunction | string;
  whitespace?: boolean;
}
export interface FormItemRule extends RuleItem {
  // 其他扩展属性（如 UI 库特有的校验配置）
  [model: string]: unknown;
  trigger?: string | string[];
}
