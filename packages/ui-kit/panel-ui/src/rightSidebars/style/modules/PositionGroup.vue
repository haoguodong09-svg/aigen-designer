<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useStyleState } from '../composables/useStyleState';
import SpacingPopover from './SpacingPopover.vue';
import StyleSelect from './StyleSelect.vue';

type OffsetSide = 'bottom' | 'left' | 'right' | 'top';

const OFFSET_LABELS: Record<OffsetSide, string> = {
  bottom: '下偏移 (bottom)',
  left: '左偏移 (left)',
  right: '右偏移 (right)',
  top: '上偏移 (top)',
};

const { batchSetStyle, getStyle, setStyle } = useStyleState();

const positionVal = computed(() => getStyle('position') || 'static');
const showOffsetPanel = computed(() => positionVal.value !== 'static');

const POSITION_OPTIONS = [
  { label: 'Static - 默认定位', value: 'static' },
  { label: 'Relative - 相对定位', value: 'relative' },
  { label: 'Absolute - 绝对定位', value: 'absolute' },
  { label: 'Fixed - 固定定位', value: 'fixed' },
  { label: 'Sticky - 粘性定位', value: 'sticky' },
];

const ANCHOR_PRESETS: Array<{
  label: string;
  patch: Record<string, string | undefined>;
  title: string;
}> = [
  {
    label: '↖',
    patch: { bottom: undefined, left: '0px', right: undefined, top: '0px' },
    title: '左上',
  },
  {
    label: '↗',
    patch: { bottom: undefined, left: undefined, right: '0px', top: '0px' },
    title: '右上',
  },
  {
    label: '↙',
    patch: { bottom: '0px', left: '0px', right: undefined, top: undefined },
    title: '左下',
  },
  {
    label: '↘',
    patch: { bottom: '0px', left: undefined, right: '0px', top: undefined },
    title: '右下',
  },
  {
    label: '⇤',
    patch: { bottom: '0px', left: '0px', right: undefined, top: '0px' },
    title: '贴左撑满',
  },
  {
    label: '⇥',
    patch: { bottom: '0px', left: undefined, right: '0px', top: '0px' },
    title: '贴右撑满',
  },
  {
    label: '⤓',
    patch: { bottom: '0px', left: '0px', right: '0px', top: undefined },
    title: '贴底撑满',
  },
  {
    label: '⤒',
    patch: { bottom: undefined, left: '0px', right: '0px', top: '0px' },
    title: '贴顶撑满',
  },
  {
    label: '▣',
    patch: { bottom: '0px', left: '0px', right: '0px', top: '0px' },
    title: '全铺满',
  },
];

const activeOffset = ref<null | OffsetSide>(null);
const offsetAnchorRect = ref<DOMRect | null>(null);
const offsetPopoverOpen = ref(false);

function openOffset(side: OffsetSide, e: MouseEvent) {
  activeOffset.value = side;
  offsetAnchorRect.value = (
    e.currentTarget as HTMLElement
  ).getBoundingClientRect();
  offsetPopoverOpen.value = true;
}

function displayOffset(side: OffsetSide): string {
  return getStyle(side) || 'auto';
}
</script>

