<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { useStyleState } from '../composables/useStyleState';
import { parseSizeValue } from '../utils/cssCodec';
import StyleSelect from './StyleSelect.vue';

const { getStyle, selectedNode, setStyle } = useStyleState();

const UNITS = ['px', '%', 'vw', 'vh', 'em', 'rem', 'auto'];
const unitOverrides = ref<Record<string, string>>({});

watch(
  () => selectedNode.value?.id,
  () => {
    unitOverrides.value = {};
  },
);
const OBJECT_FIT_OPTIONS = [
  { label: '默认', value: '' },
  { label: 'fill - 填充', value: 'fill' },
  { label: 'contain - 包含', value: 'contain' },
  { label: 'cover - 原比例填充', value: 'cover' },
  { label: 'none - 无', value: 'none' },
  { label: 'scale-down - 缩小', value: 'scale-down' },
];

const SIZE_FIELDS = [
  { key: 'width', label: '宽度' },
  { key: 'height', label: '高度' },
  { key: 'minWidth', label: '最小宽' },
  { key: 'minHeight', label: '最小高' },
  { key: 'maxWidth', label: '最大宽' },
  { key: 'maxHeight', label: '最大高' },
] as const;

function getParsed(key: string) {
  const parsed = parseSizeValue(getStyle(key), 'px');
  if (!parsed.num && unitOverrides.value[key]) {
    return { num: '', unit: unitOverrides.value[key] };
  }
  return parsed;
}

function updateNum(key: string, num: string, unit: string) {
  const clean = num.trim();
  if (!clean) {
    setStyle(key, undefined, `清除${key}`);
    return;
  }
  if (clean === 'auto') {
    unitOverrides.value[key] = 'auto';
    setStyle(key, 'auto', `调整${key}`);
    return;
  }
  const effectiveUnit = unit === 'auto' ? 'px' : unit;
  unitOverrides.value[key] = effectiveUnit;
  setStyle(key, `${clean}${effectiveUnit}`, `调整${key}`);
}

function updateUnit(key: string, unit: string, currentNum: string) {
  unitOverrides.value[key] = unit;
  if (unit === 'auto') {
    setStyle(key, 'auto', `调整${key}`);
    return;
  }
  if (!currentNum || currentNum === 'auto') {
    if (getStyle(key) === 'auto') {
      setStyle(key, undefined, `清除${key}`);
    }
    return;
  }
  setStyle(key, `${currentNum}${unit}`, `调整${key}`);
}

const overflowVal = computed(() => getStyle('overflow') || 'visible');
const objectFitVal = computed(() => getStyle('objectFit') || '');

// Object position 浮层
const showObjPos = ref(false);
const objPosRect = ref<DOMRect | null>(null);

function openObjPos(e: MouseEvent) {
  objPosRect.value = (e.currentTarget as HTMLElement).getBoundingClientRect();
  showObjPos.value = !showObjPos.value;
}

const objPosStyle = computed(() => {
  if (!objPosRect.value) return {};
  return {
    left: `${Math.max(8, Math.min(window.innerWidth - 236, objPosRect.value.right - 224))}px`,
    top: `${Math.min(window.innerHeight - 210, objPosRect.value.bottom + 6)}px`,
  };
});

const ANCHOR_POINTS = [
  { x: '0%', y: '0%' },
  { x: '50%', y: '0%' },
  { x: '100%', y: '0%' },
  { x: '0%', y: '50%' },
  { x: '50%', y: '50%' },
  { x: '100%', y: '50%' },
  { x: '0%', y: '100%' },
  { x: '50%', y: '100%' },
  { x: '100%', y: '100%' },
];

const objPosXY = computed(() => {
  const raw = getStyle('objectPosition') || '50% 50%';
  const parts = raw.trim().split(/\s+/);
  return {
    x: parts[0] || '50%',
    y: parts[1] || '50%',
  };
});

function setObjPos(x: string, y: string) {
  setStyle('objectPosition', `${x} ${y}`, '调整适应位置');
}
</script>

