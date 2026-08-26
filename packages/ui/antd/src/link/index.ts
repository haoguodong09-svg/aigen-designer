import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./link.vue'),
  config: {
    action: [
      {
        description: '点击链接时',
        type: 'click',
      },
    ],
    attribute: [
      {
        field: 'label',
        label: '显示文本',
        type: 'input',
      },
      {
        field: 'props.href',
        label: '链接地址',
        type: 'input',
      },
      {
        field: 'props.target',
        label: '打开方式',
        props: {
          allowClear: true,
          options: [
            {
              label: '当前页',
              value: '_self',
            },
            {
              label: '新标签页',
              value: '_blank',
            },
            {
              label: '父级窗口',
              value: '_parent',
            },
            {
              label: '顶层窗口',
              value: '_top',
            },
          ],
        },
        type: 'select',
      },
      {
        defaultValue: 'default',
        field: 'props.type',
        label: '类型',
        props: {
          allowClear: true,
          options: [
            {
              label: '默认',
              value: 'default',
            },
            {
              label: '主要',
              value: 'primary',
            },
            {
              label: '次要',
              value: 'secondary',
            },
          ],
        },
        type: 'select',
      },
      {
        field: 'props.disabled',
        label: '禁用',
        type: 'switch',
      },
      {
        field: 'props.underline',
        label: '显示下划线',
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
        description: '点击链接时',
        type: 'click',
      },
    ],
  },
  defaultSchema: {
    field: 'link',
    input: false,
    label: '链接',
    props: {
      href: '',
    },
    type: 'link',
  },
  groupName: '导航',
  icon: 'icon--aigen--link-rounded',
  sort: 1000,
} as ComponentConfigModel;
