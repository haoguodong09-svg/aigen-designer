<script lang="ts" setup>
import type { PropType } from 'vue';

import { VueDraggable } from 'vue-draggable-plus';

import { AigenIcon } from '@aigen-designer/base-ui';
import { useDesignerContext } from '@aigen-designer/hooks';
import { deepClone, getUUID, normalizeAction } from '@aigen-designer/utils';

import { getActionSummaryText } from '../../ActionSummary/actionSummary';
import ActionSummary from '../../ActionSummary/index.vue';

const props = defineProps({
  allEvents: {
    default: () => [],
    type: Array as PropType<any>,
  },
  events: {
    default: () => ({}),
    type: Object as PropType<any>,
  },
  itemEvents: {
    default: () => [],
    type: Array as PropType<any>,
  },
  keyword: {
    default: '',
    type: String,
  },
  modelValue: {
    default: () => ({}),
    type: Object as PropType<any>,
  },
});
const emit = defineEmits(['add', 'edit', 'update:modelValue']);

const { pageSchema } = useDesignerContext();

/**
 * 读取某事件的原始动作列表（兼容缺失情况；events 为响应式 map，取值即解包）
 * @param type 事件类型
 */
function getEventActions(type: string): any[] {
  const list = props.events[type];
  return Array.isArray(list) ? list : [];
}

/**
 * 打开动作配置窗口
 * @param type 事件类型
 */
function handleOpen(type: string) {
  emit('add', type);
}

/**
 * 删除动作
 * @param index 动作下标
 * @param type 事件类型
 */
function handleDelete(index: number | string, type: string) {
  const newEvents = getNewEvents(type);
  newEvents[type] = getEventActions(type).filter(
    (_item: any, i: number) => index !== i,
  );
  if (!newEvents[type]?.length) {
    delete newEvents[type];
  }
  emit('update:modelValue', newEvents);
}

/** 拖拽开始前该事件动作的顺序快照（用于 @end 判断顺序是否真正变化，null 表示无进行中的拖拽） */
let dragStartOrder: null | string[] = null;

/**
 * 拖拽排序开始：记录该事件动作的原始顺序快照
 * @param type 事件类型
 */
function handleDragStart(type: string) {
  dragStartOrder = getEventActions(type).map((action: any, index: number) =>
    String(action.id ?? index),
  );
}

/**
 * 拖拽排序结束：VueDraggable 的 v-model 绑定 props.events[item.type] 为原地变更，
 * 不触发 update:modelValue，排序因此不进撤销栈。此处补发 update:modelValue
 * （参照 handleDelete 的 getNewEvents 构造完整事件对象，深拷贝后 emit），
 * 复用 event.vue handleSetValue → revoke.push 链路入撤销栈。
 * 仅当顺序确实变化时触发（与拖拽开始前的顺序快照对比），避免与新增/删除动作的
 * update:modelValue 链路重复入栈。
 * @param type 事件类型
 */
function handleDragEnd(type: string) {
  const snapshot = dragStartOrder;
  dragStartOrder = null;
  // 快照缺失（异常路径）或顺序未变化（拖回原位/取消拖拽）不入撤销栈
  if (!snapshot) return;
  const currentOrder = getEventActions(type).map((action: any, index: number) =>
    String(action.id ?? index),
  );
  const orderChanged =
    snapshot.length !== currentOrder.length ||
    snapshot.some((id, i) => id !== currentOrder[i]);
  if (!orderChanged) return;

  const newEvents = getNewEvents(type);
  newEvents[type] = getEventActions(type);
  emit('update:modelValue', deepClone(newEvents));
}

/**
 * 修改动作
 * @param index 动作下标
 * @param type 事件类型
 * @param action 动作数据
 */
function handleEdit(index: number | string, type: string, action: any) {
  emit('edit', index, type, action);
}

/**
 * 复制动作：深拷贝后经 normalizeAction 补新 id，追加到同事件列表末尾（不自动打开编辑）
 * @param index 动作下标
 * @param type 事件类型
 * @param action 动作数据
 */
function handleCopy(index: number | string, type: string, action: any) {
  const copy = normalizeAction(deepClone(action));
  if (!copy) return;
  // 深拷贝保留了原 id，这里生成新 id 保证稳定身份唯一
  copy.id = getUUID();
  const newEvents = getNewEvents(type);
  newEvents[type] = [...getEventActions(type), copy];
  emit('update:modelValue', newEvents);
}

/**
 * 切换单个动作的启停用
 * @param index 动作下标
 * @param type 事件类型
 * @param enabled 是否启用
 */
function handleToggleAction(index: number, type: string, enabled: boolean) {
  const newEvents = getNewEvents(type);
  newEvents[type] = getEventActions(type).map((action: any, i: number) =>
    i === index ? { ...action, enabled } : action,
  );
  emit('update:modelValue', newEvents);
}

/**
 * 动作级启停用开关的 change 回调（模板内避免类型断言，收敛到脚本）
 */
