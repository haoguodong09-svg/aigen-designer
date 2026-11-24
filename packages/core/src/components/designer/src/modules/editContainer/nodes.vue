<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, inject, onMounted, onUnmounted, ref } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';

import { AigenIcon } from '@aigen-designer/base-ui';
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
// 画布交互演练模式：禁用拖拽与节点级点击遮罩，让组件接收真实交互事件
const interactiveMode = computed(
  () => pageManager.isInteractiveMode?.value === true,
);
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
  if (linkMode.isActive.value) return;
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
    :class="{ 'aigen-interactive-mode': interactiveMode }"
    :animation="200"
    :disabled="linkMode.isActive.value || interactiveMode"
    group="edit-draggable"
    ghost-class="aigen-moveing"
    @mouseover.stop="setHoverNode"
    @change="handleDragChange"
    @add="handleDragAdd"
    @end="handleDragEnd"
  >
    <div
      class="aigen-node-item"
      :class="{
        'aigen-inline': isInline(element),
        'aigen-node--link-source': linkMode.source.value?.id === element.id,
        'aigen-node--link-target': linkMode.target.value?.id === element.id,
        'aigen-node--link-active': linkMode.isActive.value,
        'aigen-node--link-phase-target':
          linkMode.state.value === 'select-target',
      }"
      v-for="element in modelSchemas"
      :key="element.id"
      @contextmenu.stop="contextMenu.open($event, element)"
      :data-aigen-id="element.id"
    >
      <div class="aigen-node-badge-wrap">
        <!-- 关联模式：源与目标语义标签 -->
        <div
          v-if="linkMode.source.value?.id === element.id"
          class="aigen-link-role-badge aigen-link-role-badge--source"
        >
          <AigenIcon
            name="icon--behavior--thunderbolt"
            class="mr-1 text-[11px]"
          />
          <span>触发源</span>
        </div>
        <div
          v-if="linkMode.target.value?.id === element.id"
          class="aigen-link-role-badge aigen-link-role-badge--target"
        >
          <AigenIcon
            name="icon--behavior--experiment"
            class="mr-1 text-[11px]"
          />
          <span>关联目标</span>
        </div>

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

/* 关联模式：源组件高亮样式（品牌蓝高亮与柔和内发光，完全内缩不溢出） */
.aigen-node-item.aigen-node--link-source {
  position: relative;
  border-radius: 6px;
  outline: 2px solid #1677ff;
  outline-offset: -1px;
  box-shadow:
    inset 0 0 0 1px rgba(22, 119, 255, 0.2),
    0 2px 8px rgba(22, 119, 255, 0.12);
  background-color: rgba(22, 119, 255, 0.035);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 关联模式：目标组件高亮样式（清新绿高亮与柔和内发光，完全内缩不溢出） */
.aigen-node-item.aigen-node--link-target {
  position: relative;
  border-radius: 6px;
  outline: 2px solid #52c41a;
  outline-offset: -1px;
  box-shadow:
    inset 0 0 0 1px rgba(82, 196, 26, 0.2),
    0 2px 8px rgba(82, 196, 26, 0.12);
  background-color: rgba(82, 196, 26, 0.035);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 关联模式：候选节点基础状态（预设透明虚线轮廓，彻底杜绝悬停时 outline 颜色插值闪黑） */
.aigen-node-item.aigen-node--link-active {
  outline: 1px dashed transparent;
  outline-offset: -1px;
}

/* 关联模式：候选节点悬停交互预览（直接生效品牌色细虚线，绝不闪现黑线） */
.aigen-node-item.aigen-node--link-active:not(.aigen-node--link-source):not(
    .aigen-node--link-target
  ):hover {
  border-radius: 6px;
  outline-color: rgba(22, 119, 255, 0.75);
  background-color: rgba(22, 119, 255, 0.02);
  cursor: pointer;
}

.aigen-node-item.aigen-node--link-active.aigen-node--link-phase-target:not(
    .aigen-node--link-source
  ):not(.aigen-node--link-target):hover {
  border-radius: 6px;
  outline-color: rgba(82, 196, 26, 0.85);
  background-color: rgba(82, 196, 26, 0.02);
  cursor: pointer;
}

/* 浮动语义徽标：源 / 目标（严格内嵌于组件自身右上角内部，相邻组件绝对零重叠） */
.aigen-link-role-badge {
  position: absolute;
  top: 4px;
  right: 8px;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  pointer-events: none;
  white-space: nowrap;
  animation: aigen-badge-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.aigen-link-role-badge--source {
  background: #e6f4ff;
  border: 1px solid #91caff;
  color: #0958d9;
  box-shadow: 0 1px 3px rgba(22, 119, 255, 0.12);
}

.aigen-link-role-badge--target {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #389e0d;
  box-shadow: 0 1px 3px rgba(82, 196, 26, 0.12);
}

@keyframes aigen-badge-pop {
  0% {
    transform: scale(0.7) translateY(4px);
    opacity: 0;
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
</style>
