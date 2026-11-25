import type { ComponentConfigModel } from '@aigen-designer/types';

import { createSelectOptions } from '../shared';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        bindable: false,
        description: 'HTML 标题语义标签级别（h1 至 h6）',
        field: 'props.tag',
        group: '基础信息',
        label: '标题级别',
        props: {
          options: createSelectOptions(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        description: '标题展示的文本内容',
        field: 'props.text',
        group: '基础信息',
        label: '标题内容',
        type: 'input',
      },
    ],
  },
  defaultSchema: {
    label: '标题',
    props: {
      tag: 'h2',
      text: '标题文本',
    },
    type: 'heading',
  },
  groupName: '基础元素',
  icon: 'icon--aigen--insert-text-outline-rounded',
  sort: 698,
} as ComponentConfigModel;
