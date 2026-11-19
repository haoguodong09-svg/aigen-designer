import { defineComponent, h, ref } from 'vue';

import { ElOption, ElSelect } from 'element-plus';

import 'element-plus/es/components/select/style/css';

// 二次封装组件
export default defineComponent({
  // 同时支持两种 v-model 协议：value 与 modelValue
  emits: ['update:modelValue', 'update:value'],
  setup(_, { attrs, emit, expose }) {
    const selectRef = ref();
    const dynamicOptions = ref<any[] | null>(null);

    function handleUpdate(e = null): void {
      emit('update:modelValue', e);
      emit('update:value', e);
    }

    expose({
      blur: () => selectRef.value?.blur?.(),
      clear: () => selectRef.value?.clear?.(),
      focus: () => selectRef.value?.focus?.(),
      getNativeRef: () => selectRef.value,
      setOptions: (opts: any[]) => {
        dynamicOptions.value = opts;
      },
    });

    return () => {
      const options = dynamicOptions.value ?? (attrs.options as any[]) ?? [];
      const props: Record<string, any> = {
        ...attrs,
        key: String(attrs.multiple),
        modelValue: attrs.modelValue ?? attrs.value,
        'onUpdate:modelValue': handleUpdate,
        placeholder: attrs.placeholder ?? '请选择',
        ref: selectRef,
      };

      return h(
        ElSelect,
        props,
        options.map((option: any) =>
          h(ElOption, { label: option.label, value: option.value }),
        ),
      );
    };
  },
});
