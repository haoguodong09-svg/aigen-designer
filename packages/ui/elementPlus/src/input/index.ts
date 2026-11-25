import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./input.vue'),
  config: {
    action: [
      {
        description: '使 input 获取焦点',
        type: 'focus',
      },
      {
        description: '使 input 失去焦点',
        type: 'blur',
      },
      {
        description: '清除 input 值',
        type: 'clear',
      },
      {
        description: '选中 input 中的文字',
        type: 'select',
      },
    ],
    attribute: [
      {
        bindable: false,
        description: '绑定表单数据的字段名标识',
        field: 'field',
        group: '基础信息',
        label: '数据字段',
        type: 'AigenField',
      },
      {
        description: '表单项左侧显示的标签文本',
        field: 'label',
        group: '基础信息',
        label: '标题',
        type: 'input',
      },
      {
        description: '输入框初始化时的默认内容',
        field: 'props.defaultValue',
        group: '基础信息',
        label: '默认值',
        type: 'input',
      },
      {
        description: '输入框为空时显示的提示文字',
        field: 'props.placeholder',
        group: '基础信息',
        label: '占位内容',
        type: 'input',
      },
      {
        defaultValue: 'default',
        description: '设置输入框的控件尺寸大小',
        field: 'props.size',
        group: '外观与布局',
        label: '尺寸',
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
        description: '限制输入框允许输入的最大字符数量',
        field: 'props.maxlength',
        group: '校验与限制',
        label: '最大输入长度',
        props: {
          min: 0,
        },
        type: 'number',
      },
      {
        description: '是否在输入框右侧展示输入字数与最大长度统计',
        field: 'props.showWordLimit',
        group: '校验与限制',
        label: '统计字数',
        show: ({ values }) => {
          return values.props.maxlength;
        },
        type: 'switch',
      },
      {
        defaultValue: 'text',
        description: '控制输入控件的原生输入类型（文本、数字或密码）',
        field: 'props.type',
        group: '基础信息',
        label: '输入类型',
        props: {
          clearable: true,
          options: [
            {
              label: 'text',
              value: 'text',
            },
            {
              label: 'number',
              value: 'number',
            },
            {
              label: 'password',
              value: 'password',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '密码模式下是否显示切换明文/密文的眼睛图标',
        field: 'props.showPassword',
        group: '校验与限制',
        label: '显示切换图标',
        show: ({ values }) => {
          return values.props.type === 'password';
        },
        type: 'switch',
      },
      {
        description: '是否将输入框设为只读，只读状态下不可修改内容',
        field: 'props.readonly',
        group: '校验与限制',
        label: '只读',
        type: 'switch',
      },
      {
        description: '是否显示一键清空输入内容的清除按钮',
        field: 'props.clearable',
        group: '校验与限制',
        label: '可清空',
        type: 'switch',
      },
      {
        description: '是否禁用输入框，禁用后不可编辑',
        field: 'props.disabled',
        group: '校验与限制',
        label: '禁用',
        type: 'switch',
      },
      {
        description: '是否在页面渲染时隐藏该输入框',
        field: 'props.hidden',
        group: '校验与限制',
        label: '隐藏',
        type: 'switch',
      },
      {
        bindable: false,
        description: '校验规则需要配合表单使用',
        field: 'rules',
        group: '校验与限制',
        label: '表单校验',
        layout: 'vertical',
        type: 'AigenRuleEditor',
      },
    ],
    event: [
      {
        description: '输入值时',
        type: 'input',
      },
      {
        description: '值修改时',
        type: 'change',
      },
      {
        description: '获取焦点时',
        type: 'focus',
      },
      {
        description: '失去焦点时',
        type: 'blur',
      },
      {
        description: '点击清空按钮时',
        type: 'clear',
      },
    ],
    slots: {
      prefix: {
        label: '前缀插槽',
      },
      suffix: {
        label: '后缀插槽',
      },
    },
  },
  defaultSchema: {
    field: 'input',
    input: true,
    label: '输入框',
    props: {
      placeholder: '请输入',
    },
    type: 'input',
  },
  groupName: '表单',
  icon: 'icon--aigen--border-color-outline-rounded',
  sort: 700,
} as ComponentConfigModel;
