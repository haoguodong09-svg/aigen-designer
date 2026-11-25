import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        field: 'props.text',
        label: '文本内容',
        type: 'input',
      },
    ],
  },
  defaultSchema: {
    label: '行内标签',
    props: {
      text: '行内内容',
    },
    type: 'span',
  },
  editConstraints: {
    inline: true,
  },
  groupName: '基础元素',
  icon: 'icon--aigen--border-color-outline-rounded',
  sort: 710,
} as ComponentConfigModel;
