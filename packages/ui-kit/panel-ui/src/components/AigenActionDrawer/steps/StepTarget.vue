<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, ref, watch } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { findSchemas } from '@aigen-designer/utils';

import { getComponentLabel } from '../helper';

/**
 * Step2 · 目标组件：可搜索下拉 + 当前画布选中组件快捷卡片。
 * 替代原来的整棵树：90% 的场景只需搜索/选择一次，不再逐层展开组件树。
 */
const props = defineProps<{
  componentId: null | string;
  componentSchema: ComponentSchema | null;
}>();

const emit = defineEmits<{
  (e: 'select', payload: { id: string; schema: ComponentSchema }): void;
}>();

const designer = useDesignerContext();
const { pageSchema } = designer;

const SelectComponent = pluginManager.component.get('select');

const allSchemas = computed(
  () =>
    findSchemas(pageSchema.schemas, (item) =>
      Boolean(item.id),
    ) as ComponentSchema[],
);

const targetOptions = computed(() =>
  allSchemas.value.map((item) => ({
    label: `${getTreeNodeLabel(item)}（${item.type} · ${item.id}）`,
    value: item.id as string,
  })),
);

const selectedId = ref<string>(props.componentId ?? '');

watch(
  () => props.componentId,
  (id) => {
    selectedId.value = id ?? '';
  },
  { immediate: true },
);

function handleSelectChange(value: string) {
  if (!value) return;
  const schema = allSchemas.value.find((item) => item.id === value);
  selectedId.value = value;
  if (schema) {
    emit('select', { id: value, schema });
  }
}

/** 节点展示名：label ?? 类型默认 label ?? '未命名组件' */
function getTreeNodeLabel(schema: ComponentSchema): string {
  return getComponentLabel(
    schema,
    (type) =>
      pluginManager.component.getConfigByType(type)?.defaultSchema.label,
  );
}

const currentSelectedNode = computed(() => designer.state.selectedNode);

const selectedSchema = computed(
  () => allSchemas.value.find((item) => item.id === selectedId.value) ?? null,
);
</script>

<template>
  <div class="aigen-step-target">
    <!-- 快捷选用当前编辑组件 -->
    <div
      v-if="currentSelectedNode && currentSelectedNode.id"
      class="aigen-step-target-current"
      :class="{
        'aigen-step-target-current--active':
          selectedId === currentSelectedNode.id,
      }"
      @click="handleSelectChange(currentSelectedNode.id as string)"
    >
      <div class="aigen-step-target-current-main">
        <span class="aigen-step-target-current-badge">
          <AigenIcon name="icon--behavior--container" />
          当前选中的组件
        </span>
        <span class="aigen-step-target-current-name">
          {{ getTreeNodeLabel(currentSelectedNode) }}
        </span>
        <span class="aigen-step-target-current-id">
          {{ currentSelectedNode.type }} · {{ currentSelectedNode.id }}
        </span>
      </div>
      <span
        class="aigen-step-target-current-btn"
        :class="{
          'aigen-step-target-current-btn--selected':
            selectedId === currentSelectedNode.id,
        }"
      >
        <template v-if="selectedId === currentSelectedNode.id">
          <AigenIcon name="icon--behavior--check" />
          已选中
        </template>
        <template v-else>选用当前组件</template>
      </span>
    </div>

    <!-- 搜索选择目标 -->
    <div class="aigen-step-target-picker">
      <component
        :is="SelectComponent"
        :model-value="selectedId"
        :options="targetOptions"
        :show-search="true"
        option-filter-prop="label"
        placeholder="搜索并选择目标组件"
        style="width: 100%"
        @update:model-value="handleSelectChange"
      />
    </div>

    <div v-if="selectedSchema" class="aigen-step-target-selected">
      <span class="aigen-step-target-selected-label">
        已选：{{ getTreeNodeLabel(selectedSchema) }}
      </span>
      <span class="aigen-step-target-selected-type">
        （{{ selectedSchema.type }} · {{ selectedSchema.id }}）
      </span>
    </div>
  </div>
</template>

<style scoped>
.aigen-step-target {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aigen-step-target-current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius);
  cursor: pointer;
  transition: all 0.2s ease-out-quart;
}

.aigen-step-target-current:hover {
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
}

.aigen-step-target-current--active {
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
}

.aigen-step-target-current-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.aigen-step-target-current-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--aigen-primary);
}

.aigen-step-target-current-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--aigen-text-main);
}

.aigen-step-target-current-id {
  font-size: 11px;
  color: var(--aigen-text-helper);
}

.aigen-step-target-current-btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 3px;
  padding: 4px 10px;
  font-size: var(--aigen-text-sm);
  color: var(--aigen-text-secondary);
  background: var(--aigen-background);
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
}

.aigen-step-target-current-btn--selected {
  color: var(--aigen-primary);
  font-weight: 500;
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
}

.aigen-step-target-selected {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--aigen-text-main);
  background: var(--aigen-secondary, #f5f6f8);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-step-target-selected-label {
  font-weight: 500;
}

.aigen-step-target-selected-type {
  color: var(--aigen-text-helper);
}
</style>
