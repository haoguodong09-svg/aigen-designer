import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import { ElSelect } from 'element-plus';

import { describe, expect, it, vi, beforeAll } from 'vitest';

// jsdom 缺少 ResizeObserver，el-select 的 useCalcInputWidth 需要它
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeAll(() => {
  (globalThis as any).ResizeObserver = ResizeObserverMock;
});

// 注意：导入组件本身（select/select.ts），而不是目录 index（配置对象）
// wrapper 内的 element-plus 样式导入在 vitest 外部化下无法加载，mock 掉
vi.mock('element-plus/es/components/select/style/css', () => ({}));

import SelectWrapper from '../select/select';

describe('elementPlus select 适配层', () => {
  it('default slot 不应被 withCtx 包装（避免 ElSelect 兼容 watch 在渲染外调用 slot 触发告警）', async () => {
    const Host = defineComponent({
      setup() {
        const value = ref('a');
        return () =>
          h(SelectWrapper, {
            modelValue: value.value,
            'onUpdate:modelValue': (v: unknown) => {
              value.value = v as string;
            },
            options: [
              { label: 'A', value: 'a' },
              { label: 'B', value: 'b' },
            ],
          });
      },
    });

    const wrapper = mount(Host, { attachTo: document.body });
    await nextTick();

    // 找到真实 ElSelect 实例，检查其 default slot 的形态：
    // withCtx 包装的函数带有 _c 标记，在渲染外调用会触发
    // "Slot default invoked outside of the render function" 告警；
    // vnode 数组子节点产生的 slots.default 是普通函数（无 _c），不会告警。
    const elSelect = wrapper.findComponent(ElSelect);
    expect(elSelect.exists()).toBe(true);
    const slotFn = elSelect.vm.$slots.default as any;
    expect(typeof slotFn).toBe('function');
    expect(slotFn._c).toBeUndefined();

    // 渲染结果仍包含 ElOption
    expect(
      wrapper.findAllComponents({ name: 'ElOption' }).length,
    ).toBeGreaterThanOrEqual(2);

    wrapper.unmount();
    await nextTick();
  });
});
