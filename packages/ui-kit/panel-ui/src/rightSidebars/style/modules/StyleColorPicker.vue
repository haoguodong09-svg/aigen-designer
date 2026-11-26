<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
  }>(),
  {
    modelValue: '',
    placeholder: '请输入颜色',
  },
);

const emit = defineEmits<{
  (e: 'change', value: string | undefined): void;
  (e: 'update:modelValue', value: string | undefined): void;
}>();

const PRESET_COLORS = [
  '#000000',
  '#333333',
  '#666666',
  '#999999',
  '#cccccc',
  '#ffffff',
  '#1677ff',
  '#4096ff',
  '#52c41a',
  '#faad14',
  '#ff4d4f',
  '#722ed1',
  '#13c2c2',
  '#eb2f96',
  '#fa8c16',
  'transparent',
];

const swatchRef = ref<HTMLElement | null>(null);
const svAreaRef = ref<HTMLElement | null>(null);
const open = ref(false);
const popoverPos = ref({ left: 0, top: 0 });

// HSV + Alpha internal state
const hue = ref(215);
const sat = ref(91);
const val = ref(100);
const alpha = ref(100);
const hexDraft = ref('');

function parseColorToHsva(raw: string) {
  const str = (raw || '').trim();
  if (!str || str === 'transparent') {
    alpha.value = str === 'transparent' ? 0 : 100;
    return;
  }
  let r = 22;
  let g = 119;
  let b = 255;
  let a = 1;

  const hexMatch = str.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3 || h.length === 4) {
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    }
    r = Number.parseInt(h.slice(0, 2), 16);
    g = Number.parseInt(h.slice(2, 4), 16);
    b = Number.parseInt(h.slice(4, 6), 16);
    if (h.length === 8) {
      a = Number.parseInt(h.slice(6, 8), 16) / 255;
    }
  } else {
    const rgbaMatch = str.match(
      /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
    );
    if (rgbaMatch) {
      r = Math.min(255, Number(rgbaMatch[1]));
      g = Math.min(255, Number(rgbaMatch[2]));
      b = Math.min(255, Number(rgbaMatch[3]));
      a = rgbaMatch[4] === undefined ? 1 : Math.min(1, Number(rgbaMatch[4]));
    } else {
      return;
    }
  }

  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let hDeg = 0;
  if (d !== 0) {
    if (max === rn) hDeg = ((gn - bn) / d) % 6;
    else if (max === gn) hDeg = (bn - rn) / d + 2;
    else hDeg = (rn - gn) / d + 4;
    hDeg = Math.round(hDeg * 60);
    if (hDeg < 0) hDeg += 360;
  }
  hue.value = hDeg;
  sat.value = max === 0 ? 0 : Math.round((d / max) * 100);
  val.value = Math.round(max * 100);
  alpha.value = Math.round(a * 100);
}

