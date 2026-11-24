import type { ComponentSchema } from '@aigen-designer/types';

import type { PropType } from 'vue';

import { computed, defineComponent, h, ref, renderSlot, watch } from 'vue';

import { Tabs } from 'ant-design-vue';

export default defineComponent({
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

    const componentSchema = computed(() => ({
      ...props.componentSchema?.props,
      activeKey: modelValue.value,
      'onUpdate:activeKey': (e: any) => {
        modelValue.value = e;
      },
    }));

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
      h(Tabs, componentSchema.value, {
        default: () => {
          const rawNodes = slots['edit-node']?.() ?? [];
          const schemaNodes = findSchemaNodes(rawNodes);
          // 设计区渲染
          if (schemaNodes.length) {
            return schemaNodes.map((item: any) => {
              item.props = item.props || {};
              item.props.key = item.props.schema.label ?? item.props.schema.id;
              item.props.tab = item.props.schema.label ?? item.props.schema.id;
              return item;
            });
          }

          // 直接渲染
          return children.map((componentSchema: any) =>
            renderSlot(slots, 'node', {
              componentSchema,
              key: componentSchema.label,
              tab: componentSchema.label,
            }),
          );
        },
      });
  },
});