function handleActionSwitchChange(index: number, type: string, event: Event) {
  handleToggleAction(index, type, (event.target as HTMLInputElement).checked);
}

/**
 * 事件级启停用：切换该事件全部动作的 enabled 字段。
 * 读取时经 normalizeAction 归一化；写回沿用 update:modelValue → handleSetValue + revoke 链路。
 * @param type 事件类型
 * @param enabled 是否启用
 */
function handleToggleEventEnabled(type: string, enabled: boolean) {
  const newEvents = getNewEvents(type);
  newEvents[type] = getEventActions(type).map((action: any) => ({
    ...action,
    enabled,
  }));
  emit('update:modelValue', newEvents);
}

/**
 * 事件级启停用开关的 change 回调
 */
function handleEventSwitchChange(type: string, event: Event) {
  handleToggleEventEnabled(type, (event.target as HTMLInputElement).checked);
}

/**
 * 获取新的事件数据，过滤空数据
 * @param type 事件类型
 */
function getNewEvents(type: string) {
  const newEvents: { [type: string]: any } = {};
  props.allEvents.forEach((item: any) => {
    if (getEventActions(item.type).length === 0) {
      return false;
    }
    if (item.type === type) {
      return false;
    }
    newEvents[item.type] = props.events[item.type];
  });
  return newEvents;
}

/**
 * 事件显示名：业务化命名优先，缺省回退描述（B5 人话化命名）
 * @param item 事件配置
 */
function getEventLabel(item: any): string {
  return item.businessName ?? item.describe ?? item.description ?? item.type;
}

/**
 * 事件卡片是否展示解释文案（业务名与描述不同才展示，避免重复）
 * @param item 事件配置
 */
function shouldShowEventDescription(item: any): boolean {
  return Boolean(
    item.businessName &&
      item.description &&
      item.businessName !== item.description,
  );
}

/**
 * 事件级开关状态：该事件全部动作启用时为开（读取经 normalizeAction 归一化，缺省视为启用）
 * @param type 事件类型
 */
function isEventEnabled(type: string): boolean {
  return getEventActions(type).every(
    (action: any) => normalizeAction(action)?.enabled !== false,
  );
}

/**
 * 单个动作是否启用（读取经 normalizeAction 归一化）
 * @param action 动作数据
 */
function isActionEnabled(action: any): boolean {
  return normalizeAction(action)?.enabled !== false;
}

/**
 * 事件是否已有动作（空事件开关禁用，避免空切换）
 * @param type 事件类型
 */
function hasEventActions(type: string): boolean {
  return getEventActions(type).length > 0;
}

/**
 * 事件名是否命中搜索关键字
 * @param item 事件配置
 * @param normalizedKeyword 归一化后的关键字
 */
function isEventMatched(item: any, normalizedKeyword: string): boolean {
  const name = [item.businessName, item.describe, item.description]
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    .join(' ');
  return name.toLowerCase().includes(normalizedKeyword);
}

/**
 * 动作行是否命中搜索关键字（动作摘要文本，含目标组件 label 与表达式内容）
 * @param action 动作数据
 * @param normalizedKeyword 归一化后的关键字
 */
function isActionMatched(action: any, normalizedKeyword: string): boolean {
  return getActionSummaryText(action, pageSchema)
    .toLowerCase()
    .includes(normalizedKeyword);
}

/**
 * 动作行是否显示：搜索态按事件名/动作摘要过滤。
 * 注意用 v-show 而非过滤数组——保证行下标与原始列表对齐，编辑/删除/复制下标不会错位。
 * @param item 事件配置
 * @param action 动作数据
 */
function isActionVisible(item: any, action: any): boolean {
  const normalizedKeyword = props.keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;
  if (isEventMatched(item, normalizedKeyword)) return true;
  return isActionMatched(action, normalizedKeyword);
}
</script>

