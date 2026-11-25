import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./select'),
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
        description: '是否开启多选模式，开启后绑定值为数组',
        field: 'props.multiple',
        group: '基础信息',
        label: '可多选',
        onChange: ({ value, values }: { value: any; values: any }) => {
          values.props.defaultValue = value ? [] : null;
        },
        type: 'switch',
      },
      {
        description: '多选模式下是否将已选标签折叠为数字徽标',
        field: 'props.collapseTags',
        group: '外观与布局',
        label: '多选隐藏',
        show: ({ values }) => {
          return values.props.multiple;
        },
        type: 'switch',
      },
      {
        description: '标签折叠时鼠标悬停是否通过 Tooltip 展示全部已选项',
        field: 'props.collapseTagsTooltip',
        group: '外观与布局',
        label: '隐藏提示',
        show: ({ values }) => {
          return values.props.multiple && values.props.collapseTags;
        },
        type: 'switch',
      },
      {
        description: '多选可筛选模式下选中一项后是否保留当前搜索关键词',
        field: 'props.reserveKeyword',
        group: '校验与限制',
        label: '保留搜索关键字',
        show: ({ values }) => {
          return values.props.multiple;
        },
        type: 'switch',
      },
      {
        defaultValue: 'info',
        description: '多选模式下已选标签的语义配色类型',
        field: 'props.tagType',
        group: '外观与布局',
        label: '标签类型',
        props: {
          options: [
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
              label: 'danger',
              value: 'danger',
            },
          ],
        },
        show: ({ values }) => {
          return values.props.multiple;
        },
        type: 'select',
      },
      {
        description: '多选模式下用户最多可选择的项目数量（0 表示不限制）',
        field: 'props.multipleLimit',
        group: '校验与限制',
        label: '多选限制',
        show: ({ values }) => {
          return values.props.multiple;
        },
        type: 'number',
      },
      {
        description: '折叠标签提示框或下拉浮层的主题色风格',
        field: 'props.effect',
        group: '外观与布局',
        label: '提示主题',
        props: {
          options: [
            {
              label: 'light',
              value: 'light',
            },
            {
              label: 'dark',
              value: 'dark',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '是否允许在输入框中输入关键字过滤下拉选项',
        field: 'props.filterable',
        group: '校验与限制',
        label: '可筛选',
        type: 'switch',
      },
      {
        description: '开启后允许用户输入并创建列表中不存在的新选项',
        field: 'props.allowCreate',
        group: '校验与限制',
        label: '允许创建条目',
        type: 'switch',
      },
      {
        defaultValue: 'bottom-start',
        description: '控制下拉菜单相对于选择框的弹出位置',
        field: 'props.placement',
        group: '外观与布局',
        label: '下拉框位置',
        props: {
          options: [
            {
              label: 'top',
              value: 'top',
            },
            {
              label: 'top-start',
              value: 'top-start',
            },
            {
              label: 'top-end',
              value: 'top-end',
            },
            {
              label: 'bottom',
              value: 'bottom',
            },
            {
              label: 'bottom-start',
              value: 'bottom-start',
            },
            {
              label: 'bottom-end',
              value: 'bottom-end',
            },
            {
              label: 'left',
              value: 'left',
            },
            {
              label: 'left-start',
              value: 'left-start',
            },
            {
              label: 'left-end',
              value: 'left-end',
            },
            {
              label: 'right',
              value: 'right',
            },
            {
              label: 'right-start',
              value: 'right-start',
            },
            {
              label: 'right-end',
              value: 'right-end',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '是否强制下拉框宽度与选择框输入区域宽度保持一致',
        field: 'props.fitInputWidth',
        group: '外观与布局',
        label: '下拉框宽度与输入框相同',
        type: 'switch',
      },
      {
        description: '下拉选项列表为空时展示的占位提示文案',
        field: 'props.noDataText',
        group: '校验与限制',
        label: '无数据时文本',
        type: 'input',
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
        description: '值变化时',
        type: 'change',
      },
    ],
  },
  defaultSchema: {
    field: 'select',
    input: true,
    label: '选择框',
    props: {
      effect: 'light',
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
      placement: 'bottom-start',
      size: 'default',
    },
    type: 'select',
  },
  groupName: '表单',
  icon: 'icon--aigen--select',
  sort: 900,
} as ComponentConfigModel;
