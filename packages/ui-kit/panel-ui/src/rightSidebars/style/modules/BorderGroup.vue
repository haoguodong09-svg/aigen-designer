<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useStyleState } from '../composables/useStyleState';
import { parseSizeValue } from '../utils/cssCodec';
import StyleColorPicker from './StyleColorPicker.vue';
import StyleSelect from './StyleSelect.vue';

type BorderSide = 'all' | 'bottom' | 'left' | 'right' | 'top';

const { batchSetStyle, getStyle, setStyle } = useStyleState();

// 圆角：单值 vs 四角切换
const multiRadius = ref(false);
const radiusUnitOverride = ref('px');
const radiusSingle = computed(() => {
  const parsed = parseSizeValue(
    getStyle('borderRadius'),
    radiusUnitOverride.value,
  );
  return parsed;
});

const CORNERS = [
  { key: 'borderTopLeftRadius', label: '↖' },
  { key: 'borderTopRightRadius', label: '↗' },
  { key: 'borderBottomLeftRadius', label: '↙' },
  { key: 'borderBottomRightRadius', label: '↘' },
] as const;

function setSingleRadius(num: string, unit = radiusSingle.value.unit) {
  radiusUnitOverride.value = unit;
  const clean = num.trim();
  batchSetStyle(
    {
      borderBottomLeftRadius: undefined,
      borderBottomRightRadius: undefined,
      borderRadius: clean ? `${clean}${unit}` : undefined,
      borderTopLeftRadius: undefined,
      borderTopRightRadius: undefined,
    },
    '调整圆角',
  );
}

function setSingleRadiusUnit(unit: string) {
  radiusUnitOverride.value = unit;
  if (radiusSingle.value.num) {
    setSingleRadius(radiusSingle.value.num, unit);
  }
}

function setCornerRadius(key: string, num: string) {
  const clean = num.trim();
  setStyle(key, clean ? `${clean}px` : undefined, '调整独立圆角');
}

// 边框：十字 5 选 1
const activeSide = ref<BorderSide>('all');

const sidePrefix = computed(() => {
  if (activeSide.value === 'all') return 'border';
  return `border${activeSide.value[0].toUpperCase()}${activeSide.value.slice(1)}`;
});

const sideStyleProp = computed(() => `${sidePrefix.value}Style`);
const sideWidthProp = computed(() => `${sidePrefix.value}Width`);
const sideColorProp = computed(() => `${sidePrefix.value}Color`);

const currentBorderStyle = computed(
  () => getStyle(sideStyleProp.value) || 'none',
);
const currentBorderWidth = computed(
  () => parseSizeValue(getStyle(sideWidthProp.value), 'px').num,
);
const currentBorderColor = computed(() => getStyle(sideColorProp.value));

function setBorderStyle(val: string) {
  if (val === 'none') {
    batchSetStyle(
      {
        [sideColorProp.value]: undefined,
        [sideStyleProp.value]: 'none',
        [sideWidthProp.value]: undefined,
      },
      '清除边框',
    );
  } else {
    setStyle(sideStyleProp.value, val, '调整边框样式');
  }
}
</script>

