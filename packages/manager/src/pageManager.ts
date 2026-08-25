import type {
  ActionsModel,
  AigenNodeInstance,
  ComponentSchema,
} from '@aigen-designer/types';

import { reactive, ref, shallowRef, watch } from 'vue';

import {
  useHookManager,
  useMountMonitor,
  usePageSchema,
} from '@aigen-designer/hooks';
import {
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
    if (exposed) {
      funcs.value = exposed;
    }
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
    // 检查是否提供了操作数组，如果没有提供，则发出警告并返回
    if (!actions || actions.length === 0) {
      console.warn('未提供任何动作');
      return;
    }

    // 遍历每个操作
    actions.forEach((action) => {
      // 动作级启停用：enabled === false 时跳过该动作，不中断整条动作链。
      // 缺省（undefined）视为启用，兼容旧数据（与 normalizeAction 的 enabled 缺省 true 语义一致）
      if (action.enabled === false) {
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
        methodArgs = args;
      }

      const formNames = Object.keys(forms.value);
      // 处理数据参数
      const context = {
        event: args,
        formData: (formNames.length === 1
          ? forms.value[formNames[0]]
          : forms.value) as Record<string, any>,
      };

      methodArgs = methodArgs.map((arg: any) => {
        // 如果是对象且标记为表达式，调用 jsep 计算
        if (arg && typeof arg === 'object' && arg.__isExpression__) {
          return formulaEngine.calculate(arg.content, context);
        }

        // 否则（字符串、数字等），直接返回原值（兼容旧数据）
        return arg;
      });
      // 根据操作的类型，调用不同的执行函数
      switch (action.type) {
        case 'component': {
          // 执行组件方法
          executeComponentMethod(action, scopeName, methodArgs);
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
    });
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
    find,
    findAll,
    findInstance,
    findInstanceAll,
    forms,
    funcs,
    // 兼容处理, 后续版本可能会移除
    getComponentInstance: find,
    hook,
    isDesignMode,
    mountMonitor,
    pageSchema,
    removeComponentInstance,
    scriptError,
    setDefaultComponentIds,
    setDesignMode,
    setFormData,
    setMethods,
    setPageSchema,
  };
}

export type PageManager = ReturnType<typeof createPageManager>;
