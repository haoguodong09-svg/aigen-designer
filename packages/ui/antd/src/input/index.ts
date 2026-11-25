import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  bindModel: 'value',
  component: () => import('./input.vue'),
  config: {
    action: [
      {
        description: '使输入框获取焦点',
        type: 'focus',
      },
      {
        description: '使输入框失去焦点',
        type: 'blur',
      },
      {
        description: '选中输入框中的文字',
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
        description: '输入框为空时显示的提示文字',
        field: 'props.placeholder',
        group: '基础信息',
        label: '占位内容',
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
        description: '控制输入控件的原生输入类型（文本、数字或密码）',
        field: 'props.type',
        group: '基础信息',
        label: '输入类型',
        props: {
          allowClear: true,
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
        description: '设置输入框的控件尺寸大小',
        field: 'props.size',
        group: '外观与布局',
        label: '尺寸',
        props: {
          allowClear: true,
          options: [
            {
              label: '大号',
              value: 'large',
            },
            {
              label: '中等',
              value: 'middle',
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
        description: '开启后隐藏输入框外边框',
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
        description: '限制输入框允许输入的最大字符数量',
        field: 'props.maxlength',
        group: '校验与限制',
        label: '最大输入长度',
        type: 'number',
      },
      {
        description: '是否在输入框右侧显示当前字数统计',
        field: 'props.showCount',
        group: '校验与限制',
        label: '展示字数',
        type: 'switch',
      },
      {
        description: '是否显示一键清空输入内容的清除按钮',
        field: 'props.allowClear',
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
        description: '按下回车时',
        type: 'pressEnter',
      },
      {
        description: '获取焦点时',
        type: 'focus',
      },
      {
        description: '失去焦点时',
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
      placeholder: '请输入',
    },
    type: 'input',
  },
  groupName: '表单',
  icon: 'icon--aigen--border-color-outline-rounded',
  sort: 700,
} as ComponentConfigModel;
