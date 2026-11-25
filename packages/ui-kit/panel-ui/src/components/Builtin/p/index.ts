import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        description: '段落中渲染展示的纯文本内容',
        field: 'props.text',
        group: '基础信息',
        label: '文本内容',
        type: 'textarea',
      },
    ],
  },
  defaultSchema: {
    label: '段落',
    props: {
      text: '这是一段文本内容',
    },
    type: 'p',
  },
  groupName: '基础元素',
  icon: 'icon--aigen--insert-text-outline-rounded',
  sort: 700,
} as ComponentConfigModel;
