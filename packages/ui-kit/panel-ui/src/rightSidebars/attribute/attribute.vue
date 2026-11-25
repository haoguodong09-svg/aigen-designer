<script lang="ts" setup>
import type { SlotConfigModel } from '@aigen-designer/types';

import { computed, watchEffect } from 'vue';

import { AigenIcon, useBindModel } from '@aigen-designer/base-ui';
import { useDesignerContext, useTableMeta } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { useClipboard } from '@vueuse/core';

import AigenAttributeItem from './modules/attributeItem.vue';

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

const Switch = pluginManager.component.get('switch');
const { bindModel: switchBindModel } = useBindModel('switch');
const switchUpdateEvent = computed(() => `update:${switchBindModel.value}`);

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

// 获取组件声明的具名插槽配置
const slotConfigs = computed<Record<string, SlotConfigModel>>(() => {
  if (!selectedNode.value || !selectedNode.value.type) {
    return {};
  }
  return componentConfigs[selectedNode.value.type]?.config?.slots ?? {};
});

const hasSlotConfigs = computed(
  () => Object.keys(slotConfigs.value).length > 0,
);

function isSlotEnabled(slotKey: string): boolean {
  const node = selectedNode.value;
  return Boolean(node?.slots && slotKey in node.slots);
}

/**
 * 切换具名插槽启用状态并记录撤销栈
 */
function handleToggleSlot(slotKey: string, enabled: boolean) {
  const node = selectedNode.value;
  if (!node) {
    return;
  }

  if (enabled) {
    if (!node.slots) {
      node.slots = {};
    }
    node.slots[slotKey] = [];
    designer.revoke.push('启用插槽', true);
    return;
  }

  if (node.slots) {
    delete node.slots[slotKey];
    if (Object.keys(node.slots).length === 0) {
      delete node.slots;
    }
  }
  designer.revoke.push('关闭插槽', true);
}

function handleCheckboxToggle(slotKey: string, event: Event) {
  const target = event.target as HTMLInputElement | null;
  handleToggleSlot(slotKey, Boolean(target?.checked));
}
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
    <!-- 插槽信息 start -->
    <div v-if="hasSlotConfigs" class="aigen-attr-slots">
      <div class="aigen-attr-slots-title">插槽信息</div>
      <div
        v-for="(slotConfig, slotKey) in slotConfigs"
        :key="slotKey"
        class="aigen-attr-item items-center"
      >
        <div class="aigen-attr-label" :title="slotConfig.description">
          {{ slotConfig.label }}
        </div>
        <div class="aigen-attr-input">
          <Switch
            v-if="Switch"
            :[switchBindModel]="isSlotEnabled(slotKey)"
            @[switchUpdateEvent]="
              (val: unknown) => handleToggleSlot(slotKey, Boolean(val))
            "
          />
          <input
            v-else
            type="checkbox"
            :checked="isSlotEnabled(slotKey)"
            @change="handleCheckboxToggle(slotKey, $event)"
          />
        </div>
      </div>
    </div>
    <!-- 插槽信息 end -->
  </div>
</template>
<style scoped lang="less">
.aigen-attr-slots {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--aigen-border);
}

.aigen-attr-slots-title {
  padding: 0 16px;
  margin-bottom: 8px;
  font-size: var(--aigen-text-sm);
  font-weight: 500;
  line-height: 24px;
  color: var(--aigen-text-secondary);
}
</style>
