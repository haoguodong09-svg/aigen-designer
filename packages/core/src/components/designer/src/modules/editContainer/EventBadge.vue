<script lang="ts" setup>
import type { ActionsModel, ComponentSchema } from '@aigen-designer/types';

import { computed } from 'vue';

import { AigenTooltip } from '@aigen-designer/base-ui';
import { useDesignerContext, usePageManager } from '@aigen-designer/hooks';
import { findSchemaById, normalizeAction } from '@aigen-designer/utils';

defineOptions({
  name: 'EventBadge',
});
const props = defineProps<{
  schema: ComponentSchema;
}>();

const designer = useDesignerContext();
const pageManager = usePageManager();

/** 当前元素事件动作统计（遍历 schema.on 各事件数组，enabled === false 计入停用） */
const actionStats = computed(() => {
  const actions: ActionsModel[] = [];
  const on = props.schema.on;
  if (on) {
    for (const eventName of Object.keys(on)) {
      const list = on[eventName];
      if (!Array.isArray(list)) continue;
      for (const raw of list) {
        // 读取层归一化（兼容旧数据缺 id/enabled）
        const action = normalizeAction(raw);
        if (action) {
          actions.push(action);
        }
      }
    }
  }
  return {
    actions,
    disabled: actions.filter((item) => item.enabled === false).length,
    total: actions.length,
  };
});

/** 有动作才显示角标 */
const showBadge = computed(() => actionStats.value.total > 0);
/** 全部动作停用 → 角标置灰 */
const allDisabled = computed(
  () =>
    actionStats.value.total > 0 &&
    actionStats.value.disabled === actionStats.value.total,
);

/** 轻量动作人话摘要：methodName + 目标组件 label（core 内实现，不跨包引用 panel-ui 摘要） */
function getActionBrief(action: ActionsModel): string {
  if (action.type === 'component' && action.componentId) {
    const target = findSchemaById(
      designer.pageSchema.schemas,
      action.componentId,
    );
    const label = target?.label ?? action.componentId;
    return `${action.methodName}(${label})`;
  }
  return action.methodName || '未知动作';
}

/** tooltip 内容：前 2 条动作摘要 + 统计脚注 */
const tooltipContent = computed(() => {
  const { actions, disabled, total } = actionStats.value;
  return {
    footer: `共 ${total} 个动作，${disabled} 个停用`,
    lines: actions.slice(0, 2).map((action) => {
      const brief = getActionBrief(action);
      return action.enabled === false ? `${brief}（停用）` : brief;
    }),
  };
});

/** 点击角标：选中该元素，且 stopPropagation 不干扰画布 */
function handleBadgeClick(event: MouseEvent) {
  event.stopPropagation();
  designer.setSelectedNode(props.schema);
}
</script>

<template>
  <div
    v-if="showBadge && pageManager.isDesignMode.value"
    class="aigen-event-badge"
    @click="handleBadgeClick"
  >
    <AigenTooltip placement="top" :mouse-enter-delay="200">
      <template #content>
        <div class="aigen-event-badge-tip">
          <div
            v-for="line in tooltipContent.lines"
            :key="line"
            class="aigen-event-badge-tip-line"
          >
            {{ line }}
          </div>
          <div class="aigen-event-badge-tip-footer">
            {{ tooltipContent.footer }}
          </div>
        </div>
      </template>
      <span
        class="aigen-event-badge-dot"
        :class="{ 'aigen-event-badge-dot--disabled': allDisabled }"
      >
        ⚡{{ actionStats.total }}
      </span>
    </AigenTooltip>
  </div>
</template>

<style scoped>
/* 角标外层容器：不拦截画布交互（pointer-events: none），徽标自身可点选 */
.aigen-event-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 1000;
  pointer-events: none;
}

/* 徽标本体：可点选（pointer-events: auto） */
.aigen-event-badge-dot {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--aigen-primary-foreground);
  background: var(--aigen-primary);
  border-radius: 2px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  user-select: none;
}

/* 全部动作停用：置灰 */
.aigen-event-badge-dot--disabled {
  color: var(--aigen-muted-foreground);
  background: var(--aigen-muted);
}

.aigen-event-badge-tip {
  font-size: 12px;
  line-height: 1.6;
}

.aigen-event-badge-tip-line {
  white-space: nowrap;
}

.aigen-event-badge-tip-footer {
  margin-top: 4px;
  color: var(--aigen-text-helper);
}
</style>
