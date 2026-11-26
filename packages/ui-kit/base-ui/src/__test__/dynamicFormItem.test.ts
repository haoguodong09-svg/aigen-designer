import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { describe, expect, it, vi } from 'vitest';

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

describe('dynamicFormItem 无壳直出渲染', () => {
  it('hasFormItem=false 分支：直接透出插槽真实 DOM，不包裹 .aigen-form-item-wrap', () => {
    const Host = defineComponent({
      setup() {
        return () =>
          h('div', { class: 'host-container' }, [
            h(
              DynamicFormItem,
              {
                checkPayload: null,
                formItemProps: { id: 'btn_1', type: 'button' },
                hasFormItem: false,
              },
              {
                default: () =>
                  h('button', { 'data-aigen-id': 'btn_1' }, '确定'),
              },
            ),
          ]);
      },
    });
    const wrapper = mount(Host);

    expect(wrapper.find('.aigen-form-item-wrap').exists()).toBe(false);
    const hostEl = wrapper.find('.host-container').element as HTMLElement;
    expect(hostEl.children.length).toBe(1);
    expect(hostEl.firstElementChild?.tagName).toBe('BUTTON');
    expect(hostEl.firstElementChild?.getAttribute('data-aigen-id')).toBe(
      'btn_1',
    );
  });

  it('hasFormItem=true 分支：直接以 FormItem 作为根节点并保留自定义宽度与 display', () => {
    const wrapper = mount(DynamicFormItem, {
      props: {
        checkPayload: null,
        formItemProps: {
          id: 'input_1',
          props: {},
          style: { display: 'inline-block', width: '200px' },
          type: 'input',
        } as any,
        hasFormItem: true,
      },
      slots: {
        default: () => h('input'),
      },
    });

    expect(wrapper.find('.aigen-form-item-wrap').exists()).toBe(false);
    const rootEl = wrapper.find('[data-aigen-id="input_1"]')
      .element as HTMLElement;
    expect(wrapper.element).toBe(rootEl);
    expect(rootEl.style.width).toBe('200px');
    expect(rootEl.style.display).toBe('inline-block');
  });
});
