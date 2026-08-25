<script lang="ts" setup>
import { ref } from 'vue';

import ComputedFieldEditor from './modules/ComputedFieldEditor.vue';
import EventBusView from './modules/EventBusView.vue';
import FieldLinkEditor from './modules/FieldLinkEditor.vue';

/**
 * 「关联与计算」右侧面板（link_view，sort 250，见 B4 / WP-B）。
 * 三个子模块：字段联动（schema.links）/ 计算字段（pageSchema.computed）/ 事件总线（on 扫描）。
 * 设计态安全：本面板只做规则保存与求值预览，不触发任何运行时事件；
 * 联动规则保存后由运行时编译（WP-C linkCompiler）在预览 / 发布环境生效。
 */
type LinkTab = 'computed' | 'event-bus' | 'field-link';

const TABS: Array<{ key: LinkTab; title: string }> = [
  { key: 'field-link', title: '字段联动' },
  { key: 'computed', title: '计算字段' },
  { key: 'event-bus', title: '事件总线' },
];

const activeTab = ref<LinkTab>('field-link');
</script>

<template>
  <div class="aigen-link-view">
    <!-- 顶部说明：设计态安全 + 生效时机 -->
    <div class="aigen-link-view__desc">
      联动与计算规则在设计态仅保存与预览，不触发任何运行时事件；保存后经运行时编译，在预览与发布环境生效。
    </div>

    <!-- 三个子模块页签 -->
    <div class="aigen-link-view__tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        class="aigen-link-view__tab"
        :class="{ 'aigen-link-view__tab--active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.title }}
      </button>
    </div>

    <div class="aigen-link-view__body">
      <FieldLinkEditor v-if="activeTab === 'field-link'" />
      <ComputedFieldEditor v-else-if="activeTab === 'computed'" />
      <EventBusView v-else />
    </div>
  </div>
</template>

<style scoped>
.aigen-link-view {
  padding: 4px 0 12px;
}

/* 顶部说明文案 */
.aigen-link-view__desc {
  margin: 0 12px 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--aigen-text-helper);
  background: var(--aigen-secondary, #f5f6f8);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

/* 页签栏 */
.aigen-link-view__tabs {
  display: flex;
  gap: 4px;
  margin: 0 12px 8px;
  padding: 3px;
  background: var(--aigen-secondary, #f5f6f8);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-link-view__tab {
  flex: 1;
  padding: 5px 0;
  font-size: 13px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 4px;
}

.aigen-link-view__tab:hover {
  color: var(--aigen-primary);
}

.aigen-link-view__tab--active {
  color: var(--aigen-primary);
  font-weight: 500;
  background: var(--aigen-background, #fff);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.aigen-link-view__body {
  padding: 0 12px;
}
</style>