<template>
  <div class="aigen-style-group-body">
    <!-- 圆角 -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">圆角</span>
      <div class="aigen-style-seg" style="max-width: 124px">
        <button
          type="button"
          class="aigen-style-seg__btn"
          :class="{ 'is-active': !multiRadius }"
          title="统一圆角"
          @click="multiRadius = false"
        >
          <svg
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
          </svg>
          <span>统一</span>
        </button>
        <button
          type="button"
          class="aigen-style-seg__btn"
          :class="{ 'is-active': multiRadius }"
          title="四角独立圆角"
          @click="multiRadius = true"
        >
          <svg
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          >
            <path d="M2.5 6V4A1.5 1.5 0 0 1 4 2.5H6" />
            <path d="M10 2.5H12A1.5 1.5 0 0 1 13.5 4V6" />
            <path d="M13.5 10V12A1.5 1.5 0 0 1 12 13.5H10" />
            <path d="M6 13.5H4A1.5 1.5 0 0 1 2.5 12V10" />
          </svg>
          <span>四角</span>
        </button>
      </div>
    </div>

    <div v-if="!multiRadius" class="aigen-style-row">
      <span class="aigen-style-row__label"></span>
      <div class="aigen-style-row__ctrl">
        <input
          type="range"
          min="0"
          max="60"
          class="aigen-style-slider"
          :style="{
            '--slider-pct': `${Math.min(100, Math.round(((Number(radiusSingle.num) || 0) / 60) * 100))}%`,
          }"
          :value="Number(radiusSingle.num) || 0"
          @input="setSingleRadius(($event.target as HTMLInputElement).value)"
        />
        <div class="aigen-style-unit-box" style="max-width: 82px">
          <input
            type="number"
            min="0"
            :value="radiusSingle.num"
            placeholder="0"
            @change="setSingleRadius(($event.target as HTMLInputElement).value)"
          />
          <StyleSelect
            variant="unit"
            :model-value="radiusSingle.unit"
            :options="['px', '%']"
            @change="setSingleRadiusUnit"
          />
        </div>
      </div>
    </div>

    <div v-else class="aigen-style-grid-2">
      <div v-for="c in CORNERS" :key="c.key" class="aigen-style-unit-box">
        <span class="aigen-corner-icon">
          <svg
            viewBox="0 0 14 14"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          >
            <path
              v-if="c.key === 'borderTopLeftRadius'"
              d="M2.5 11.5V5A2.5 2.5 0 0 1 5 2.5H11.5"
            />
            <path
              v-else-if="c.key === 'borderTopRightRadius'"
              d="M2.5 2.5H9A2.5 2.5 0 0 1 11.5 5V11.5"
            />
            <path
              v-else-if="c.key === 'borderBottomLeftRadius'"
              d="M2.5 2.5V9A2.5 2.5 0 0 0 5 11.5H11.5"
            />
            <path v-else d="M11.5 2.5V9A2.5 2.5 0 0 1 9 11.5H2.5" />
          </svg>
        </span>
        <input
          type="number"
          min="0"
          :value="parseSizeValue(getStyle(c.key), 'px').num"
          placeholder="0"
          @change="
            setCornerRadius(c.key, ($event.target as HTMLInputElement).value)
          "
        />
        <span class="aigen-style-unit-tag">px</span>
      </div>
    </div>

    <!-- 边框：十字 5 选 1 + 右侧样式/宽度/颜色 -->
    <div class="aigen-style-row is-top">
      <span class="aigen-style-row__label">边框</span>
      <div class="aigen-border-panel">
        <div class="aigen-border-cross">
          <span></span>
          <button
            type="button"
            class="aigen-border-cross__btn"
            :class="{ 'is-active': activeSide === 'top' }"
            title="上边框"
            @click="activeSide = 'top'"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
              <rect
                x="2.5"
                y="2.5"
                width="11"
                height="11"
                stroke="currentColor"
                stroke-opacity="0.28"
                stroke-width="1.2"
              />
              <path
                d="M2 2.5H14"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <span></span>
          <button
            type="button"
            class="aigen-border-cross__btn"
            :class="{ 'is-active': activeSide === 'left' }"
            title="左边框"
            @click="activeSide = 'left'"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
              <rect
                x="2.5"
                y="2.5"
                width="11"
                height="11"
                stroke="currentColor"
                stroke-opacity="0.28"
                stroke-width="1.2"
              />
              <path
                d="M2.5 2V14"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            class="aigen-border-cross__btn"
            :class="{ 'is-active': activeSide === 'all' }"
            title="全边框"
            @click="activeSide = 'all'"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
              <rect
                x="2.5"
                y="2.5"
                width="11"
                height="11"
                stroke="currentColor"
                stroke-width="1.8"
              />
            </svg>
          </button>
          <button
            type="button"
            class="aigen-border-cross__btn"
            :class="{ 'is-active': activeSide === 'right' }"
            title="右边框"
            @click="activeSide = 'right'"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
              <rect
                x="2.5"
                y="2.5"
                width="11"
                height="11"
                stroke="currentColor"
                stroke-opacity="0.28"
                stroke-width="1.2"
              />
              <path
                d="M13.5 2V14"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <span></span>
          <button
            type="button"
            class="aigen-border-cross__btn"
            :class="{ 'is-active': activeSide === 'bottom' }"
            title="下边框"
            @click="activeSide = 'bottom'"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
              <rect
                x="2.5"
                y="2.5"
                width="11"
                height="11"
                stroke="currentColor"
                stroke-opacity="0.28"
                stroke-width="1.2"
              />
              <path
                d="M2 13.5H14"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <span></span>
        </div>

        <div class="aigen-border-props">
          <div class="aigen-style-seg">
            <button
              v-for="opt in [
                { label: '无', val: 'none' },
                { label: '实', val: 'solid' },
                { label: '虚', val: 'dashed' },
                { label: '点', val: 'dotted' },
              ]"
              :key="opt.val"
              type="button"
              class="aigen-style-seg__btn"
              :class="{ 'is-active': currentBorderStyle === opt.val }"
              @click="setBorderStyle(opt.val)"
            >
              {{ opt.label }}
            </button>
          </div>

          <div class="aigen-style-unit-box">
            <input
              type="number"
              min="0"
              :value="currentBorderWidth"
              placeholder="1"
              @change="
                setStyle(
                  sideWidthProp,
                  ($event.target as HTMLInputElement).value.trim()
                    ? `${($event.target as HTMLInputElement).value.trim()}px`
                    : undefined,
                  '调整边框宽度',
                )
              "
            />
            <span class="aigen-style-unit-tag">px</span>
          </div>

          <StyleColorPicker
            :model-value="currentBorderColor"
            placeholder="颜色"
            @change="(val) => setStyle(sideColorProp, val, '调整边框颜色')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.aigen-radius-slider {
  flex: 1;
  min-width: 0;
  accent-color: var(--aigen-primary);
  cursor: pointer;
}

.aigen-corner-icon {
  padding-left: 5px;
  color: var(--aigen-text-helper);
  display: inline-flex;
  align-items: center;
}

.aigen-border-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.aigen-border-cross {
  display: grid;
  grid-template-columns: repeat(3, 22px);
  grid-template-rows: repeat(3, 22px);
  gap: 2px;
  flex-shrink: 0;

  &__btn {
    width: 22px;
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

    &.is-active {
      border-color: var(--aigen-primary);
      background: var(--aigen-primary-faded);
      color: var(--aigen-primary);
      font-weight: 700;
    }
  }
}

.aigen-border-props {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
