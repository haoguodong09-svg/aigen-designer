import type { ComponentSchema } from '@aigen-designer/types';

import type { PropType } from 'vue';

import { defineComponent, h, renderSlot } from 'vue';

import { NButton } from 'naive-ui';

// 二次封装组件
export default defineComponent({
  props: {
    componentSchema: {
      default: () => ({}),
      type: Object as PropType<ComponentSchema>,
    },
  },
  setup(props, { slots }) {
    return () => {
      const componentProps: Record<string, any> = {
        ...props.componentSchema?.props,
      };
      const iconSlotNodes = props.componentSchema?.slots?.icon;
      const hasIconSlot = Boolean(slots.icon || iconSlotNodes);

      return h(NButton, componentProps, {
        default: () =>
          renderSlot(slots, 'default', {}, () => [
            props.componentSchema?.label,
          ]),
        ...(hasIconSlot
          ? {
              icon: () =>
                renderSlot(slots, 'icon', {}, () =>
                  (iconSlotNodes ?? []).map((node) =>
                    renderSlot(slots, 'node', { componentSchema: node }),
                  ),
                ),
            }
          : {}),
      });
    };
  },
});
