import { mount } from '@vue/test-utils';
import { defineComponent, h, ref, vShow, withDirectives } from 'vue';

import { describe, expect, it, vi, beforeAll } from 'vitest';

// 依赖 mock：DynamicFormItem 需要 usePageManager 与 pluginManager
vi.mock('@aigen-designer/hooks', () => ({
  usePageManager: () => ({
    addComponentInstance: () => {},
    removeComponentInstance: () => {},
  }),
}));
vi.mock('@aigen-designer/manager', () => ({
  pluginManager: {
    component: {
      get: () => 'div',
    },
  },
}));

import DynamicFormItem from '../node/dynamicFormItem.vue';

describe('dynamicFormItem 根节点指令防御', () => {
  it('hasFormItem=false 分支：父级在组件上使用运行时指令时不应触发 "Runtime directive" 告警', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // 模拟设计器节点链：父组件对 DynamicFormItem 的 vnode 应用 v-show 运行时指令
    const show = ref(true);
    const Host = defineComponent({
      setup() {
        return () =>
          withDirectives(
            h(DynamicFormItem, {
              hasFormItem: false,
              formItemProps: { id: 'x', type: 'input' },
              checkPayload: null,
            }),
            [[vShow, show]],
          );
      },
    });

    const wrapper = mount(Host, { attachTo: document.body });
    // 切换 v-show 触发更新
    show.value = false;
    show.value = true;
    wrapper.unmount();

    const directiveWarns = warnSpy.mock.calls.filter((args) =>
      String(args[0]).includes('Runtime directive used on component'),
    );
    warnSpy.mockRestore();
    expect(directiveWarns).toEqual([]);
  });
});
