<script lang="ts" setup>
import type { EventModel } from '@aigen-designer/types';

import { computed, onBeforeUnmount, ref } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import { useDesignerContext, usePageManager } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { getValueByPath, setValueByPath } from '@aigen-designer/utils';

import EventBusView from '../link/modules/EventBusView.vue';
import FieldLinkEditor from '../link/modules/FieldLinkEditor.vue';

const designer = useDesignerContext();
const pageManager = usePageManager();
const revoke = designer.revoke;
const AigenActionEditor = pluginManager.component.get('AigenActionEditor');

// 与 AigenActionEditor 的协调接口（其 defineExpose 暴露 openAdd，供快捷模板直达添加流程）
interface AigenActionEditorExpose {
  openAdd: (type: string) => void;
}
const editorRef = ref<AigenActionEditorExpose | null>(null);

// 交互面板内部页签：字段联动（常用，声明式）| 事件与动作（高级，命令式）
type EventTab = 'behavior' | 'link';

const TABS: Array<{ icon: string; key: EventTab; title: string }> = [
  {
    icon: 'icon--behavior--thunderbolt',
    key: 'link',
    title: '字段联动',
  },
  {
    icon: 'icon--behavior--experiment',
    key: 'behavior',
    title: '事件与动作',
  },
];

// 默认展示「字段联动」页（80% 常用场景直达）
const activeTab = ref<EventTab>('link');
const showEventBus = ref(false);

/**
 * 画布试运行（交互演练）：
 * 设计态默认屏蔽组件事件，配置完联动只能反复打开预览验证。
 * 打开后画布中的组件可直接交互，联动规则与动作即时生效（仅内存态，不写入 schema）。
 */
const interactiveMode = computed({
  get: () => pageManager.isInteractiveMode?.value === true,
  set: (value: boolean) => pageManager.setInteractiveMode(value),
});

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

// 当前元素实际可用的事件类型（组件事件 ∪ 生命周期），用于过滤快捷模板，
// 避免出现"模板配完后面板无对应事件行"的困惑（如 switch 没有 click 事件）
const availableEventTypes = computed(() => {
  const nodeType = designer.state.selectedNode?.type;
  const configEvents = componentConfigs[nodeType ?? '']?.config?.event ?? [];
  const types = new Set<string>(configEvents.map((event) => event.type));
  LIFECYCLE_EVENTS.forEach((event) => types.add(event.type));
  return types;
});

// 快捷上手模板：点击后直达对应事件的添加流程（设计态仅打开动作配置，不触发运行时事件）
const emptyTemplates = [
  { eventType: 'click', text: '点击时执行动作（打开弹窗 / 调用接口）' },
  { eventType: 'change', text: '值变化时执行动作（校验 / 联动 / 请求）' },
  { eventType: 'aigenReady', text: '页面加载完成后执行动作' },
] as const;

const filteredTemplates = computed(() =>
  emptyTemplates.filter((template) =>
    availableEventTypes.value.has(template.eventType),
  ),
);

/**
 * 点击空状态模板：触发 AigenActionEditor 的添加流程（打开动作配置抽屉）
 */
function handleEmptyTemplateClick(eventType: string) {
  editorRef.value?.openAdd(eventType);
}

// 离开交互面板时关闭画布试运行，避免用户误触画布元素时继续触发动作
onBeforeUnmount(() => {
  pageManager.setInteractiveMode(false);
});

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
    <!-- 内部页签：字段联动 | 事件与动作 -->
    <div class="aigen-event-tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        class="aigen-event-tab"
        :class="{ 'aigen-event-tab--active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <AigenIcon class="aigen-event-tab__icon" :name="tab.icon" />
        {{ tab.title }}
      </button>
    </div>

    <!-- 联动页：声明式规则 + 画布试运行（默认展示） -->
    <div v-if="activeTab === 'link'" class="aigen-event-link-body">
      <div class="aigen-interactive-bar">
        <div class="aigen-interactive-bar__text">
          <span class="aigen-interactive-bar__title">
            <AigenIcon name="icon--behavior--eye" />
            画布试运行
          </span>
          <span class="aigen-interactive-bar__desc">
            开启后可直接在画布操作组件验证联动，不会写入页面数据
          </span>
        </div>
        <label
          class="aigen-switch"
          :class="{ 'aigen-switch--checked': interactiveMode }"
          title="画布试运行"
        >
          <input
            v-model="interactiveMode"
            type="checkbox"
            class="aigen-switch__input"
          />
          <span class="aigen-switch__slider"></span>
        </label>
      </div>
      <FieldLinkEditor />
    </div>

    <!-- 事件页：快捷模板 + 事件动作编辑 + 事件总线 -->
    <div v-else-if="activeTab === 'behavior'">
      <div v-if="selectedNode">
        <!-- 常用事件快捷入口（始终展示，点击直达对应事件的添加流程） -->
        <div v-if="filteredTemplates.length" class="aigen-event-quick">
          <span class="aigen-event-quick__title">常用事件</span>
          <button
            v-for="template in filteredTemplates"
            :key="template.eventType"
            type="button"
            class="aigen-event-quick__item"
            @click="handleEmptyTemplateClick(template.eventType)"
          >
            <AigenIcon name="icon--aigen--add-rounded" />
            {{ template.text }}
          </button>
        </div>

        <AigenActionEditor
          ref="editorRef"
          :key="selectedNode.id"
          :event-list="eventList"
          :model-value="getValueByPath(selectedNode!, `on`)"
          @update:model-value="handleSetValue($event, `on`)"
        />

        <div class="aigen-event-link-separator"></div>
        <div class="aigen-event-bus-collapsible">
          <button
            type="button"
            class="aigen-event-bus-toggle"
            @click="showEventBus = !showEventBus"
          >
            <span class="aigen-event-bus-title">
              <AigenIcon name="icon--behavior--wifi" />
              页面事件总线
            </span>
            <span class="aigen-event-bus-state">
              {{ showEventBus ? '收起' : '展开' }}
              <AigenIcon
                :name="
                  showEventBus
                    ? 'icon--behavior--arrowup'
                    : 'icon--behavior--arrowdown'
                "
              />
            </span>
          </button>
          <div v-if="showEventBus" class="aigen-event-bus-body">
            <EventBusView />
          </div>
        </div>
      </div>
      <div v-else class="aigen-event-no-selected">
        <AigenIcon
          class="aigen-event-no-selected__icon"
          name="icon--behavior--container"
        />
        <span class="aigen-event-no-selected__text">
          请在画布中选中组件以配置事件
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aigen-event-view {
  padding: 4px 0 12px;
}

