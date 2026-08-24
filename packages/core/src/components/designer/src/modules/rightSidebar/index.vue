<script lang="ts" setup>
import type { RightSidebarModel } from '@aigen-designer/types';

import { computed, ref, shallowRef } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import { pluginManager } from '@aigen-designer/manager';

import AigenBreadcrumb from './breadcrumb.vue';

const hideRightMain = ref(false);

const rightSidebars = computed(() => {
  return pluginManager.panel.rightSidebars.value
    .filter((item) => item.visible)
    .sort((a, b) => {
      return a.sort! - b.sort!;
    });
});

const activityBarCheckedIndex = ref<null | number>(0);
const sidebarComponent = shallowRef<any>(null);
sidebarComponent.value = rightSidebars.value[0]?.component;

function handleHideRight() {
  hideRightMain.value = !hideRightMain.value;
}

function handleClick(item: RightSidebarModel, index: number) {
  if (activityBarCheckedIndex.value === index) {
    return false;
  }
  sidebarComponent.value = item.component;
  activityBarCheckedIndex.value = index;
}
</script>
<template>
  <div v-if="sidebarComponent" class="aigen-right-sidebar-container relative">
    <!-- 折叠按钮 start -->
    <div
      class="aigen-right-sidebar-hide-btn z-9 absolute flex cursor-pointer items-center justify-center"
      @click="handleHideRight"
    >
      <AigenIcon
        class="transition-all"
        :class="{ 'rotate-180': hideRightMain }"
        name="icon--aigen--arrow-forward-ios-rounded"
      />
    </div>
    <!-- 折叠按钮 end -->

    <div class="aigen-right-sidebar w-308px" :class="{ hide: hideRightMain }">
      <AigenBreadcrumb />
      <ul class="aigen-actions-container">
        <li
          v-for="(item, index) in rightSidebars"
          :key="index"
          class="aigen-action-item"
          :title="item.title"
          :class="{ checked: activityBarCheckedIndex === index }"
          @click="handleClick(item, index)"
        >
          {{ item.title }}
        </li>
      </ul>
      <div class="aigen-sidebar-content">
        <component :is="sidebarComponent" />
      </div>
    </div>
  </div>
</template>