import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  bindModel: 'value',
  component: () => import('./tabs'),
  config: {
    action: [],
    attribute: [
      {
        description: '新增、删除、排序或编辑标签页的页签项',
        field: 'children',
        group: '基础信息',
        label: '页签管理',
        layout: 'vertical',
        type: 'AigenTabPaneEditor',
      },
      {
        description: '是否在页面渲染时隐藏整个标签页容器',
        field: 'props.hidden',
        group: '校验与限制',
        label: '隐藏',
        type: 'switch',
      },
    ],
    event: [
      {
        description: 'tab 被选中时触发',
        type: 'tabClick',
      },
      {
        description: 'activeName 改变时触发',
        type: 'tabChange',
      },
      {
        description: '点击 tab 新增按钮时触发',
        type: 'tabRemove',
      },
      {
        description: '点击 tab 新增按钮时触发',
        type: 'tabAdd',
      },
    ],
  },
  defaultSchema: {
    field: 'tabs',
    label: '标签页',
    props: {
      defaultValue: '标签1',
    },
    type: 'tabs',
    children: [
      {
        label: '标签1',
        type: 'tab-pane',
        children: [],
      },
      {
        label: '标签2',
        type: 'tab-pane',
        children: [],
      },
    ],
  },
  editConstraints: {
    childImmovable: true,
  },
  groupName: '布局',
  icon: 'icon--aigen--layout-tabs',
} as ComponentConfigModel;