<template>
  <div
    v-for="(item, eventIndex) in itemEvents"
    :key="item.type"
    class="aigen-event-item"
  >
    <!-- 组件级生命周期的子分组标题（挂载 / 更新 / 卸载 / 错误） -->
    <div
      v-if="
        item.subgroup && item.subgroup !== itemEvents[eventIndex - 1]?.subgroup
      "
      class="aigen-event-subgroup"
    >
      {{ item.subgroup }}
    </div>

    <!-- 事件卡片：名称 + 描述 + 事件级启停用 + 添加动作 -->
    <div class="aigen-event-info">
      <div class="aigen-event-label-wrap">
        <div class="aigen-event-label" :title="getEventLabel(item)">
          {{ getEventLabel(item) }}
        </div>
        <div
          v-if="shouldShowEventDescription(item)"
          class="aigen-event-description"
          :title="item.description"
        >
          {{ item.description }}
        </div>
      </div>
      <div
        class="aigen-event-btn text-$aigen-text-secondary flex items-center text-lg"
      >
        <label
          class="aigen-switch"
          :class="{
            'aigen-switch--checked': isEventEnabled(item.type),
            'aigen-switch--disabled': !hasEventActions(item.type),
          }"
        >
          <input
            type="checkbox"
            class="aigen-switch__input"
            :checked="isEventEnabled(item.type)"
            :disabled="!hasEventActions(item.type)"
            @change="handleEventSwitchChange(item.type, $event)"
          />
          <span class="aigen-switch__slider"></span>
        </label>
        <AigenIcon
          name="icon--aigen--add-rounded"
          @click="handleOpen(item.type)"
        />
      </div>
    </div>

    <div class="aigen-action-editor-main">
      <VueDraggable
        v-model="props.events[item.type]"
        item-key="id"
        :component-data="{
          type: 'transition-group',
        }"
        group="option-list"
        handle=".handle"
        :animation="200"
        @start="handleDragStart(item.type)"
        @end="handleDragEnd(item.type)"
      >
        <div
          v-for="(action, index) in getEventActions(item.type)"
          v-show="isActionVisible(item, action)"
          class="aigen-editor-item rounded"
          :class="{ 'aigen-editor-item--disabled': !isActionEnabled(action) }"
          :key="action.id ?? index"
        >
          <div class="w-36px flex items-center text-lg">
            <AigenIcon
              class="handle text-$aigen-text-helper mr-2 cursor-move text-lg"
              name="icon--aigen--drag"
            />
          </div>
          <div class="aigen-action-summary-cell flex-1">
            <ActionSummary :action="action" :page-schema="pageSchema" />
          </div>
          <div class="aigen-action-box text-$aigen-text-helper text-lg">
            <label
              class="aigen-switch aigen-switch--small"
              :class="{ 'aigen-switch--checked': isActionEnabled(action) }"
              title="启停用"
            >
              <input
                type="checkbox"
                class="aigen-switch__input"
                :checked="isActionEnabled(action)"
                @change="handleActionSwitchChange(index, item.type, $event)"
              />
              <span class="aigen-switch__slider"></span>
            </label>
            <div
              class="aigen-edit-btn"
              title="编辑"
              @click="handleEdit(index, item.type, action)"
            >
              <AigenIcon name="icon--aigen--edit-square-outline-rounded" />
            </div>
            <div
              class="aigen-copy-btn"
              title="复制"
              @click="handleCopy(index, item.type, action)"
            >
              <AigenIcon name="icon--aigen--copy-all-outline-rounded" />
            </div>
            <div
              class="aigen-del-btn"
              title="删除"
              @click="handleDelete(index, item.type)"
            >
              <AigenIcon name="icon--aigen--delete-outline-rounded" />
            </div>
          </div>
        </div>
      </VueDraggable>
    </div>
  </div>
</template>

<style scoped>
/* 组件级生命周期子分组标题 */
.aigen-event-subgroup {
  margin: 10px 0 4px;
  padding-left: 12px;
  border-left: 3px solid var(--aigen-primary);
  color: var(--aigen-text-secondary);
  font-size: var(--aigen-text-sm);
  line-height: 18px;
}

/* 事件卡片：支持两行（名称 + 解释文案），覆盖 index.less 的固定 36px 高度 */
.aigen-event-info {
  height: auto;
  min-height: 36px;
  gap: 8px;
  padding: 4px 12px;
}

.aigen-event-label-wrap {
  flex: 1;
  min-width: 0;
}

.aigen-event-label {
  overflow: hidden;
  color: var(--aigen-text-main);
  font-size: var(--aigen-text-md);
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-event-description {
  overflow: hidden;
  color: var(--aigen-text-helper);
  font-size: 11px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-event-btn {
  gap: 6px;
  flex-shrink: 0;
}

/* 启停用 switch（aigen 风格，不依赖具体 UI 库） */
.aigen-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 30px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
}

.aigen-switch--small {
  width: 26px;
  height: 14px;
}

.aigen-switch__input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}

.aigen-switch__slider {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background-color: var(--aigen-border);
  transition: background-color 0.2s;
}

.aigen-switch__slider::before {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--aigen-background);
  content: '';
  transition: transform 0.2s;
}

.aigen-switch--small .aigen-switch__slider::before {
  width: 10px;
  height: 10px;
}

.aigen-switch--checked .aigen-switch__slider {
  background-color: var(--aigen-primary);
}

.aigen-switch--checked .aigen-switch__slider::before {
  transform: translateX(14px);
}

.aigen-switch--small.aigen-switch--checked .aigen-switch__slider::before {
  transform: translateX(12px);
}

.aigen-switch--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* 动作行：摘要容器留出最小宽度，便于截断 */
.aigen-action-summary-cell {
  min-width: 0;
}

/* 复制按钮（与编辑/删除同尺寸，样式补充进 scoped，不触碰 index.less） */
.aigen-copy-btn {
  width: 28px;
  height: 100%;
  text-align: center;
  cursor: pointer;

  &:hover {
    color: var(--aigen-primary);
  }
}

.aigen-action-box .aigen-edit-btn,
.aigen-action-box .aigen-del-btn {
  width: 28px;
}

/* 停用的动作行视觉置灰 */
.aigen-editor-item--disabled {
  opacity: 0.55;
}
</style>
