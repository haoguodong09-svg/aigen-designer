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
        description: '设置表单标签与输入控件的排列方式（水平、垂直或内联）',
        field: 'props.layout',
        group: '外观与布局',
        label: '表单布局',
        props: {
          allowClear: true,
          'option-type': 'button',
          options: [
            {
              label: '水平',
              value: 'horizontal',
            },
            {
              label: '垂直',
              value: 'vertical',
            },
            {
              label: '内联',
              value: 'inline',
            },
          ],
        },
        type: 'radio',
      },
      {
        description: '选择标签宽度采用固定像素还是栅格比例布局',
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
        show: ({ values }) => {
          return values.props?.labelLayout === 'fixed';
        },
        type: 'AigenInputSize',
      },
      {
        description: '自适应布局下标签区域所占栅格列数（共 24 格）',
        field: 'props.labelCol.span',
        group: '外观与布局',
        label: '标签占比',
        show: ({ values }) => {
          return values.props?.labelLayout === 'flex';
        },
        type: 'input',
      },
      {
        description: '自适应布局下输入控件区域所占栅格列数（共 24 格）',
        field: 'props.wrapperCol.span',
        group: '外观与布局',
        label: '控件占比',
        show: ({ values }) => {
          return values.props?.labelLayout === 'flex';
        },
        type: 'input',
      },
      {
        description: '控制表单项标签文字的水平对齐方向',
        field: 'props.labelAlign',
        group: '外观与布局',
        label: '标签对齐',
        props: {
          'option-type': 'button',
          options: [
            {
              label: '左',
              value: 'left',
            },
            {
              label: '右',
              value: 'right',
            },
          ],
        },
        type: 'radio',
      },
      {
        defaultValue: 'default',
        description: '统一设置表单内所有控件的尺寸大小',
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
        description: '开启后隐藏表单项标签末尾的冒号',
        field: 'props.colon',
        group: '外观与布局',
        label: '隐藏冒号',
        props: {
          checkedValue: false,
          unCheckedValue: true,
        },
        type: 'switch',
      },
      {
        description: '开启后隐藏必填字段旁的红色星号标记',
        field: 'props.hideRequiredMark',
        group: '校验与限制',
        label: '隐藏必须标志',
        type: 'switch',
      },

      {
        description: '标签文字过长时是否允许自动换行显示',
        field: 'props.labelWrap',
        group: '外观与布局',
        label: '标签文本换行',
        type: 'switch',
      },
      {
        description: '提交校验失败时是否自动滚动到第一个错误字段',
        field: 'props.scrollToFirstError',
        group: '校验与限制',
        label: '滚动校验错误处',
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
      labelCol: {
        span: 5,
      },
      labelLayout: 'fixed',
      labelWidth: '100px',
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
