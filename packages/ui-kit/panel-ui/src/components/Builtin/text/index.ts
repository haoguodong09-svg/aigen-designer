import type { ComponentConfigModel } from '@aigen-designer/types';

import { createSelectOptions } from '../shared';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        description: '文本组件显示的具体文字内容',
        field: 'props.text',
        group: '基础信息',
        label: '文本内容',
        type: 'input',
      },
      {
        description: '设置文本的字体大小（如 14px、1.2rem）',
        field: 'props.fontSize',
        group: '外观与布局',
        label: '字体大小',
        type: 'input',
      },
      {
        description: '设置文本的字体粗细程度（400 为常规，700 为加粗）',
        field: 'props.fontWeight',
        group: '外观与布局',
        label: '字重',
        props: {
          options: createSelectOptions(['400', '500', '600', '700']),
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        description: '设置文字的前景颜色值',
        field: 'props.color',
        group: '外观与布局',
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
