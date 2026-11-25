import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./card'),
  config: {
    attribute: [
      {
        description: '卡片头部展示的标题文本',
        field: 'label',
        group: '基础信息',
        label: '标题',
        type: 'input',
      },
      {
        description: '设置卡片容器阴影的显示时机（始终、悬停或从不）',
        field: 'props.shadow',
        group: '外观与布局',
        label: '阴影时机',
        props: {
          clearable: true,
          options: [
            {
              label: 'always',
              value: 'always',
            },
            {
              label: 'hover',
              value: 'hover',
            },
            {
              label: 'never',
              value: 'never',
            },
          ],
        },
        type: 'select',
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
      footer: {
        description: '自定义卡片底部内容',
        label: '底部插槽',
      },
      header: {
        description: '自定义卡片头部内容',
        label: '标题插槽',
      },
    },
  },
  defaultSchema: {
    label: '卡片布局',
    props: {},
    type: 'card',
    children: [],
  },
  groupName: '布局',
  icon: 'icon--aigen--wysiwyg-rounded',
  sort: 700,
} as ComponentConfigModel;
