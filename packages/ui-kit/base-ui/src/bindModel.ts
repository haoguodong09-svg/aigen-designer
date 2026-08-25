import type { MaybeRefOrGetter } from 'vue';

import { computed, toValue } from 'vue';

import { pluginManager } from '@aigen-designer/manager';

/**
 * 获取组件的 v-model 绑定属性名（统一 v-model 属性解析）。
 *
 * 优先级：优先读取组件注册时的 bindModel 声明；
 * 未声明时按 UI 框架默认值映射（element-plus 等默认 modelValue，
 * antd/naive-ui 系列在组件配置中声明 bindModel='value'）。
 *
 * @param type 组件类型
 * @returns v-model 绑定属性名
 */
export function getBindModel(type: string): string {
  return (
    pluginManager.component.getConfigByType(type)?.bindModel ?? 'modelValue'
  );
}

/**
 * 组合式函数：根据组件类型解析 v-model 绑定属性名。
 * 在模板中使用 v-model:[bindModel] 完成动态绑定，避免硬编码 v-model:value。
 *
 * @param type 组件类型（支持 ref 或普通字符串）
 */
export function useBindModel(type: MaybeRefOrGetter<string>) {
  const bindModel = computed(() => getBindModel(toValue(type)));

  return {
    bindModel,
  };
}
