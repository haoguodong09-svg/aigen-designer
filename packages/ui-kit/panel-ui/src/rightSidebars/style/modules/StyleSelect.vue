<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

export interface SelectOptionItem {
  label: string;
  value: string;
}

export interface SelectOptionGroup {
  label: string;
  options: Array<SelectOptionItem | string>;
}

const props = withDefaults(
  defineProps<{
    groups?: SelectOptionGroup[];
    modelValue?: string;
    options?: Array<SelectOptionItem | string>;
    placeholder?: string;
    title?: string;
    variant?: 'default' | 'unit';
  }>(),
  {
    groups: undefined,
    modelValue: '',
    options: () => [],
    placeholder: '请选择',
    title: '',
    variant: 'default',
  },
);

const emit = defineEmits<{
  (e: 'change', value: string): void;
  (e: 'update:modelValue', value: string): void;
}>();

const triggerRef = ref<HTMLElement | null>(null);
const open = ref(false);
const menuRect = ref<{ left: number; minWidth: number; top: number }>({
  left: 0,
  minWidth: 80,
  top: 0,
});

function normalizeOpt(opt: SelectOptionItem | string): SelectOptionItem {
  return typeof opt === 'string' ? { label: opt, value: opt } : opt;
}

const flatOptions = computed<SelectOptionItem[]>(() => {
  if (props.groups && props.groups.length > 0) {
    return props.groups.flatMap((g) => g.options.map(normalizeOpt));
  }
  return props.options.map(normalizeOpt);
});

const normalizedGroups = computed(() =>
  (props.groups ?? []).map((g) => ({
    label: g.label,
    options: g.options.map(normalizeOpt),
  })),
);

const currentLabel = computed(() => {
  const found = flatOptions.value.find((o) => o.value === props.modelValue);
  if (found) return found.label;
  return props.modelValue || props.placeholder;
});

function toggleOpen() {
  if (open.value) {
    open.value = false;
    return;
  }
  const rect = triggerRef.value?.getBoundingClientRect();
  if (rect) {
    const estHeight = Math.min(220, flatOptions.value.length * 26 + 12);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < estHeight + 12 && rect.top > estHeight + 12
        ? rect.top - estHeight - 4
        : rect.bottom + 4;
    const minWidth = Math.max(props.variant === 'unit' ? 68 : 110, rect.width);
    const left = Math.max(
      8,
      Math.min(window.innerWidth - minWidth - 8, rect.left),
    );
    menuRect.value = { left, minWidth, top };
  }
  open.value = true;
}

function selectValue(val: string) {
  emit('update:modelValue', val);
  emit('change', val);
  open.value = false;
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
  <button
    ref="triggerRef"
    type="button"
    class="aigen-ss-trigger"
    :class="[`is-${variant}`, { 'is-open': open }]"
    :title="title || currentLabel"
    @click.stop="toggleOpen"
  >
    <span class="aigen-ss-trigger__label">{{ currentLabel }}</span>
    <svg
      viewBox="0 0 12 12"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="aigen-ss-trigger__arrow"
    >
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  </button>

  <Teleport to="body">
    <div v-if="open" class="aigen-ss-mask" @click="open = false"></div>
    <div
      v-if="open"
      class="aigen-ss-menu"
      :style="{
        left: `${menuRect.left}px`,
        minWidth: `${menuRect.minWidth}px`,
        top: `${menuRect.top}px`,
      }"
      @click.stop
    >
      <template v-if="normalizedGroups.length > 0">
        <div
          v-for="group in normalizedGroups"
          :key="group.label"
          class="aigen-ss-group"
        >
          <div class="aigen-ss-group__label">{{ group.label }}</div>
          <button
            v-for="opt in group.options"
            :key="opt.value"
            type="button"
            class="aigen-ss-item"
            :class="{ 'is-active': opt.value === modelValue }"
            @click="selectValue(opt.value)"
          >
            <span class="aigen-ss-item__text">{{ opt.label }}</span>
            <span v-if="opt.value === modelValue" class="aigen-ss-item__check">
              ✓
            </span>
          </button>
        </div>
      </template>
      <template v-else>
        <button
          v-for="opt in flatOptions"
          :key="opt.value"
          type="button"
          class="aigen-ss-item"
          :class="{ 'is-active': opt.value === modelValue }"
          @click="selectValue(opt.value)"
        >
          <span class="aigen-ss-item__text">{{ opt.label }}</span>
          <span v-if="opt.value === modelValue" class="aigen-ss-item__check">
            ✓
          </span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style lang="less">
.aigen-ss-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin: 0;
  outline: none;
  cursor: pointer;
  box-sizing: border-box;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;

  &.is-default {
    flex: 1;
    width: 100%;
    min-width: 0;
    height: 26px;
    padding: 0 6px;
    border: 1px solid var(--aigen-border, #e5e7eb);
    border-radius: 4px;
    background: var(--aigen-designer-background, #ffffff);
    color: var(--aigen-text-main, #1f2937);
    font-size: 12px;

    &:hover,
    &.is-open {
      border-color: var(--aigen-primary, #1677ff);
    }
  }

  &.is-unit {
    flex-shrink: 0;
    height: 24px;
    line-height: 1;
    padding: 0 5px;
    border: none;
    border-left: 1px solid var(--aigen-border, #e5e7eb);
    background: var(--aigen-secondary, #f3f4f6);
    color: var(--aigen-text-secondary, #4b5563);
    font-size: 12px;

    &:hover,
    &.is-open {
      background: var(--aigen-muted, #e5e7eb);
      color: var(--aigen-text-main, #1f2937);
    }
  }

  &__label {
    flex: 1;
    min-width: 0;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    display: block;
    flex-shrink: 0;
    opacity: 0.65;
    transition: transform 0.15s ease;
  }

  &.is-open &__arrow {
    transform: rotate(180deg);
  }
}

.aigen-ss-mask {
  position: fixed;
  inset: 0;
  z-index: 2199;
}

.aigen-ss-menu {
  position: fixed;
  z-index: 2200;
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--aigen-border, #e5e7eb);
  border-radius: 6px;
  background: var(--aigen-designer-background, #ffffff);
  box-shadow: 0 8px 24px rgb(0 0 0 / 14%);
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.aigen-ss-group {
  display: flex;
  flex-direction: column;
  gap: 1px;

  &:not(:first-child) {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid var(--aigen-border, #e5e7eb);
  }

  &__label {
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 600;
    color: var(--aigen-text-helper, #9ca3af);
    text-transform: uppercase;
  }
}

.aigen-ss-item {
  width: 100%;
  min-height: 26px;
  padding: 2px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-main, #374151);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--aigen-muted, #f3f4f6);
  }

  &.is-active {
    background: var(--aigen-primary-faded, #eff6ff);
    color: var(--aigen-primary, #1677ff);
    font-weight: 600;
  }

  &__text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__check {
    flex-shrink: 0;
    font-size: 11px;
  }
}
</style>
