import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./form.vue'),
  config: {
    action: [
      {
        description: '获取表单数据',
        type: 'getData',
      },
      {
        description: '设置表单数据',
        type: 'setData',
      },
      {
        description: '校验表单',
        type: 'validate',
      },
    ],
    attribute: [
      {
        description: '表单在页面实例中的唯一名称标识',
        field: 'props.name',
        group: '基础信息',
        label: 'Name',
        type: 'input',
      },
      {
        description: '设置表单域标签相对于输入控件的位置和对齐方式',
        field: 'props.label-position',
        group: '外观与布局',
        label: '标签位置',
        props: {
          clearable: true,
          options: [
            {
              label: '左边',
              value: 'left',
            },
            {
              label: '右边',
              value: 'right',
            },
            {
              label: '顶部',
              value: 'top',
            },
          ],
          radioButton: true,
        },
        type: 'radio',
      },
      {
        description: '设置所有表单项标签区域的固定宽度',
        field: 'props.labelWidth',
        group: '外观与布局',
        label: '标签宽度',
        type: 'AigenInputSize',
      },
      {
        description: '统一附加在表单域标签文字末尾的后缀字符',
        field: 'props.labelSuffix',
        group: '外观与布局',
        label: '标签后缀',
        type: 'input',
      },

      {
        description: '统一设置表单内所有控件的尺寸大小',
        field: 'props.size',
        group: '外观与布局',
        label: '表单尺寸',
        props: {
          clearable: true,
          options: [
            {
              label: '大号',
              value: 'large',
            },
            {
              label: '中等',
              value: 'default',
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
        description: '控制必填字段红色星号显示在标签左侧还是右侧',
        field: 'props.require-asterisk-position',
        group: '校验与限制',
        label: '星号位置',
        props: {
          clearable: true,
          options: [
            {
              label: '左边',
              value: 'left',
            },
            {
              label: '右边',
              value: 'right',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '是否以行内形式紧贴控件展示校验错误提示信息',
        field: 'props.inline-message',
        group: '校验与限制',
        label: '行内展示校验信息',
        type: 'switch',
      },
      {
        description: '是否在输入框右侧显示校验结果的反馈状态图标',
        field: 'props.status-icon',
        group: '校验与限制',
        label: '校验反馈图标',
        type: 'switch',
      },
      {
        description: '提交校验失败时是否自动滚动到首个错误表单项',
        field: 'props.scroll-to-error',
        group: '校验与限制',
        label: '滚动校验错误处',
        type: 'switch',
      },
      {
        description: '开启后表单项将在同一行内横向排列显示',
        field: 'props.inline',
        group: '外观与布局',
        label: '行内模式',
        type: 'switch',
      },
      {
        description: '是否批量禁用表单内的所有输入组件',
        field: 'props.disabled',
        group: '校验与限制',
        label: '禁用',
        type: 'switch',
      },
      {
        description: '是否在页面渲染时隐藏整个表单',
        field: 'props.hidden',
        group: '校验与限制',
        label: '隐藏',
        type: 'switch',
      },
    ],
  },
  defaultSchema: {
    label: '表单',
    props: {
      'label-position': 'left',
      labelWidth: '100px',
      name: 'default',
    },
    type: 'form',
    children: [],
  },
  groupName: '表单',
  icon: 'icon--aigen--list-alt-outline-rounded',
  sort: 600,
} as ComponentConfigModel;
