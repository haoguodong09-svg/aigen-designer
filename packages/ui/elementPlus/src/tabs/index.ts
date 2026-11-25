import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./tabs'),
  config: {
    action: [],
    attribute: [
      {
        description: '设置页签导航栏在容器中的停靠方位',
        field: 'props.tabPosition',
        group: '外观与布局',
        label: '页签位置',
        props: {
          allowClear: true,
          options: [
            {
              label: 'top',
              value: 'top',
            },
            {
              label: 'right',
              value: 'right',
            },
            {
              label: 'bottom',
              value: 'bottom',
            },
            {
              label: 'left',
              value: 'left',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '设置标签页的视觉风格（默认、卡片或带边框卡片）',
        field: 'props.type',
        group: '基础信息',
        label: '类型',
        props: {
          allowClear: true,
          options: [
            {
              label: '默认',
              value: '',
            },
            {
              label: '卡片',
              value: 'card',
            },
            {
              label: '边框',
              value: 'border-card',
            },
          ],
          radioButton: true,
        },
        type: 'radio',
      },
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
    label: '标签页',
    props: {
      defaultValue: '标签1',
      type: '',
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
