import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./divider.vue'),
  config: {
    attribute: [
      {
        field: 'label',
        label: '标题',
        type: 'input',
      },
      {
        defaultValue: 'horizontal',
        field: 'props.type',
        label: '方向',
        props: {
          allowClear: true,
          options: [
            {
              label: '水平',
              value: 'horizontal',
            },
            {
              label: '垂直',
              value: 'vertical',
            },
          ],
        },
        type: 'select',
      },
      {
        field: 'props.orientation',
        label: '内容位置',
        props: {
          allowClear: true,
          options: [
            {
              label: '居中',
              value: 'center',
            },
            {
              label: '靠左',
              value: 'left',
            },
            {
              label: '靠右',
              value: 'right',
            },
          ],
        },
        show: ({ values }) => values.props?.type !== 'vertical',
        type: 'select',
      },
      {
        field: 'props.orientationMargin',
        label: '标题偏移',
        show: ({ values }) =>
          values.props?.orientation === 'left' ||
          values.props?.orientation === 'right',
        type: 'input',
      },
      {
        field: 'props.dashed',
        label: '虚线',
        type: 'switch',
      },
      {
        field: 'props.plain',
        label: '文字样式',
        type: 'switch',
      },
      {
        field: 'props.hidden',
        label: '隐藏',
        type: 'switch',
      },
    ],
  },
  defaultSchema: {
    label: '分割线',
    props: {},
    type: 'divider',
  },
  groupName: '布局',
  icon: 'icon--aigen--minus-rounded',
  sort: 820,
} as ComponentConfigModel;
