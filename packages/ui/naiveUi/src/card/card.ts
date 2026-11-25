import type { ComponentSchema } from '@aigen-designer/types';

import type { PropType, Slots } from 'vue';

import { defineComponent, h, renderSlot } from 'vue';

import { NCard } from 'naive-ui';

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
        title: props.componentSchema.label,
      } as ComponentSchema;
      const children = componentSchema.children ?? [];
      delete componentSchema.children;
      delete componentSchema.slots;

      return h(NCard, componentSchema, {
        default: () =>
          renderSlot(slots, 'edit-node', {}, () =>
            children.map((node: ComponentSchema) =>
              renderSlot(slots, 'node', { componentSchema: node }),
            ),
          ),
        ...forwardNamedSlots(slots, props.componentSchema, [
          'header',
          'header-extra',
        ]),
      });
    };
  },
});
