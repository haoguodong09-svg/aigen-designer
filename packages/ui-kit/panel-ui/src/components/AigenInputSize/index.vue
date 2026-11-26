<script lang="ts" setup>
import { ref, watch } from 'vue';

import StyleSelect from '../../rightSidebars/style/modules/StyleSelect.vue';
import { parseSizeValue } from '../../rightSidebars/style/utils/cssCodec';

const props = withDefaults(
  defineProps<{
    modelValue?: number | string;
    placeholder?: string;
  }>(),
  {
    modelValue: undefined,
    placeholder: '自动',
  },
);

const emit = defineEmits<{
  (e: 'change', value: string | undefined): void;
  (e: 'update:modelValue', value: string | undefined): void;
}>();

const UNITS = ['px', '%', 'vw', 'vh', 'em', 'rem', 'pt', 'auto'];

const num = ref('');
const unit = ref('px');

watch(
  () => props.modelValue,
  (val) => {
    const parsed = parseSizeValue(val, 'px');
    num.value = parsed.num;
    if (val !== undefined && val !== null && val !== '') {
      unit.value = parsed.unit;
    }
  },
  { immediate: true },
);

function emitValue(next: string | undefined) {
  emit('update:modelValue', next);
  emit('change', next);
}

function handleInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  const clean = raw.trim();
  num.value = raw;

  if (!clean) {
    emitValue(undefined);
    return;
  }
  if (clean === 'auto') {
    unit.value = 'auto';
    emitValue('auto');
    return;
  }
  const effectiveUnit = unit.value === 'auto' ? 'px' : unit.value;
  unit.value = effectiveUnit;
  emitValue(`${clean}${effectiveUnit}`);
}

function handleUnitChange(nextUnit: string) {
  unit.value = nextUnit;
  if (nextUnit === 'auto') {
    num.value = 'auto';
    emitValue('auto');
    return;
  }
  const clean = num.value.trim();
  if (!clean || clean === 'auto') {
    if (clean === 'auto') {
      num.value = '';
    }
    if (props.modelValue === 'auto') {
      emitValue(undefined);
    }
    return;
  }
  emitValue(`${clean}${nextUnit}`);
}
</script>

<template>
  <div class="aigen-input-size aigen-style-unit-box">
    <input
      type="text"
      :value="unit === 'auto' ? 'auto' : num"
      :placeholder="props.placeholder"
      @input="handleInput"
    />
    <StyleSelect
      variant="unit"
      :model-value="unit"
      :options="UNITS"
      @change="handleUnitChange"
    />
  </div>
</template>

<style lang="less" scoped>
.aigen-input-size.aigen-style-unit-box {
  width: 100%;
  flex: 1;
  min-width: 0;
  height: 26px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: var(--aigen-designer-background);
  overflow: hidden;
  transition: border-color 0.15s ease;

  &:focus-within {
    border-color: var(--aigen-primary);
  }

  input {
    flex: 1;
    min-width: 0;
    width: 100%;
    height: 24px;
    line-height: 24px;
    padding: 0 4px 0 6px;
    margin: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 12px;
    color: var(--aigen-text-main);
    box-sizing: border-box;

    &::placeholder {
      color: var(--aigen-text-helper);
    }

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }
}
</style>
