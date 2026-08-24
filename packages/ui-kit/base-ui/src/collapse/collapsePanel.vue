<script setup lang="ts">
import type { PanelName } from './collapseContext';

import { computed, inject, onMounted, onUnmounted, ref } from 'vue';

import { AigenIcon } from '../icon';
import { COLLAPSE_CONTEXT_KEY } from './collapseContext';

interface Props {
  // 是否显示边框
  bordered?: boolean;
  // 自定义类名
  customClass?: string;
  // 是否默认展开
  defaultExpanded?: boolean;
  // 是否禁用
  disabled?: boolean;
  // 面板唯一标识
  name?: PanelName;
  // 面板标题
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  bordered: true,
  customClass: '',
  defaultExpanded: false,
  disabled: false,
  name: '',
  title: '',
});

// 获取 collapse 上下文
const collapseContext = inject(COLLAPSE_CONTEXT_KEY);

// 生成唯一 name
const panelKey = ref<PanelName>(props.name || Symbol('collapse-panel'));
const contentRef = ref<HTMLElement>();

// 计算是否激活
const isActive = computed(() => {
  if (!collapseContext) return false;
  return collapseContext.isPanelActive(panelKey.value);
});

// 处理头部点击
const handleHeaderClick = () => {
  if (props.disabled || !collapseContext) return;
  collapseContext.togglePanel(panelKey.value);
};

// 动画处理
const handleEnter = (el: HTMLElement) => {
  el.style.height = '0';
  el.style.overflow = 'hidden';
  setTimeout(() => {
    if (contentRef.value) {
      el.style.height = `${contentRef.value.offsetHeight}px`;
    }
  }, 0);
};

const handleAfterEnter = (el: HTMLElement) => {
  el.style.height = 'auto';
  el.style.overflow = 'visible';
};

const handleLeave = (el: HTMLElement) => {
  el.style.height = `${el.offsetHeight}px`;
  el.style.overflow = 'hidden';
  setTimeout(() => {
    el.style.height = '0';
  }, 0);
};

// 生命周期
onMounted(() => {
  if (collapseContext) {
    collapseContext.registerPanel(panelKey.value);

    // 默认展开逻辑：如果父组件设置了 defaultExpandAll，则忽略单个面板的 defaultExpanded
    if (
      collapseContext.defaultExpandAll ||
      (props.defaultExpanded && !isActive.value)
    ) {
      collapseContext.togglePanel(panelKey.value);
    }
  }
});

onUnmounted(() => {
  if (collapseContext) {
    collapseContext.unregisterPanel(panelKey.value);
  }
});
</script>

<template>
  <div
    class="aigen-collapse-panel"
    :class="{
      'aigen-collapse-panel--active': isActive,
      'aigen-collapse-panel--bordered': bordered,
    }"
  >
    <!-- 面板头部 -->
    <div
      class="aigen-collapse-panel__header"
      :class="{ 'aigen-collapse-panel__header--active': isActive }"
      @click="handleHeaderClick"
    >
      <div class="aigen-collapse-panel__header-content">
        <!-- 自定义头部插槽 -->
        <slot v-if="$slots.header" name="header" :active="isActive"></slot>
        <template v-else>
          <span class="aigen-collapse-panel__title">{{ title }}</span>
        </template>
      </div>

      <!-- 展开箭头 -->
      <div
        class="aigen-collapse-panel__arrow"
        :class="{ 'aigen-collapse-panel__arrow--active': isActive }"
      >
        <slot name="arrow">
          <AigenIcon name="icon--aigen--arrow-forward-ios-rounded" />
        </slot>
      </div>
    </div>

    <!-- 面板内容（可动画展开） -->
    <transition
      name="aigen-collapse-transition"
      @enter="handleEnter"
      @after-enter="handleAfterEnter"
      @leave="handleLeave"
    >
      <div v-show="isActive" class="aigen-collapse-panel__content-wrapper">
        <div ref="contentRef" class="aigen-collapse-panel__content">
          <slot></slot>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.aigen-collapse-panel {
  transition: all 0.3s ease;
}

.aigen-collapse-panel--bordered {
  border-bottom: 1px solid var(--aigen-border);
}

.aigen-collapse-panel--bordered:last-child {
  border-bottom: none;
}

.aigen-collapse-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
}

.aigen-collapse-panel__header-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.aigen-collapse-panel__title {
  font-weight: 500;
  font-size: 14px;
  color: var(--aigen-text-main);
}

.aigen-collapse-panel__arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  transition: transform 0.3s ease;
  font-size: 12px;
}

.aigen-collapse-panel__arrow--active {
  transform: rotate(90deg);
}

.aigen-collapse-panel__content-wrapper {
  overflow: hidden;
  transition: height 0.3s ease;
}

/* 动画效果 */
.aigen-collapse-transition-enter-active,
.aigen-collapse-transition-leave-active {
  transition: height 0.3s ease;
  overflow: hidden;
}

.aigen-collapse-transition-enter-from,
.aigen-collapse-transition-leave-to {
  height: 0;
}
</style>