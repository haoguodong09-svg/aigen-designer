<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { generateNewSchema } from '@aigen-designer/utils';

interface RowPreset {
  label: string;
  spans: number[];
}

const props = defineProps<{
  modelValue?: ComponentSchema[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ComponentSchema[]): void;
}>();

const ROW_PRESETS: ReadonlyArray<RowPreset> = [
  { label: '24', spans: [24] },
  { label: '12:12', spans: [12, 12] },
  { label: '6:18', spans: [6, 18] },
  { label: '16:8', spans: [16, 8] },
  { label: '18:6', spans: [18, 6] },
  { label: '8:8:8', spans: [8, 8, 8] },
  { label: '6:12:6', spans: [6, 12, 6] },
  { label: '6×4', spans: [6, 6, 6, 6] },
  { label: '4×6', spans: [4, 4, 4, 4, 4, 4] },
];

/**
 * 判断当前列配置是否与指定分栏预设完全匹配
 */
function isPresetActive(spans: number[]): boolean {
  const cols = props.modelValue;
  if (!Array.isArray(cols) || cols.length !== spans.length) {
    return false;
  }
  return spans.every((span, idx) => Number(cols[idx]?.props?.span) === span);
}

/**
 * 应用分栏预设：复用对应索引下的已有 col 节点以保留列内子组件，不足时新建，多余尾部列裁剪
 */
function applyPreset(spans: number[]): void {
  const existingCols = Array.isArray(props.modelValue) ? props.modelValue : [];
  const nextCols: ComponentSchema[] = spans.map((span, idx) => {
    const existing = existingCols[idx];
    if (existing) {
      return {
        ...existing,
        props: {
          ...existing.props,
          span,
        },
      };
    }
    return generateNewSchema({
      props: { span },
      type: 'col',
      children: [],
    });
  });
  emit('update:modelValue', nextCols);
}
</script>

<template>
  <div class="aigen-row-preset-editor">
    <button
      v-for="preset in ROW_PRESETS"
      :key="preset.label"
      type="button"
      class="aigen-row-preset-editor__tile"
      :class="{ 'is-active': isPresetActive(preset.spans) }"
      :title="`分栏预设 ${preset.label}`"
      :aria-label="`分栏预设 ${preset.label}`"
      :aria-pressed="isPresetActive(preset.spans)"
      @click="applyPreset(preset.spans)"
    >
      <div class="aigen-row-preset-editor__bars">
        <span
          v-for="(span, idx) in preset.spans"
          :key="idx"
          class="aigen-row-preset-editor__bar"
          :style="{ flex: span }"
        ></span>
      </div>
      <span class="aigen-row-preset-editor__label">{{ preset.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.aigen-row-preset-editor {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
}

.aigen-row-preset-editor__tile {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  padding: 5px;
  border: 1px solid var(--aigen-border, #e2e8f0);
  border-radius: 6px;
  background: var(--aigen-background, #ffffff);
  cursor: pointer;
  box-sizing: border-box;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.aigen-row-preset-editor__tile:hover {
  border-color: var(--aigen-primary, #1677ff);
}

.aigen-row-preset-editor__tile.is-active {
  border-color: var(--aigen-primary, #1677ff);
  background: rgba(22, 119, 255, 0.08);
}

.aigen-row-preset-editor__bars {
  display: flex;
  align-items: stretch;
  gap: 2px;
  width: 100%;
  height: 14px;
}

.aigen-row-preset-editor__bar {
  min-width: 2px;
  border-radius: 2px;
  background: var(--aigen-border, #cbd5e1);
  transition: background-color 0.15s ease;
}

.aigen-row-preset-editor__tile:hover .aigen-row-preset-editor__bar {
  background: rgba(22, 119, 255, 0.45);
}

.aigen-row-preset-editor__tile.is-active .aigen-row-preset-editor__bar {
  background: var(--aigen-primary, #1677ff);
}

.aigen-row-preset-editor__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  line-height: 1.2;
  text-align: center;
  color: var(--aigen-text-helper, #64748b);
}

.aigen-row-preset-editor__tile.is-active .aigen-row-preset-editor__label {
  color: var(--aigen-primary, #1677ff);
  font-weight: 500;
}
</style>
