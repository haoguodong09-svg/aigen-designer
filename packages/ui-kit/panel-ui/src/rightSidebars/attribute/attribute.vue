<script lang="ts" setup>
import type { ComponentSchema, SlotConfigModel } from '@aigen-designer/types';

import { computed, ref, watchEffect } from 'vue';

import { AigenIcon, useBindModel } from '@aigen-designer/base-ui';
import { useDesignerContext, useTableMeta } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { useClipboard } from '@vueuse/core';

import AttributeGroup from './modules/AttributeGroup.vue';
import AigenAttributeItem from './modules/attributeItem.vue';
import OtherAttrSection from './modules/OtherAttrSection.vue';

const designer = useDesignerContext();
const pageSchema = designer.pageSchema;
const searchKeyword = ref('');

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

/**
 * 按关键字过滤并按 group 分组归类（默认归入 '基础信息'）
 */
const groupedAttributes = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  const filtered = kw
    ? componentAttributes.value.filter((item) => {
        const label = (item.label ?? '').toLowerCase();
        const field = (item.field ?? '').toLowerCase();
        return label.includes(kw) || field.includes(kw);
      })
    : componentAttributes.value;

  const groupMap = new Map<string, ComponentSchema[]>();
  for (const item of filtered) {
    const groupTitle = item.group || '基础信息';
    const list = groupMap.get(groupTitle);
    if (list) {
      list.push(item);
    } else {
      groupMap.set(groupTitle, [item]);
    }
  }

  return Array.from(groupMap.entries()).map(([title, items]) => ({
    title,
    items,
  }));
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
    <!-- 顶部节点ID复制 + 快捷属性筛选 start -->
    <div
      class="aigen-attr-item mb-1 mt-2 flex h-8 cursor-pointer items-center px-3"
    >
      <div
        class="bg-$aigen-secondary rounded-1 h-full flex-1 px-2 leading-8"
        title="点击复制节点 ID"
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
    <div class="aigen-attr-search-bar">
      <AigenIcon
        name="icon--aigen--search-rounded"
        class="text-13px shrink-0 opacity-60"
      />
      <input
        v-model="searchKeyword"
        type="text"
        class="aigen-attr-search-input"
        placeholder="筛选属性名称或字段..."
      />
      <AigenIcon
        v-if="searchKeyword"
        name="icon--aigen--minus-rounded"
        class="aigen-attr-search-clear"
        title="清空筛选"
        @click="searchKeyword = ''"
      />
    </div>
    <!-- 顶部节点ID复制 + 快捷属性筛选 end -->
    <!-- 数据表 start -->
    <div
      v-if="tableMeta?.tableRemark && designer.state.selectedNode?.input"
      class="aigen-attr-item mb-2 flex h-8 cursor-pointer items-center px-3"
    >
      <div class="aigen-attr-label">数据表</div>
      <div class="bg-$aigen-secondary rounded-1 h-full flex-1 px-2 leading-8">
        {{ tableMeta.tableRemark }}
      </div>
    </div>
    <!-- 数据表 end -->
    <AttributeGroup
      v-for="grp in groupedAttributes"
      :key="grp.title"
      :title="grp.title"
      :count="grp.items.length"
    >
      <AigenAttributeItem
        v-for="item in grp.items"
        :key="item.field || item.label"
        :schema="item"
      />
    </AttributeGroup>
    <!-- 插槽信息 start -->
    <AttributeGroup
      v-if="hasSlotConfigs && !searchKeyword.trim()"
      title="插槽信息"
      :count="Object.keys(slotConfigs).length"
    >
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
    </AttributeGroup>
    <!-- 插槽信息 end -->
    <OtherAttrSection v-if="!searchKeyword.trim()" />
  </div>
</template>
