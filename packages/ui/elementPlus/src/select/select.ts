import { defineComponent, h } from 'vue';

import { ElOption, ElSelect } from 'element-plus';

import 'element-plus/es/components/select/style/css';

// 二次封装组件
export default defineComponent({
  emits: ['update:modelValue'],
  setup(_, { attrs, emit }) {
    function handleUpdate(e = null): void {
      emit('update:modelValue', e);
    }

    return () => {
      const props: Record<string, any> = {
        ...attrs,
        key: String(attrs.multiple),
        'onUpdate:modelValue': handleUpdate,
        placeholder: attrs.placeholder ?? '请选择',
      };

      // watch

      // 注意：options 必须作为 vnode 数组子节点传入，而不能用函数型 default slot。
      // element-plus 的 ElSelect 内部有一个 { immediate: true } 的兼容 watch，会在
      // 渲染函数之外直接调用 slots.default()（select2.mjs 的 manuallyRenderSlots 兼容逻辑），
      // 函数型 slot 经 Vue 的 withCtx 包装后，在渲染外调用会触发
      // "Slot \"default\" invoked outside of the render function" 告警
      // （EP 自带的告警抑制只覆盖 ElTreeSelect，普通 ElSelect 会漏出）。
      // vnode 数组子节点的 slots.default 是普通函数（无 withCtx 包装），调用不会告警，
      // 渲染结果与函数型 slot 完全一致。
      // 注意：options 必须作为 vnode 数组子节点传入，而不能用函数型 default slot。
      // element-plus 的 ElSelect 内部有一个 { immediate: true } 的兼容 watch，会在
      // 渲染函数之外直接调用 slots.default()（select2.mjs 的 manuallyRenderSlots 兼容逻辑），
      // 函数型 slot 经 Vue 的 withCtx 包装后，在渲染外调用会触发
      // "Slot \"default\" invoked outside of the render function" 告警
      // （EP 自带的告警抑制只覆盖 ElTreeSelect，普通 ElSelect 会漏出）。
      // vnode 数组子节点的 slots.default 是普通函数（无 withCtx 包装），调用不会告警，
      // 渲染结果与函数型 slot 完全一致。
      // 注意：options 必须作为 vnode 数组子节点传入，而不能用函数型 default slot。
      // element-plus 的 ElSelect 内部有一个 { immediate: true } 的兼容 watch，会在
      // 渲染函数之外直接调用 slots.default()（select2.mjs 的 manuallyRenderSlots 兼容逻辑），
      // 函数型 slot 经 Vue 的 withCtx 包装后，在渲染外调用会触发
      // "Slot \"default\" invoked outside of the render function" 告警
      // （EP 自带的告警抑制只覆盖 ElTreeSelect，普通 ElSelect 会漏出）。
      // vnode 数组子节点的 slots.default 是普通函数（无 withCtx 包装），调用不会告警，
      // 渲染结果与函数型 slot 完全一致。
      return h(
        ElSelect,
        props,
        (props.options ?? []).map((option: any) =>
          h(ElOption, { label: option.label, value: option.value }),
        ),
      );
    };
  },
});
