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
        field: 'props.hidden',
        label: '隐藏',
        type: 'switch',
      },
    ],
    slots: {
      header: {
        description: '自定义卡片标题区',
        label: '标题插槽',
      },
      'header-extra': {
        description: '卡片头部右侧额外内容',
        label: '右上角操作区',
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