<template>
  <div class="aigen-style-group-body">
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">定位</span>
      <StyleSelect
        :model-value="positionVal"
        :options="POSITION_OPTIONS"
        @change="(val) => setStyle('position', val, '切换定位模式')"
      />
    </div>

    <template v-if="showOffsetPanel">
      <!-- 9 锚点快捷定位 -->
      <div class="aigen-style-row">
        <span class="aigen-style-row__label">快捷锚点</span>
        <div class="aigen-pos-presets">
          <button
            v-for="preset in ANCHOR_PRESETS"
            :key="preset.title"
            type="button"
            class="aigen-pos-preset-btn"
            :title="preset.title"
            @click="batchSetStyle(preset.patch, `快捷定位: ${preset.title}`)"
          >
            <svg viewBox="0 0 14 14" width="12" height="12" fill="none">
              <rect
                x="1.5"
                y="1.5"
                width="11"
                height="11"
                rx="1.5"
                stroke="currentColor"
                stroke-opacity="0.35"
                stroke-width="1.1"
              />
              <rect
                v-if="preset.title === '左上'"
                x="3"
                y="3"
                width="4"
                height="4"
                rx="0.8"
                fill="currentColor"
              />
              <rect
                v-else-if="preset.title === '右上'"
                x="7"
                y="3"
                width="4"
                height="4"
                rx="0.8"
                fill="currentColor"
              />
              <rect
                v-else-if="preset.title === '左下'"
                x="3"
                y="7"
                width="4"
                height="4"
                rx="0.8"
                fill="currentColor"
              />
              <rect
                v-else-if="preset.title === '右下'"
                x="7"
                y="7"
                width="4"
                height="4"
                rx="0.8"
                fill="currentColor"
              />
              <rect
                v-else-if="preset.title === '贴左撑满'"
                x="3"
                y="3"
                width="3"
                height="8"
                rx="0.8"
                fill="currentColor"
              />
              <rect
                v-else-if="preset.title === '贴右撑满'"
                x="8"
                y="3"
                width="3"
                height="8"
                rx="0.8"
                fill="currentColor"
              />
              <rect
                v-else-if="preset.title === '贴底撑满'"
                x="3"
                y="8"
                width="8"
                height="3"
                rx="0.8"
                fill="currentColor"
              />
              <rect
                v-else-if="preset.title === '贴顶撑满'"
                x="3"
                y="3"
                width="8"
                height="3"
                rx="0.8"
                fill="currentColor"
              />
              <rect
                v-else
                x="3"
                y="3"
                width="8"
                height="8"
                rx="0.8"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- 交互式 4 边 SVG 偏移盒模型 -->
      <div class="aigen-pos-box-wrap">
        <div class="aigen-pos-box">
          <svg viewBox="0 0 220 84" class="aigen-pos-box__svg">
            <polygon
              points="0,0 220,0 184,22 36,22"
              class="aigen-pos-side"
              @click="openOffset('top', $event)"
            />
            <polygon
              points="220,0 220,84 184,62 184,22"
              class="aigen-pos-side"
              @click="openOffset('right', $event)"
            />
            <polygon
              points="36,62 184,62 220,84 0,84"
              class="aigen-pos-side"
              @click="openOffset('bottom', $event)"
            />
            <polygon
              points="0,0 36,22 36,62 0,84"
              class="aigen-pos-side"
              @click="openOffset('left', $event)"
            />
            <rect
              x="40"
              y="25"
              width="140"
              height="34"
              rx="3"
              class="aigen-pos-center"
            />
          </svg>
          <span class="aigen-pos-val is-top" @click="openOffset('top', $event)">
            {{ displayOffset('top') }}
          </span>
          <span
            class="aigen-pos-val is-right"
            @click="openOffset('right', $event)"
          >
            {{ displayOffset('right') }}
          </span>
          <span
            class="aigen-pos-val is-bottom"
            @click="openOffset('bottom', $event)"
          >
            {{ displayOffset('bottom') }}
          </span>
          <span
            class="aigen-pos-val is-left"
            @click="openOffset('left', $event)"
          >
            {{ displayOffset('left') }}
          </span>
        </div>
      </div>

      <!-- z-Index -->
      <div class="aigen-style-row">
        <span class="aigen-style-row__label">z-Index</span>
        <div class="aigen-style-unit-box">
          <input
            type="number"
            :value="getStyle('zIndex')"
            placeholder="auto"
            @change="
              setStyle(
                'zIndex',
                ($event.target as HTMLInputElement).value.trim() || undefined,
                '调整层级 z-index',
              )
            "
          />
        </div>
      </div>

      <SpacingPopover
        v-model:open="offsetPopoverOpen"
        :anchor-rect="offsetAnchorRect"
        :label="activeOffset ? OFFSET_LABELS[activeOffset] : ''"
        :model-value="activeOffset ? getStyle(activeOffset) : ''"
        allow-auto
        @update:model-value="
          (val) => activeOffset && setStyle(activeOffset, val, '调整定位偏移')
        "
        @reset="
          () =>
            activeOffset && setStyle(activeOffset, undefined, '重置定位偏移')
        "
      />
    </template>
  </div>
</template>

<style lang="less" scoped>
.aigen-pos-presets {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 2px;
}

.aigen-pos-preset-btn {
  height: 22px;
  padding: 0;
  border: 1px solid var(--aigen-border);
  border-radius: 3px;
  background: var(--aigen-secondary);
  color: var(--aigen-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    border-color: var(--aigen-primary);
    color: var(--aigen-primary);
    background: var(--aigen-primary-faded);
  }
}

.aigen-pos-box-wrap {
  display: flex;
  justify-content: center;
}

.aigen-pos-box {
  position: relative;
  width: 220px;
  height: 84px;
  user-select: none;

  &__svg {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.aigen-pos-side {
  fill: var(--aigen-secondary, #f3f4f6);
  stroke: var(--aigen-border, #e5e7eb);
  stroke-width: 1;
  cursor: pointer;

  &:hover {
    fill: var(--aigen-primary-faded, #eff6ff);
  }
}

.aigen-pos-center {
  fill: var(--aigen-designer-background, #fff);
  stroke: var(--aigen-border, #e5e7eb);
  stroke-width: 1;
}

.aigen-pos-val {
  position: absolute;
  font-size: 10px;
  line-height: 1;
  color: var(--aigen-text-main);
  cursor: pointer;
  transform: translate(-50%, -50%);

  &:hover {
    color: var(--aigen-primary);
    font-weight: 600;
  }

  &.is-top {
    left: 50%;
    top: 11px;
  }
  &.is-right {
    left: 202px;
    top: 50%;
  }
  &.is-bottom {
    left: 50%;
    top: 73px;
  }
  &.is-left {
    left: 18px;
    top: 50%;
  }
}
</style>
