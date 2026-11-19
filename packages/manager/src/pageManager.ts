import type {
  ActionsModel,
  AigenNodeInstance,
  ComponentSchema,
  PageSchema,
} from '@aigen-designer/types';

import { reactive, ref, shallowRef, watch } from 'vue';

import {
  createEventBus,
  useHookManager,
  useMountMonitor,
  usePageSchema,
} from '@aigen-designer/hooks';
import {
  adaptLegacySchema,
  findSchemas,
  FormulaEngine,
  getValueByPath,
  setValueByPath,
} from '@aigen-designer/utils';

import { ActionExecutionEngine } from './actionExecutionEngine';
import { pluginManager } from './pluginManager';
import { createReactiveEngine } from './reactiveRuleEngine';
import { createSafeComponentProxy } from './safeComponentProxy';

// ActionsModel 由 types 包定义（避免反向依赖），此处 re-export 保持 manager 的既有导出面
export type { ActionsModel } from '@aigen-designer/types';
export type ComponentInstances = Record<
  string,
  Record<string, AigenNodeInstance>
>;
export const DEFAULT_SCOPE = 'default';

export function createPageManager() {
  const pageManagerApi: any = {};
  const formulaEngine = new FormulaEngine();
  const componentInstances = ref<ComponentInstances>({});
  const funcs = ref<Record<string, Function>>({});
  // 当前模式 true 设计模式, false 渲染模式
  const isDesignMode = ref(false);
  // 画布交互模拟演练模式（在设计模式下亦可安全模拟事件响应与联动）
  const isInteractiveMode = ref(false);
  // script 错误状态
  const scriptError = ref<Error | null>(null);

  const defaultComponentIds = ref<string[]>([]);

  // 待决操作队列：组件未挂载时的操作暂存，挂载后重放
  const pendingOperations = ref<
    Record<
      string,
      Array<{ args: unknown[]; methodName: string; timestamp: number }>
    >
  >({});

  function enqueuePendingOperation(
    id: string,
    op: { args: unknown[]; methodName: string; timestamp: number },
  ) {
    if (!pendingOperations.value[id]) {
      pendingOperations.value[id] = [];
    }
    pendingOperations.value[id].push(op);
  }

  function replayPendingOperations(id: string, instance: AigenNodeInstance) {
    const queue = pendingOperations.value[id];
    if (queue && queue.length > 0 && instance.exposed) {
      while (queue.length > 0) {
        const op = queue.shift();
        if (!op) break;
        if (typeof instance.exposed[op.methodName] === 'function') {
          try {
            instance.exposed[op.methodName](...op.args);
          } catch (error) {
            console.error(
              `[Aigen Replay Error] Failed to replay ${op.methodName} on ${id}:`,
              error,
            );
          }
        }
      }
    }
  }

  // 性能文档 P-W7：forms 容器改用 shallowRef，避免容器被深度代理
  // （容器内每个表单数据仍通过 reactive() 保持响应式，见 setFormData）
  const forms = shallowRef<Record<string, unknown>>({});
  // 页面级表单数据：不属于任何 <form> 的元素（直接放在页面/布局容器中）共享此对象。
  // 修复：此前 useFormItem 在无 Form 上下文时回退为「每个节点各自 reactive({})」，
  // 导致字段联动条件 / 公式 $formData 读不到页面级字段，条件联动完全失效。
  const pageFormData = reactive<Record<string, unknown>>({});
  const mountMonitor = useMountMonitor();

  // 初始化
  const { pageSchema, setPageSchema: rawSetPageSchema } = usePageSchema();
  // 存量 Schema 零中断双轨兼容解析
  adaptLegacySchema(pageSchema);

  const hook = useHookManager();

  // P3 页面事件总线（页面级通道）：元素之间解耦通信（B4.4）。
  const pageEventBus = createEventBus('page');
  // P3 全局变量：公式 $vars 上下文与 setVar/getVar 的存储，初值取 pageSchema.vars
  const vars = ref<Record<string, unknown>>(pageSchema.vars ?? {});

  // 新一代响应式规则引擎（首屏即计算 + 条件反转自愈 + computed 脏检查）
  // 显式注入数据源：引擎创建早于 pageManagerApi 组装，若从 pageManager 读取属性会拿到 undefined，
  // 导致 watch 无法追踪表单数据变化（历史缺陷：条件联动/首屏联动不生效的根本原因）。
  const reactiveEngine = createReactiveEngine(pageSchema, pageManagerApi, {
    forms,
    formulaEngine,
    getFieldValue,
    getFormData,
    pageFormData,
    setFieldValue,
    vars,
  });

  function setPageSchema(schema: PageSchema) {
    adaptLegacySchema(schema);
    rawSetPageSchema(schema);
    reactiveEngine.evaluateAllRules();
  }

  /**
   * 查找组件的exposed属性（集成 SafeComponentProxy 生命周期安全代理）
   * @param queryValue - 要查找的查询值
   * @param queryField - 要查找的查询字段，默认为 "id"
   * @returns - 匹配组件的 SafeComponentProxy 代理或 null
   */
  function find(
    queryValue: string,
    queryField = 'id',
    scopeName = DEFAULT_SCOPE,
  ): AigenNodeInstance['exposed'] | any {
    if (queryField === 'id') {
      return createSafeComponentProxy({
        componentId: queryValue,
        pageManager: pageManagerApi,
        scopeName,
      });
    }

    const instance = findInstance(queryValue, queryField, scopeName);
    if (instance) {
      const matchingSchema = findSchemas(
        pageSchema.schemas,
        (schema) => getValueByPath(schema, queryField) === queryValue,
        true,
      ) as ComponentSchema | false;
      const compId =
        matchingSchema && matchingSchema.id ? matchingSchema.id : queryValue;
      return createSafeComponentProxy({
        componentId: compId,
        pageManager: pageManagerApi,
        scopeName,
      });
    }

    return null;
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
    replayPendingOperations(id, instance);
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

  const actionExecutionEngine = new ActionExecutionEngine({
    formulaEngine,
    funcs,
    getFormData: () => pageManagerApi.getFormData(),
    pageEventBus,
    pageManager: pageManagerApi,
    pluginManager,
    vars,
  });

  /**
   * 执行一组操作（支持原生异步 Promise 管道与活动调用栈防环）
   *
   * @param actions 操作数组
   * @param scopeName 作用域名称，默认值为 DEFAULT_SCOPE
   * @param args 其他参数
   */
  function doActions(
    actions: ActionsModel[],
    scopeName = DEFAULT_SCOPE,
    ...args: unknown[]
  ): Promise<any> {
    return actionExecutionEngine.executePipeline(
      actions,
      {},
      scopeName,
      ...args,
    );
  }

  /**
   * 设置设计模式的状态
   * @param isDesign 是否处于设计模式
   */
  function setDesignMode(isDesign: boolean = true): void {
    isDesignMode.value = isDesign;
  }

  function setInteractiveMode(interactive: boolean = true): void {
    isInteractiveMode.value = interactive;
  }

  function __DEBUG_PIPELINE__() {
    return {
      activeStack: (actionExecutionEngine as any).currentActiveStack,
      chainDepth: (actionExecutionEngine as any).currentChainDepth,
      pendingOperations: pendingOperations.value,
      reactiveState: reactiveEngine.reactiveStateMap,
    };
  }

  function __DUMP_DEPENDENCY_GRAPH__() {
    const rules = pageSchema.reactiveRules || [];
    return rules.map((r) => ({
      condition: r.condition,
      effects: Object.keys(r.effects),
      id: r.id,
      target: r.targetField,
    }));
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
   * 解析目标标识（组件 id 或 field）对应的表单字段名。
   * 联动的目标通常是组件 id，而表单数据按 field 存储，需要显式转换。
   * @param target 组件 id 或字段名
   * @returns 字段名；无匹配时原样返回
   */
  function resolveFieldName(target: string): string {
    if (!target) return target;
    const matched = findSchemas(
      pageSchema.schemas,
      (schema) => schema.id === target || schema.field === target,
      true,
    ) as ComponentSchema | false;
    if (matched && matched.field) return String(matched.field);
    return target;
  }

  /**
   * 获取指定作用域的表单数据对象（可写引用）。
   * 优先使用具名 form 的数据；无 form 时使用页面级共享数据。
   */
  function getScopeFormData(
    scopeName = DEFAULT_SCOPE,
  ): Record<string, unknown> {
    return (forms.value[scopeName] as Record<string, unknown>) ?? pageFormData;
  }

  /**
   * 获取合并后的表单数据快照（页面级字段 + 所有表单字段）。
   * 用于动作条件、公式 $formData 上下文与联动规则求值。
   * 注意：返回新对象，避免引擎/表达式意外改写内部响应式容器。
   */
  function getFormData(): Record<string, unknown> {
    const formNames = Object.keys(forms.value);
    if (formNames.length === 0) return pageFormData as Record<string, unknown>;
    if (formNames.length === 1) {
      return {
        ...pageFormData,
        ...(forms.value[formNames[0]] as Record<string, unknown>),
      };
    }
    return { ...pageFormData, ...forms.value };
  }

  /**
   * 读取字段值（支持传组件 id，自动解析为 field）
   */
  function getFieldValue(target: string, scopeName = DEFAULT_SCOPE): unknown {
    return getValueByPath(
      getScopeFormData(scopeName),
      resolveFieldName(target),
    );
  }

  /**
   * 写入字段值（支持传组件 id，自动解析为 field）
   */
  function setFieldValue(
    target: string,
    value: unknown,
    scopeName = DEFAULT_SCOPE,
  ): void {
    setValueByPath(
      getScopeFormData(scopeName),
      resolveFieldName(target),
      value,
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

  Object.assign(pageManagerApi, {
    __DEBUG_PIPELINE__,
    __DUMP_DEPENDENCY_GRAPH__,
    actionExecutionEngine,
    addComponentInstance,
    componentInstances,
    defaultComponentIds,
    doActions,
    emitEvent,
    enqueuePendingOperation,
    eventBus: pageEventBus,
    find,
    findAll,
    findInstance,
    findInstanceAll,
    forms,
    formulaEngine,
    funcs,
    // 兼容处理, 后续版本可能会移除
    getComponentInstance: find,
    getFieldValue,
    getFormData,
    getScopeFormData,
    getVar,
    hook,
    isDesignMode,
    isInteractiveMode,
    mountMonitor,
    onEvent,
    pageFormData,
    pageSchema,
    pendingOperations,
    reactiveEngine,
    reactiveStateMap: reactiveEngine.reactiveStateMap,
    removeComponentInstance,
    resolveFieldName,
    scriptError,
    setDefaultComponentIds,
    setDesignMode,
    setFieldValue,
    setFormData,
    setInteractiveMode,
    setMethods,
    setPageSchema,
    setVar,
    vars,
  });

  return pageManagerApi;
}

export type PageManager = ReturnType<typeof createPageManager>;
