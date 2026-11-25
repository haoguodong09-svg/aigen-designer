import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  bindModel: 'value',
  component: () => import('./select.vue'),
  config: {
    action: [
      {
        description: '使选择框获取焦点',
        type: 'focus',
      },
      {
        description: '使选择框失去焦点',
        type: 'blur',
      },
      {
        description: '清空当前选择',
        type: 'clear',
      },
      {
        description: '动态设置下拉选项列表',
        type: 'setOptions',
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
        description: '未选择任何选项时显示的提示文字',
        field: 'props.placeholder',
        group: '基础信息',
        label: '占位内容',
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
        description: '设置选择框的控件尺寸大小',
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
        description: '设置下拉菜单列表弹窗的最大高度（px）',
        field: 'props.listHeight',
        group: '外观与布局',
        label: '弹窗高度',
        type: 'number',
      },
      {
        description: '设置选择器的交互模式（多选、标签或组合框）',
        field: 'props.mode',
        group: '基础信息',
        label: '模式',
        props: {
          allowClear: true,
          options: [
            {
              label: 'multiple',
              value: 'multiple',
            },
            {
              label: 'tags',
              value: 'tags',
            },
            {
              label: 'combobox',
              value: 'combobox',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '是否允许在输入框中输入关键字过滤选项',
        field: 'props.showSearch',
        group: '校验与限制',
        label: '可搜索',
        type: 'switch',
      },
      {
        description: '多选模式下选中选项后是否自动清空搜索框',
        field: 'props.autoClearSearchValue',
        group: '校验与限制',
        label: '选中选项后清空搜索框',
        show: ({ values }) => values.props.mode && values.props.showSearch,
        type: 'switch',
      },
      {
        description: '多选模式下单个已选标签文本的最大显示字符数',
        field: 'props.maxTagTextLength',
        group: '校验与限制',
        label: '最大tag文本长度',
        show: ({ values }) => values.props.mode,
        type: 'number',
      },
      {
        description: '多选模式下最多同时显示的已选标签数量',
        field: 'props.maxTagCount',
        group: '校验与限制',
        label: '最大tag显示数',
        show: ({ values }) => values.props.mode,
        type: 'number',
      },
      {
        description: '控制下拉菜单相对于选择框的弹出方向',
        field: 'props.placement',
        group: '外观与布局',
        label: '弹出框位置',
        props: {
          allowClear: true,
          options: [
            {
              label: 'bottomLeft',
              value: 'bottomLeft',
            },
            {
              label: 'bottomRight',
              value: 'bottomRight',
            },
            {
              label: 'topLeft',
              value: 'topLeft',
            },
            {
              label: 'topRight',
              value: 'topRight',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '开启后隐藏选择框外边框',
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
        description: '是否显示一键清除已选内容的按钮',
        field: 'props.allowClear',
        group: '校验与限制',
        label: '可清空',
        type: 'switch',
      },
      {
        description: '开启后绑定值将以 { value, label } 对象形式返回',
        field: 'props.labelInValue',
        group: '校验与限制',
        label: 'labelInValue',
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
        description: '配置下拉选项的展示标签与对应值列表',
        field: 'props.options',
        group: '基础信息',
        label: '选项管理',
        layout: 'vertical',
        type: 'AigenOptionsEditor',
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
