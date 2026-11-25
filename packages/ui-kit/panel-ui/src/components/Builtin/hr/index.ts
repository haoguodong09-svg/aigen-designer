import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        bindable: false,
        description: '分隔线的线型样式',
        field: 'props.borderStyle',
        group: '外观与布局',
        label: '线条样式',
        props: {
          options: [
            { label: '实线 (solid)', value: 'solid' },
            { label: '虚线 (dashed)', value: 'dashed' },
            { label: '点线 (dotted)', value: 'dotted' },
          ],
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        description: '分隔线颜色',
        field: 'props.color',
        group: '外观与布局',
        label: '线条颜色',
        props: {
          type: 'color',
        },
        type: 'color-picker',
      },
      {
        description: '分隔线高度粗细（像素）',
        field: 'props.thickness',
        group: '外观与布局',
        label: '线条粗细',
        props: {
          max: 20,
          min: 1,
        },
        type: 'number',
      },
    ],
  },
  defaultSchema: {
    label: '分隔线',
    props: {
      borderStyle: 'solid',
      color: '#e2e8f0',
      thickness: 1,
    },
    type: 'hr',
  },
  groupName: '基础元素',
  icon: 'icon--aigen--minus-rounded',
  sort: 696,
} as ComponentConfigModel;
