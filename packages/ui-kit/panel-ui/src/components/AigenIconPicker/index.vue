<script lang="ts" setup>
import type { CSSProperties } from 'vue';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';

interface IconOption {
  label: string;
  name: string;
}

defineProps<{
  modelValue?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const CURATED_ICONS: ReadonlyArray<IconOption> = [
  { label: '添加', name: 'icon--aigen--add-rounded' },
  { label: '减少', name: 'icon--aigen--minus-rounded' },
  { label: '搜索', name: 'icon--aigen--search-rounded' },
  { label: '编辑', name: 'icon--aigen--edit-square-outline-rounded' },
  { label: '删除', name: 'icon--aigen--delete-outline-rounded' },
  { label: '复制', name: 'icon--aigen--copy-all-outline-rounded' },
  { label: '预览', name: 'icon--aigen--eye' },
  { label: '显示', name: 'icon--aigen--visibility-outline-rounded' },
  { label: '隐藏', name: 'icon--aigen--visibility-off-outline-rounded' },
  { label: '锁定', name: 'icon--aigen--lock-outline' },
  { label: '解锁', name: 'icon--aigen--lock-open-outline' },
  { label: '信息', name: 'icon--aigen--info' },
  { label: '警告', name: 'icon--aigen--error-outline-rounded' },
  { label: '帮助', name: 'icon--aigen--help-outline-rounded' },
  { label: '日历', name: 'icon--aigen--calendar-month-outline-rounded' },
  { label: '时间', name: 'icon--aigen--time-line' },
  { label: '历史', name: 'icon--aigen--history-rounded' },
  { label: '云上传', name: 'icon--aigen--cloud-upload-outlined' },
  { label: '上传', name: 'icon--aigen--upload-rounded' },
  { label: '保存', name: 'icon--aigen--save-outline-rounded' },
  { label: '代码', name: 'icon--aigen--code' },
  { label: '终端', name: 'icon--aigen--terminal-rounded' },
  { label: '链接', name: 'icon--aigen--link-rounded' },
  { label: '拖拽', name: 'icon--aigen--drag' },
  { label: '置顶', name: 'icon--aigen--upward' },
  { label: '左箭头', name: 'icon--aigen--arrow-back-ios-rounded' },
  { label: '右箭头', name: 'icon--aigen--arrow-forward-ios-rounded' },
  { label: '撤销', name: 'icon--aigen--undo' },
  { label: '重做', name: 'icon--aigen--redo' },
  { label: '回收站', name: 'icon--aigen--trash' },
  { label: '滑块', name: 'icon--aigen--sliders' },
  { label: '开关', name: 'icon--aigen--switches' },
  { label: '组件', name: 'icon--aigen--component' },
  { label: '调色板', name: 'icon--aigen--palette-outline' },
  { label: '标签页', name: 'icon--aigen--layout-tabs' },
  { label: '栅格', name: 'icon--aigen--width-normal-outline' },
  { label: '拼图布局', name: 'icon--aigen--auto-awesome-mosaic-outline' },
  { label: '弹窗', name: 'icon--aigen--dialogs-outline-rounded' },
  { label: '图片', name: 'icon--aigen--imagesmode-outline-rounded' },
  { label: '文本', name: 'icon--aigen--insert-text-outline-rounded' },
  { label: '树形结构', name: 'icon--aigen--account-tree-outline-rounded' },
  { label: '卡片集', name: 'icon--aigen--web-stories-outline' },
  { label: '视图', name: 'icon--aigen--wysiwyg-rounded' },
  { label: '窗口预览', name: 'icon--aigen--preview-outline' },
];

const POPOVER_WIDTH = 288;
const POPOVER_MAX_HEIGHT = 320;
const VIEWPORT_PADDING = 8;

const open = ref(false);
const keyword = ref('');
const triggerRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const popoverStyle = ref<CSSProperties>({});

const filteredIcons = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) {
    return CURATED_ICONS;
  }
  return CURATED_ICONS.filter(
    (item) =>
      item.name.toLowerCase().includes(kw) ||
      item.label.toLowerCase().includes(kw),
  );
});

