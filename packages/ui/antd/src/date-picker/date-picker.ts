import { defineComponent, h, useAttrs, watch } from 'vue';

import { DatePicker } from 'ant-design-vue';
// 二次封装组件
export default defineComponent({
  emits: ['update:modelValue', 'change', 'blur'],
  // 手动处理 attrs 透传，避免事件重复绑定
  inheritAttrs: false,
  name: 'AigenDatePicker',
  props: {
    modelValue: {
      default: null,
      type: [String, Object, Array],
    },
    placeholder: {
      default: '请选择',
      // 范围选择时占位符为数组
      type: [String, Array],
    },
    type: {
      default: 'date',
      type: String,
    },
  },
  setup(props, { emit }) {
    const attrs = useAttrs();
    watch(
      () => props.type,
      () => {
        handleUpdate();
      },
    );

    /**
     * 统一日期值格式为字符串
     * 配置了 valueFormat 时，将 dayjs 值格式化为字符串，避免对象写入表单数据
     */
    function formatValue(e: any): any {
      const valueFormat = (attrs.valueFormat as string) ?? 'YYYY-MM-DD';
      if (Array.isArray(e)) {
        return e.map((item) => formatDate(item, valueFormat));
      }
      return formatDate(e, valueFormat);
    }

    function formatDate(item: any, valueFormat: string): any {
      return item && typeof item.format === 'function'
        ? item.format(valueFormat)
        : item;
    }

    function handleUpdate(e = null): void {
      // 未配置 valueFormat 时保持原值，保证 dayjs 值能正常回显
      const value = attrs.valueFormat ? formatValue(e) : e;
      emit('update:modelValue', value);
      emit('change', value);
      emit('blur', value);
    }
    return () => {
      let cmp: any = DatePicker;

      const compProps: Record<string, any> = {
        // 透传属性面板配置的其余 props（format/valueFormat/disabled 等）与事件
        ...attrs,
        'onUpdate:value': handleUpdate,
        picker: props.type.replace(/range$/, ''),
        placeholder: props.placeholder,
        value: props.modelValue,
      };
      // showTime 优先使用属性面板配置，未配置时按类型兜底
      if (!('showTime' in attrs)) {
        compProps.showTime = props.type.includes('time');
      }

      // 判断日期类型，渲染相应组件
      if (props.type.includes('range')) {
        cmp = DatePicker.RangePicker;
      }
      return h(cmp, compProps);
    };
  },
});
