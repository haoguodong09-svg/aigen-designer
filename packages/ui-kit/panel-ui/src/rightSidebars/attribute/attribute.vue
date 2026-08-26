<script lang="ts" setup>
import { computed, watchEffect } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import { useDesignerContext, useTableMeta } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { useClipboard } from '@vueuse/core';

import AigenAttributeItem from './modules/attributeItem.vue';
import ComputedFieldEditor from './modules/computedFieldEditor.vue';

const designer = useDesignerContext();
const pageSchema = designer.pageSchema;

const { copied, copy } = useClipboard();
watchEffect(() => {
  if (copied.value) {
    pluginManager.global.$message.success('节点ID复制成功');
  }
});

const componentConfigs = pluginManager.component.getComponentConfigs();
const selectedNode = computed(() => {
  return designer.state.selectedNode;
});

const tableMeta = useTableMeta(pluginManager);

// 获取组件属性配置
const componentAttributes = computed(() => {
  if (!selectedNode.value || !selectedNode.value.type) {
    return [];
  }

  const baseAttributes =
    componentConfigs[selectedNode.value.type]?.config?.attribute ?? [];
  const allAttributes = [...baseAttributes];

  if (selectedNode.value.id === pageSchema.schemas[0]?.id) {
    allAttributes.push(
      {
        editData: pageSchema,
        field: 'canvas.width',
        label: '画布宽度',
        type: 'AigenInputSize',
      },
      {
        editData: pageSchema,
        field: 'canvas.height',
        label: '画布高度',
        type: 'AigenInputSize',
      },
    );
  }

  return allAttributes;
});

/** 计算字段区块显示条件：输入型组件且配置了 field 时展示（非输入元素不显示） */
const showComputedSection = computed(() => {
  const node = selectedNode.value;
  return Boolean(node && node.input === true && node.field);
});
</script>
<template>
  <div :key="selectedNode?.id" class="aigen-attribute-view">
    <!-- 组件id展示 start -->
    <div
      class="aigen-attr-item mb-2 mt-2 flex h-8 cursor-pointer items-center px-4"
    >
      <div
        class="bg-$aigen-secondary rounded-1 h-full flex-1 px-2 leading-8"
        @click="copy(designer.state.selectedNode?.id ?? '')"
      >
        <AigenIcon
          class="aigen-component-icon translate-y-2px mr-1"
          :name="
            pluginManager.component.getIcon(designer.state.selectedNode!.type)
          "
        />
        {{ designer.state.selectedNode?.id }}
      </div>
    </div>
    <!-- 组件id展示 end -->
    <!-- 数据表 start -->
    <div
      v-if="tableMeta?.tableRemark && designer.state.selectedNode?.input"
      class="aigen-attr-item mb-2 flex h-8 cursor-pointer items-center px-4"
    >
      <div class="aigen-attr-label">数据表</div>
      <div class="bg-$aigen-secondary rounded-1 h-full flex-1 px-2 leading-8">
        {{ tableMeta.tableRemark }}
      </div>
    </div>
    <!-- 数据表 end -->
    <div v-for="item in componentAttributes" :key="item.field">
      <AigenAttributeItem :schema="item" />
    </div>
    <!-- 计算字段 start（方案C-E2：公式字段配置在字段属性里，仅输入型组件展示） -->
    <div
      v-if="showComputedSection"
      :key="`computed-${selectedNode?.id}`"
      class="aigen-attr-item mt-2 flex h-8 items-center px-4"
    >
      <div class="aigen-attr-label">计算字段</div>
    </div>
    <ComputedFieldEditor
      v-if="showComputedSection"
      :key="`computed-editor-${selectedNode?.id}`"
      :target-field="selectedNode?.field ?? ''"
    />
    <!-- 计算字段 end -->
  </div>
</template>
