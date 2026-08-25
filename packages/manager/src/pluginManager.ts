import type { Ref } from 'vue';

import { ref } from 'vue';

import {
  useComponentManager,
  useFormSchema,
  useGlobal,
  useHookManager,
  usePanel,
  usePublicMethods,
} from '@aigen-designer/hooks';

export interface PluginManager {
  component: ReturnType<typeof useComponentManager> & {
    add: ReturnType<typeof useComponentManager>['addComponent'];
    clearGroupNameMap: ReturnType<
      typeof useComponentManager
    >['clearComponentGroupNameMap'];
    get: ReturnType<typeof useComponentManager>['getComponent'];
    getConfigByType: ReturnType<
      typeof useComponentManager
    >['getComponentConfigByType'];
    hide: ReturnType<typeof useComponentManager>['hideComponent'];
    hideComponents: ReturnType<typeof useComponentManager>['setHideComponents'];
    register: ReturnType<typeof useComponentManager>['registerComponent'];
    remove: ReturnType<typeof useComponentManager>['removeComponent'];
    setComponentGroupNameMap: ReturnType<
      typeof useComponentManager
    >['setComponentGroupNameMap'];
    setGroupNameMap: ReturnType<
      typeof useComponentManager
    >['setComponentGroupNameMap'];
    show: ReturnType<typeof useComponentManager>['showComponent'];
  };
  designer: {
    formSchema: ReturnType<typeof useFormSchema>['formSchema'];
    initialized: Ref<boolean>;
    setFormSchema: ReturnType<typeof useFormSchema>['setFormSchema'];
    setInitialized: (value: boolean) => void;
  };
  global: ReturnType<typeof useGlobal>['global'];
  hook: ReturnType<typeof useHookManager>;
  panel: ReturnType<typeof usePanel>;
  publicMethods: ReturnType<typeof usePublicMethods> & {
    add: ReturnType<typeof usePublicMethods>['addPublicMethod'];
    remove: ReturnType<typeof usePublicMethods>['removePublicMethod'];
  };
}

// 插件管理器类
export function createPluginManager(): PluginManager {
  const { formSchema, setFormSchema } = useFormSchema();
  const {
    addBaseComponentType,
    addComponent,
    baseComponentTypes,
    clearComponentGroupNameMap,
    clearSortedGroups,
    componentConfigs,
    componentGroupNameMap,
    components,
    componentSchemaGroups,
    getComponent,
    getComponentConfigByType,
    getComponentConfigs,
    getComponents,
    getComponentSchemaGroups,
    getIcon,
    getLabel,
    getLocked,
    hiddenComponents,
    hideComponent,
    registerComponent,
    removeBaseComponents,
    removeComponent,
    setBaseComponentTypes,
    setComponentGroupNameMap,
    setHideComponents,
    setSortedGroups,
    showComponent,
    sortedGroups,
  } = useComponentManager();

  // 已初始化基础UI
  const initialized = ref(false);

  const {
    activityBars,
    hideActivitybar,
    hideRightSidebar,
    registerActivitybar,
    registerRightSidebar,
    rightSidebars,
    showActivitybar,
    showRightSidebar,
  } = usePanel();

  const { addPublicMethod, methodsMap, removePublicMethod } =
    usePublicMethods();

  // 全局状态管理
  const { global } = useGlobal({
    // 请求服务基础地址
    axiosConfig: {
      headers: {},
    },
    // 上传文件地址
    uploadFile: null,
    // 上传图片地址
    uploadImage: null,
  });

  const hook = useHookManager();

  /**
   * 设置initialized的状态。
   *
   * @param value 要设置的布尔值。
   */
  function setInitialized(value: boolean): void {
    initialized.value = value;
  }

  const groupedReturn = {
    component: {
      add: addComponent,
      addBaseComponentType,
      baseComponentTypes,
      clearComponentGroupNameMap,
      clearGroupNameMap: clearComponentGroupNameMap,
      clearSortedGroups,
      componentConfigs,
      componentGroupNameMap,
      components,
      componentSchemaGroups,
      get: getComponent,
      getComponent,
      getComponentConfigByType,
      getComponentConfigs,
      getComponents,
      getComponentSchemaGroups,
      getConfigByType: getComponentConfigByType,
      getIcon,
      getLabel,
      getLocked,
      hiddenComponents,
      hide: hideComponent,
      hideComponent,
      hideComponents: setHideComponents,
      register: registerComponent,
      registerComponent,
      remove: removeComponent,
      removeBaseComponents,
      removeComponent,
      setBaseComponentTypes,
      setComponentGroupNameMap,
      setGroupNameMap: setComponentGroupNameMap,
      setHideComponents,
      setSortedGroups,
      show: showComponent,
      showComponent,
      sortedGroups,
    },
    designer: {
      formSchema,
      initialized,
      setFormSchema,
      setInitialized,
    },
    global,
    hook,
    panel: {
      activityBars,
      hideActivitybar,
      hideRightSidebar,
      registerActivitybar,
      registerRightSidebar,
      rightSidebars,
      showActivitybar,
      showRightSidebar,
    },
    publicMethods: {
      add: addPublicMethod,
      addPublicMethod,
      methodsMap,
      remove: removePublicMethod,
      removePublicMethod,
    },
  };

  return createProxyWithWarnings(groupedReturn) as PluginManager;
}

