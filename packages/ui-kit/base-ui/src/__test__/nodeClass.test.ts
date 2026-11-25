import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createPageManager, pluginManager } from '@aigen-designer/manager';
import { PAGE_MANAGER_KEY } from '@aigen-designer/hooks';
import AigenNode from '../node/node.vue';

describe('AigenNode class merging', () => {
  it('preserves component root class when className is unset or set', async () => {
    const TestComp = defineComponent({
      setup() {
        return () => h('div', { class: 'aigen-row-preset-editor' }, 'test');
      },
    });
    pluginManager.component.add('test-preset', TestComp);

    const pageManager = createPageManager();
    const wrapper = mount(AigenNode, {
      props: {
        isProperty: true,
        componentSchema: {
          id: 'test_1',
          type: 'test-preset',
          props: {},
        },
      },
      global: {
        provide: {
          [PAGE_MANAGER_KEY as symbol]: pageManager,
        },
      },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(wrapper.find('.aigen-row-preset-editor').exists()).toBe(true);
  });

  it('merges custom className with component root class', async () => {
    const TestComp2 = defineComponent({
      setup() {
        return () => h('div', { class: 'ant-input' }, 'input');
      },
    });
    const direct = mount(TestComp2, { attrs: { class: ['my-custom-box'] } });
    console.log('DIRECT HTML:', direct.html());
    pluginManager.component.add('test-input-cls', TestComp2);

    const pageManager = createPageManager();
    const wrapper = mount(AigenNode, {
      props: {
        isProperty: true,
        componentSchema: {
          id: 'test_2',
          type: 'test-input-cls',
          props: {
            className: 'my-custom-box',
          },
        },
      },
      global: {
        provide: {
          [PAGE_MANAGER_KEY as symbol]: pageManager,
        },
      },
    });

    await new Promise((r) => setTimeout(r, 50));
    const el = wrapper.find('.ant-input');
    expect(el.exists()).toBe(true);
    expect(el.classes()).toContain('my-custom-box');
  });
});
