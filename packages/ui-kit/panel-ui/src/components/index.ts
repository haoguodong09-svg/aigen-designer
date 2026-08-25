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
    'AigenInputSize',
    async () => await import('./AigenInputSize/index.vue'),
  );
  pluginManager.component.add(
    'AigenColEditor',
    async () => await import('./AigenColEditor/index.vue'),
  );
  pluginManager.component.add(
    'AigenActionEditor',
    async () => await import('./AigenActionEditor/index.vue'),
  );
  pluginManager.component.add(
    'aigenActionModal',
    async () => await import('./aigenActionModal/index.vue'),
  );
  pluginManager.component.add(
    'AigenRuleEditor',
    async () => await import('./AigenRuleEditor/index.vue'),
  );
  pluginManager.component.add(
    'AigenTabPaneEditor',
    async () => await import('./AigenTabPaneEditor/index.vue'),
  );
  pluginManager.component.add(
    'AigenOptionsEditor',
    async () => await import('./AigenOptionsEditor/index.vue'),
  );

  pluginManager.component.add('AigenNode', AigenNode);

  const componentArray = [MonacoEditor, AigenField];

  setupPage(pluginManager);

  componentArray.forEach((item) => {
    pluginManager.component.register(item);
  });
}