/**
 * 计算并更新弹窗在视口中的固定定位坐标，避免右侧边栏贴边溢出
 */
function updatePopoverPosition(): void {
  const el = triggerRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const width = Math.min(
    POPOVER_WIDTH,
    window.innerWidth - VIEWPORT_PADDING * 2,
  );
  const left = Math.max(
    VIEWPORT_PADDING,
    Math.min(rect.right - width, window.innerWidth - width - VIEWPORT_PADDING),
  );

  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
  const placeAbove = spaceBelow < POPOVER_MAX_HEIGHT && rect.top > spaceBelow;
  const top = placeAbove
    ? Math.max(VIEWPORT_PADDING, rect.top - POPOVER_MAX_HEIGHT - 6)
    : Math.min(
        rect.bottom + 6,
        window.innerHeight - POPOVER_MAX_HEIGHT - VIEWPORT_PADDING,
      );

  popoverStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
  };
}

function handleOpen(): void {
  keyword.value = '';
  updatePopoverPosition();
  open.value = true;
  nextTick(() => {
    searchInputRef.value?.focus();
  });
}

function close(): void {
  open.value = false;
}

function toggleOpen(): void {
  if (open.value) {
    close();
  } else {
    handleOpen();
  }
}

function handleSelect(name: string): void {
  emit('update:modelValue', name);
  close();
}

function handleClear(): void {
  emit('update:modelValue', '');
}

function handleClearAndClose(): void {
  emit('update:modelValue', '');
  close();
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close();
  }
}

watch(open, (visible) => {
  if (visible) {
    window.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('resize', updatePopoverPosition);
  } else {
    window.removeEventListener('keydown', handleKeydown, true);
    window.removeEventListener('resize', updatePopoverPosition);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown, true);
  window.removeEventListener('resize', updatePopoverPosition);
});
</script>

<template>
  <div class="aigen-icon-picker">
    <div
      ref="triggerRef"
      role="button"
      tabindex="0"
      class="aigen-icon-picker__trigger"
      :aria-expanded="open"
      @click="toggleOpen"
      @keydown.enter.prevent="toggleOpen"
      @keydown.space.prevent="toggleOpen"
    >
      <AigenIcon
        v-if="modelValue"
        :name="modelValue"
        class="aigen-icon-picker__preview"
      />
      <span
        class="aigen-icon-picker__text"
        :class="{ 'is-placeholder': !modelValue }"
        :title="modelValue || '选择图标'"
      >
        {{ modelValue || '选择图标' }}
      </span>
      <button
        v-if="modelValue"
        type="button"
        class="aigen-icon-picker__clear"
        title="清空图标"
        aria-label="清空图标"
        @click.stop="handleClear"
      >
        ×
      </button>
    </div>

    <Teleport to="body">
      <template v-if="open">
        <div class="aigen-icon-picker__backdrop" @click="close"></div>
        <div
          class="aigen-icon-picker__popover"
          :style="popoverStyle"
          role="dialog"
          aria-label="选择内置图标"
        >
          <div class="aigen-icon-picker__header">
            <div class="aigen-icon-picker__search-wrap">
              <AigenIcon
                name="icon--aigen--search-rounded"
                class="aigen-icon-picker__search-icon"
              />
              <input
                ref="searchInputRef"
                v-model="keyword"
                type="text"
                class="aigen-icon-picker__search-input"
                placeholder="搜索图标名称..."
              />
            </div>
            <button
              type="button"
              class="aigen-icon-picker__clear-btn"
              @click="handleClearAndClose"
            >
              清空
            </button>
          </div>

          <div v-if="filteredIcons.length > 0" class="aigen-icon-picker__grid">
            <button
              v-for="item in filteredIcons"
              :key="item.name"
              type="button"
              class="aigen-icon-picker__item"
              :class="{ 'is-active': item.name === modelValue }"
              :title="`${item.label} (${item.name})`"
              @click="handleSelect(item.name)"
            >
              <AigenIcon
                :name="item.name"
                class="aigen-icon-picker__item-icon"
              />
              <span class="aigen-icon-picker__item-label">{{
                item.label
              }}</span>
            </button>
          </div>
          <div v-else class="aigen-icon-picker__empty">未找到匹配的图标</div>
        </div>
      </template>
    </Teleport>
  </div>
