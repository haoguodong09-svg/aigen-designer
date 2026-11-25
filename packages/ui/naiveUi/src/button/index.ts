import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./button'),
  config: {
    attribute: [
      {
        description: '按钮上显示的文字内容',
        field: 'label',
        group: '基础信息',
        label: '标题',
        type: 'input',
      },
      {
        description: '设置按钮的视觉语义类型（默认、次要、主色、状态色等）',
        field: 'props.type',
        group: '基础信息',
        label: '类型',
        props: {
          options: [
            {
              label: 'default',
              value: 'default',
            },
            {
              label: 'tertiary',
              value: 'tertiary',
            },
            {
              label: 'primary',
              value: 'primary',
            },
            {
              label: 'success',
              value: 'success',
            },
            {
              label: 'info',
              value: 'info',
            },
            {
              label: 'warning',
              value: 'warning',
            },
            {
              label: 'error',
              value: 'error',
            },
          ],
        },
        type: 'select',
      },
      {
        defaultValue: 'default',
        description: '设置按钮的尺寸大小（极小、小、中、大）',
        field: 'props.size',
        group: '外观与布局',
        label: '尺寸',
        props: {
          clearable: true,
          options: [
            {
              label: 'tiny',
              value: 'tiny',
            },
            {
              label: '大号',
              value: 'large',
            },
            {
              label: '中等',
              value: 'medium',
            },
            {
              label: '小型',
              value: 'small',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '开启后按钮宽度占满父容器（display: block）',
        field: 'props.block',
        group: '外观与布局',
        label: '是否块级',
        type: 'switch',
      },
      {
        description: '是否显示按钮的外围边框线',
        field: 'props.bordered',
        group: '外观与布局',
        label: '显示边框',
        type: 'switch',
      },
      {
        description: '是否将按钮边框渲染为虚线样式',
        field: 'props.dashed',
        group: '外观与布局',
        label: '虚线框',
        type: 'switch',
      },
      {
        description: '开启后将按钮两侧边角设置为胶囊圆角样式',
        field: 'props.round',
        group: '外观与布局',
        label: '圆角按钮',
        type: 'switch',
      },
      {
        description: '开启后将按钮渲染为正圆形，适合纯图标按钮',
        field: 'props.circle',
        group: '外观与布局',
        label: '圆形按钮',
        type: 'switch',
      },
      {
        description: '自定义按钮的主色调（会覆盖预设类型的颜色）',
        field: 'props.color',
        group: '外观与布局',
        label: '按钮颜色',
        type: 'color-picker',
      },
      {
        description: '开启后按钮背景保持透明，仅显示边框与文字颜色',
        field: 'props.ghost',
        group: '外观与布局',
        label: '是否透明',
        type: 'switch',
      },
      {
        description: '是否禁用按钮，禁用后不可点击',
        field: 'props.disabled',
        group: '校验与限制',
        label: '禁用',
        type: 'switch',
      },
      {
        description: '是否在页面渲染时隐藏该按钮',
        field: 'props.hidden',
        group: '校验与限制',
        label: '隐藏',
        type: 'switch',
      },
    ],
    event: [
      {
        description: '点击按钮时',
        type: 'click',
      },
      {
        description: '双击按钮时',
        type: 'dblclick',
      },
    ],
    slots: {
      icon: {
        label: '图标插槽',
      },
    },
  },
  defaultSchema: {
    field: 'input',
    input: false,
    label: '按钮',
    props: {
      bordered: true,
      size: 'medium',
      type: 'default',
    },
    type: 'button',
  },
  editConstraints: {
    inline: true,
  },
  groupName: '表单',
  icon: 'icon--aigen--fit-screen-rounded',
  sort: 1200,
} as ComponentConfigModel;
