import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./tag.vue'),
  config: {
    action: [
      {
        description: '关闭标签时',
        type: 'close',
      },
    ],
    attribute: [
      {
        field: 'label',
        label: '标签文本',
        type: 'input',
      },
      {
        field: 'props.color',
        label: '标签色',
        type: 'color-picker',
      },
      {
        field: 'props.bordered',
        label: '带边框',
        type: 'switch',
      },
      {
        field: 'props.closable',
        label: '可关闭',
        type: 'switch',
      },
      {
        field: 'props.round',
        label: '圆角',
        type: 'switch',
      },
      {
        field: 'props.icon',
        label: '图标',
        type: 'input',
      },
      {
        field: 'props.disabled',
        label: '禁用',
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
        description: '关闭标签时',
        type: 'close',
      },
    ],
  },
  defaultSchema: {
    field: 'tag',
    input: false,
    label: '标签',
    props: {},
    type: 'tag',
  },
  groupName: '数据展示',
  icon: 'icon--aigen--pricetag-outline-rounded',
  sort: 1000,
} as ComponentConfigModel;
