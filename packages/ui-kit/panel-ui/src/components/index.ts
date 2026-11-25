import type { PluginManager } from '@aigen-designer/manager';

import { AigenNode } from '@aigen-designer/base-ui';

import AigenField from './AigenField';
import BuiltinDiv from './Builtin/div';
import BuiltinFlexBox from './Builtin/flex-box';
import BuiltinIcon from './Builtin/icon';
import BuiltinImg from './Builtin/img';
import BuiltinP from './Builtin/p';
import BuiltinSlot from './Builtin/slot';
import BuiltinSpan from './Builtin/span';
import BuiltinText from './Builtin/text';
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
    'aigenActionDrawer',
    async () => await import('./AigenActionDrawer/index.vue'),
  );
  // 兼容旧宿主：旧 1200px 动作配置弹窗注册保持不动
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
  pluginManager.component.add(
    'AigenCodeModal',
    async () => await import('./AigenCodeModal/index.vue'),
  );
  pluginManager.component.add(
    'AigenIconPicker',
    async () => await import('./AigenIconPicker/index.vue'),
  );
  pluginManager.component.add(
    'AigenRowPresetEditor',
    async () => await import('./AigenRowPresetEditor/index.vue'),
  );

  pluginManager.component.add('AigenNode', AigenNode);

  const componentArray = [
    MonacoEditor,
    AigenField,
    BuiltinDiv,
    BuiltinFlexBox,
    BuiltinP,
    BuiltinSpan,
    BuiltinText,
    BuiltinImg,
    BuiltinIcon,
    BuiltinSlot,
  ];

  setupPage(pluginManager);

  componentArray.forEach((item) => {
    pluginManager.component.register(item);
  });
}
