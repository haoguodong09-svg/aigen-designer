import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  bindModel: 'value',
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
        description: '设置输入框的控件尺寸大小',
        field: 'props.size',
        group: '外观与布局',
        label: '尺寸',
        props: {
          clearable: true,
          options: [
            {
              label: '极小',
              value: 'tiny',
            },
            {
              label: '小型',
              value: 'small',
            },
            {
              label: '中等',
              value: 'medium',
            },
            {
              label: '大号',
              value: 'large',
            },
          ],
        },
        type: 'select',
      },
      {
        defaultValue: 'text',
        description: '设置输入控件类型（单行文本、多行文本域或密码框）',
        field: 'props.type',
        group: '基础信息',
        label: '输入类型',
        onChange: ({ value, values }: { value: any; values: any }) => {
          if (value !== 'text') values.props.pair = false;
        },
        props: {
          clearable: true,
          options: [
            {
              label: 'text',
              value: 'text',
            },
            {
              label: 'textarea',
              value: 'textarea',
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
        description: '限制输入框允许输入的最大字符数量',
        field: 'props.maxlength',
        group: '校验与限制',
        label: '最大输入长度',
        type: 'number',
      },
      {
        description: '密码模式下触发明文显示的交互方式（点击或按下）',
        field: 'props.showPasswordOn',
        group: '校验与限制',
        label: '显示密码的时机',
        props: {
          clearable: true,
          options: [
            {
              label: 'click',
              value: 'click',
            },
            {
              label: 'mousedown',
              value: 'mousedown',
            },
          ],
        },
        show: ({ values }) => values.props.type === 'password',
        type: 'select',
      },
      {
        description: '多行文本域默认显示的行数',
        field: 'props.rows',
        group: '外观与布局',
        label: '行数',
        show: ({ values }) => values.props.type === 'textarea',
        type: 'number',
      },
      {
        description: '成对输入模式下两个输入框之间的分隔字符',
        field: 'props.separator',
        group: '外观与布局',
        label: '分割符',
        props: {
          placeholder: '请输入',
        },
        show: ({ values }) => values.props.type === 'text' && values.props.pair,
        type: 'input',
      },
      {
        description: '开启后输入框两侧呈现圆角胶囊外观',
        field: 'props.round',
        group: '外观与布局',
        label: '是否圆角',
        type: 'switch',
      },
      {
        description: '是否在输入框末尾显示当前已输入字数统计',
        field: 'props.showCount',
        group: '校验与限制',
        label: '是否统计字数',
        type: 'switch',
      },
      {
        description: '多行文本域是否根据输入内容自动调整高度',
        field: 'props.autosize',
        group: '外观与布局',
        label: '自适应内容高度',
        show: ({ values }) => values.props.type === 'textarea',
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
        description: '输入值',
        type: 'input',
      },
      {
        description: '值修改',
        type: 'change',
      },
      {
        description: '获取焦点',
        type: 'focus',
      },
      {
        description: '失去焦点',
        type: 'blur',
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
      defaultValue: '',
      placeholder: '请输入',
      type: 'text',
    },
    type: 'input',
  },
  groupName: '表单',
  icon: 'icon--aigen--border-color-outline-rounded',
  sort: 700,
} as ComponentConfigModel;
