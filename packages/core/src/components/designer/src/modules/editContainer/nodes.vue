<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, inject, onMounted, onUnmounted, ref } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';

import {
  useDesignerContext,
  useLinkMode,
  usePageManager,
} from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { findSchemaById } from '@aigen-designer/utils';

import EventBadge from './EventBadge.vue';
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
const linkMode = useLinkMode();
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
function getNodeSchema(target: HTMLElement | null) {
  if (!target?.closest) return null;

  // 优先检查当前元素
  if (target.dataset?.aigenId) {
    return getSchemaByAigenId(target.dataset.aigenId);
  }

  // 检查直接子元素（只向下查询一级）
  if (!target.classList.contains('aigen-draggable-range')) {
    const directChild = target.querySelector(
      ':scope > [data-aigen-id]',
    ) as HTMLElement | null;
    if (directChild?.dataset?.aigenId) {
      return getSchemaByAigenId(directChild.dataset.aigenId);
    }
  }

  // 向父级查找
  const parentElement = target.closest('[data-aigen-id]') as HTMLElement | null;
  if (parentElement?.dataset?.aigenId) {
    return getSchemaByAigenId(parentElement.dataset.aigenId);
  }

  return null;
}

/**
 * 根据aigenId获取schema的辅助函数（悬停走组件实例 exposed；
 * 关联模式点选需写回页面 schema，因此直接按 id 查 pageSchema）
 * @param {string} aigenId
 */
function getSchemaByAigenId(aigenId: string) {
  const instance = pageManager.findInstance(aigenId);
  return instance?.exposed?.schema || null;
}

/** 关联模式点选：按 id 解析页面 schema（可写回的实时引用） */
function getSchemaForLinkPick(aigenId: string) {
  return findSchemaById(designer.pageSchema.schemas, aigenId);
}

function setHoverNode(event: Event) {
  const schema = getNodeSchema(event.target as HTMLElement | null);
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

// 关联模式画布点选：nodes.vue 为递归组件，模块级计数保证 document 委托监听只注册一次
let linkPickerCount = 0;

/**
 * document 委托监听（捕获阶段，先于画布选中/拖拽逻辑）：
 * - 命中 [data-aigen-id] 元素 → 按阶段选择源/目标（源=蓝、目标=绿 outline）；
 * - 点击画布空白 → 取消当前选择（不退出模式），再点一次空白退出；
 * - 角标/选中操作条等控件点击保持正常交互（不拦截）。
 */
function handleLinkModeClick(event: MouseEvent) {
  if (!linkMode.isActive.value) return;
  const target = event.target as HTMLElement | null;
  if (!target) return;
  // 仅处理画布编辑区内的点击（工具栏/侧边栏/气泡等均不参与点选）
  if (!target.closest('.aigen-edit-range')) return;
  // 角标与选中操作条等控件保持正常交互
  if (target.closest('.aigen-event-badge, .aigen-selected-widget')) return;
  const nodeElement = target.closest('[data-aigen-id]') as HTMLElement | null;
  const aigenId = nodeElement?.dataset.aigenId;
  if (aigenId) {
    const schema = getSchemaForLinkPick(aigenId);
    if (schema) {
      event.stopPropagation();
      linkMode.pick(schema);
      return;
    }
  }
  // 点击画布空白：取消当前选择（不退出模式），再点一次空白退出
  event.stopPropagation();
  linkMode.handleBlankClick();
}

onMounted(() => {
  linkPickerCount++;
  if (linkPickerCount === 1) {
    document.addEventListener('click', handleLinkModeClick, true);
  }
});

onUnmounted(() => {
  linkPickerCount--;
  if (linkPickerCount === 0) {
    document.removeEventListener('click', handleLinkModeClick, true);
  }
});
</script>

<template>
  <VueDraggable
    v-model="modelSchemas"
    class="aigen-draggable-range"
    :animation="200"
    :disabled="linkMode.isActive.value"
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
      <div class="aigen-node-badge-wrap">
        <AigenNodeItem :schema="element" />
        <EventBadge :schema="element" />
      </div>
    </div>
  </VueDraggable>
</template>

<style scoped>
/* 角标叠加层定位容器：仅提供相对定位，不影响节点自身布局 */
.aigen-node-badge-wrap {
  position: relative;
}

/* 内联组件（如按钮）保持行内布局 */
.aigen-node-item.aigen-inline > .aigen-node-badge-wrap {
  display: inline-block;
}
</style>
