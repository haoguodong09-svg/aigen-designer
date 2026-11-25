import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./card'),
  config: {
    attribute: [
      {
        description: '卡片顶部栏展示的标题文本',
        field: 'label',
        group: '基础信息',
        label: '标题',
        type: 'input',
      },
      {
        description: '设置卡片的内边距与标题区尺寸规格',
        field: 'props.size',
        group: '外观与布局',
        label: '尺寸',
        props: {
          allowClear: true,
          options: [
            {
              label: 'default',
              value: 'default',
            },
            {
              label: 'small',
              value: 'small',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '开启后隐藏卡片外围的边框线',
        field: 'props.bordered',
        group: '外观与布局',
        label: '无边框',
        props: {
          checkedValue: false,
          unCheckedValue: true,
        },
        type: 'switch',
      },
      {
        description: '鼠标移入卡片时是否浮起并显示阴影效果',
        field: 'props.hoverable',
        group: '外观与布局',
        label: '鼠标悬停阴影',
        type: 'switch',
      },
      {
        description: '是否展示骨架屏占位以表示内容正在加载',
        field: 'props.loading',
        group: '校验与限制',
        label: '加载状态',
        type: 'switch',
      },
      {
        description: '是否在页面渲染时隐藏该卡片',
        field: 'props.hidden',
        group: '校验与限制',
        label: '隐藏',
        type: 'switch',
      },
    ],
    slots: {
      extra: {
        description: '卡片右上角操作区域',
        label: '右上角操作区',
      },
      title: {
        description: '自定义卡片标题区',
        label: '标题插槽',
      },
    },
  },
  defaultSchema: {
    label: '卡片布局',
    type: 'card',
    children: [],
  },
  groupName: '布局',
  icon: 'icon--aigen--wysiwyg-rounded',
  sort: 700,
} as ComponentConfigModel;
