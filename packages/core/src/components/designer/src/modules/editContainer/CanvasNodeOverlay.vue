<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, nextTick, onUnmounted, ref, watch } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import {
  useDesignerContext,
  useLinkMode,
  useStore,
} from '@aigen-designer/hooks';
import { findRelatedReactiveRules } from '@aigen-designer/utils';

import EventBadge from './EventBadge.vue';

defineOptions({
  name: 'CanvasNodeOverlay',
});

const props = defineProps<{
  containerRef: HTMLElement | null;
}>();

interface OverlayEntry {
  hasEventsOrRules: boolean;
  height: number;
  id: string;
  isLinkSource: boolean;
  isLinkTarget: boolean;
  left: number;
  schema: ComponentSchema;
  top: number;
  width: number;
}

const designer = useDesignerContext();
const linkMode = useLinkMode();
const { canvasScale, disabledZoom } = useStore();

const entries = ref<OverlayEntry[]>([]);

function collectSchemas(
  list: ComponentSchema[] | undefined,
  acc: ComponentSchema[] = [],
): ComponentSchema[] {
  if (!Array.isArray(list)) return acc;
  for (const item of list) {
    if (!item) continue;
    acc.push(item);
    if (Array.isArray(item.children)) {
      collectSchemas(item.children, acc);
    }
    if (item.slots) {
      for (const slotList of Object.values(item.slots)) {
        if (Array.isArray(slotList)) {
          collectSchemas(slotList, acc);
        }
      }
    }
  }
  return acc;
}

const overlayTargets = computed(() => {
  const all = collectSchemas(designer.pageSchema.schemas);
  const linkActive = linkMode.isActive.value;
  const sourceId = linkMode.source.value?.id;
  const targetId = linkMode.target.value?.id;
  const result: Array<{
    hasEventsOrRules: boolean;
    isLinkSource: boolean;
    isLinkTarget: boolean;
    schema: ComponentSchema;
  }> = [];

  for (const schema of all) {
    if (!schema.id || schema.props?.hidden) continue;
    const hasOn = Boolean(
      schema.on &&
        Object.values(schema.on).some(
          (arr) => Array.isArray(arr) && arr.length > 0,
        ),
    );
    const hasRules =
      hasOn || findRelatedReactiveRules(designer.pageSchema, schema).total > 0;
    const isLinkSource = Boolean(linkActive && sourceId === schema.id);
    const isLinkTarget = Boolean(linkActive && targetId === schema.id);
    if (hasRules || isLinkSource || isLinkTarget) {
      result.push({
        hasEventsOrRules: hasRules,
        isLinkSource,
        isLinkTarget,
        schema,
      });
    }
  }
  return result;
});

let rafId: null | number = null;

function updatePositions() {
  const container = props.containerRef;
  if (!container) {
    entries.value = [];
    return;
  }
  const containerRect = container.getBoundingClientRect();
  const scale = disabledZoom.value ? 1 : canvasScale.value || 1;
  const next: OverlayEntry[] = [];

  for (const target of overlayTargets.value) {
    const el = container.querySelector(
      `[data-aigen-id="${target.schema.id}"]`,
    ) as HTMLElement | null;
    if (!el) continue;
    let rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && el.firstElementChild) {
      rect = el.firstElementChild.getBoundingClientRect();
    }
    if (rect.width === 0 && rect.height === 0) continue;

    next.push({
      hasEventsOrRules: target.hasEventsOrRules,
      height: rect.height / scale,
      id: target.schema.id!,
      isLinkSource: target.isLinkSource,
      isLinkTarget: target.isLinkTarget,
      left: (rect.left - containerRect.left) / scale + container.scrollLeft,
      schema: target.schema,
      top: (rect.top - containerRect.top) / scale + container.scrollTop,
      width: rect.width / scale,
    });
  }
  entries.value = next;
}

function scheduleUpdate() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    updatePositions();
  });
}

let mutationObserver: MutationObserver | null = null;
let resizeObserver: null | ResizeObserver = null;
let observedContainer: HTMLElement | null = null;

function cleanupObservers() {
  mutationObserver?.disconnect();
  mutationObserver = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (observedContainer) {
    observedContainer.removeEventListener('scroll', scheduleUpdate);
    observedContainer = null;
  }
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

watch(
  () => props.containerRef,
  (container) => {
    cleanupObservers();
    if (!container) return;
    observedContainer = container;
    container.addEventListener('scroll', scheduleUpdate, { passive: true });
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(scheduleUpdate);
      mutationObserver.observe(container, {
        attributeFilter: ['style', 'class'],
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(container);
    }
    nextTick(updatePositions);
  },
  { immediate: true },
);

watch(
  [overlayTargets, canvasScale, disabledZoom],
  () => {
    nextTick(scheduleUpdate);
  },
  { deep: true },
);

onUnmounted(cleanupObservers);
</script>

<template>
  <div class="aigen-canvas-node-overlay" aria-hidden="true">
    <div
      v-for="item in entries"
      :key="item.id"
      class="aigen-overlay-node-box"
      :class="{
        'aigen-node--link-source': item.isLinkSource,
        'aigen-node--link-target': item.isLinkTarget,
      }"
      :style="{
        top: `${item.top}px`,
        left: `${item.left}px`,
        width: `${item.width}px`,
        height: `${item.height}px`,
      }"
    >
      <div
        v-if="item.isLinkSource"
        class="aigen-link-role-badge aigen-link-role-badge--source"
      >
        <AigenIcon
          name="icon--behavior--thunderbolt"
          class="mr-1 text-[11px]"
        />
        <span>触发源</span>
      </div>
      <div
        v-if="item.isLinkTarget"
        class="aigen-link-role-badge aigen-link-role-badge--target"
      >
        <AigenIcon name="icon--behavior--experiment" class="mr-1 text-[11px]" />
        <span>关联目标</span>
      </div>
      <EventBadge v-if="item.hasEventsOrRules" :schema="item.schema" />
    </div>
  </div>
</template>

<style scoped>
.aigen-canvas-node-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 40;
}

.aigen-overlay-node-box {
  position: absolute;
  pointer-events: none;
  box-sizing: border-box;
}

.aigen-overlay-node-box :deep(.aigen-event-badge) {
  pointer-events: auto;
}

.aigen-overlay-node-box.aigen-node--link-source {
  border-radius: 6px;
  outline: 2px solid #1677ff;
  outline-offset: -1px;
  box-shadow:
    inset 0 0 0 1px rgba(22, 119, 255, 0.2),
    0 2px 8px rgba(22, 119, 255, 0.12);
  background-color: rgba(22, 119, 255, 0.035);
}

.aigen-overlay-node-box.aigen-node--link-target {
  border-radius: 6px;
  outline: 2px solid #52c41a;
  outline-offset: -1px;
  box-shadow:
    inset 0 0 0 1px rgba(82, 196, 26, 0.2),
    0 2px 8px rgba(82, 196, 26, 0.12);
  background-color: rgba(82, 196, 26, 0.035);
}

.aigen-link-role-badge {
  position: absolute;
  top: 4px;
  right: 8px;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  pointer-events: none;
  white-space: nowrap;
}

.aigen-link-role-badge--source {
  background: #e6f4ff;
  border: 1px solid #91caff;
  color: #0958d9;
  box-shadow: 0 1px 3px rgba(22, 119, 255, 0.12);
}

.aigen-link-role-badge--target {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #389e0d;
  box-shadow: 0 1px 3px rgba(82, 196, 26, 0.12);
}
</style>