<template>
  <div class="aigen-style-group-body">
    <!-- 2列 尺寸矩阵 -->
    <div class="aigen-style-grid-2">
      <div
        v-for="item in SIZE_FIELDS"
        :key="item.key"
        class="aigen-style-field"
      >
        <span class="aigen-style-field__label">{{ item.label }}</span>
        <div class="aigen-style-unit-box">
          <input
            type="text"
            :value="
              getParsed(item.key).unit === 'auto'
                ? 'auto'
                : getParsed(item.key).num
            "
            placeholder="自动"
            @change="
              updateNum(
                item.key,
                ($event.target as HTMLInputElement).value,
                getParsed(item.key).unit === 'auto'
                  ? 'px'
                  : getParsed(item.key).unit,
              )
            "
          />
          <StyleSelect
            variant="unit"
            :model-value="getParsed(item.key).unit"
            :options="UNITS"
            @change="
              (val) => updateUnit(item.key, val, getParsed(item.key).num)
            "
          />
        </div>
      </div>
    </div>

    <!-- 溢出 Overflow -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">溢出</span>
      <div class="aigen-style-seg">
        <button
          v-for="opt in [
            { label: '可见', title: 'visible 溢出可见', val: 'visible' },
            { label: '隐藏', title: 'hidden 溢出隐藏', val: 'hidden' },
            { label: '滚动', title: 'scroll 溢出滚动', val: 'scroll' },
            { label: 'Auto', title: 'auto 溢出自动滚动', val: 'auto' },
          ]"
          :key="opt.val"
          type="button"
          class="aigen-style-seg__btn"
          :class="{ 'is-active': overflowVal === opt.val }"
          :title="opt.title"
          @click="setStyle('overflow', opt.val, '调整溢出策略')"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 适应 Object Fit + Object Position -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">适应</span>
      <div class="aigen-style-row__ctrl">
        <StyleSelect
          :model-value="objectFitVal"
          :options="OBJECT_FIT_OPTIONS"
          @change="
            (val) => setStyle('objectFit', val || undefined, '调整适应方式')
          "
        />

        <button
          type="button"
          class="aigen-size-more-btn"
          title="Object position 设置"
          @click="openObjPos"
        >
          ···
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showObjPos"
        class="aigen-spacing-mask"
        @click="showObjPos = false"
      ></div>
      <div
        v-if="showObjPos"
        class="aigen-style-popover"
        :style="objPosStyle"
        @click.stop
      >
        <div class="aigen-sp-head">
          <span class="aigen-sp-title">位置 (object-position)</span>
        </div>
        <div class="aigen-objpos-body">
          <div class="aigen-style-anchor-grid">
            <button
              v-for="(pt, idx) in ANCHOR_POINTS"
              :key="idx"
              type="button"
              class="aigen-style-anchor-grid__cell"
              :class="{
                'is-active': objPosXY.x === pt.x && objPosXY.y === pt.y,
              }"
              @click="setObjPos(pt.x, pt.y)"
            ></button>
          </div>
          <div class="aigen-objpos-inputs">
            <div class="aigen-style-field">
              <span class="aigen-style-field__label">Left</span>
              <div class="aigen-style-unit-box">
                <input
                  type="text"
                  :value="objPosXY.x"
                  @change="
                    setObjPos(
                      ($event.target as HTMLInputElement).value || '50%',
                      objPosXY.y,
                    )
                  "
                />
              </div>
            </div>
            <div class="aigen-style-field">
              <span class="aigen-style-field__label">Top</span>
              <div class="aigen-style-unit-box">
                <input
                  type="text"
                  :value="objPosXY.y"
                  @change="
                    setObjPos(
                      objPosXY.x,
                      ($event.target as HTMLInputElement).value || '50%',
                    )
                  "
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style lang="less" scoped>
.aigen-size-more-btn {
  width: 28px;
  height: 26px;
  flex-shrink: 0;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: var(--aigen-secondary);
  color: var(--aigen-text-secondary);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: var(--aigen-primary);
    color: var(--aigen-primary);
  }
}

.aigen-objpos-body {
  display: flex;
  align-items: center;
  gap: 10px;
}

.aigen-objpos-inputs {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
