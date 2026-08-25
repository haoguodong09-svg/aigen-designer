<script lang="ts" setup>
import type { PageSchema } from '@aigen-designer/types';

import type { PropType } from 'vue';

import { computed } from 'vue';

import { getActionSummaryText } from './actionSummary';

defineOptions({
  name: 'ActionSummary',
});

const props = defineProps({
  action: {
    required: true,
    type: Object as PropType<any>,
  },
  pageSchema: {
    default: undefined,
    type: Object as PropType<PageSchema | undefined>,
  },
});

// 动作摘要文本（纯函数生成，供展示与搜索共用；设计态仅求值展示，不触发运行时事件）
const summary = computed(() =>
  getActionSummaryText(props.action, props.pageSchema),
);
</script>

<template>
  <span class="aigen-action-summary" :title="summary">{{ summary }}</span>
</template>

<style scoped>
.aigen-action-summary {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: inherit;
  font-size: var(--aigen-text-sm);
  line-height: 20px;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}
</style>
