import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  bindModel: 'formatted-value',
  component: () => import('./time-picker.vue'),
  config: {
    attribute: [
      {
        field: 'field',
        label: '数据字段',
        type: 'AigenField',
      },
      {
        field: 'label',
        label: '标题',
        type: 'input',
      },
      {
        field: 'props.defaultValue',
        label: '默认值',
        type: 'time',
      },
      {
        field: 'props.placeholder',
        label: '占位内容',
        type: 'input',
      },
      {
        field: 'props.format',
        label: '显示格式',
        type: 'input',
      },
      {
        field: 'props.valueFormat',
        label: '数据格式',
        type: 'input',
      },
      {
        field: 'props.size',
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
        changeSync: true,
        field: 'props.use12Hours',
        label: '12小时制',
        onChange({ value, values }: { value: any; values: any }) {
          values.props.defaultValue = null;
          if (value) {
            values.props.format = 'h:mm:ss a';
            values.props.valueFormat = 'h:mm:ss a';
          } else {
            values.props.format = 'HH:mm:ss';
            values.props.valueFormat = 'HH:mm:ss';
          }
        },
        type: 'switch',
      },
      {
        field: 'props.bordered',
        label: '无边框',
        props: {
          checkedValue: false,
          unCheckedValue: true,
        },
        type: 'switch',
      },
      {
        field: 'props.inputReadonly',
        label: '禁止键盘输入',
        type: 'switch',
      },
      {
        field: 'props.clearable',
        label: '可清空',
        type: 'switch',
      },
      {
        field: 'props.disabled',
        label: '禁用',
        type: 'switch',
      },
      {
        field: 'props.hidden',
        label: '隐藏',
        type: 'switch',
      },
      {
        description: '校验规则需要配合表单使用',
        field: 'rules',
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
    field: 'time',
    input: true,
    label: '时间选择器',
    props: {
      format: 'HH:mm:ss',
      placeholder: '请选择',
      valueFormat: 'HH:mm:ss',
    },
    type: 'time',
  },
  groupName: '表单',
  icon: 'icon--aigen--time-line',
  sort: 920,
} as ComponentConfigModel;
