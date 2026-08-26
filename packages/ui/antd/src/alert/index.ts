import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./alert.vue'),
  config: {
    attribute: [
      {
        field: 'label',
        label: '标题',
        type: 'input',
      },
      {
        defaultValue: 'info',
        field: 'props.type',
        label: '类型',
        props: {
          allowClear: true,
          options: [
            {
              label: '成功',
              value: 'success',
            },
            {
              label: '信息',
              value: 'info',
            },
            {
              label: '警告',
              value: 'warning',
            },
            {
              label: '错误',
              value: 'error',
            },
          ],
        },
        type: 'select',
      },
      {
        field: 'props.message',
        label: '内容',
        type: 'input',
      },
      {
        field: 'props.description',
        label: '附加描述',
        type: 'input',
      },
      {
        field: 'props.showIcon',
        label: '显示图标',
        type: 'switch',
      },
      {
        field: 'props.closable',
        label: '可关闭',
        type: 'switch',
      },
      {
        field: 'props.banner',
        label: '顶部通栏样式',
        type: 'switch',
      },
      {
        field: 'props.hidden',
        label: '隐藏',
        type: 'switch',
      },
    ],
    event: [
      {
        description: '关闭提示时',
        type: 'close',
      },
    ],
  },
  defaultSchema: {
    field: 'alert',
    input: false,
    label: '警告提示',
    props: {
      message: '警告提示',
      type: 'info',
    },
    type: 'alert',
  },
  groupName: '反馈',
  icon: 'icon--aigen--alert-circle-outline-rounded',
  sort: 1000,
} as ComponentConfigModel;
