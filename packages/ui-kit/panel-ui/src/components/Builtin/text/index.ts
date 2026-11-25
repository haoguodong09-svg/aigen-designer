import type { ComponentConfigModel } from '@aigen-designer/types';

import { createSelectOptions } from '../shared';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        field: 'props.text',
        label: '文本内容',
        type: 'input',
      },
      {
        field: 'props.fontSize',
        label: '字体大小',
        type: 'input',
      },
      {
        field: 'props.fontWeight',
        label: '字重',
        props: {
          options: createSelectOptions(['400', '500', '600', '700']),
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        field: 'props.color',
        label: '文字颜色',
        props: {
          type: 'color',
        },
        type: 'color-picker',
      },
    ],
  },
  defaultSchema: {
    label: '文本',
    props: {
      fontSize: '14px',
      fontWeight: '400',
      text: '文本内容',
    },
    type: 'text',
  },
  editConstraints: {
    inline: true,
  },
  groupName: '基础元素',
  icon: 'icon--aigen--insert-text-outline-rounded',
  sort: 720,
} as ComponentConfigModel;
