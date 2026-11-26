<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { parseSizeValue } from '../utils/cssCodec';
import StyleSelect from './StyleSelect.vue';

const props = withDefaults(
  defineProps<{
    allowAuto?: boolean;
    anchorRect: DOMRect | null;
    label: string;
    modelValue?: string;
    open: boolean;
  }>(),
  {
    allowAuto: false,
    modelValue: '',
  },
);

const emit = defineEmits<{
  (e: 'reset'): void;
  (e: 'update:modelValue', value: string | undefined): void;
  (e: 'update:open', value: boolean): void;
}>();

const PRESETS = ['0', '4', '8', '12', '16', '20', '24', '32'];
const UNITS = ['px', '%', 'em', 'rem', 'vw', 'vh'];

const parsed = computed(() => parseSizeValue(props.modelValue, 'px'));
const numDraft = ref('');
const unitDraft = ref('px');

watch(
  () => [props.open, props.modelValue],
  () => {
    numDraft.value = parsed.value.num === 'auto' ? '' : parsed.value.num;
    unitDraft.value = parsed.value.unit === 'auto' ? 'px' : parsed.value.unit;
  },
  { immediate: true },
);

const popoverStyle = computed(() => {
  if (!props.anchorRect) return {};
  const top = Math.min(window.innerHeight - 220, props.anchorRect.bottom + 6);
  const left = Math.max(
    8,
    Math.min(window.innerWidth - 236, props.anchorRect.left - 80),
  );
  return {
    left: `${left}px`,
    top: `${Math.max(8, top)}px`,
  };
});

function commitNumber() {
  const clean = numDraft.value.trim();
  if (!clean) {
    emit('update:modelValue', undefined);
    return;
  }
  emit('update:modelValue', `${clean}${unitDraft.value}`);
}

function selectPreset(val: string) {
  numDraft.value = val;
  emit('update:modelValue', val === '0' ? '0px' : `${val}${unitDraft.value}`);
  emit('update:open', false);
}

function selectAuto() {
  emit('update:modelValue', 'auto');
  emit('update:open', false);
}

function handleReset() {
  emit('reset');
  emit('update:open', false);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    emit('update:open', false);
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) window.addEventListener('keydown', onKeydown);
    else window.removeEventListener('keydown', onKeydown);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="aigen-spacing-mask"
      @click="emit('update:open', false)"
    ></div>
    <div
      v-if="open"
      class="aigen-style-popover"
      :style="popoverStyle"
      @click.stop
    >
      <div class="aigen-sp-head">
        <span class="aigen-sp-title">{{ label }}</span>
        <button
          v-if="allowAuto"
          type="button"
          class="aigen-sp-auto"
          :class="{ 'is-active': modelValue === 'auto' }"
          @click="selectAuto"
        >
          Auto
        </button>
      </div>

      <div class="aigen-style-unit-box">
        <input
          v-model="numDraft"
          type="number"
          placeholder="请输入"
          @change="commitNumber"
          @keydown.enter="commitNumber"
        />
        <StyleSelect
          v-model="unitDraft"
          variant="unit"
          :options="UNITS"
          @change="commitNumber"
        />
      </div>

      <div class="aigen-sp-presets">
        <button
          v-for="preset in PRESETS"
          :key="preset"
          type="button"
          class="aigen-sp-preset-btn"
          :class="{
            'is-active':
              parsed.num === preset &&
              (preset === '0' || parsed.unit === unitDraft),
          }"
          @click="selectPreset(preset)"
        >
          {{ preset }}
        </button>
      </div>

      <div class="aigen-sp-footer">
        <span class="aigen-sp-note">重置后将恢复到初始值</span>
        <button type="button" class="aigen-sp-reset" @click="handleReset">
          重置
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style lang="less">
.aigen-spacing-mask {
  position: fixed;
  inset: 0;
  z-index: 2099;
}

.aigen-sp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.aigen-sp-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--aigen-text-main, #1f2937);
}

.aigen-sp-auto {
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--aigen-border, #d1d5db);
  border-radius: 4px;
  background: var(--aigen-secondary, #f3f4f6);
  color: var(--aigen-text-secondary, #4b5563);
  font-size: 11px;
  cursor: pointer;

  &.is-active {
    border-color: var(--aigen-primary, #1677ff);
    color: var(--aigen-primary, #1677ff);
    background: var(--aigen-primary-faded, #eff6ff);
  }
}

.aigen-sp-presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.aigen-sp-preset-btn {
  height: 24px;
  border: 1px solid var(--aigen-border, #e5e7eb);
  border-radius: 4px;
  background: var(--aigen-secondary, #f9fafb);
  color: var(--aigen-text-main, #374151);
  font-size: 11px;
  cursor: pointer;

  &:hover {
    border-color: var(--aigen-primary, #1677ff);
    color: var(--aigen-primary, #1677ff);
  }

  &.is-active {
    background: var(--aigen-primary-faded, #eff6ff);
    border-color: var(--aigen-primary, #1677ff);
    color: var(--aigen-primary, #1677ff);
    font-weight: 600;
  }
}

.aigen-sp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
  border-top: 1px solid var(--aigen-border, #e5e7eb);
}

.aigen-sp-note {
  font-size: 11px;
  color: var(--aigen-text-helper, #9ca3af);
}

.aigen-sp-reset {
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--aigen-border, #d1d5db);
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-secondary, #4b5563);
  font-size: 11px;
  cursor: pointer;

  &:hover {
    color: var(--aigen-text-main, #111827);
    border-color: var(--aigen-text-secondary, #6b7280);
  }
}
</style>
