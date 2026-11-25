import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./tabs'),
  config: {
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
        description: '切换页签时是否启用滑动过渡动画',
        field: 'props.animated',
        group: '外观与布局',
        label: '切换动画',
        type: 'switch',
      },
      {
        description: '相邻页签头部之间的间距大小（px）',
        field: 'props.tabBarGutter',
        group: '外观与布局',
        label: '标签间隙',
        type: 'number',
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
        description: '设置页签导航栏的尺寸大小',
        field: 'props.size',
        group: '外观与布局',
        label: '尺寸',
        props: {
          allowClear: true,
          options: [
            {
              label: 'large',
              value: 'large',
            },
            {
              label: 'middle',
              value: 'middle',
            },
            {
              label: 'small',
              value: 'small',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '是否在页面渲染时隐藏整个标签页容器',
        field: 'props.hidden',
        group: '校验与限制',
        label: '隐藏',
        type: 'switch',
      },
    ],
  },
  defaultSchema: {
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
