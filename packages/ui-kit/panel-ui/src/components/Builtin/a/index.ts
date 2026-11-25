import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        description: '超链接展示的文本内容',
        field: 'props.text',
        group: '基础信息',
        label: '链接文本',
        type: 'input',
      },
      {
        description: '点击链接跳转的目标 URL 地址',
        field: 'props.href',
        group: '基础信息',
        label: '链接地址',
        type: 'input',
      },
      {
        bindable: false,
        description: '点击链接后打开目标页面的方式',
        field: 'props.target',
        group: '基础信息',
        label: '打开方式',
        props: {
          options: [
            { label: '当前页面 (_self)', value: '_self' },
            { label: '新窗口 (_blank)', value: '_blank' },
          ],
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        description: '是否始终显示链接下划线',
        field: 'props.underline',
        group: '外观与布局',
        label: '显示下划线',
        type: 'switch',
      },
    ],
    event: [
      {
        description: '点击链接时触发',
        type: 'click',
      },
    ],
  },
  defaultSchema: {
    label: '链接',
    props: {
      href: 'https://opentiny.design',
      target: '_blank',
      text: '超链接',
      underline: false,
    },
    type: 'a',
  },
  groupName: '基础元素',
  icon: 'icon--aigen--link-rounded',
  sort: 697,
} as ComponentConfigModel;
