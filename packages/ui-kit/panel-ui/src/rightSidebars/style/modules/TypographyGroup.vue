<script lang="ts" setup>
import { computed } from 'vue';

import { useStyleState } from '../composables/useStyleState';
import { parseSizeValue } from '../utils/cssCodec';
import StyleColorPicker from './StyleColorPicker.vue';
import StyleSelect from './StyleSelect.vue';

const { getStyle, setStyle } = useStyleState();

// TinyEngine 同款 31 种字体列表
const FONT_FAMILIES = [
  '微软雅黑',
  '苹方',
  '黑体',
  '宋体',
  'Arial',
  'Bitter',
  'Changa One',
  'Droid Sans',
  'Droid Serif',
  'Exo',
  'Georgia',
  'Great Vibes',
  'Impact',
  'Inconsolata',
  'Lato',
  'Merriweather',
  'Montserrat',
  'Open Sans',
  'Oswald',
  'PT Sans',
  'PT Serif',
  'Palatino Linotype',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Ubuntu',
  'Varela',
  'Varela Round',
  'Verdana',
  'Vollkorn',
  'system-ui',
];

const FONT_WEIGHTS = [
  { label: '100 - Thin', value: '100' },
  { label: '400 - Normal', value: '400' },
  { label: '700 - Bold', value: '700' },
  { label: '900 - Black', value: '900' },
];

const FONT_FAMILY_OPTIONS = [
  { label: '默认', value: '' },
  ...FONT_FAMILIES.map((f) => ({ label: f, value: f })),
];

const FONT_WEIGHT_OPTIONS = [{ label: '默认', value: '' }, ...FONT_WEIGHTS];

const FONT_SIZES = ['9', '10', '11', '12', '14', '16', '18', '20', '24'];

const fontSizeNum = computed(
  () => parseSizeValue(getStyle('fontSize'), 'px').num,
);
const lineHeightNum = computed(
  () => parseSizeValue(getStyle('lineHeight'), 'px').num,
);
const colorVal = computed(() => getStyle('color'));
const textAlignVal = computed(() => getStyle('textAlign'));
const fontStyleVal = computed(() => getStyle('fontStyle') || 'normal');
const textDecorationVal = computed(() => getStyle('textDecoration') || 'none');

function setPxProp(prop: string, raw: string) {
  const clean = raw.trim();
  setStyle(prop, clean ? `${clean}px` : undefined, `调整 ${prop}`);
}
</script>

<template>
  <div class="aigen-style-group-body">
    <!-- 字体 & 字重 -->
    <div class="aigen-style-grid-2">
      <div class="aigen-style-field">
        <span class="aigen-style-field__label">字体</span>
        <StyleSelect
          :model-value="getStyle('fontFamily')"
          :options="FONT_FAMILY_OPTIONS"
          @change="
            (val) => setStyle('fontFamily', val || undefined, '调整字体')
          "
        />
      </div>
      <div class="aigen-style-field">
        <span class="aigen-style-field__label">字重</span>
        <StyleSelect
          :model-value="getStyle('fontWeight')"
          :options="FONT_WEIGHT_OPTIONS"
          @change="
            (val) => setStyle('fontWeight', val || undefined, '调整字重')
          "
        />
      </div>
    </div>

    <!-- 字号 & 行高 -->
    <div class="aigen-style-grid-2">
      <div class="aigen-style-field">
        <span class="aigen-style-field__label">字号</span>
        <div class="aigen-style-unit-box">
          <input
            type="number"
            list="aigen-font-size-list"
            :value="fontSizeNum"
            placeholder="14"
            @change="
              setPxProp('fontSize', ($event.target as HTMLInputElement).value)
            "
          />
          <datalist id="aigen-font-size-list">
            <option v-for="sz in FONT_SIZES" :key="sz" :value="sz"></option>
          </datalist>
          <span class="aigen-style-unit-tag">px</span>
        </div>
      </div>

      <div class="aigen-style-field">
        <span class="aigen-style-field__label">行高</span>
        <div class="aigen-style-unit-box">
          <input
            type="number"
            :value="lineHeightNum"
            placeholder="20"
            @change="
              setPxProp('lineHeight', ($event.target as HTMLInputElement).value)
            "
          />
          <span class="aigen-style-unit-tag">px</span>
        </div>
      </div>
    </div>

    <!-- 文字颜色 -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">颜色</span>
      <StyleColorPicker
        :model-value="colorVal"
        placeholder="请输入颜色"
        @change="(val) => setStyle('color', val, '调整文字颜色')"
      />
    </div>

    <!-- 对齐 -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">对齐</span>
      <div class="aigen-style-seg">
        <button
          v-for="opt in [
            { label: '左', title: 'Left - 左对齐', val: 'left' },
            { label: '中', title: 'Center - 居中对齐', val: 'center' },
            { label: '右', title: 'Right - 右对齐', val: 'right' },
            { label: '两端', title: 'Justify - 两侧对齐', val: 'justify' },
          ]"
          :key="opt.val"
          type="button"
          class="aigen-style-seg__btn"
          :class="{ 'is-active': textAlignVal === opt.val }"
          :title="opt.title"
          @click="setStyle('textAlign', opt.val, '调整文本对齐')"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 样式（斜体 + 装饰线） -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">样式</span>
      <div class="aigen-style-row__ctrl">
        <div class="aigen-style-seg" style="flex: 0.7">
          <button
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': fontStyleVal === 'normal' }"
            title="Regular - 常规"
            @click="setStyle('fontStyle', 'normal', '调整字体样式')"
          >
            T
          </button>
          <button
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': fontStyleVal === 'italic' }"
            title="Italic - 斜体"
            style="font-style: italic"
            @click="setStyle('fontStyle', 'italic', '调整字体样式')"
          >
            I
          </button>
        </div>

        <div class="aigen-style-seg" style="flex: 1.3">
          <button
            v-for="opt in [
              { label: '无', style: '', title: 'None - 无', val: 'none' },
              {
                label: 'S',
                style: 'text-decoration: line-through',
                title: 'Strikethrough - 删除线',
                val: 'line-through',
              },
              {
                label: 'U',
                style: 'text-decoration: underline',
                title: 'Underline - 下划线',
                val: 'underline',
              },
              {
                label: 'O',
                style: 'text-decoration: overline',
                title: 'Overline - 上划线',
                val: 'overline',
              },
            ]"
            :key="opt.val"
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': textDecorationVal === opt.val }"
            :style="opt.style"
            :title="opt.title"
            @click="setStyle('textDecoration', opt.val, '调整文本装饰线')"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
