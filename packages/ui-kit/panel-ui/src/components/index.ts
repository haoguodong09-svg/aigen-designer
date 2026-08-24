import type { PluginManager } from '@aigen-designer/manager';

import { AigenNode } from '@aigen-designer/base-ui';

import AigenField from './AigenField';
import MonacoEditor from './MonacoEditor';
import Page from './Page';

/**
 * 初始化页面组件
 * @param pluginManager
 * @returns {void}
 */
export function setupPage(pluginManager: PluginManager): void {
  pluginManager.component.register(Page);
}

/**
 * 初始化属性设置组件
 * @param pluginManager
 * @returns {void}
 */
export function setupComponent(pluginManager: PluginManager): void {
  pluginManager.component.add(
    'EInputSize',
    async () => await import('./EInputSize/index.vue'),
  );
  pluginManager.component.add(
    'EColEditor',
    async () => await import('./EColEditor/index.vue'),
  );
  pluginManager.component.add(
    'EActionEditor',
    async () => await import('./EActionEditor/index.vue'),
  );
  pluginManager.component.add(
    'aigenActionModal',
    async () => await import('./aigenActionModal/index.vue'),
  );
  pluginManager.component.add(
    'ERuleEditor',
    async () => await import('./ERuleEditor/index.vue'),
  );
  pluginManager.component.add(
    'ETabPaneEditor',
    async () => await import('./ETabPaneEditor/index.vue'),
  );
  pluginManager.component.add(
    'EOptionsEditor',
    async () => await import('./EOptionsEditor/index.vue'),
  );

  pluginManager.component.add('AigenNode', AigenNode);

  const componentArray = [MonacoEditor, AigenField];

  setupPage(pluginManager);

  componentArray.forEach((item) => {
    pluginManager.component.register(item);
  });
}