<script lang="ts" setup>
import type { ActionsModel, ComponentSchema } from '@aigen-designer/types';

import { computed } from 'vue';

import { AigenIcon, AigenTooltip } from '@aigen-designer/base-ui';
import {
  useDesignerContext,
  useLinkMode,
  usePageManager,
} from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import {
  findRelatedReactiveRules,
  findSchemaById,
  findSchemas,
  getRuleSummary,
  normalizeAction,
} from '@aigen-designer/utils';

defineOptions({
  name: 'EventBadge',
});
const props = defineProps<{
  schema: ComponentSchema;
}>();

const designer = useDesignerContext();
const pageManager = usePageManager();
const linkMode = useLinkMode();

/** 当前元素命令式事件动作统计（遍历 schema.on 各事件数组） */
const actionStats = computed(() => {
  const actions: ActionsModel[] = [];
  const on = props.schema.on;
  if (on) {
    for (const eventName of Object.keys(on)) {
      const list = on[eventName];
      if (!Array.isArray(list)) continue;
      for (const raw of list) {
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

/** 当前元素相关的响应式联动规则（作为目标或作为条件源） */
const relatedRules = computed(() => {
  return findRelatedReactiveRules(designer.pageSchema, props.schema);
});

/** 有动作或有联动规则即显示角标（关联模式交互期间暂时让位，避免视觉干扰） */
const showBadge = computed(
  () =>
    !linkMode.isActive.value &&
    (actionStats.value.total > 0 || relatedRules.value.total > 0),
);

/** 全部动作停用判定 */
const allDisabled = computed(
  () =>
    actionStats.value.total > 0 &&
    actionStats.value.disabled === actionStats.value.total &&
    relatedRules.value.total === 0,
);

/** 轻量动作人话摘要 */
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

function resolveLabel(fieldOrId: string): string {
  const schema = findSchemaById(designer.pageSchema.schemas, fieldOrId);
  if (schema) return (schema.label as string) || schema.id || fieldOrId;
  const matchResult = findSchemas(
    designer.pageSchema.schemas,
    (s) => s.field === fieldOrId,
    true,
  );
  if (
    matchResult &&
    typeof matchResult === 'object' &&
    !Array.isArray(matchResult)
  ) {
    const matchField = matchResult as ComponentSchema;
    return (
      (matchField.label as string) || (matchField.field as string) || fieldOrId
    );
  }
  return fieldOrId;
}

/** tooltip 内容：动作摘要 + 规则摘要 + 统计脚注 */
const tooltipContent = computed(() => {
  const { actions, disabled, total: actionTotal } = actionStats.value;
  const { asSource, asTarget, total: ruleTotal } = relatedRules.value;

  const items: { icon: string; text: string; type: 'action' | 'rule' }[] = [];

  // 前 2 条命令式动作
  actions.slice(0, 2).forEach((action) => {
    const brief = getActionBrief(action);
    items.push({
      icon: 'icon--behavior--thunderbolt',
      text: action.enabled === false ? `${brief}（停用）` : brief,
      type: 'action',
    });
  });

  // 联动规则人话
  asTarget.slice(0, 2).forEach((rule) => {
    items.push({
      icon: 'icon--aigen--link-rounded',
      text: getRuleSummary(rule, resolveLabel, resolveLabel),
      type: 'rule',
    });
  });
  asSource.slice(0, 2).forEach((rule) => {
    if (!asTarget.some((r) => r.id === rule.id)) {
      items.push({
        icon: 'icon--aigen--link-rounded',
        text: getRuleSummary(rule, resolveLabel, resolveLabel),
        type: 'rule',
      });
    }
  });

  const footers: string[] = [];
  if (actionTotal > 0) {
    footers.push(`${actionTotal} 个动作${disabled ? `(${disabled}停用)` : ''}`);
  }
  if (ruleTotal > 0) {
    footers.push(`${ruleTotal} 条联动规则`);
  }

  return {
    footer: footers.join('，') || '暂无详细信息',
    items: items.slice(0, 4),
  };
});

/** 点击角标：选中该元素并直接切到右侧「行为」面板 */
function handleBadgeClick(event: MouseEvent) {
  event.stopPropagation();
  designer.setSelectedNode(props.schema);
  pluginManager.panel.setActiveRightSidebar?.('event_view');
}
</script>

<template>
  <div
    v-if="showBadge && pageManager.isDesignMode.value"
    class="aigen-event-badge"
    @click="handleBadgeClick"
  >
    <AigenTooltip
      placement="top"
      :mouse-enter-delay="200"
      overlay-class-name="aigen-event-badge-tooltip"
      :overlay-style="{ maxWidth: '420px', minWidth: '220px' }"
    >
      <template #content>
        <div class="aigen-event-badge-tip">
          <div
            v-for="(item, idx) in tooltipContent.items"
            :key="idx"
            class="aigen-event-badge-tip-line"
          >
            <span
              class="aigen-event-badge-tip-icon-box"
              :class="`aigen-event-badge-tip-icon-box--${item.type}`"
            >
              <AigenIcon :name="item.icon" class="aigen-event-badge-tip-icon" />
            </span>
            <span class="aigen-event-badge-tip-text">{{ item.text }}</span>
          </div>
          <div class="aigen-event-badge-tip-footer">
            <span class="aigen-event-badge-tip-footer-stat">
              {{ tooltipContent.footer }}
            </span>
            <span class="aigen-event-badge-tip-footer-action">
              点击打开行为面板
            </span>
          </div>
        </div>
      </template>
      <span
        class="aigen-event-badge-dot"
        :class="{ 'aigen-event-badge-dot--disabled': allDisabled }"
      >
        <span v-if="actionStats.total > 0" class="aigen-event-badge-segment">
          <AigenIcon name="icon--behavior--thunderbolt" class="text-[10px]" />
          <span>{{ actionStats.total }}</span>
        </span>
        <span v-if="relatedRules.total > 0" class="aigen-event-badge-segment">
          <AigenIcon name="icon--aigen--link-rounded" class="text-[11px]" />
          <span>{{ relatedRules.total }}</span>
        </span>
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
  gap: 4px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--aigen-primary-foreground, #fff);
  background: var(--aigen-primary, #2563eb);
  border-radius: 3px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  user-select: none;
  pointer-events: auto;
}

.aigen-event-badge-segment {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

/* 全部动作停用：置灰 */
.aigen-event-badge-dot--disabled {
  color: var(--aigen-muted-foreground, #94a3b8);
  background: var(--aigen-muted, #e2e8f0);
}

/* 提示气泡内容结构化布局 */
.aigen-event-badge-tip {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  box-sizing: border-box;
}

.aigen-event-badge-tip-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 2px 0;
  box-sizing: border-box;
}

/* 图标容器：精确 18x18 独立容器，居中对齐，与首行文字 18px 行高完全一致 */
.aigen-event-badge-tip-icon-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  flex-shrink: 0;
  line-height: 1;
  box-sizing: border-box;
}

.aigen-event-badge-tip-icon-box--action {
  background: rgba(250, 173, 20, 0.18);
  color: #faad14;
}

.aigen-event-badge-tip-icon-box--rule {
  background: rgba(22, 119, 255, 0.18);
  color: #60a5fa;
}

.aigen-event-badge-tip-icon-box :deep(.iconfont),
.aigen-event-badge-tip-icon-box :deep(.icon--aigen),
.aigen-event-badge-tip-icon-box :deep(.icon--behavior) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  vertical-align: middle;
}

/* 规则/动作文本内容：行高 18px 与图标容器高度 18px 严格对齐，垂直居中 */
.aigen-event-badge-tip-text {
  flex: 1;
  font-size: 12px;
  line-height: 18px;
  color: rgba(255, 255, 255, 0.95);
  word-break: break-all;
  letter-spacing: 0.2px;
}

/* 底部操作指引与统计 */
.aigen-event-badge-tip-footer {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  line-height: 16px;
  color: rgba(255, 255, 255, 0.65);
}

.aigen-event-badge-tip-footer-stat {
  color: rgba(255, 255, 255, 0.7);
}

.aigen-event-badge-tip-footer-action {
  color: #60a5fa;
  cursor: pointer;
  white-space: nowrap;
  opacity: 0.9;
}
</style>