/* 内部页签栏：与设计器右侧主标签一致的底部高亮样式 */
.aigen-event-tabs {
  display: flex;
  margin: 0 12px 10px;
  border-bottom: 1px solid var(--aigen-border);
}

.aigen-event-tab {
  position: relative;
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 0;
  font-size: var(--aigen-text-sm);
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: transparent;
  border: none;
  transition: color 0.2s ease-out-quart;
}

.aigen-event-tab__icon {
  font-size: 14px;
}

.aigen-event-tab:hover {
  color: var(--aigen-primary);
}

.aigen-event-tab--active {
  color: var(--aigen-primary);
  font-weight: 500;
}

.aigen-event-tab--active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background-color: var(--aigen-primary);
  content: '';
}

/* 联动页：子模块左右留白 */
.aigen-event-link-body {
  padding: 0 12px 12px;
}

/* 字段联动 与 事件总线 之间的分隔线 */
.aigen-event-link-separator {
  height: 1px;
  margin: 16px 0 10px;
  background: var(--aigen-border);
}

/* 事件总线折叠区 */
.aigen-event-bus-collapsible {
  margin-top: 8px;
}

.aigen-event-bus-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--aigen-secondary, #f8f9fa);
  border: 1px dashed var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  color: var(--aigen-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.aigen-event-bus-toggle:hover {
  color: var(--aigen-primary);
  border-color: var(--aigen-primary);
}

.aigen-event-bus-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.aigen-event-bus-state {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  opacity: 0.7;
}

.aigen-event-bus-body {
  margin-top: 8px;
}

/* 画布试运行开关条 */
.aigen-interactive-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 8px 10px;
  background: var(--aigen-secondary, #f5f6f8);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-interactive-bar__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.aigen-interactive-bar__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--aigen-text-sm);
  font-weight: 500;
  color: var(--aigen-text-main);
}

.aigen-interactive-bar__title .iconfont {
  color: var(--aigen-text-secondary);
}

.aigen-interactive-bar__desc {
  font-size: 11px;
  line-height: 1.4;
  color: var(--aigen-text-helper);
}

/* 常用事件快捷入口 */
.aigen-event-quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0 12px 8px;
}

.aigen-event-quick__title {
  font-size: 11px;
  color: var(--aigen-text-helper);
}

.aigen-event-quick__item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  font-size: var(--aigen-text-sm);
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: var(--aigen-background);
  border: 1px solid var(--aigen-border);
  border-radius: calc(var(--aigen-radius) - 2px);
  transition: all 0.2s ease-out-quart;
}

.aigen-event-quick__item:hover {
  color: var(--aigen-primary);
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
}

/* 启停用 switch（aigen 风格，不依赖具体 UI 库） */
.aigen-switch {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  width: 30px;
  height: 16px;
  cursor: pointer;
  user-select: none;
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
  background-color: var(--aigen-border);
  border-radius: 999px;
  transition: background-color 0.2s;
}

.aigen-switch__slider::before {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  background-color: var(--aigen-background);
  border-radius: 50%;
  content: '';
  transition: transform 0.2s;
}

.aigen-switch--checked .aigen-switch__slider {
  background-color: var(--aigen-primary);
}

.aigen-switch--checked .aigen-switch__slider::before {
  transform: translateX(14px);
}

/* 未选组件提示 */
.aigen-event-no-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  color: var(--aigen-text-helper);
  text-align: center;
}

.aigen-event-no-selected__icon {
  margin-bottom: 8px;
  color: var(--aigen-text-helper);
  font-size: 24px;
}

.aigen-event-no-selected__text {
  font-size: var(--aigen-text-sm);
}
</style>
