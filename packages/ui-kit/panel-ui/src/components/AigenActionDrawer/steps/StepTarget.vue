<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { AigenIcon, AigenTree } from '@aigen-designer/base-ui';
import { useDesignerContext, usePageManager } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { findSchemaById } from '@aigen-designer/utils';
import { useClipboard } from '@vueuse/core';

import { filterSchemasByKeyword, getComponentLabel } from '../helper';

/**
 * Step2 · 目标组件：三个 Tab（画布点选 / 组件树 / 搜索）。
 * 画布点选：document 级委托监听 click/mouseover/mouseout，
 * 命中 [data-aigen-id] 元素后临时高亮（inline outline，不改 core 样式），
 * schema 优先取 pageManager.findInstance(id)?.exposed?.schema，兜底 findSchemaById。
 * 设计态安全：点选仅做读取与高亮，不触发任何运行时事件。
 */
const props = defineProps<{
  componentId: null | string;
  componentSchema: ComponentSchema | null;
}>();

const emit = defineEmits<{
  (e: 'pickChange', picking: boolean): void;
  (e: 'select', payload: { id: string; schema: ComponentSchema }): void;
}>();

const { pageSchema } = useDesignerContext();
const pageManager = usePageManager();
const { copy } = useClipboard({});

type TargetTab = 'pick' | 'search' | 'tree';

const activeTab = ref<TargetTab>('pick');
const selectedKeys = ref<string[]>([]);
const searchKeyword = ref('');
const picking = ref(false);
const pickHint = ref('');

/** 当前高亮的画布元素（临时 outline 高亮） */
let highlightedElement: HTMLElement | null = null;

// 选中项与外部同步（编辑模式回填组件树选中态）
watch(
  () => props.componentId,
  (id) => {
    selectedKeys.value = id ? [id] : [];
  },
  { immediate: true },
);

/** 从事件目标向上查找带 data-aigen-id 的元素 */
function getAigenElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const nodeEl = target.closest('[data-aigen-id]') as HTMLElement | null;
  return nodeEl && nodeEl.dataset.aigenId ? nodeEl : null;
}

function clearHighlight() {
  if (highlightedElement) {
    highlightedElement.style.outline = '';
    highlightedElement = null;
  }
}

function handlePickOver(event: MouseEvent) {
  if (!picking.value) return;
  const nodeEl = getAigenElement(event.target);
  if (nodeEl === highlightedElement) return;
  clearHighlight();
  if (nodeEl) {
    nodeEl.style.outline = '2px solid var(--aigen-primary)';
    nodeEl.style.outlineOffset = '1px';
    highlightedElement = nodeEl;
  }
}

function handlePickOut(event: MouseEvent) {
  if (!picking.value) return;
  const nodeEl = getAigenElement(event.relatedTarget);
  if (!nodeEl || nodeEl !== highlightedElement) clearHighlight();
}

