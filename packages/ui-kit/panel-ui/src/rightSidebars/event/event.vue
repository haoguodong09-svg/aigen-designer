<script lang="ts" setup>
import type { EventModel } from '@aigen-designer/types';

import { computed, ref } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { getValueByPath, setValueByPath } from '@aigen-designer/utils';

const designer = useDesignerContext();
const revoke = designer.revoke;
const AigenActionEditor = pluginManager.component.get('AigenActionEditor');

// 与 AigenActionEditor 的协调接口（其 defineExpose 暴露 openAdd，供空状态引导直达添加流程）
interface AigenActionEditorExpose {
  openAdd: (type: string) => void;
}
const editorRef = ref<AigenActionEditorExpose | null>(null);

const componentConfigs = pluginManager.component.getComponentConfigs();
const selectedNode = computed(() => {
  return designer.state.selectedNode;
});

/**
 * 生命周期事件元数据（命名严格按 04 报告 B5 表落地）：
 * - businessName：人话命名
 * - description：触发时机解释
 * - usage：典型用途（可选）
 * - group：'page'（页面级）| 'component'（组件级）
 * - subgroup：组件级再分 挂载/更新/卸载/错误
 */
type LifecycleEventModel = {
  businessName: string;
  group: 'component' | 'page';
  subgroup?: '卸载' | '挂载' | '更新' | '错误';
  usage?: string;
} & EventModel;

const LIFECYCLE_EVENTS: LifecycleEventModel[] = [
  {
    businessName: '页面加载完成',
    description: '整个页面所有组件都渲染完成后触发一次',
    group: 'page',
    type: 'aigenReady',
    usage: '初始化默认值、拉取首屏数据、初始跳转',
  },
  {
    businessName: '组件挂载前',
    description: '当前组件即将渲染到页面之前',
    group: 'component',
    subgroup: '挂载',
    type: 'vnodeBeforeMount',
    usage: '预置初始属性/状态',
  },
  {
    businessName: '组件挂载完成',
    description: '当前组件完成首次渲染后触发',
    group: 'component',
    subgroup: '挂载',
    type: 'vnodeMounted',
    usage: '组件自身初始化、加载选项数据',
  },
  {
    businessName: '组件更新前',
    description: '更新发生之前触发',
    group: 'component',
    subgroup: '更新',
    type: 'vnodeBeforeUpdate',
    usage: '记录旧值、拦截更新',
  },
  {
    businessName: '组件更新完成',
    description: '当前组件的属性或数据更新之后触发',
    group: 'component',
    subgroup: '更新',
    type: 'vnodeUpdated',
    usage: '值变化的后续处理（简单场景建议优先用对应业务事件，如 change）',
  },
  {
    businessName: '组件卸载前',
    description: '组件即将被移除之前',
    group: 'component',
    subgroup: '卸载',
    type: 'vnodeBeforeUnmount',
    usage: '释放资源、确认离开',
  },
  {
    businessName: '组件卸载完成',
    description: '组件从页面移除后触发',
    group: 'component',
    subgroup: '卸载',
    type: 'vnodeUnmounted',
    usage: '清理定时器、解绑订阅',
  },
  {
    businessName: '组件错误捕获',
    description: '组件内部渲染或运行出错时触发',
    group: 'component',
    subgroup: '错误',
    type: 'vnodeErrorCaptured',
    usage: '错误提示、降级显示',
  },
];

// 事件分组（每组标题 + 一句解释文案）
type EventGroup = {
  // 该分组是否默认展开（组件事件 / 页面级生命周期 默认展开，其余折叠）
  defaultExpanded?: boolean;
  // 分组解释文案
  description: string;
  events: EventModel[];
  title: string;
};

