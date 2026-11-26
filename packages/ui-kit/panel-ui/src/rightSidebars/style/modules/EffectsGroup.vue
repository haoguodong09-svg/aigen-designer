<script lang="ts" setup>
import { computed } from 'vue';

import { useStyleState } from '../composables/useStyleState';
import { parseSizeValue } from '../utils/cssCodec';
import StyleColorPicker from './StyleColorPicker.vue';
import StyleSelect from './StyleSelect.vue';

const { batchSetStyle, getStyle, setStyle } = useStyleState();

// 透明度：CSS 为 0~1，面板展示 0~100%
const opacityPercent = computed(() => {
  const raw = getStyle('opacity');
  if (!raw) return 100;
  const num = Number.parseFloat(raw);
  if (Number.isNaN(num)) return 100;
  return num <= 1 ? Math.round(num * 100) : Math.min(100, Math.round(num));
});

function setOpacityPercent(pct: number) {
  const clamped = Math.max(0, Math.min(100, pct));
  setStyle(
    'opacity',
    clamped === 100 ? undefined : String(clamped / 100),
    '调整透明度',
  );
}

// 轮廓 Outline
const outlineStyle = computed(() => getStyle('outlineStyle') || 'none');
const outlineWidth = computed(
  () => parseSizeValue(getStyle('outlineWidth'), 'px').num,
);
const outlineOffset = computed(
  () => parseSizeValue(getStyle('outlineOffset'), 'px').num,
);
const outlineColor = computed(() => getStyle('outlineColor'));

function selectOutlineStyle(val: string) {
  if (val === 'none') {
    batchSetStyle(
      {
        outlineColor: undefined,
        outlineOffset: undefined,
        outlineStyle: undefined,
        outlineWidth: undefined,
      },
      '清除轮廓',
    );
  } else {
    setStyle('outlineStyle', val, '调整轮廓样式');
  }
}

// 光标 Cursor（6 大分组全量复刻 + 中文说明）
const CURSOR_GROUPS = [
  {
    label: 'General · 常规',
    options: [
      { label: 'auto - 自动', value: 'auto' },
      { label: 'default - 默认箭头', value: 'default' },
      { label: 'none - 无光标', value: 'none' },
    ],
  },
  {
    label: 'Links & Status · 链接与状态',
    options: [
      { label: 'pointer - 手型链接', value: 'pointer' },
      { label: 'not-allowed - 禁止操作', value: 'not-allowed' },
      { label: 'wait - 等待加载', value: 'wait' },
      { label: 'progress - 后台处理', value: 'progress' },
      { label: 'help - 帮助提示', value: 'help' },
      { label: 'context-menu - 右键菜单', value: 'context-menu' },
    ],
  },
  {
    label: 'Selection · 选择',
    options: [
      { label: 'cell - 单元格', value: 'cell' },
      { label: 'crosshair - 十字准星', value: 'crosshair' },
      { label: 'text - 文本选择', value: 'text' },
      { label: 'vertical-text - 垂直文本', value: 'vertical-text' },
    ],
  },
  {
    label: 'Drag & Drop · 拖拽',
    options: [
      { label: 'grab - 可抓取', value: 'grab' },
      { label: 'grabbing - 抓取中', value: 'grabbing' },
      { label: 'alias - 创建快捷方式', value: 'alias' },
      { label: 'copy - 复制', value: 'copy' },
      { label: 'move - 移动', value: 'move' },
    ],
  },
  {
    label: 'Zoom · 缩放',
    options: [
      { label: 'zoom-in - 放大', value: 'zoom-in' },
      { label: 'zoom-out - 缩小', value: 'zoom-out' },
    ],
  },
  {
    label: 'Resize · 调整尺寸',
    options: [
      { label: 'col-resize - 调整列宽', value: 'col-resize' },
      { label: 'row-resize - 调整行高', value: 'row-resize' },
      { label: 'nesw-resize - 右上/左下缩放', value: 'nesw-resize' },
      { label: 'nwse-resize - 左上/右下缩放', value: 'nwse-resize' },
      { label: 'ew-resize - 水平缩放', value: 'ew-resize' },
      { label: 'ns-resize - 垂直缩放', value: 'ns-resize' },
      { label: 'n-resize - 向上缩放', value: 'n-resize' },
      { label: 'w-resize - 向左缩放', value: 'w-resize' },
      { label: 's-resize - 向下缩放', value: 's-resize' },
      { label: 'e-resize - 向右缩放', value: 'e-resize' },
      { label: 'nw-resize - 左上角缩放', value: 'nw-resize' },
      { label: 'ne-resize - 右上角缩放', value: 'ne-resize' },
      { label: 'sw-resize - 左下角缩放', value: 'sw-resize' },
      { label: 'se-resize - 右下角缩放', value: 'se-resize' },
    ],
  },
];
</script>

