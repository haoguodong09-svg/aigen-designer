import type { ComponentConfigModel } from '@aigen-designer/types';

import { describe, expect, it } from 'vitest';

import { pluginManager } from '@aigen-designer/manager';

import { getBindModel, useBindModel } from '../bindModel';

describe('getBindModel（统一 v-model 属性解析）', () => {
  it('未注册的组件类型默认返回 modelValue', () => {
    expect(getBindModel('not-exist-type')).toBe('modelValue');
  });

  it('读取组件注册时声明的 bindModel（antd 系列为 value）', () => {
    const config = {
      bindModel: 'value',
      component: {},
      config: {
        attribute: [],
      },
      defaultSchema: {
        field: 'testInput',
        input: true,
        label: '测试输入框',
        type: 'testInput',
      },
      groupName: '表单',
    } as ComponentConfigModel;

    pluginManager.component.register(config);

    expect(getBindModel('testInput')).toBe('value');
  });

  it('未声明 bindModel 时按默认映射返回 modelValue（element-plus 语义）', () => {
    const config = {
      component: {},
      config: {
        attribute: [],
      },
      defaultSchema: {
        field: 'testSelect',
        label: '测试下拉',
        type: 'testSelect',
      },
      groupName: '表单',
    } as ComponentConfigModel;

    pluginManager.component.register(config);

    expect(getBindModel('testSelect')).toBe('modelValue');
  });
});

describe('useBindModel', () => {
  it('返回可响应组件类型的 bindModel 计算属性', () => {
    const { bindModel } = useBindModel('not-exist-type');
    expect(bindModel.value).toBe('modelValue');

    const { bindModel: bound } = useBindModel(() => 'testInput');
    expect(bound.value).toBe('value');
  });
});
