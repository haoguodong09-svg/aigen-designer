<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useStyleState } from '../composables/useStyleState';
import SpacingPopover from './SpacingPopover.vue';

type SideProp =
  | 'marginBottom'
  | 'marginLeft'
  | 'marginRight'
  | 'marginTop'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'paddingRight'
  | 'paddingTop';

const SIDE_LABELS: Record<SideProp, string> = {
  marginBottom: '下外边距 (margin-bottom)',
  marginLeft: '左外边距 (margin-left)',
  marginRight: '右外边距 (margin-right)',
  marginTop: '上外边距 (margin-top)',
  paddingBottom: '下内边距 (padding-bottom)',
  paddingLeft: '左内边距 (padding-left)',
  paddingRight: '右内边距 (padding-right)',
  paddingTop: '上内边距 (padding-top)',
};

const { getStyle, setStyle } = useStyleState();

const activeSide = ref<null | SideProp>(null);
const anchorRect = ref<DOMRect | null>(null);
const popoverOpen = ref(false);

function displayVal(prop: SideProp): string {
  const direct = getStyle(prop);
  if (direct) return direct.replace(/px$/i, '');
  const shorthand = prop.startsWith('margin')
    ? getStyle('margin')
    : getStyle('padding');
  if (shorthand) return shorthand.replace(/px$/i, '');
  return '0';
}

function openSide(prop: SideProp, e: MouseEvent) {
  activeSide.value = prop;
  anchorRect.value = (e.currentTarget as HTMLElement).getBoundingClientRect();
  popoverOpen.value = true;
}

const currentVal = computed(() =>
  activeSide.value ? getStyle(activeSide.value) : '',
);
const isMargin = computed(
  () => activeSide.value?.startsWith('margin') ?? false,
);

function handleUpdate(val: string | undefined) {
  if (!activeSide.value) return;
  setStyle(activeSide.value, val, `调整${SIDE_LABELS[activeSide.value]}`);
}

function handleReset() {
  if (!activeSide.value) return;
  setStyle(activeSide.value, undefined, `重置${SIDE_LABELS[activeSide.value]}`);
}
</script>

