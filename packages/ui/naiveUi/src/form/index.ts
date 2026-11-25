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
        label: 'name',
        type: 'input',
      },
      {
        description: '选择标签宽度采用固定像素还是自适应比例布局',
        field: 'props.labelLayout',
        group: '外观与布局',
        label: '标签布局',
        props: {
          'option-type': 'button',
          options: [
            {
              label: '固定宽度',
              value: 'fixed',
            },
            {
              label: '自适应宽度',
              value: 'flex',
            },
          ],
        },
        type: 'radio',
      },
      {
        description: '固定布局模式下表单项标签的宽度',
        field: 'props.labelWidth',
        group: '外观与布局',
        label: '标签宽度',
        // 兼容旧 schema 未配置 labelLayout 的情况（默认按固定宽度处理）
        show: ({ values }) => values.props?.labelLayout !== 'flex',
        type: 'AigenInputSize',
      },
      {
        description: '控制表单项标签位于输入控件的左侧还是上方',
        field: 'props.labelPlacement',
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
              label: '顶部',
              value: 'top',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '控制表单项标签文字的水平对齐方式',
        field: 'props.labelAlign',
        group: '外观与布局',
        label: '标签对齐方式',
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
        description: '控制必填字段红色星号显示在标签左侧还是右侧',
        field: 'props.requireMarkPlacement',
        group: '校验与限制',
        label: '必填星号位置',
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
      hideRequiredMark: false,
      labelCol: {
        span: 5,
      },
      labelLayout: 'fixed',
      labelWidth: 100,
      name: 'default',
      wrapperCol: {
        span: 19,
      },
    },
    type: 'form',
    children: [],
  },
  groupName: '表单',
  icon: 'icon--aigen--list-alt-outline-rounded',
  sort: 600,
} as ComponentConfigModel;
