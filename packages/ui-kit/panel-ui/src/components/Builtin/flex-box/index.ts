import type { ComponentConfigModel } from '@aigen-designer/types';

import { createSelectOptions } from '../shared';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        field: 'props.flexDirection',
        label: '主轴方向',
        props: {
          options: createSelectOptions(['row', 'column']),
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        field: 'props.justifyContent',
        label: '主轴对齐',
        props: {
          options: createSelectOptions([
            'flex-start',
            'center',
            'flex-end',
            'space-between',
            'space-around',
          ]),
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        field: 'props.alignItems',
        label: '交叉轴对齐',
        props: {
          options: createSelectOptions([
            'stretch',
            'flex-start',
            'center',
            'flex-end',
          ]),
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        field: 'props.flexWrap',
        label: '换行方式',
        props: {
          options: createSelectOptions(['nowrap', 'wrap']),
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        field: 'props.gap',
        label: '间距',
        type: 'input',
      },
      {
        field: 'props.padding',
        label: '内边距',
        type: 'input',
      },
    ],
  },
  defaultSchema: {
    label: '弹性容器',
    props: {
      alignItems: 'stretch',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: '8px',
      justifyContent: 'flex-start',
      padding: '8px',
    },
    type: 'flex-box',
    children: [],
  },
  groupName: '布局',
  icon: 'icon--aigen--auto-awesome-mosaic-outline',
  sort: 760,
} as ComponentConfigModel;