function hsvaToRgb(h: number, s: number, v: number) {
  const sn = s / 100;
  const vn = v / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    b: Math.round((b1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    r: Math.round((r1 + m) * 255),
  };
}

function formatCurrentColor(): string {
  const { b, g, r } = hsvaToRgb(hue.value, sat.value, val.value);
  if (alpha.value < 100) {
    return `rgba(${r}, ${g}, ${b}, ${Number((alpha.value / 100).toFixed(2))})`;
  }
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

watch(
  () => props.modelValue,
  (next) => {
    hexDraft.value = next ?? '';
    if (next) parseColorToHsva(next);
  },
  { immediate: true },
);

const hueBg = computed(() => `hsl(${hue.value}, 100%, 50%)`);
const currentSolidHex = computed(() => {
  const { b, g, r } = hsvaToRgb(hue.value, sat.value, val.value);
  return `rgb(${r}, ${g}, ${b})`;
});

function emitColor(valStr: string | undefined) {
  hexDraft.value = valStr ?? '';
  emit('update:modelValue', valStr);
  emit('change', valStr);
}

function openPicker() {
  if (open.value) {
    open.value = false;
    return;
  }
  if (props.modelValue) parseColorToHsva(props.modelValue);
  const rect = swatchRef.value?.getBoundingClientRect();
  if (rect) {
    const popW = 228;
    const popH = 290;
    const left = Math.max(
      8,
      Math.min(window.innerWidth - popW - 8, rect.left - 80),
    );
    const top =
      window.innerHeight - rect.bottom < popH + 12 && rect.top > popH + 12
        ? rect.top - popH - 6
        : rect.bottom + 6;
    popoverPos.value = { left, top };
  }
  open.value = true;
}

function updateSvFromPointer(e: MouseEvent) {
  const el = svAreaRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
  sat.value = Math.round((x / rect.width) * 100);
  val.value = Math.round(100 - (y / rect.height) * 100);
  emitColor(formatCurrentColor());
}

function startSvDrag(e: MouseEvent) {
  updateSvFromPointer(e);
  const onMove = (ev: MouseEvent) => updateSvFromPointer(ev);
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function onSliderChange() {
  emitColor(formatCurrentColor());
}

function selectPreset(color: string) {
  if (color === 'transparent') {
    alpha.value = 0;
    emitColor('transparent');
    return;
  }
  parseColorToHsva(color);
  emitColor(color);
}

function clearColor() {
  emitColor(undefined);
  open.value = false;
}

function onTextCommit() {
  const clean = hexDraft.value.trim();
  emitColor(clean || undefined);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    open.value = false;
  }
}

watch(open, (isOpen) => {
  if (isOpen) window.addEventListener('keydown', onKeydown);
  else window.removeEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="aigen-style-color-box">
    <button
      ref="swatchRef"
      type="button"
      class="aigen-cp-swatch"
      title="点击打开颜色选择器"
      @click.stop="openPicker"
    >
      <span
        class="aigen-cp-swatch__fill"
        :style="{ backgroundColor: modelValue || 'transparent' }"
      ></span>
    </button>

    <input
      v-model="hexDraft"
      type="text"
      class="aigen-style-color-box__text"
      :placeholder="placeholder"
      @change="onTextCommit"
      @keydown.enter="onTextCommit"
    />
  </div>

  <Teleport to="body">
    <div v-if="open" class="aigen-cp-mask" @click="open = false"></div>
    <div
      v-if="open"
      class="aigen-cp-popover"
      :style="{ left: `${popoverPos.left}px`, top: `${popoverPos.top}px` }"
      @click.stop
    >
      <!-- 2D 饱和度 / 亮度面板 -->
      <div
        ref="svAreaRef"
        class="aigen-cp-sv"
        :style="{ backgroundColor: hueBg }"
        @mousedown.prevent="startSvDrag"
      >
        <div class="aigen-cp-sv__white"></div>
        <div class="aigen-cp-sv__black"></div>
        <div
          class="aigen-cp-sv__thumb"
          :style="{ left: `${sat}%`, top: `${100 - val}%` }"
        ></div>
      </div>

      <!-- 色相 & 透明度滑块 -->
      <div class="aigen-cp-sliders">
        <div class="aigen-cp-slider-row">
          <span class="aigen-cp-slider-label">色相</span>
          <input
            v-model.number="hue"
            type="range"
            min="0"
            max="360"
            class="aigen-cp-hue-slider"
            @input="onSliderChange"
          />
        </div>
        <div class="aigen-cp-slider-row">
          <span class="aigen-cp-slider-label">透明</span>
          <div class="aigen-cp-alpha-wrap">
            <div
              class="aigen-cp-alpha-bg"
              :style="{
                backgroundImage: `linear-gradient(to right, transparent, ${currentSolidHex})`,
              }"
            ></div>
            <input
              v-model.number="alpha"
              type="range"
              min="0"
              max="100"
              class="aigen-cp-alpha-slider"
              @input="onSliderChange"
            />
          </div>
        </div>
      </div>

      <!-- 常用预设色板 -->
      <div class="aigen-cp-presets">
        <button
          v-for="c in PRESET_COLORS"
          :key="c"
          type="button"
          class="aigen-cp-preset"
          :class="{
            'is-transparent': c === 'transparent',
            'is-active': modelValue?.toLowerCase() === c.toLowerCase(),
          }"
          :title="c === 'transparent' ? '透明' : c"
          @click="selectPreset(c)"
        >
          <span
            v-if="c !== 'transparent'"
            class="aigen-cp-preset__dot"
            :style="{ backgroundColor: c }"
          ></span>
        </button>
      </div>

      <!-- 底部色值与清空 -->
      <div class="aigen-cp-footer">
        <input
          v-model="hexDraft"
          type="text"
          class="aigen-cp-hex-input"
          placeholder="#hex 或 rgba(...)"
          @change="onTextCommit"
          @keydown.enter="onTextCommit"
        />
        <button type="button" class="aigen-cp-clear" @click="clearColor">
          清空
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style lang="less">
.aigen-cp-swatch {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--aigen-border, #d1d5db);
  border-radius: 3px;
  background-image:
    linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
  background-size: 8px 8px;
  background-position:
    0 0,
    0 4px,
    4px -4px,
    -4px 0;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
  display: inline-flex;

  &__fill {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.aigen-cp-mask {
  position: fixed;
  inset: 0;
  z-index: 2299;
}

.aigen-cp-popover {
  position: fixed;
  z-index: 2300;
  width: 228px;
  padding: 10px;
  border: 1px solid var(--aigen-border, #e5e7eb);
  border-radius: 8px;
  background: var(--aigen-designer-background, #ffffff);
  box-shadow: 0 10px 28px rgb(0 0 0 / 16%);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aigen-cp-sv {
  position: relative;
  width: 100%;
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
  cursor: crosshair;

  &__white {
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, #fff, transparent);
  }

  &__black {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, #000, transparent);
  }

  &__thumb {
    position: absolute;
    width: 10px;
    height: 10px;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 2px rgb(0 0 0 / 60%);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
}

.aigen-cp-sliders {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.aigen-cp-slider-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.aigen-cp-slider-label {
  width: 28px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--aigen-text-secondary, #6b7280);
}

.aigen-cp-hue-slider {
  flex: 1;
  height: 10px;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 5px;
  background: linear-gradient(
    to right,
    #f00 0%,
    #ff0 17%,
    #0f0 33%,
    #0ff 50%,
    #00f 67%,
    #f0f 83%,
    #f00 100%
  );
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid var(--aigen-primary, #1677ff);
    box-shadow: 0 1px 3px rgb(0 0 0 / 30%);
  }
}

.aigen-cp-alpha-wrap {
  position: relative;
  flex: 1;
  height: 10px;
  border-radius: 5px;
  background-image:
    linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
  background-size: 8px 8px;
  background-position:
    0 0,
    0 4px,
    4px -4px,
    -4px 0;
  overflow: hidden;
}

.aigen-cp-alpha-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.aigen-cp-alpha-slider {
  position: relative;
  width: 100%;
  height: 10px;
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid var(--aigen-primary, #1677ff);
    box-shadow: 0 1px 3px rgb(0 0 0 / 30%);
  }
}

.aigen-cp-presets {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 5px;
}

.aigen-cp-preset {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--aigen-border, #d1d5db);
  border-radius: 4px;
  background: transparent;
  overflow: hidden;
  cursor: pointer;
  display: inline-flex;

  &.is-transparent {
    background: linear-gradient(
      to top right,
      transparent calc(50% - 1px),
      #ef4444,
      transparent calc(50% + 1px)
    );
  }

  &.is-active {
    box-shadow: 0 0 0 2px var(--aigen-primary, #1677ff);
  }

  &__dot {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.aigen-cp-footer {
  display: flex;
  align-items: center;
  gap: 6px;
}

.aigen-cp-hex-input {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--aigen-border, #d1d5db);
  border-radius: 4px;
  font-size: 11px;
  color: var(--aigen-text-main, #1f2937);
  outline: none;

  &:focus {
    border-color: var(--aigen-primary, #1677ff);
  }
}

.aigen-cp-clear {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--aigen-border, #d1d5db);
  border-radius: 4px;
  background: var(--aigen-secondary, #f3f4f6);
  color: var(--aigen-text-secondary, #4b5563);
  font-size: 11px;
  cursor: pointer;

  &:hover {
    color: var(--aigen-text-main, #1f2937);
  }
}
</style>
