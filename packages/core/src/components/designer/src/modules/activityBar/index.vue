<script lang="ts" setup>
import type { ActivitybarModel } from '@aigen-designer/types';

import { computed, ref, shallowRef } from 'vue';

import { AigenIcon, AigenTooltip } from '@aigen-designer/base-ui';
import { pluginManager } from '@aigen-designer/manager';

defineOptions({
  name: 'AigenActivityBar',
});
const activityBars = computed(() => {
  return pluginManager.panel.activityBars.value
    .filter((item) => item.visible)
    .sort((a, b) => {
      return a.sort! - b.sort!;
    });
});

const activityBarCheckedIndex = ref<null | number>(0);

const sidebarComponent = shallowRef<any>(null);
// 空列表保护：无 activityBar 时不取第一个元素的 component，避免崩溃
sidebarComponent.value = activityBars.value[0]?.component ?? null;

function handleClick(item: ActivitybarModel, index: number) {
  if (activityBarCheckedIndex.value === index) {
    activityBarCheckedIndex.value = null;
    return false;
  }
  sidebarComponent.value = item.component;
  activityBarCheckedIndex.value = index;
}
</script>
<template>
  <div class="relative flex">
    <div class="aigen-action-bar">
      <ul class="aigen-actions-container flex-center flex-col gap-1">
        <AigenTooltip
          placement="right"
          :content="item.title"
          v-for="(item, index) in activityBars"
          :key="index"
        >
          <li
            class="aigen-action-item flex-center h-8 w-8 text-[16px]"
            :class="{ checked: activityBarCheckedIndex === index }"
            @click="handleClick(item, index)"
          >
            <AigenIcon :name="item.icon" />
            <!-- <div class="text-14px">
            {{ item.title }}
          </div> -->
          </li>
        </AigenTooltip>
      </ul>
    </div>
    <div
      v-if="sidebarComponent"
      class="aigen-left-sidebar"
      :class="{ hide: activityBarCheckedIndex === null }"
    >
      <div class="aigen-sidebar-container">
        <component :is="sidebarComponent" />
      </div>
    </div>
  </div>
</template>
