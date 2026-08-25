<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, inject, ref } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';

import { useDesignerContext, usePageManager } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';

import AigenNodeItem from './nodeItem.vue';

defineOptions({
  name: 'EditNodeItem',
});
const props = defineProps<{
  schemas: ComponentSchema[];
}>();
const emit = defineEmits(['update:schemas']);
const designer = useDesignerContext();
const revoke = designer.revoke;
const pageManager = usePageManager();
const contextMenu = inject('contextMenu', {
  close: () => {},
  open: (_event: Event, _schema: ComponentSchema) => {},
});
const modelSchemas = computed({
  get: () => props.schemas,
  set: (val) => emit('update:schemas', val.filter(Boolean)),
});

const isDragChange = ref(false);
// 标记本次拖拽是否为从其他列表（侧边栏）拖入，用于避免 end 事件重复记录
let isDragAdd = false;

/**
 * 获取节点的schema
 * @param {Element} target 节点元素
 * @returns {ComponentSchema | null} 节点的schema
 */
function getNodeSchema(target) {
  if (!target?.closest) return null;

  // 优先检查当前元素
  if (target.dataset?.aigenId) {
    return getSchemaByAigenId(target.dataset.aigenId);
  }

  // 检查直接子元素（只向下查询一级）
  if (!target.classList.contains('aigen-draggable-range')) {
    const directChild = target.querySelector(':scope > [data-aigen-id]');
    if (directChild?.dataset?.aigenId) {
      return getSchemaByAigenId(directChild.dataset.aigenId);
    }
  }

  // 向父级查找
  const parentElement = target.closest('[data-aigen-id]');
  if (parentElement?.dataset?.aigenId) {
    return getSchemaByAigenId(parentElement.dataset.aigenId);
  }

  return null;
}

/**
 * 根据aigenId获取schema的辅助函数
 * @param {string} aigenId
 */
function getSchemaByAigenId(aigenId) {
  const instance = pageManager.findInstance(aigenId);
  return instance?.exposed?.schema || null;
}

function setHoverNode(event: Event) {
  const schema = getNodeSchema(event.target);
  event.stopPropagation();
  designer.setHoverNode(schema);
}

/**
 * 从侧边栏拖入编辑区域，直接记录插入操作
 * 拖入也会导致 change 被触发，Add 应重置 isDragChange 标识，避免 end 重复记录
 */
function handleDragAdd(event: any) {
  designer.setSelectedNode(event.clonedData);
  isDragChange.value = false;
  // 记录插入组件操作，支持撤销
  revoke.push('插入组件', true);
  // 标记本次拖拽为跨列表新增，end 事件不再重复记录
  isDragAdd = true;
}

/**
 * 编辑区域内的拖拽change事件，记录顺序发生变化
 */
function handleDragChange() {
  isDragChange.value = true;
}

/**
 * 编辑区域内的拖拽结束事件，需判断是否 change，有可能拖拽并未修改顺序
 * 拖入新增（handleDragAdd）已单独记录，此处仅记录编辑区域内的顺序变化
 */
function handleDragEnd() {
  if (isDragChange.value && !isDragAdd) {
    revoke.push('拖拽组件', true);
  }
  isDragChange.value = false;
  isDragAdd = false;
}

function isInline(schema: ComponentSchema) {
  const config = pluginManager.component.getComponentConfigByType(schema.type);
  return config?.editConstraints?.inline || false;
}
</script>

<template>
  <VueDraggable
    v-model="modelSchemas"
    class="aigen-draggable-range"
    :animation="200"
    group="edit-draggable"
    ghost-class="aigen-moveing"
    @mouseover.stop="setHoverNode"
    @change="handleDragChange"
    @add="handleDragAdd"
    @end="handleDragEnd"
  >
    <div
      class="aigen-node-item"
      :class="{ 'aigen-inline': isInline(element) }"
      v-for="element in modelSchemas"
      :key="element.id"
      @contextmenu.stop="contextMenu.open($event, element)"
      :data-aigen-id="element.id"
    >
      <AigenNodeItem :schema="element" />
    </div>
  </VueDraggable>
</template>
