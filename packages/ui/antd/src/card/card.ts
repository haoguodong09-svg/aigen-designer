import type { ComponentSchema } from '@aigen-designer/types';

import type { PropType, Slots } from 'vue';

import { defineComponent, h, renderSlot } from 'vue';

import { Card } from 'ant-design-vue';

function forwardNamedSlots(
  slots: Slots,
  componentSchema: ComponentSchema | undefined,
  slotNames: string[],
) {
  const forwarded: Record<string, () => ReturnType<typeof renderSlot>> = {};
  for (const slotName of slotNames) {
    const slotSchemas = componentSchema?.slots?.[slotName];
    if (slots[slotName] || slotSchemas) {
      forwarded[slotName] = () =>
        renderSlot(slots, slotName, {}, () =>
          (slotSchemas ?? []).map((subcomponentSchema) =>
            renderSlot(slots, 'node', {
              componentSchema: subcomponentSchema,
            }),
          ),
        );
    }
  }
  return forwarded;
}

export default defineComponent({
  props: {
    componentSchema: {
      default: () => ({}),
      require: true,
      type: Object as PropType<ComponentSchema>,
    },
  },
  setup(props, { slots }) {
    return () => {
      const componentSchema = {
        ...props.componentSchema,
        title: props.componentSchema?.label ?? '',
      } as Record<string, any>;
      const children = componentSchema.children ?? [];
      delete componentSchema.children;
      delete componentSchema.slots;

      return h(Card, componentSchema, {
        default: () =>
          renderSlot(slots, 'edit-node', {}, () =>
            children.map((subcomponentSchema: ComponentSchema) =>
              renderSlot(slots, 'node', {
                componentSchema: subcomponentSchema,
              }),
            ),
          ),
        ...forwardNamedSlots(slots, props.componentSchema, ['title', 'extra']),
      });
    };
  },
});
