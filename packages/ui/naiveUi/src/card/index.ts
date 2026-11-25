import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./card'),
  config: {
    attribute: [
      {
        description: '卡片顶部展示的标题文本',
        field: 'label',
        group: '基础信息',
        label: '标题',
        type: 'input',
      },
      {
        description: '是否在页面渲染时隐藏该卡片',
        field: 'props.hidden',
        group: '校验与限制',
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
