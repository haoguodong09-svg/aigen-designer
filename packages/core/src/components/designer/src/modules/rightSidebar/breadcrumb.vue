<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { AigenIcon } from '@aigen-designer/base-ui';
import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';

const designer = useDesignerContext();
/**
 * 选中点击节点元素
 * @param schema
 */
function handleSelect(schema: ComponentSchema) {
  designer.setSelectedNode(schema);
}
</script>
<template>
  <div class="aigen-breadcrumb h-40px flex items-center truncate py-2 pl-4">
    <span v-for="(item, index) in designer.state.matched" :key="index">
      <span
        v-if="index > designer.state.matched.length - 4"
        class="flex items-center"
      >
        <span
          v-if="
            designer.state.matched.length > 3 &&
            index === designer.state.matched.length - 3
          "
          >...
        </span>
        <AigenIcon
          v-if="index !== 0"
          class="m-1"
          name="icon--aigen--arrow-forward-ios-rounded"
        />
        <span
          class="node-item cursor-pointer"
          @click="handleSelect(item)"
          @mouseenter.stop="designer.setHoverNode(item)"
          @mouseleave.stop="designer.setHoverNode(null)"
        >
          {{
            item.label ??
            pluginManager.component.getConfigByType(item.type)?.defaultSchema
              .label
          }}
        </span>
      </span>
    </span>
  </div>
</template>