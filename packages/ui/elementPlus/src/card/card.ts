import type { ComponentSchema } from '@aigen-designer/types';

import type { PropType, Slots } from 'vue';

import { defineComponent, h, renderSlot } from 'vue';

import { ElCard } from 'element-plus';

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
      required: true,
      type: Object as PropType<ComponentSchema>,
    },
  },
  setup(props, { slots }) {
    return () => {
      const componentSchema = {
        ...props.componentSchema,
        header: props.componentSchema?.label ?? '',
      } as ComponentSchema;
      const children = componentSchema.children ?? [];
      delete componentSchema.children;
      delete componentSchema.slots;

      let vNodeClildren: any = null;
      vNodeClildren =
        children.length > 0
          ? () =>
              children.map((node: ComponentSchema) =>
                renderSlot(slots, 'node', { componentSchema: node }),
              )
          : () => [renderSlot(slots, 'default')];
      return h(ElCard, componentSchema, {
        default: () => renderSlot(slots, 'edit-node', {}, vNodeClildren),
        ...forwardNamedSlots(slots, props.componentSchema, [
          'header',
          'footer',
        ]),
      });
    };
  },
});
