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
  // 关联与计算面板（B4 / WP-B）：字段联动 / 计算字段 / 事件总线
  pluginManager.panel.registerRightSidebar({
    component: async () => await import('./link/link.vue'),
    id: 'link_view',
    sort: 250,
    title: '关联与计算',
  });
  pluginManager.panel.registerRightSidebar({
    component: async () => await import('./event/event.vue'),
    id: 'event_view',
    sort: 300,
    title: '行为',
  });
}
