<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { AigenIcon, AigenTree } from '@aigen-designer/base-ui';
import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';

import { getComponentLabel } from '../helper';

/**
 * Step2 · 目标组件：合并组件树 + 搜索为一个面板。
 * AigenTree 内置搜索框，按 label 过滤节点，无需单独 tab。
 */
const props = defineProps<{
  componentId: null | string;
  componentSchema: ComponentSchema | null;
}>();

const emit = defineEmits<{
  (e: 'select', payload: { id: string; schema: ComponentSchema }): void;
}>();

const { pageSchema } = useDesignerContext();

const selectedKeys = ref<string[]>([]);

/** 选中项与外部同步（编辑模式回填组件树选中态） */
watch(
  () => props.componentId,
  (id) => {
    selectedKeys.value = id ? [id] : [];
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  selectedKeys.value = [];
});

/** 节点展示名：label ?? 类型默认 label ?? '未命名组件' */
function getTreeNodeLabel(schema: ComponentSchema): string {
  return getComponentLabel(
    schema,
    (type) =>
      pluginManager.component.getConfigByType(type)?.defaultSchema.label,
  );
}

function handleTreeNodeClick(payload: {
  componentSchema: ComponentSchema;
  id: string;
}) {
  emit('select', { id: payload.id, schema: payload.componentSchema });
}

function handleCopyId(id: string) {
  copy(id);
}

const selectedLabel = computed(() => {
  if (!props.componentSchema) return '';
  return getTreeNodeLabel(props.componentSchema);
});
</script>

<template>
  <div class="aigen-step-target">
    <!-- 已选展示 -->
    <div v-if="props.componentSchema" class="aigen-step-target-selected">
      <span class="aigen-step-target-selected-label">
        已选：{{ selectedLabel }}
      </span>
      <span class="aigen-step-target-selected-type">
        （{{ props.componentSchema.type }}）
      </span>
      <button
        type="button"
        class="aigen-step-target-reselect"
        @click="selectedKeys = []"
      >
        重选
      </button>
    </div>

    <!-- 组件树（含内置搜索） -->
    <div class="aigen-step-target-panel aigen-step-target-panel--tree">
      <AigenTree
        v-model:selected-keys="selectedKeys"
        :options="pageSchema.schemas"
        @node-click="handleTreeNodeClick"
      >
        <template #tree-node="{ schema }">
          <div
            class="aigen-step-target-node"
            :class="{ 'aigen-step-target-node--hidden': schema.props?.hidden }"
          >
            <AigenIcon
              v-if="schema.props?.hidden"
              name="icon--aigen--visibility-off-outline-rounded"
              class="aigen-step-target-node-icon"
            />
            <span class="aigen-step-target-node-label" :title="schema.id">
              {{ getTreeNodeLabel(schema) }}
            </span>
            <span class="aigen-step-target-node-type">{{ schema.type }}</span>
            <button
              type="button"
              class="aigen-step-target-copy"
              @click.stop="handleCopyId(schema.id)"
            >
              复制 ID
            </button>
          </div>
        </template>
      </AigenTree>
    </div>
  </div>
</template>

<style scoped>
.aigen-step-target-selected {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--aigen-text-main);
  background: var(--aigen-primary-faded);
  border: 1px solid var(--aigen-primary);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-step-target-selected-label {
  font-weight: 500;
}

.aigen-step-target-selected-type {
  color: var(--aigen-text-helper);
}

.aigen-step-target-reselect {
  margin-left: auto;
  padding: 2px 10px;
  font-size: 12px;
  color: var(--aigen-primary);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--aigen-primary);
  border-radius: 4px;
}

.aigen-step-target-panel--tree {
  height: 380px;
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  overflow: hidden;
}

.aigen-step-target-node {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--aigen-text-main);
}

.aigen-step-target-node--hidden {
  opacity: 0.55;
}

.aigen-step-target-node-icon {
  flex-shrink: 0;
}

.aigen-step-target-node-label {
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-step-target-node-type {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--aigen-text-helper);
  background: var(--aigen-muted);
  border-radius: 3px;
  padding: 0 4px;
}

.aigen-step-target-copy {
  flex-shrink: 0;
  margin-left: auto;
  padding: 1px 6px;
  font-size: 11px;
  color: var(--aigen-text-helper);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--aigen-border);
  border-radius: 3px;
}

.aigen-step-target-copy:hover {
  color: var(--aigen-primary);
  border-color: var(--aigen-primary);
}
</style>