function createProxyWithWarnings(groupedReturn: any) {
  const propertyGroupMap = createPropertyGroupMap(groupedReturn);
  const groupedReturnKeys = Object.keys(groupedReturn);
  const simplifiedFunctionMap: Record<string, string> = {
    addPublicMethod: 'add',
    clearComponentGroupNameMap: 'clearGroupNameMap',
    getComponent: 'get',
    getComponentConfigByType: 'getConfigByType',
    hideComponent: 'hide',
    registerComponent: 'register',
    removeComponent: 'remove',
    removePublicMethod: 'remove',
    setComponentGroupNameMap: 'setGroupNameMap',
    setHideComponents: 'hideComponents',
    showComponent: 'show',
  };
  return new Proxy(groupedReturn, {
    get(_target, prop) {
      // 检查是否是分组对象的直接访问（这是新API的正确用法）
      if (groupedReturnKeys.includes(prop as string)) {
        return groupedReturn[prop];
      }

      // 检查是否是旧API中存在的属性访问（需要警告）
      if (prop in propertyGroupMap) {
        const group = propertyGroupMap[prop as keyof typeof propertyGroupMap];
        const oldProp = prop;
        if (simplifiedFunctionMap[prop as string]) {
          prop = simplifiedFunctionMap[prop as string];
        }
        console.warn(
          `Aigen Designer: 检测到已过时的 API 使用方式, 请尽快迁移到新 API.\n` +
            `❌ 旧写法: pluginManager.${String(oldProp)}\n` +
            `✅ 新写法: pluginManager.${String(group)}.${String(prop)}`,
        );

        return groupedReturn[group][prop];
      }

      return groupedReturn[prop];
    },
  });
}

// 自动生成 propertyGroupMap
function createPropertyGroupMap<T extends Record<string, Record<string, any>>>(
  groupedReturn: T,
): Record<keyof T[keyof T], keyof T> {
  const propertyGroupMap: any = {};

  // 遍历 groupedReturn 的每个分组
  (Object.keys(groupedReturn) as Array<keyof T>).forEach((groupName) => {
    const group = groupedReturn[groupName];

    // 遍历分组中的每个属性
    Object.keys(group as object).forEach((propertyName) => {
      propertyGroupMap[propertyName] = groupName;
    });
  });

  return propertyGroupMap;
}

/**
 * 全局单例插件管理器（向后兼容保留，W6-6.6）
 * @description ⚠️ 已知限制：模块级单例意味着所有组件注册、designer.initialized、公共方法、
 * 全局状态等在模块加载时共享——同一页面挂载多个设计器实例时会互相干扰。
 * 多设计器/多实例隔离场景请使用 createPluginManager() 创建独立实例
 *（需各实例自行完成组件注册与初始化）。
 * 完整的实例隔离方案与 W5 协调分期落地，当前版本仅文档化该限制。
 */
export const pluginManager = createPluginManager();

// 向 utils 注册组件配置查询器（注入式，避免 utils → manager 模块级依赖形成
// Worker 依赖图循环；详见 utils/src/common/data.ts 的 setComponentConfigProvider 注释）。
// utils → component.ts → base-ui → … → manager 存在既有环状依赖：环内动态 import 可能
// 拿到求值中的部分命名空间（vite-node 实测），故用 setTimeout 延后 + 类型校验失败重试，
// 保证注册一定在 utils 模块求值完成后生效。
function registerComponentConfigProvider(): void {
  void import('@aigen-designer/utils')
    .then(({ setComponentConfigProvider }) => {
      if (typeof setComponentConfigProvider !== 'function') {
        // 部分命名空间：下一轮事件循环重试
        setTimeout(registerComponentConfigProvider, 0);
        return;
      }
      setComponentConfigProvider((type: string) =>
        pluginManager.component.getConfigByType(type),
      );
    })
    .catch(() => setTimeout(registerComponentConfigProvider, 0));
}
registerComponentConfigProvider();
