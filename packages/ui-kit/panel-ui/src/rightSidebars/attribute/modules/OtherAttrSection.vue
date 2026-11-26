<script lang="ts" setup>
import type { Ref } from 'vue';

import { computed, inject, ref, watch } from 'vue';

import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { findSchemaById } from '@aigen-designer/utils';

import AttributeGroup from './AttributeGroup.vue';

const designer = useDesignerContext();
const pageSchema = designer.pageSchema;
const injectedExpanded = inject<null | Ref<boolean>>(
  'aigen-attr-all-expanded',
  null,
);
const allExpanded = injectedExpanded ?? ref(true);

const selectedNode = computed(() => designer.state.selectedNode);

const isRootNode = computed(() =>
  Boolean(
    selectedNode.value && selectedNode.value.id === pageSchema.schemas[0]?.id,
  ),
);

const editingId = ref('');

watch(
  () => selectedNode.value?.id,
  (nextId) => {
    editingId.value = nextId ?? '';
  },
  { immediate: true },
);

/**
 * 提交元素 ID 修改：禁止置空，且校验全局唯一性后再更新并入撤销栈
 */
function commitNodeId() {
  const node = selectedNode.value;
  if (!node || isRootNode.value) return;

  const nextId = editingId.value.trim();
  if (!nextId) {
    editingId.value = node.id ?? '';
    pluginManager.global.$message.warning('元素 ID 不能为空');
    return;
  }

  if (nextId === node.id) {
    editingId.value = nextId;
    return;
  }

  const existing = findSchemaById(pageSchema.schemas, nextId);
  if (existing && existing !== node) {
    editingId.value = node.id ?? '';
    pluginManager.global.$message.error('元素 ID 已存在，请使用其他 ID');
    return;
  }

  node.id = nextId;
  editingId.value = nextId;
  designer.revoke.push('属性编辑', true);
}

/**
 * 更新节点 props 中的字符串属性（className / refName）并记录撤销栈
 */
function updateNodeProp(
  propKey: 'className' | 'refName',
  event: Event,
  immediate: boolean,
) {
  const node = selectedNode.value;
  if (!node) return;

  const target = event.target as HTMLInputElement | null;
  const rawValue = target?.value ?? '';
  const nextValue = immediate ? rawValue.trim() : rawValue;

  node.props ||= {};
  if (nextValue) {
    node.props[propKey] = nextValue;
  } else {
    delete node.props[propKey];
  }

  designer.revoke.push('属性编辑', immediate);
}
</script>

<template>
  <AttributeGroup
    v-if="selectedNode"
    :default-expanded="allExpanded"
    title="其他"
    :count="3"
  >
    <div class="aigen-attr-item items-center">
      <div class="aigen-attr-label" title="元素 ID">元素 ID</div>
      <div class="aigen-attr-input">
        <input
          v-model="editingId"
          type="text"
          class="aigen-other-input"
          :disabled="isRootNode"
          placeholder="组件唯一标识"
          @blur="commitNodeId"
          @keydown.enter="commitNodeId"
        />
      </div>
    </div>

    <div class="aigen-attr-item items-center">
      <div class="aigen-attr-label" title="样式类">样式类</div>
      <div class="aigen-attr-input">
        <input
          type="text"
          class="aigen-other-input"
          :value="selectedNode.props?.className ?? ''"
          placeholder="多个类名用空格分隔"
          @input="updateNodeProp('className', $event, false)"
          @change="updateNodeProp('className', $event, true)"
        />
      </div>
    </div>

    <div class="aigen-attr-item items-center">
      <div class="aigen-attr-label" title="ref 引用">ref 引用</div>
      <div class="aigen-attr-input">
        <input
          type="text"
          class="aigen-other-input"
          :value="selectedNode.props?.refName ?? ''"
          placeholder="组件实例引用名"
          @change="updateNodeProp('refName', $event, true)"
        />
      </div>
    </div>
  </AttributeGroup>
</template>

<style scoped>
.aigen-other-input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--aigen-text-main);
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}

.aigen-other-input:focus {
  border-color: var(--aigen-primary);
}

.aigen-other-input:disabled {
  color: var(--aigen-muted-foreground, #94a3b8);
  cursor: not-allowed;
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.03));
}
</style>