/** 点选期间阻止画布自身的 mousedown（避免误拖拽/误选中） */
function handlePickMousedown(event: MouseEvent) {
  if (!picking.value) return;
  if (getAigenElement(event.target)) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function handlePickClick(event: MouseEvent) {
  if (!picking.value) return;
  const nodeEl = getAigenElement(event.target);
  if (!nodeEl?.dataset.aigenId) return;
  event.preventDefault();
  event.stopPropagation();

  const id = nodeEl.dataset.aigenId;
  // 优先取实例暴露的 schema，兜底按 id 查找（参考 nodes.vue getNodeSchema 思路）
  const instance = pageManager.findInstance(id);
  const schema =
    instance?.exposed?.schema ?? findSchemaById(pageSchema.schemas, id);
  if (schema) {
    emit('select', { id, schema });
    stopPicking();
  }
}

/** Esc 退出点选（不连带关闭抽屉） */
function handlePickKeydown(event: KeyboardEvent) {
  if (!picking.value) return;
  if (event.key === 'Escape') {
    event.stopPropagation();
    stopPicking();
  }
}

function startPicking() {
  if (picking.value) return;
  picking.value = true;
  pickHint.value = '移动鼠标在画布预览，点击元素选中目标';
  emit('pickChange', true);
  document.addEventListener('mouseover', handlePickOver, true);
  document.addEventListener('mouseout', handlePickOut, true);
  document.addEventListener('mousedown', handlePickMousedown, true);
  document.addEventListener('click', handlePickClick, true);
  document.addEventListener('keydown', handlePickKeydown);
}

function stopPicking() {
  if (!picking.value) return;
  picking.value = false;
  clearHighlight();
  emit('pickChange', false);
  document.removeEventListener('mouseover', handlePickOver, true);
  document.removeEventListener('mouseout', handlePickOut, true);
  document.removeEventListener('mousedown', handlePickMousedown, true);
  document.removeEventListener('click', handlePickClick, true);
  document.removeEventListener('keydown', handlePickKeydown);
}

// 切到画布点选 Tab 自动进入点选模式
watch(
  () => activeTab.value,
  (tab) => {
    if (tab === 'pick') {
      startPicking();
    } else {
      stopPicking();
    }
  },
  { immediate: true },
);

onBeforeUnmount(stopPicking);

/** 节点展示名：label ?? 类型默认 label ?? 未命名组件 */
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

function handleSearchSelect(schema: ComponentSchema) {
  if (!schema.id) return;
  emit('select', { id: schema.id, schema });
}

function handleCopyId(id: string) {
  copy(id);
}

function handleReselect() {
  startPicking();
}

/** 搜索：按 label / id / type / 类型中文名过滤（递归） */
const searchResults = computed(() =>
  filterSchemasByKeyword(
    pageSchema.schemas,
    searchKeyword.value,
    (type) =>
      pluginManager.component.getConfigByType(type)?.defaultSchema.label ?? '',
  ),
);

const selectedLabel = computed(() => {
  if (!props.componentSchema) return '';
  return getTreeNodeLabel(props.componentSchema);
});
</script>

<template>
  <div class="aigen-step-target">
    <div class="aigen-step-target-tabs">
      <button
        type="button"
        class="aigen-step-target-tab"
        :class="{ 'aigen-step-target-tab--active': activeTab === 'pick' }"
        @click="activeTab = 'pick'"
      >
        画布点选
      </button>
      <button
        type="button"
        class="aigen-step-target-tab"
        :class="{ 'aigen-step-target-tab--active': activeTab === 'tree' }"
        @click="activeTab = 'tree'"
      >
        组件树
      </button>
      <button
        type="button"
        class="aigen-step-target-tab"
        :class="{ 'aigen-step-target-tab--active': activeTab === 'search' }"
        @click="activeTab = 'search'"
      >
        搜索
      </button>
    </div>

    <!-- 画布点选（默认） -->
    <div v-if="activeTab === 'pick'" class="aigen-step-target-panel">
      <p
        class="aigen-step-target-tip"
        :class="{ 'aigen-step-target-tip--active': picking }"
      >
        {{ pickHint }}
      </p>
      <div
        v-if="props.componentSchema && !picking"
        class="aigen-step-target-selected"
      >
        <span class="aigen-step-target-selected-label">
          已选：{{ selectedLabel }}
        </span>
        <span class="aigen-step-target-selected-type">
          （{{ props.componentSchema.type }}）
        </span>
        <button
          type="button"
          class="aigen-step-target-reselect"
          @click="handleReselect"
        >
          重选
        </button>
      </div>
      <button
        v-else-if="picking"
        type="button"
        class="aigen-step-target-cancel"
        @click="stopPicking"
      >
        取消点选
      </button>
    </div>

    <!-- 组件树 -->
    <div
      v-else-if="activeTab === 'tree'"
      class="aigen-step-target-panel aigen-step-target-panel--tree"
    >
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

    <!-- 搜索 -->
    <div v-else class="aigen-step-target-panel">
      <input
        v-model="searchKeyword"
        type="text"
        class="aigen-step-target-search"
        placeholder="按名称 / ID / 类型搜索组件"
      />
      <div class="aigen-step-target-list">
        <button
          v-for="item in searchResults"
          :key="item.id"
          type="button"
          class="aigen-step-target-item"
          :class="{
            'aigen-step-target-item--checked': item.id === props.componentId,
          }"
          @click="handleSearchSelect(item)"
        >
          <span class="aigen-step-target-node-label">{{
            getTreeNodeLabel(item)
          }}</span>
          <span class="aigen-step-target-node-type">{{ item.type }}</span>
          <span class="aigen-step-target-item-id">{{ item.id }}</span>
        </button>
        <div v-if="searchResults.length === 0" class="aigen-step-target-empty">
          未找到匹配的组件
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aigen-step-target-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--aigen-border);
}

.aigen-step-target-tab {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
}

.aigen-step-target-tab--active {
  font-weight: 600;
  color: var(--aigen-primary);
  border-bottom-color: var(--aigen-primary);
}

.aigen-step-target-panel {
  display: flex;
  flex-direction: column;
  min-height: 320px;
}

.aigen-step-target-panel--tree {
  height: 380px;
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  overflow: hidden;
}

.aigen-step-target-tip {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-step-target-tip--active {
  color: var(--aigen-primary);
}

.aigen-step-target-selected {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
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

.aigen-step-target-cancel {
  align-self: flex-start;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
}

.aigen-step-target-cancel:hover {
  color: var(--aigen-primary);
  border-color: var(--aigen-primary);
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

.aigen-step-target-search {
  width: 100%;
  padding: 6px 10px;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--aigen-text-main);
  outline: none;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  box-sizing: border-box;
}

.aigen-step-target-search:focus {
  border-color: var(--aigen-primary);
}

.aigen-step-target-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 320px;
  overflow: auto;
}

.aigen-step-target-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--aigen-text-main);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
}

.aigen-step-target-item:hover {
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
}

.aigen-step-target-item--checked {
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
}

.aigen-step-target-item-id {
  margin-left: auto;
  font-size: 11px;
  color: var(--aigen-text-helper);
  font-family: monospace;
}

.aigen-step-target-empty {
  padding: 16px 0;
  font-size: 12px;
  color: var(--aigen-text-helper);
  text-align: center;
}
</style>
