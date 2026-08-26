import type {
  ActionsModel,
  AigenNodeInstance,
  ComponentSchema,
} from '@aigen-designer/types';

import { reactive, ref, shallowRef, watch } from 'vue';

import {
  createEventBus,
  useHookManager,
  useMountMonitor,
  usePageSchema,
} from '@aigen-designer/hooks';
import {
  evaluateCondition,
  findSchemas,
  FormulaEngine,
  getValueByPath,
} from '@aigen-designer/utils';

import { pluginManager } from './pluginManager';

// ActionsModel 由 types 包定义（避免反向依赖），此处 re-export 保持 manager 的既有导出面
export type { ActionsModel } from '@aigen-designer/types';
export type ComponentInstances = Record<
  string,
  Record<string, AigenNodeInstance>
>;
export const DEFAULT_SCOPE = 'default';

export function createPageManager() {
  const formulaEngine = new FormulaEngine();
  const componentInstances = ref<ComponentInstances>({});
  const funcs = ref<Record<string, Function>>({});
  // 当前模式 true 设计模式, false 渲染模式
  const isDesignMode = ref(false);
  // script 错误状态
  const scriptError = ref<Error | null>(null);

  const defaultComponentIds = ref<string[]>([]);

  // 性能文档 P-W7：forms 容器改用 shallowRef，避免容器被深度代理
  // （容器内每个表单数据仍通过 reactive() 保持响应式，见 setFormData）
  const forms = shallowRef<Record<string, unknown>>({});
  const mountMonitor = useMountMonitor();

  // 初始化
  const { pageSchema, setPageSchema } = usePageSchema();
  const hook = useHookManager();

  // P3 页面事件总线（页面级通道）：元素之间解耦通信（B4.4）。
  // createEventBus 为 hooks 包纯函数（内部提供/清理与组件生命周期相关，
  // 在非组件上下文调用仅产生告警不影响功能），不引入 hooks ↔ manager 新循环依赖。
  const pageEventBus = createEventBus('page');
  // P3 全局变量：公式 $vars 上下文与 setVar/getVar 的存储，初值取 pageSchema.vars
  const vars = ref<Record<string, unknown>>(pageSchema.vars ?? {});

  /**
   * 查找组件的exposed属性
   * @param queryValue - 要查找的查询值
   * @param queryField - 要查找的查询字段，默认为 "id"
   * @returns - 匹配组件的exposed属性，若无匹配则返回 null
   */
  function find(
    queryValue: string,
    queryField = 'id',
    scopeName = DEFAULT_SCOPE,
  ): AigenNodeInstance['exposed'] | null {
    const instance = findInstance(queryValue, queryField, scopeName);
    // 返回组件实例的 exposed 属性
    return instance?.exposed ?? null;
  }

  /**
   * 查找所有匹配的组件的exposed属性
   * @param queryValue - 要查找的查询值
   * @param queryField - 要查找的查询字段，默认为 "id"
   * @returns - 匹配的组件的exposed属性数组
   */
  function findAll(
    queryValue: string,
    queryField = 'id',
    scopeName = DEFAULT_SCOPE,
  ): AigenNodeInstance['exposed'][] {
    const instances = findInstanceAll(queryValue, queryField, scopeName);
    // 返回组件实例的 exposed 属性数组
    return instances.map((instance) => instance.exposed);
  }

  /**
   * 查找组件实例
   * @param queryValue - 要查找的查询值
   * @param queryField - 要查找的查询字段，默认为 "id"
   * @returns - 匹配的组件实例，若无匹配则返回 null
   */
  function findInstance(
    queryValue: string,
    queryField = 'id',
    scopeName = DEFAULT_SCOPE,
  ): AigenNodeInstance | null {
    // 如果查询字段是 id，直接在组件实例映射中查找
    if (queryField === 'id') {
      return componentInstances.value[queryValue]?.[scopeName] ?? null;
    }

    // 通过递归查询所有组件 schema，找到第一个与指定字段和值匹配的 schema
    const matchingSchema = findSchemas(
      pageSchema.schemas,
      (schema) => getValueByPath(schema, queryField) === queryValue,
      true,
    ) as ComponentSchema | false;

    // 如果未找到匹配的 schema，返回 null
    if (!matchingSchema || !matchingSchema.id) {
      return null;
    }

    // 返回组件实例
    return componentInstances.value[matchingSchema.id]?.[scopeName] ?? null;
  }

  /**
   * 查找所有匹配的组件实例
   * @param queryValue - 要查找的查询值
   * @param queryField - 要查找的查询字段，默认为 "id"
   * @returns - 匹配的组件实例数组
   */
  function findInstanceAll(
    queryValue: string,
    queryField = 'id',
    scopeName = DEFAULT_SCOPE,
  ): AigenNodeInstance[] {
    // 如果查询字段是 id，直接返回对应的组件实例数组
    if (queryField === 'id') {
      const instance = componentInstances.value[queryValue]?.[scopeName];

      return instance ? [instance] : [];
    }

    // 通过递归查询所有组件 schema，找到与指定字段和值匹配的 schema
    const matchingSchemas = findSchemas(
      pageSchema.schemas,
      (schema) => getValueByPath(schema, queryField) === queryValue,
    ) as ComponentSchema[];

    // 从匹配的 schema 中获取组件实例
    return matchingSchemas
      .map((schema) => componentInstances.value[schema.id ?? '']?.[scopeName])
      .filter(Boolean); // 过滤掉 undefined 或 null 的实例
  }

  /**
   * 查找组件（废弃）
   * @param queryValue 要查找的查询值
   * @param queryField - 要查找的查询字段 默认值 id
   */
  function getComponent(queryValue: string, queryField = 'id') {
    console.warn(
      '[Aigen 自定义函数]: `getComponent`方法已废弃，后续版本可能移除该函数，请使用`find`方法',
    );
    return find(queryValue, queryField);
  }

  /**
   * 添加组件实例
   * @param id
   * @param instance
   */
  function addComponentInstance(
    id: string,
    instance: AigenNodeInstance,
    scopeName = DEFAULT_SCOPE,
  ) {
    // 如果第一层 id 不存在，先创建一个空对象
    if (!componentInstances.value[id]) {
      componentInstances.value[id] = {};
    }

    // 现在可以安全地存入特定 scopeName 的实例了
    componentInstances.value[id][scopeName] = instance;
  }
  /**
   * 移除组件实例
   * @param id
   */
  function removeComponentInstance(
    id: string,
    scopeName = DEFAULT_SCOPE,
  ): void {
    delete componentInstances.value[id]?.[scopeName];
  }

  /**
   * 动态创建函数
   * @param scriptStr
   */
  function setMethods(scriptStr: string, outputError: boolean = false): void {
    // CSP 安全说明（W6-6.7）：自定义脚本通过 new Function 编译执行，这是低代码设计器
    // 编译用户脚本的固有需求。若部署环境启用严格 CSP（禁用 'unsafe-eval'），该编译会被
    // 浏览器阻止并置 scriptError。请确保页面 CSP 策略允许 'unsafe-eval'，且不要将
    // 不可信来源的文本直接写入 pageSchema.script。
    if (typeof scriptStr !== 'string') {
      scriptError.value = new Error('自定义脚本必须是字符串');
      if (outputError) {
        console.error('[Aigen：自定义函数]异常：脚本必须是字符串', scriptStr);
      }
      return;
    }

    // 初始化一个空对象来存储公共方法
    const publicMethods: Record<string, Function> = {};

    // 遍历 pluginManager.publicMethods 对象的属性
    for (const key in pluginManager.publicMethods.methodsMap) {
      if (
        Object.prototype.hasOwnProperty.call(
          pluginManager.publicMethods.methodsMap,
          key,
        )
      ) {
        // 将每个属性的 handler 赋值给新对象的对应属性
        publicMethods[key] =
          pluginManager.publicMethods.methodsMap[key].handler;
      }
    }

    try {
      // eslint-disable-next-line no-new-func
      new Function(`const aigen = this;${scriptStr}`).bind({
        ...publicMethods,
        defineExpose,
        find,
        findAll,
        findInstance,
        findInstanceAll,
        getComponent,
        pluginManager,
        publicMethods,
        state: pluginManager.global,
      })();
      scriptError.value = null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      scriptError.value = err;
      if (outputError) {
        console.error('[Aigen：自定义函数]异常：', err);
      }
    }
  }

  /**
   *  存储自定义脚本暴露的函数及属性
   * @param exposed
   */
  function defineExpose(exposed?: Record<string, Function> | undefined): void {
    if (!exposed) return;
    const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    const filtered: Record<string, Function> = {};
    for (const key of Object.keys(exposed)) {
      if (DANGEROUS_KEYS.has(key)) {
        console.warn(`[Aigen:defineExpose] 忽略危险键名: ${key}`);
      } else {
        filtered[key] = exposed[key];
      }
    }
    funcs.value = filtered;
  }

  /**
   * 执行一组操作
   *
   * @param actions 操作数组
   * @param scopeName 作用域名称，默认值为 DEFAULT_SCOPE
   * @param args 其他参数
   */
  function doActions(
    actions: ActionsModel[],
    scopeName = DEFAULT_SCOPE,
    ...args: unknown[]
  ): void {
    // 递归深度保护（doActions 每次调用独立计数，避免跨调用累积）
    const MAX_RECURSION_DEPTH = 20;
    let depth = 0;

    function executeActions(
      acts: ActionsModel[],
      sn: string,
      a: unknown[],
    ): void {
      depth++;
      if (depth > MAX_RECURSION_DEPTH) {
        console.error('[Aigen:doActions] 递归深度超过限制，中止执行');
        return;
      }

      try {
        // 检查是否提供了操作数组，如果没有提供，则发出警告并返回
        if (!acts || acts.length === 0) {
          console.warn('未提供任何动作');
          return;
        }

        // 追踪延迟执行的 timer，便于后续清理（如页面卸载时 clear 防止内存泄漏）
        const pendingTimers = new Set<number>();

        // 遍历每个操作
        acts.forEach((action) => {
          // 动作级启停用：enabled === false 时跳过该动作，不中断整条动作链。
          // 缺省（undefined）视为启用，兼容旧数据（与 normalizeAction 的 enabled 缺省 true 语义一致）
          if (action.enabled === false) {
            return;
          }

          const formNames = Object.keys(forms.value);
          // 处理数据参数（表单数据 + 触发事件参数 + 全局变量，供条件求值与表达式计算使用）
          const context = {
            event: a,
            formData: (formNames.length === 1
              ? forms.value[formNames[0]]
              : forms.value) as Record<string, any>,
            // P3：全局变量注入公式上下文（$vars.xxx）
            vars: vars.value,
          };

          // P3：动作条件求值——不满足时跳过该动作，不中断整条动作链。
          // evaluateCondition 内部 fail-safe（求值异常返回 false 并告警）
          if (
            !evaluateCondition(action.condition, {
              event: a,
              formData: context.formData,
              vars: vars.value,
            })
          ) {
            return;
          }

          // 尝试解析操作参数，如果没有提供，则使用传入的参数。
          // 单个动作的 args 为非法 JSON 时仅跳过该动作并告警，不中断整条动作链（W6-6.1）
          let methodArgs: unknown[];
          if (action.args) {
            try {
              const parsed = JSON.parse(action.args);
              // 兼容非数组 JSON（如对象字面量），统一包装为数组
              methodArgs = Array.isArray(parsed) ? parsed : [parsed];
            } catch (error) {
              console.warn(
                `[Aigen：动作(${action.methodName})]args 非法 JSON，已跳过该动作`,
                { args: action.args, error },
              );
              return;
            }
          } else {
            methodArgs = a;
          }

          methodArgs = methodArgs.map((arg: any) => {
            // 如果是对象且标记为表达式，调用 jsep 计算
            if (arg && typeof arg === 'object' && arg.__isExpression__) {
              return formulaEngine.calculate(arg.content, context);
            }

            // 否则（字符串、数字等），直接返回原值（兼容旧数据）
            return arg;
          });

          // 实际执行体：按动作类型分发到对应执行函数（各执行函数内部均有 try/catch，
          // 此处兜底保证单动作异常不中断动作链）
          const executeAction = (): void => {
            try {
              // 根据操作的类型，调用不同的执行函数
              switch (action.type) {
                case 'component': {
                  // 执行组件方法
                  executeComponentMethod(action, sn, methodArgs);
                  break;
                }

                case 'custom': {
                  // 执行自定义方法
                  executeCustomMethod(action, methodArgs);
                  break;
                }

                case 'public': {
                  // 执行公共方法
                  executePublicMethod(action, methodArgs);
                  break;
                }

                default: {
                  // 如果遇到未知的操作类型，发出警告
                  console.warn(`未知的动作类型: ${action.type}`);
                  break;
                }
              }
            } catch (error) {
              console.error(
                `[Aigen：动作(${action.methodName})]执行异常:`,
                error,
              );
            }
          };

          // P3：延迟执行——仅该动作延迟，动作链其他动作不受影响（动作参数已在
          // 调用前完成解析与表达式求值，延迟体内直接执行）
          if (typeof action.delay === 'number' && action.delay > 0) {
            const timerId = window.setTimeout(() => {
              pendingTimers.delete(timerId);
              executeAction();
            }, action.delay);
            pendingTimers.add(timerId);
          } else {
            executeAction();
          }
        });
      } finally {
        depth--;
      }
    }

    executeActions(actions, scopeName, [...args]);
  }

  /**
   * 执行公共方法
   * @param action 操作
   * @param args 参数
   */
  function executePublicMethod(action: ActionsModel, args: unknown[]): void {
    try {
      // 尝试调用公共方法处理程序
      pluginManager.publicMethods.methodsMap[action.methodName]?.handler(
        ...args,
      );
    } catch (error) {
      // 如果调用失败，打印错误信息
      console.error(`[Aigen：公共函数(${action.methodName})]执行异常:`, error);
    }
  }

  /**
   * 执行自定义方法
   * @param action 操作
   * @param args 参数
   */
  function executeCustomMethod(action: ActionsModel, args: unknown[]): void {
    try {
      // 尝试调用自定义方法
      funcs.value[action.methodName]?.(...args);
    } catch (error) {
      // 如果调用失败，打印错误信息
      console.error(
        `[Aigen：自定义函数(${action.methodName})]执行异常:`,
        error,
      );
    }
  }

  /**
   * 执行组件方法
   * @param action 操作
   * @param scopeName 作用域名称，默认值为 DEFAULT_SCOPE
   * @param args 参数
   */
  function executeComponentMethod(
    action: ActionsModel,
    scopeName = DEFAULT_SCOPE,
    args: unknown[],
  ): void {
    // 获取组件实例
    const component =
      action.componentId && find(action.componentId, 'id', scopeName);

    // 如果未找到组件实例，发出警告并返回
    if (!component) {
      console.warn(`[Aigen：组件${action.componentId}]未找到`);
      return;
    }

    try {
      // 调用组件的方法
      component[action.methodName](...args);
    } catch (error) {
      // 如果调用失败，打印错误信息
      console.error(
        `[Aigen：组件${action.componentId}函数(${action.methodName})]执行异常:`,
        error,
      );
    }
  }

  /**
   * 设置设计模式的状态
   * @param isDesign 是否处于设计模式
   */
  function setDesignMode(isDesign: boolean = true): void {
    isDesignMode.value = isDesign;
  }

  function setDefaultComponentIds(schemas: ComponentSchema[]) {
    const componentSchemas = findSchemas(
      schemas,
      () => true,
    ) as ComponentSchema[];
    defaultComponentIds.value = componentSchemas.map(
      (item) => item.id as string,
    );
  }

  /**
   * 设置表单数据
   * 用于组件内部向表单管理器添加新的表单数据
   * 如果表单已存在，会将新数据合并到现有数据中，保持响应式
   * @param formData 要添加的表单数据对象
   * @param formName 表单名称，默认为 'default'
   * @returns 返回响应式的表单数据
   */
  function setFormData(
    formData: Record<string, unknown>,
    formName: string = 'default',
  ) {
    if (forms.value[formName]) {
      // 存在表单数据，合并到旧数据（内部数据仍是 reactive，属性级更新保持响应式）
      const reactiveFormData = forms.value[formName] as Record<string, unknown>;

      Object.keys(formData).forEach((key) => {
        reactiveFormData[key] = formData[key];
      });
      return reactiveFormData; // 返回已存在的响应式数据
    }
    // 没有表单数据时，创建响应式数据
    const reactiveFormData = reactive(formData);
    // shallowRef 容器只追踪 .value 整体替换，新增表单时替换容器以触发响应式
    forms.value = { ...forms.value, [formName]: reactiveFormData };
    return reactiveFormData; // 返回新创建的响应式数据
  }

  /**
   * 触发页面事件（P3 页面事件总线，B4.4）：元素之间解耦通信。
   * @param eventName 事件名
   * @param payload 事件载荷，可选
   */
  function emitEvent(eventName: string, payload?: unknown): void {
    pageEventBus.emit(eventName, payload);
  }

  /**
   * 监听页面事件（P3）：注册后收到 emitEvent 触发的同名校验载荷。
   * @param eventName 事件名
   * @param handler 处理函数
   */
  function onEvent(
    eventName: string,
    handler: (payload: unknown) => void,
  ): void {
    pageEventBus.on(eventName, handler);
  }

  /**
   * 设置全局变量（P3）：写入 vars，公式 $vars.xxx 与 getVar 可读取。
   * @param key 变量名
   * @param value 变量值
   */
  function setVar(key: string, value: unknown): void {
    vars.value[key] = value;
  }

  /**
   * 读取全局变量（P3）。
   * @param key 变量名
   * @returns 变量值，未设置时为 undefined
   */
  function getVar(key: string): unknown {
    return vars.value[key];
  }

  // P3：把页面事件与全局变量方法注册为公共方法（methodsMap），
  // 供「公共函数」类型动作选择与自定义脚本（setMethods 编译时快照 methodsMap）调用。
  // 注意：pluginManager.publicMethods 为模块级单例（多设计器实例共享，见
  // pluginManager.ts 文档化限制），多实例场景下后创建的 pageManager 覆盖前者。
  pluginManager.publicMethods.methodsMap.emitEvent = {
    description: '触发页面事件（emitEvent）',
    handler: (eventName: unknown, payload?: unknown) => {
      emitEvent(String(eventName), payload);
    },
    name: 'emitEvent',
  };
  pluginManager.publicMethods.methodsMap.onEvent = {
    description: '监听页面事件（onEvent）',
    handler: (eventName: unknown, handler: unknown) => {
      onEvent(String(eventName), handler as (payload: unknown) => void);
    },
    name: 'onEvent',
  };
  pluginManager.publicMethods.methodsMap.setVar = {
    description: '设置全局变量（setVar）',
    handler: (key: unknown, value: unknown) => {
      setVar(String(key), value);
    },
    name: 'setVar',
  };
  pluginManager.publicMethods.methodsMap.getVar = {
    description: '读取全局变量（getVar）',
    handler: (key: unknown) => getVar(String(key)),
    name: 'getVar',
  };

  // 监听自定义函数：收窄响应式追踪范围（性能文档 P-W7），
  // 原 watchEffect 会追踪 script 读取路径上的所有依赖，现改为仅在 pageSchema.script
  // 字段变化时重编译（immediate 保留初始化即编译的行为）
  watch(
    () => pageSchema.script,
    (script) => {
      if (script && script !== '') {
        setMethods(script, !isDesignMode.value);
      }
    },
    { immediate: true },
  );

  return {
    addComponentInstance,
    componentInstances,
    defaultComponentIds,
    doActions,
    emitEvent,
    find,
    findAll,
    findInstance,
    findInstanceAll,
    forms,
    funcs,
    // 兼容处理, 后续版本可能会移除
    getComponentInstance: find,
    getVar,
    hook,
    isDesignMode,
    mountMonitor,
    onEvent,
    pageSchema,
    removeComponentInstance,
    scriptError,
    setDefaultComponentIds,
    setDesignMode,
    setFormData,
    setMethods,
    setPageSchema,
    setVar,
    vars,
  };
}

export type PageManager = ReturnType<typeof createPageManager>;
