import type {
  ComponentConfigModel,
  ComponentSchema,
} from '@aigen-designer/types';

import { describe, expect, it } from 'vitest';

// 先触发 @aigen-designer/manager 侧求值（hooks ↔ utils ↔ base-ui ↔ manager 存在
// 循环依赖，先导入 manager 可让循环按应用内的求值顺序完整走完，避免 useComponentManager 未定义）
import '@aigen-designer/manager';

import { useComponentManager } from '../plugin/useComponentManager';

const createConfig = (
  type: string,
  groupName = '表单',
  input = false,
): ComponentConfigModel => ({
  component: {},
  config: {
    action: [],
    attribute: [
      // 一个 props 属性，用于生成 setAttr 的参数选项
      {
        field: 'props.placeholder',
        label: '占位提示',
        type: 'input',
      } as ComponentSchema,
    ],
  },
  defaultSchema: {
    children: [],
    id: type,
    input,
    label: type,
    props: {},
    type,
  } as ComponentSchema,
  groupName,
  priority: 99,
  sort: 1000,
});

describe('useComponentManager', () => {
  it('批量注册组件后分组在微任务中统一刷新（修复 4.11 每次注册全量重算）', async () => {
    const manager = useComponentManager();

    // 同步连续注册多个组件：分组尚未重算（微任务尚未执行）
    manager.registerComponent(createConfig('input', '表单'));
    manager.registerComponent(createConfig('select', '表单'));
    manager.registerComponent(createConfig('card', '布局'));
    expect(manager.componentSchemaGroups.value).toHaveLength(0);

    // 微任务刷新后：一次重算完成，所有组件都进入分组
    await Promise.resolve();
    const groups = manager.componentSchemaGroups.value;
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.title)).toEqual(['表单', '布局']);
    expect(groups[0].list.map((i) => i.type)).toEqual(['input', 'select']);
    expect(groups[1].list.map((i) => i.type)).toEqual(['card']);
  });

  it('同一 type 重复注册不累积动作配置（修复 4.10 重复注册累积）', async () => {
    const manager = useComponentManager();
    const config = createConfig('input', '表单', true);

    manager.registerComponent(config);
    manager.registerComponent(config);

    const stored = manager.getComponentConfigByType('input');
    const actionTypes = stored.config.action!.map((a) => a.type);

    // 只保留一份 setValue/getValue/setAttr
    expect(actionTypes.filter((t) => t === 'setValue')).toHaveLength(1);
    expect(actionTypes.filter((t) => t === 'getValue')).toHaveLength(1);
    expect(actionTypes.filter((t) => t === 'setAttr')).toHaveLength(1);
  });

  it('重新注册同 type 会替换旧配置（先移除再注册）', async () => {
    const manager = useComponentManager();

    manager.registerComponent(createConfig('input', '表单'));
    manager.registerComponent(createConfig('input', '布局'));

    await Promise.resolve();
    const groups = manager.componentSchemaGroups.value;
    const inputGroup = groups.find((g) =>
      g.list.some((i) => i.type === 'input'),
    );
    // 旧分组（表单）中的 input 已被移除，只存在于新分组（布局）
    expect(
      groups.filter((g) => g.list.some((i) => i.type === 'input')),
    ).toHaveLength(1);
    expect(inputGroup?.title).toBe('布局');
  });

  it('hideComponent/showComponent/setHideComponents 后分组刷新', async () => {
    const manager = useComponentManager();

    manager.registerComponent(createConfig('input', '表单'));
    manager.registerComponent(createConfig('select', '表单'));
    await Promise.resolve();
    expect(manager.componentSchemaGroups.value[0].list).toHaveLength(2);

    manager.hideComponent('input');
    await Promise.resolve();
    expect(
      manager.componentSchemaGroups.value[0].list.map((i) => i.type),
    ).toEqual(['select']);

    manager.showComponent('input');
    await Promise.resolve();
    expect(manager.componentSchemaGroups.value[0].list).toHaveLength(2);

    manager.setHideComponents(['select']);
    await Promise.resolve();
    expect(
      manager.componentSchemaGroups.value[0].list.map((i) => i.type),
    ).toEqual(['input']);
  });

  it('removeComponent 清理记录并刷新分组（修复 4.10 优先级残留）', async () => {
    const manager = useComponentManager();

    manager.registerComponent(createConfig('input', '表单'));
    await Promise.resolve();
    expect(manager.componentSchemaGroups.value[0].list).toHaveLength(1);

    manager.removeComponent('input');
    await Promise.resolve();

    expect(manager.getComponentConfigByType('input')).toBeUndefined();
    expect(manager.getComponent('input')).toBeUndefined();
    // 重新注册同 type 时优先级不会残留
    manager.registerComponent(createConfig('input', '表单', true));
    expect(manager.getComponent('input')).toBeDefined();
  });
});
