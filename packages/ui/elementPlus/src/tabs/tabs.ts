import type { ComponentSchema } from '@aigen-designer/types';

import type { PropType } from 'vue';

import { computed, defineComponent, h, ref, renderSlot, watch } from 'vue';

import { ElTabs } from 'element-plus';

export default defineComponent({
  inheritAttrs: false,
  props: {
    componentSchema: {
      default: () => ({}),
      require: true,
      type: Object as PropType<ComponentSchema>,
    },
  },
  setup(props, { slots }) {
    const modelValue = ref();
    watch(
      () => props.componentSchema.props.defaultValue,
      (newValue) => {
        const tabPaneLabels = props.componentSchema.children?.map(
          (node) => node.label,
        );
        modelValue.value = tabPaneLabels?.includes(newValue)
          ? newValue
          : tabPaneLabels?.[0];
      },
      {
        immediate: true,
      },
    );

    const componentSchema = computed(() => {
      return {
        ...props.componentSchema?.props,
        modelValue: modelValue.value,
        'onUpdate:modelValue': (e: any) => {
          modelValue.value = e;
        },
      };
    });

    const children = props.componentSchema?.children ?? [];

    function findSchemaNodes(nodes: any[]): any[] {
      const result: any[] = [];
      for (const node of nodes) {
        if (!node) continue;
        if (node.props?.schema) {
          result.push(node);
        } else if (Array.isArray(node.children)) {
          result.push(...findSchemaNodes(node.children));
        }
      }
      return result;
    }

    return () =>
      h(ElTabs, componentSchema.value, {
        default: () => {
          const rawNodes = slots['edit-node']?.() ?? [];
          const schemaNodes = findSchemaNodes(rawNodes);
          // 设计区渲染
          if (schemaNodes.length) {
            return schemaNodes.map((item: any) => {
              item.props = item.props || {};
              item.props.name = item.props.schema.label ?? item.props.schema.id;
              item.props.label =
                item.props.schema.label ?? item.props.schema.id;
              return item;
            });
          }
          return children.map((componentSchema: any) =>
            renderSlot(slots, 'node', {
              componentSchema,
              name: componentSchema.label,
            }),
          );
        },
      });
  },
});
