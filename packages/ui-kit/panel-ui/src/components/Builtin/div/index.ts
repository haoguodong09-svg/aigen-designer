import type { ComponentConfigModel } from '@aigen-designer/types';

import { createSelectOptions } from '../shared';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        description: '指定容器渲染使用的语义化 HTML 块级标签',
        field: 'props.tag',
        group: '基础信息',
        label: 'HTML标签',
        props: {
          options: createSelectOptions([
            'div',
            'section',
            'header',
            'footer',
            'main',
            'article',
          ]),
          style: { width: '100%' },
        },
        type: 'select',
      },
    ],
  },
  defaultSchema: {
    label: '盒子容器',
    props: {
      tag: 'div',
    },
    type: 'div',
    children: [],
  },
  groupName: '布局',
  icon: 'icon--aigen--dialogs-outline-rounded',
  sort: 750,
} as ComponentConfigModel;
