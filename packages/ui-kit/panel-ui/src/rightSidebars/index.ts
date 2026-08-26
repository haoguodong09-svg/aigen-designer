import type { PluginManager } from '@aigen-designer/manager';

/**
 * 初始化右侧边栏，向插件管理器注册右侧边栏项。
 *
 * @param {PluginManager} pluginManager - 插件管理器实例，用于注册右侧边栏项。
 * @returns {void}
 */
export function setupRightSidebar(pluginManager: PluginManager): void {
  pluginManager.panel.registerRightSidebar({
    component: async () => await import('./attribute/attribute.vue'),
    id: 'attribute_view',
    sort: 100,
    title: '属性',
  });

  pluginManager.panel.registerRightSidebar({
    component: async () => await import('./style/style.vue'),
    id: 'style_view',
    sort: 200,
    title: '样式',
  });
  // 方案C-E1：原 link_view（关联与计算）右侧页签已移除——字段联动与事件总线并入「行为」面板
  // 内部页签（event.vue），计算字段由 E2 迁往元素属性面板；右侧页签仅剩 属性 / 样式 / 行为。
  pluginManager.panel.registerRightSidebar({
    component: async () => await import('./event/event.vue'),
    id: 'event_view',
    sort: 300,
    title: '行为',
  });
}
