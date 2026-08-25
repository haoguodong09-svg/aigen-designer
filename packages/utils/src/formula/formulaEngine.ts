import jsep from 'jsep';

// --- 类型定义 ---

// 定义上下文数据结构
export interface FormulaContext {
  event?: Record<string, any>;
  formData?: Record<string, any>;
  vars?: Record<string, any>;
}

// 定义内置函数库的类型
type FormulaFunction = (...args: any[]) => any;

// --- 内置函数库 ---

const internalFunctions: Record<string, FormulaFunction> = {
  ABS: (val: number) => Math.abs(val),
  AVERAGE: (...args: any[]) =>
    internalFunctions.SUM(...args) / (args.length || 1),
  IF: (condition: any, trueVal: any, falseVal: any) =>
    condition ? trueVal : falseVal,
  MAX: (...args: number[]) => Math.max(...args),
  MIN: (...args: number[]) => Math.min(...args),
  // 你可以继续扩展，例如农业常用的：亩转平方米
  MU_TO_SQM: (mu: number) => mu * 666.67,
  SUM: (...args: any[]) =>
    args.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0),
};

// --- 核心引擎类 ---

export class FormulaEngine {
  /** AST 缓存上限，防止表达式无限增长导致内存膨胀 */
  private static readonly AST_CACHE_MAX = 1000;

  /** AST 缓存：相同表达式只解析一次（性能文档 P-W6），避免每次 calculate 重复调用 jsep */
  private static readonly astCache = new Map<string, jsep.Expression>();
  private context: FormulaContext;

  constructor(initialContext: FormulaContext = {}) {
    this.context = initialContext;
  }

  /**
   * 执行主入口
   * @param expression 表达式字符串
   * @param runtimeContext 运行时实时数据（合并构造函数中的 context）
   */
  public calculate(
    expression: string,
    runtimeContext: FormulaContext = {},
  ): any {
    if (!expression || typeof expression !== 'string') return null;

    // 合并初始上下文和运行时上下文
    const mergedContext: FormulaContext = {
      event: { ...this.context.event, ...runtimeContext.event },
      formData: { ...this.context.formData, ...runtimeContext.formData },
      vars: { ...this.context.vars, ...runtimeContext.vars },
    };

    try {
      // 优先使用缓存中的 AST，相同表达式第二次调用不再触发 jsep 解析
      let ast = FormulaEngine.astCache.get(expression);
      if (!ast) {
        ast = jsep(expression);
        if (FormulaEngine.astCache.size >= FormulaEngine.AST_CACHE_MAX) {
          // 简单淘汰策略：达到上限时整体清空，避免缓存无限增长
          FormulaEngine.astCache.clear();
        }
        FormulaEngine.astCache.set(expression, ast);
      }
      return this._execute(ast, mergedContext);
    } catch (error) {
      console.error('[Aigen: 公式解析错误]', error);
      return null;
    }
  }

  /**
   * 运算符实现
   */
  private _applyOperator(op: string, l: any, r: any): any {
    switch (op) {
      case '!=':
      case '!==': {
        return l !== r;
      }
      case '*': {
        return (l as number) * (r as number);
      }
      case '+': {
        return (Number(l) || 0) + (Number(r) || 0);
      }
      case '-': {
        return (l as number) - (r as number);
      }
      case '/': {
        return r === 0 ? 0 : (l as number) / (r as number);
      }
      case '<': {
        return l < r;
      }
      case '<=': {
        return l <= r;
      }
      case '==':
      case '===': {
        return l === r;
      }
      case '>': {
        return l > r;
      }
      case '>=': {
        return l >= r;
      }
      default: {
        return 0;
      }
    }
  }

  /**
   * 递归解析 AST 节点
   */
  private _execute(node: jsep.Expression, ctx: FormulaContext): any {
    switch (node.type) {
      // 3. 基础运算符: +, -, *, /
      case 'BinaryExpression': {
        const binNode = node as jsep.BinaryExpression;
        const left = this._execute(binNode.left, ctx);
        const right = this._execute(binNode.right, ctx);
        return this._applyOperator(binNode.operator, left, right);
      }

      // 4. 函数调用: SUM(...)
      case 'CallExpression': {
        const callNode = node as jsep.CallExpression;
        const callee = callNode.callee as jsep.Identifier;
        const funcName = callee.name.toUpperCase();

        const args = callNode.arguments.map((arg) => this._execute(arg, ctx));

        const func = internalFunctions[funcName];
        if (func) {
          return func(...args);
        }
        console.warn(`Function not found: ${funcName}`);
        return 0;
      }

      // 常量: 123, "abc"
      case 'Literal': {
        return (node as jsep.Literal).value;
      }

      // 逻辑表达式: &&, ||
      case 'LogicalExpression': {
        // jsep 类型未显式声明 LogicalExpression，left/right 经索引签名推断为
        // 联合类型（含 undefined），这里按 BinaryExpression 形状断言保证类型安全
        const logNode = node as jsep.BinaryExpression;
        const left = this._execute(logNode.left, ctx);
        const right = this._execute(logNode.right, ctx);
        return logNode.operator === '&&' ? left && right : left || right;
      }

      // 带前缀的变量: $formData.qty 或 $formData.user.address.city
      case 'MemberExpression': {
        const memberNode = node as jsep.MemberExpression;
        const propertyNode = memberNode.property as jsep.Identifier;
        const propertyName = propertyNode.name || (propertyNode as any).value;

        const sourceMap: Record<string, any> = {
          $event: ctx.event || {},
          $formData: ctx.formData || {},
          $vars: ctx.vars || {},
        };

        // 递归解析 object 部分，获取根对象名和属性路径
        let currentNode = memberNode.object;
        const propertyPath: string[] = [propertyName];
        let rootObjectName = '';

        while (currentNode) {
          if (currentNode.type === 'Identifier') {
            rootObjectName = (currentNode as jsep.Identifier).name;
            break;
          } else if (currentNode.type === 'MemberExpression') {
            const nestedMember = currentNode as jsep.MemberExpression;
            const nestedProperty = nestedMember.property as jsep.Identifier;
            const nestedPropertyName =
              nestedProperty.name || (nestedProperty as any).value;
            propertyPath.unshift(nestedPropertyName);
            currentNode = nestedMember.object;
          } else {
            break;
          }
        }

        const source = sourceMap[rootObjectName] || {};

        // 沿着属性路径逐层获取值
        let value = source;
        for (const prop of propertyPath) {
          if (value === null) {
            value = 0;
            break;
          }
          value = value[prop];
        }

        return value;
      }

      // 5. 一元运算符: -5, !true
      case 'UnaryExpression': {
        const unaryNode = node as jsep.UnaryExpression;
        const arg = this._execute(unaryNode.argument, ctx);
        return unaryNode.operator === '-' ? -arg : arg;
      }

      default: {
        console.warn(`Unsupported node type: ${node.type}`);
        return 0;
      }
    }
  }
}