<template>
  <div class="aigen-spacing-box">
    <!-- 外圈 Margin + 内圈 Padding 交互式 SVG 盒模型 -->
    <div class="aigen-box-model">
      <svg
        viewBox="0 0 240 120"
        class="aigen-box-model__svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Margin 4 个梯形 -->
        <polygon
          points="0,0 240,0 206,24 34,24"
          class="aigen-box-side"
          :class="{ 'is-active': activeSide === 'marginTop' && popoverOpen }"
          @click="openSide('marginTop', $event)"
        />
        <polygon
          points="240,0 240,120 206,96 206,24"
          class="aigen-box-side"
          :class="{ 'is-active': activeSide === 'marginRight' && popoverOpen }"
          @click="openSide('marginRight', $event)"
        />
        <polygon
          points="34,96 206,96 240,120 0,120"
          class="aigen-box-side"
          :class="{ 'is-active': activeSide === 'marginBottom' && popoverOpen }"
          @click="openSide('marginBottom', $event)"
        />
        <polygon
          points="0,0 34,24 34,96 0,120"
          class="aigen-box-side"
          :class="{ 'is-active': activeSide === 'marginLeft' && popoverOpen }"
          @click="openSide('marginLeft', $event)"
        />

        <!-- Padding 4 个梯形 -->
        <polygon
          points="38,28 202,28 172,50 68,50"
          class="aigen-box-side is-inner"
          :class="{ 'is-active': activeSide === 'paddingTop' && popoverOpen }"
          @click="openSide('paddingTop', $event)"
        />
        <polygon
          points="202,28 202,92 172,70 172,50"
          class="aigen-box-side is-inner"
          :class="{ 'is-active': activeSide === 'paddingRight' && popoverOpen }"
          @click="openSide('paddingRight', $event)"
        />
        <polygon
          points="68,70 172,70 202,92 38,92"
          class="aigen-box-side is-inner"
          :class="{
            'is-active': activeSide === 'paddingBottom' && popoverOpen,
          }"
          @click="openSide('paddingBottom', $event)"
        />
        <polygon
          points="38,28 68,50 68,70 38,92"
          class="aigen-box-side is-inner"
          :class="{ 'is-active': activeSide === 'paddingLeft' && popoverOpen }"
          @click="openSide('paddingLeft', $event)"
        />

        <!-- 中心标签 -->
        <rect
          x="70"
          y="52"
          width="100"
          height="16"
          rx="2"
          class="aigen-box-core"
        />
        <text x="120" y="63" text-anchor="middle" class="aigen-box-core-text">
          PADDING / MARGIN
        </text>
      </svg>

      <!-- Margin 数值标注 -->
      <span class="aigen-box-val is-mt" @click="openSide('marginTop', $event)">
        {{ displayVal('marginTop') }}
      </span>
      <span
        class="aigen-box-val is-mr"
        @click="openSide('marginRight', $event)"
      >
        {{ displayVal('marginRight') }}
      </span>
      <span
        class="aigen-box-val is-mb"
        @click="openSide('marginBottom', $event)"
      >
        {{ displayVal('marginBottom') }}
      </span>
      <span class="aigen-box-val is-ml" @click="openSide('marginLeft', $event)">
        {{ displayVal('marginLeft') }}
      </span>

      <!-- Padding 数值标注 -->
      <span class="aigen-box-val is-pt" @click="openSide('paddingTop', $event)">
        {{ displayVal('paddingTop') }}
      </span>
      <span
        class="aigen-box-val is-pr"
        @click="openSide('paddingRight', $event)"
      >
        {{ displayVal('paddingRight') }}
      </span>
      <span
        class="aigen-box-val is-pb"
        @click="openSide('paddingBottom', $event)"
      >
        {{ displayVal('paddingBottom') }}
      </span>
      <span
        class="aigen-box-val is-pl"
        @click="openSide('paddingLeft', $event)"
      >
        {{ displayVal('paddingLeft') }}
      </span>
    </div>

    <SpacingPopover
      v-model:open="popoverOpen"
      :anchor-rect="anchorRect"
      :label="activeSide ? SIDE_LABELS[activeSide] : ''"
      :model-value="currentVal"
      :allow-auto="isMargin"
      @update:model-value="handleUpdate"
      @reset="handleReset"
    />
  </div>
</template>

<style lang="less" scoped>
.aigen-spacing-box {
  display: flex;
  justify-content: center;
}

.aigen-box-model {
  position: relative;
  width: 240px;
  height: 120px;
  user-select: none;

  &__svg {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.aigen-box-side {
  fill: var(--aigen-secondary, #f3f4f6);
  stroke: var(--aigen-border, #e5e7eb);
  stroke-width: 1;
  cursor: pointer;
  transition: fill 0.15s ease;

  &.is-inner {
    fill: var(--aigen-designer-background, #ffffff);
  }

  &:hover,
  &.is-active {
    fill: var(--aigen-primary-faded, #eff6ff);
  }
}

.aigen-box-core {
  fill: var(--aigen-secondary, #f3f4f6);
  stroke: var(--aigen-border, #e5e7eb);
  stroke-width: 1;
}

.aigen-box-core-text {
  font-size: 7.5px;
  fill: var(--aigen-text-helper, #9ca3af);
  font-weight: 600;
  pointer-events: none;
}

.aigen-box-val {
  position: absolute;
  font-size: 10px;
  line-height: 1;
  color: var(--aigen-text-main);
  cursor: pointer;
  transform: translate(-50%, -50%);
  white-space: nowrap;

  &:hover {
    color: var(--aigen-primary);
    font-weight: 600;
  }

  &.is-mt {
    left: 50%;
    top: 12px;
  }
  &.is-mr {
    left: 223px;
    top: 50%;
  }
  &.is-mb {
    left: 50%;
    top: 108px;
  }
  &.is-ml {
    left: 17px;
    top: 50%;
  }

  &.is-pt {
    left: 50%;
    top: 39px;
  }
  &.is-pr {
    left: 187px;
    top: 50%;
  }
  &.is-pb {
    left: 50%;
    top: 81px;
  }
  &.is-pl {
    left: 53px;
    top: 50%;
  }
}
</style>