<template>
  <div class="aigen-style-group-body">
    <!-- 透明度 -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">透明度</span>
      <div class="aigen-style-row__ctrl">
        <input
          type="range"
          min="0"
          max="100"
          class="aigen-style-slider"
          :style="{ '--slider-pct': `${opacityPercent}%` }"
          :value="opacityPercent"
          @input="
            setOpacityPercent(Number(($event.target as HTMLInputElement).value))
          "
        />
        <div class="aigen-style-unit-box" style="max-width: 74px">
          <input
            type="number"
            min="0"
            max="100"
            :value="opacityPercent"
            @change="
              setOpacityPercent(
                Number(($event.target as HTMLInputElement).value),
              )
            "
          />
          <span class="aigen-style-unit-tag">%</span>
        </div>
      </div>
    </div>

    <!-- 轮廓 -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">轮廓</span>
      <div class="aigen-style-seg">
        <button
          v-for="opt in [
            { label: '无', title: 'none - 无', val: 'none' },
            { label: '实线', title: 'solid - 实线', val: 'solid' },
            { label: '虚线', title: 'dashed - 虚线', val: 'dashed' },
            { label: '圆点', title: 'dotted - 圆点', val: 'dotted' },
          ]"
          :key="opt.val"
          type="button"
          class="aigen-style-seg__btn"
          :class="{ 'is-active': outlineStyle === opt.val }"
          :title="opt.title"
          @click="selectOutlineStyle(opt.val)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 轮廓展开属性 -->
    <template v-if="outlineStyle !== 'none'">
      <div class="aigen-style-grid-2">
        <div class="aigen-style-field">
          <span class="aigen-style-field__label">宽度</span>
          <div class="aigen-style-unit-box">
            <input
              type="number"
              min="0"
              :value="outlineWidth"
              placeholder="1"
              @change="
                setStyle(
                  'outlineWidth',
                  ($event.target as HTMLInputElement).value.trim()
                    ? `${($event.target as HTMLInputElement).value.trim()}px`
                    : undefined,
                  '调整轮廓宽度',
                )
              "
            />
            <span class="aigen-style-unit-tag">px</span>
          </div>
        </div>
        <div class="aigen-style-field">
          <span class="aigen-style-field__label">偏移</span>
          <div class="aigen-style-unit-box">
            <input
              type="number"
              :value="outlineOffset"
              placeholder="0"
              @change="
                setStyle(
                  'outlineOffset',
                  ($event.target as HTMLInputElement).value.trim()
                    ? `${($event.target as HTMLInputElement).value.trim()}px`
                    : undefined,
                  '调整轮廓偏移',
                )
              "
            />
            <span class="aigen-style-unit-tag">px</span>
          </div>
        </div>
      </div>

      <div class="aigen-style-row">
        <span class="aigen-style-row__label">颜色</span>
        <StyleColorPicker
          :model-value="outlineColor"
          placeholder="请输入颜色"
          @change="(val) => setStyle('outlineColor', val, '调整轮廓颜色')"
        />
      </div>
    </template>

    <!-- 光标 -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">光标</span>
      <StyleSelect
        :model-value="getStyle('cursor') || 'auto'"
        :groups="CURSOR_GROUPS"
        @change="(val) => setStyle('cursor', val, '调整光标样式')"
      />
    </div>
  </div>
</template>
