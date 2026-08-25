import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./row'),
  config: {
    attribute: [
      {
        field: 'props.gutter',
        label: '栅格间距',
        type: 'number',
      },
      {
        field: 'children',
        label: '列编辑',
        layout: 'vertical',
        type: 'AigenColEditor',
      },
      {
        field: 'props.hidden',
        label: '隐藏',
        type: 'switch',
      },
    ],
  },
  defaultSchema: {
    label: '栅格布局',
    type: 'row',
    children: [
      {
        type: 'col',
        children: [],
        props: {
          span: 12,
        },
      },
      {
        type: 'col',
        children: [],
        props: {
          span: 12,
        },
      },
    ],
  },
  editConstraints: {
    childImmovable: true,
  },
  groupName: '布局',
  icon: 'icon--aigen--width-normal-outline',
  sort: 800,
} as ComponentConfigModel;