</template>

<style scoped>
.aigen-icon-picker {
  width: 100%;
  min-width: 0;
}

.aigen-icon-picker__trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--aigen-border, #e2e8f0);
  border-radius: 6px;
  background: var(--aigen-background, #ffffff);
  color: var(--aigen-text-main, #1e293b);
  cursor: pointer;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}

.aigen-icon-picker__trigger:hover,
.aigen-icon-picker__trigger:focus-visible {
  border-color: var(--aigen-primary, #1677ff);
  outline: none;
}

.aigen-icon-picker__preview {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--aigen-text-main, #1e293b);
}

.aigen-icon-picker__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.aigen-icon-picker__text.is-placeholder {
  color: var(--aigen-text-helper, #94a3b8);
}

.aigen-icon-picker__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--aigen-text-helper, #94a3b8);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.aigen-icon-picker__clear:hover {
  color: var(--aigen-destructive, #ff4d4f);
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.06));
}

.aigen-icon-picker__backdrop {
  position: fixed;
  inset: 0;
  z-index: 3099;
  background: transparent;
}

.aigen-icon-picker__popover {
  position: fixed;
  z-index: 3100;
  display: flex;
  flex-direction: column;
  max-height: 320px;
  padding: 10px;
  border: 1px solid var(--aigen-border, #e2e8f0);
  border-radius: 8px;
  background: var(--aigen-background, #ffffff);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
  box-sizing: border-box;
}

.aigen-icon-picker__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.aigen-icon-picker__search-wrap {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--aigen-border, #e2e8f0);
  border-radius: 6px;
  background: var(--aigen-secondary, #f8fafc);
}

.aigen-icon-picker__search-wrap:focus-within {
  border-color: var(--aigen-primary, #1677ff);
}

.aigen-icon-picker__search-icon {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--aigen-text-helper, #94a3b8);
}

.aigen-icon-picker__search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  color: var(--aigen-text-main, #1e293b);
}

.aigen-icon-picker__clear-btn {
  flex-shrink: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--aigen-border, #e2e8f0);
  border-radius: 6px;
  background: var(--aigen-background, #ffffff);
  color: var(--aigen-text-secondary, #475569);
  font-size: 12px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;
}

.aigen-icon-picker__clear-btn:hover {
  color: var(--aigen-primary, #1677ff);
  border-color: var(--aigen-primary, #1677ff);
}

.aigen-icon-picker__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  overflow-y: auto;
  padding-right: 2px;
}

.aigen-icon-picker__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 6px 2px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--aigen-text-main, #1e293b);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.aigen-icon-picker__item:hover {
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.04));
  border-color: var(--aigen-border, #e2e8f0);
}

.aigen-icon-picker__item.is-active {
  color: var(--aigen-primary, #1677ff);
  border-color: var(--aigen-primary, #1677ff);
  background: rgba(22, 119, 255, 0.08);
}

.aigen-icon-picker__item-icon {
  font-size: 18px;
  line-height: 1;
}

.aigen-icon-picker__item-label {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  line-height: 1.2;
  text-align: center;
  color: var(--aigen-text-helper, #64748b);
}

.aigen-icon-picker__item.is-active .aigen-icon-picker__item-label {
  color: var(--aigen-primary, #1677ff);
}

.aigen-icon-picker__empty {
  padding: 24px 0;
  font-size: 12px;
  text-align: center;
  color: var(--aigen-text-helper, #94a3b8);
}
</style>
