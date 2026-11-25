import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  bindModel: 'value',
  component: () => import('./select.vue'),
  config: {
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
        description: '选择器初始化时的默认选中值',
        field: 'props.defaultValue',
        group: '基础信息',
        label: '默认值',
        type: 'select',
      },
      {
        description: '未选择任何选项时显示的提示文字',
        field: 'props.placeholder',
        group: '基础信息',
        label: '占位内容',
        type: 'input',
      },
      {
        description: '设置选择框的控件尺寸大小',
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
        description: '控制下拉菜单相对于选择框的弹出位置',
        field: 'props.placement',
        group: '外观与布局',
        label: '菜单弹出的位置',
        props: {
          clearable: true,
          options: [
            {
              label: 'top-start',
              value: 'top-start',
            },
            {
              label: 'top',
              value: 'top',
            },
            {
              label: 'top-end',
              value: 'top-end',
            },
            {
              label: 'right-start',
              value: 'right-start',
            },
            {
              label: 'right',
              value: 'right',
            },
            {
              label: 'right-end',
              value: 'right-end',
            },
            {
              label: 'bottom-start',
              value: 'bottom-start',
            },
            {
              label: 'bottom',
              value: 'bottom',
            },
            {
              label: 'bottom-end',
              value: 'bottom-end',
            },
            {
              label: 'left-start',
              value: 'left-start',
            },
            {
              label: 'left',
              value: 'left',
            },
            {
              label: 'left-end',
              value: 'left-end',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '是否允许在输入框中输入关键字过滤下拉选项',
        field: 'props.filterable',
        group: '校验与限制',
        label: '可过滤',
        type: 'switch',
      },
      {
        description: '可过滤模式下是否允许用户输入并创建新的选项标签',
        field: 'props.tag',
        group: '校验与限制',
        label: '允许创建新选项',
        show: ({ values }) => values.props.filterable,
        type: 'switch',
      },
      {
        description: '是否开启多选模式，允许同时选择多个选项',
        field: 'props.multiple',
        group: '基础信息',
        label: '多选',
        type: 'switch',
      },
      {
        description: '多选模式下最多同时展示的已选标签数量',
        field: 'props.maxTagCount',
        group: '校验与限制',
        label: '最大tag数',
        show: ({ values }) => values.props.multiple,
        type: 'number',
      },
      {
        description: '是否显示一键清除已选内容的按钮',
        field: 'props.clearable',
        group: '校验与限制',
        label: '可清空',
        type: 'switch',
      },
      {
        description: '是否禁用选择框，禁用后不可选择',
        field: 'props.disabled',
        group: '校验与限制',
        label: '禁用',
        type: 'switch',
      },
      {
        description: '是否在页面渲染时隐藏该选择框',
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
      {
        bindable: false,
        description: '配置下拉选项的展示标签与对应值列表',
        field: 'props.options',
        group: '基础信息',
        label: '选项管理',
        layout: 'vertical',
        type: 'AigenOptionsEditor',
      },
    ],
    event: [
      {
        description: '值修改',
        type: 'change',
      },
    ],
  },
  defaultSchema: {
    field: 'select',
    input: true,
    label: '选择框',
    props: {
      options: [
        {
          label: '选项1',
          value: '选项1',
        },
        {
          label: '选项2',
          value: '选项2',
        },
      ],
      placeholder: '请选择',
    },
    type: 'select',
  },
  groupName: '表单',
  icon: 'icon--aigen--select',
  sort: 900,
} as ComponentConfigModel;
