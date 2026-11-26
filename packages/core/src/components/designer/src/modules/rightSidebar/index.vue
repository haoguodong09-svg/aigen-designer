<script lang="ts" setup>
import type { RightSidebarModel } from '@aigen-designer/types';

import { computed, provide, ref, shallowRef, watch } from 'vue';

import { AigenIcon, AigenTooltip } from '@aigen-designer/base-ui';
import { pluginManager } from '@aigen-designer/manager';

const hideRightMain = ref(false);
const isPinned = ref(true);
const styleAllExpanded = ref(true);
const attrAllExpanded = ref(true);
provide('aigen-style-all-expanded', styleAllExpanded);
provide('aigen-attr-all-expanded', attrAllExpanded);

const rightSidebars = computed(() => {
  return pluginManager.panel.rightSidebars.value
    .filter((item) => item.visible)
    .sort((a, b) => {
      return (a.sort ?? 0) - (b.sort ?? 0);
    });
});

const activityBarCheckedIndex = ref<null | number>(0);
const sidebarComponent = shallowRef<any>(null);
sidebarComponent.value = rightSidebars.value[0]?.component ?? null;

const activeSidebar = computed(() => {
  if (activityBarCheckedIndex.value === null) {
    return null;
  }
  return rightSidebars.value[activityBarCheckedIndex.value] ?? null;
});

const hasGroupCollapseToggle = computed(
  () =>
    activeSidebar.value?.id === 'style_view' ||
    activeSidebar.value?.id === 'attribute_view',
);

const isCurrentAllExpanded = computed(() =>
  activeSidebar.value?.id === 'attribute_view'
    ? attrAllExpanded.value
    : styleAllExpanded.value,
);

function handleToggleAllExpanded() {
  if (activeSidebar.value?.id === 'attribute_view') {
    attrAllExpanded.value = !attrAllExpanded.value;
    return;
  }
  styleAllExpanded.value = !styleAllExpanded.value;
}

// 同步外部激活的右侧边栏 ID（如从画布气泡或角标跳转）
watch(
  () => pluginManager.panel.activeRightSidebarId?.value,
  (id) => {
    if (!id) return;
    const index = rightSidebars.value.findIndex((item) => item.id === id);
    if (index !== -1) {
      activityBarCheckedIndex.value = index;
      sidebarComponent.value = rightSidebars.value[index].component;
      hideRightMain.value = false;
    }
  },
  { immediate: true },
);

function handleCloseRight() {
  hideRightMain.value = true;
}

function handleTogglePin() {
  isPinned.value = !isPinned.value;
}

function handleClick(item: RightSidebarModel, index: number) {
  // 点击当前已展开的页签时收起，收起状态下点击则展开（对齐 TinyEngine 右侧导航栏交互）
  if (activityBarCheckedIndex.value === index && !hideRightMain.value) {
    hideRightMain.value = true;
    return;
  }
  sidebarComponent.value = item.component;
  activityBarCheckedIndex.value = index;
  hideRightMain.value = false;
  if (item.id && pluginManager.panel.setActiveRightSidebar) {
    pluginManager.panel.setActiveRightSidebar(item.id);
  }
}
</script>
<template>
  <div v-if="rightSidebars.length > 0" class="aigen-right-sidebar-container">
    <div
      class="aigen-right-sidebar"
      :class="{ hide: hideRightMain || !sidebarComponent }"
    >
      <div class="aigen-right-sidebar-header">
        <span class="aigen-right-sidebar-title">
          {{ activeSidebar?.title ?? '' }}
        </span>
        <div class="aigen-right-sidebar-header-actions">
          <button
            v-if="hasGroupCollapseToggle"
            type="button"
            class="aigen-right-header-btn"
            :title="isCurrentAllExpanded ? '全部折叠' : '全部展开'"
            :aria-label="isCurrentAllExpanded ? '全部折叠' : '全部展开'"
            @click="handleToggleAllExpanded"
          >
            <svg
              v-if="isCurrentAllExpanded"
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M5 3.5L8 6.5L11 3.5" />
              <path d="M5 12.5L8 9.5L11 12.5" />
            </svg>
            <svg
              v-else
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M5 6L8 3L11 6" />
              <path d="M5 10L8 13L11 10" />
            </svg>
          </button>
          <button
            type="button"
            class="aigen-right-header-btn"
            :class="{ 'is-active': isPinned }"
            :title="isPinned ? '已固定面板' : '固定面板'"
            :aria-label="isPinned ? '已固定面板' : '固定面板'"
            @click="handleTogglePin"
          >
            <AigenIcon
              :name="
                isPinned
                  ? 'icon--aigen--lock-outline'
                  : 'icon--aigen--lock-open-outline'
              "
            />
          </button>
          <button
            type="button"
            class="aigen-right-header-btn"
            title="收起面板"
            aria-label="收起面板"
            @click="handleCloseRight"
          >
            <AigenIcon name="icon--aigen--close" />
          </button>
        </div>
      </div>

      <div class="aigen-sidebar-content">
        <component :is="sidebarComponent" v-if="sidebarComponent" />
      </div>
    </div>

    <!-- 右侧垂直图标导航栏（对标 TinyEngine #tiny-engine-nav-panel） -->
    <div class="aigen-right-action-bar">
      <ul class="aigen-right-actions-container">
        <AigenTooltip
          v-for="(item, index) in rightSidebars"
          :key="item.id || index"
          placement="left"
          :content="item.title"
        >
          <li
            class="aigen-right-action-item"
            :class="{
              checked: !hideRightMain && activityBarCheckedIndex === index,
            }"
            :title="item.title"
            @click="handleClick(item, index)"
          >
            <AigenIcon
              v-if="item.icon"
              :name="item.icon"
              class="aigen-right-action-icon"
            />
            <span v-else class="aigen-right-action-fallback">
              {{ item.title.slice(0, 1) }}
            </span>
          </li>
        </AigenTooltip>
      </ul>
    </div>
  </div>
</template>