const eventList = computed<EventGroup[]>(() => {
  // 组件事件（来自 config.event）
  const selectedNodeType = designer.state.selectedNode?.type;
  const events = componentConfigs[selectedNodeType ?? '']?.config?.event ?? [];

  return [
    {
      defaultExpanded: true,
      description: '该组件可响应的操作（如点击、值变化等）',
      events,
      title: '组件事件',
    },
    {
      defaultExpanded: true,
      description: '与整个页面渲染流程相关的事件',
      events: LIFECYCLE_EVENTS.filter((item) => item.group === 'page'),
      title: '页面级生命周期',
    },
    {
      // 组件级生命周期（其余 7 个，按 挂载/更新/卸载/错误 子分组）
      description: '组件自身挂载、更新、卸载、出错等时机',
      events: LIFECYCLE_EVENTS.filter((item) => item.group === 'component'),
      title: '组件级生命周期',
    },
  ];
});

// 当前选中元素是否已存在事件动作（空状态判断；停用动作也计入）
const hasAnyAction = computed(() => {
  const on = getValueByPath(selectedNode.value, 'on') as
    | Record<string, unknown[]>
    | undefined;
  if (!on) return false;
  return Object.values(on).some(
    (list) => Array.isArray(list) && list.length > 0,
  );
});

// 空状态引导模板：点击后直达对应事件的添加流程（设计态仅打开动作配置，不触发运行时事件）
const emptyTemplates = [
  { eventType: 'click', text: '点击时显示/隐藏其他元素' },
  { eventType: 'change', text: '值变化时计算合计' },
  { eventType: 'aigenReady', text: '页面加载时填充默认值' },
] as const;

/**
 * 点击空状态模板：触发 AigenActionEditor 的添加流程（打开动作配置抽屉）
 */
function handleEmptyTemplateClick(eventType: string) {
  editorRef.value?.openAdd(eventType);
}

/**
 * 设置属性值
 */
function handleSetValue(value: any, field: string) {
  if (!selectedNode.value) return;
  setValueByPath(selectedNode.value, field, value);
  // 将修改过的组件属性推入撤销操作的栈中
  revoke.push('属性编辑');
}
</script>

<template>
  <div class="aigen-event-view">
    <div v-if="selectedNode">
      <!-- 空状态引导：选中元素没有任何事件动作时展示 -->
      <div v-if="!hasAnyAction" class="aigen-event-empty">
        <div class="aigen-event-empty__icon">
          <AigenIcon name="icon--aigen--event-available-rounded" />
        </div>
        <div class="aigen-event-empty__title">让这个元素「动」起来</div>
        <div class="aigen-event-empty__desc">
          从常用场景开始，快速添加第一条行为
        </div>
        <div
          v-for="template in emptyTemplates"
          :key="template.eventType"
          class="aigen-event-empty__item"
          @click="handleEmptyTemplateClick(template.eventType)"
        >
          {{ template.text }}
        </div>
      </div>
      <AigenActionEditor
        ref="editorRef"
        :key="selectedNode.id"
        :event-list="eventList"
        :model-value="getValueByPath(selectedNode!, `on`)"
        v-show="hasAnyAction"
        @update:model-value="handleSetValue($event, `on`)"
      />
    </div>
  </div>
</template>

<style scoped>
.aigen-event-view {
  padding: 4px 0;
}

/* 空状态引导 */
.aigen-event-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px;
  text-align: center;
}

.aigen-event-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  border-radius: 50%;
  color: var(--aigen-primary);
  background-color: var(--aigen-primary-faded);
  font-size: 24px;
}

.aigen-event-empty__title {
  margin-bottom: 6px;
  color: var(--aigen-text-main);
  font-size: var(--aigen-text-md);
  font-weight: 500;
}

.aigen-event-empty__desc {
  margin-bottom: 16px;
  color: var(--aigen-text-helper);
  font-size: var(--aigen-text-sm);
}

.aigen-event-empty__item {
  width: 100%;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius);
  color: var(--aigen-text-main);
  background-color: var(--aigen-background);
  font-size: var(--aigen-text-sm);
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;

  &:hover {
    border-color: var(--aigen-primary);
    color: var(--aigen-primary);
  }
}
</style>
