import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./card'),
  config: {
    attribute: [
      {
        field: 'label',
        label: '标题',
        type: 'input',
      },
      {
        field: 'props.size',
        label: '尺寸',
        props: {
          allowClear: true,
          options: [
            {
              label: 'default',
              value: 'default',
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
        field: 'props.bordered',
        label: '无边框',
        props: {
          checkedValue: false,
          unCheckedValue: true,
        },
        type: 'switch',
      },
      {
        field: 'props.hoverable',
        label: '鼠标悬停阴影',
        type: 'switch',
      },
      {
        field: 'props.loading',
        label: '加载状态',
        type: 'switch',
      },
      {
        field: 'props.hidden',
        label: '隐藏',
        type: 'switch',
      },
    ],
    slots: {
      extra: {
        description: '卡片右上角操作区域',
        label: '右上角操作区',
      },
      title: {
        description: '自定义卡片标题区',
        label: '标题插槽',
      },
    },
  },
  defaultSchema: {
    label: '卡片布局',
    type: 'card',
    children: [],
  },
  groupName: '布局',
  icon: 'icon--aigen--wysiwyg-rounded',
  sort: 700,
} as ComponentConfigModel;
