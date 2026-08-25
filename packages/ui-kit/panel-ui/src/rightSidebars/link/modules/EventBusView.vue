<script lang="ts" setup>
import type { PageSchema } from '@aigen-designer/types';

import type { EventBusAction } from './linkHelper';

import { computed } from 'vue';

import { useDesignerContext } from '@aigen-designer/hooks';

import { scanEventBusActions } from './linkHelper';

/**
 * 事件总线子模块（B4.4）：
 * - 说明文案：页面内部的事件通道，用于元素之间解耦通信（通道为页面级 root，限定页面内）；
 * - 扫描页面 schema 的 on 中 methodName 含 emitEvent（广播）/ onEvent（监听）的动作，按事件名分组一览；
 * - 引导：去「行为」面板添加「执行函数 → emitEvent('事件名', 数据)」广播 / 「onEvent('事件名', ...)」监听。
 * P3 运行时由 WP-C 将 emitEvent / onEvent 注册为公共方法；本模块只做设计态静态扫描展示，不执行任何动作。
 */
const designer = useDesignerContext();
const pageSchema: PageSchema = designer.pageSchema;

/** 按事件名分组的广播 / 监听动作一览 */
interface EventBusGroup {
  emits: EventBusAction[];
  eventName: string;
  listens: EventBusAction[];
}

const busGroups = computed<EventBusGroup[]>(() => {
  const groups = new Map<string, EventBusGroup>();
  scanEventBusActions(pageSchema).forEach((item) => {
    const group = groups.get(item.eventName) ?? {
      emits: [],
      eventName: item.eventName,
      listens: [],
    };
    if (item.kind === 'emit') {
      group.emits.push(item);
    } else {
      group.listens.push(item);
    }
    groups.set(item.eventName, group);
  });
  return [...groups.values()];
});
</script>

<template>
  <div class="aigen-link-eventbus">
    <!-- 说明文案 -->
    <div class="aigen-link-eventbus__desc">
      事件总线是页面内部的事件通道，用于元素之间解耦通信：A 元素广播事件，B
      元素监听并执行动作链。通道限定在页面内。
    </div>

    <!-- 已配置的广播 / 监听动作一览 -->
    <template v-if="busGroups.length">
      <div
        v-for="group in busGroups"
        :key="group.eventName"
        class="aigen-link-eventbus__group"
      >
        <div class="aigen-link-eventbus__group-name">
          {{ group.eventName }}
        </div>
        <div v-if="group.emits.length" class="aigen-link-eventbus__row">
          <span
            class="aigen-link-eventbus__badge aigen-link-eventbus__badge--emit"
          >
            广播
          </span>
          <span
            v-for="emit in group.emits"
            :key="emit.ownerId + emit.boundEvent"
            class="aigen-link-eventbus__text"
            :title="emit.ownerId"
          >
            「{{ emit.ownerLabel }}」在 [{{ emit.boundEvent }}] 时 emitEvent
          </span>
        </div>
        <div v-if="group.listens.length" class="aigen-link-eventbus__row">
          <span
            class="aigen-link-eventbus__badge aigen-link-eventbus__badge--listen"
          >
            监听
          </span>
          <span
            v-for="listen in group.listens"
            :key="listen.ownerId + listen.boundEvent"
            class="aigen-link-eventbus__text"
            :title="listen.ownerId"
          >
            「{{ listen.ownerLabel }}」在 [{{ listen.boundEvent }}] 时 onEvent
          </span>
        </div>
      </div>
    </template>
    <div v-else class="aigen-link-eventbus__empty">
      页面暂未配置事件总线动作。在「行为」面板为元素添加：执行函数（公共函数）→
      emitEvent('事件名', 数据) 广播；onEvent('事件名', ...) 监听。
    </div>

    <!-- 引导 -->
    <div class="aigen-link-eventbus__guide">
      添加方式：选中元素 → 右侧「行为」面板 → 事件旁 ＋ → 类型选「执行函数」→
      方法选 emitEvent / onEvent（P3 运行时提供），参数第一个为事件名。
    </div>
  </div>
</template>

<style scoped>
.aigen-link-eventbus__desc {
  margin-bottom: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--aigen-text-helper);
  background: var(--aigen-secondary, #f5f6f8);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-link-eventbus__group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  padding: 8px 10px;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-link-eventbus__group-name {
  font-size: 13px;
  font-weight: 500;
  font-family: monospace;
  color: var(--aigen-primary);
  word-break: break-all;
}

.aigen-link-eventbus__row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.aigen-link-eventbus__badge {
  align-self: flex-start;
  padding: 1px 6px;
  font-size: 11px;
  border-radius: 8px;
}

.aigen-link-eventbus__badge--emit {
  color: var(--aigen-primary);
  background: var(--aigen-primary-faded);
}

.aigen-link-eventbus__badge--listen {
  color: var(--aigen-text-secondary);
  background: var(--aigen-muted);
}

.aigen-link-eventbus__text {
  font-size: 12px;
  line-height: 1.6;
  color: var(--aigen-text-main);
  word-break: break-all;
}

.aigen-link-eventbus__empty {
  padding: 16px 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--aigen-text-helper);
}

.aigen-link-eventbus__guide {
  margin-top: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--aigen-text-helper);
  border-left: 3px solid var(--aigen-primary);
  background: var(--aigen-secondary, #f5f6f8);
}
</style>
