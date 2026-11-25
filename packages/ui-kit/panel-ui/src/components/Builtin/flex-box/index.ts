import type { ComponentConfigModel } from '@aigen-designer/types';

import { createSelectOptions } from '../shared';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        description: '设置弹性容器子元素的排列主轴方向（水平或垂直）',
        field: 'props.flexDirection',
        group: '基础信息',
        label: '主轴方向',
        props: {
          options: createSelectOptions(['row', 'column']),
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        description: '控制子元素沿主轴方向的对齐和分布方式',
        field: 'props.justifyContent',
        group: '外观与布局',
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
        description: '控制子元素在交叉轴方向上的对齐方式',
        field: 'props.alignItems',
        group: '外观与布局',
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
        description: '设置主轴空间不足时子元素是否自动换行',
        field: 'props.flexWrap',
        group: '外观与布局',
        label: '换行方式',
        props: {
          options: createSelectOptions(['nowrap', 'wrap']),
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        description: '设置弹性子元素之间的行列间距（如 8px）',
        field: 'props.gap',
        group: '外观与布局',
        label: '间距',
        type: 'input',
      },
      {
        description: '设置弹性容器内部四周的内边距（如 8px 或 8px 16px）',
        field: 'props.padding',
        group: '外观与布局',
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
