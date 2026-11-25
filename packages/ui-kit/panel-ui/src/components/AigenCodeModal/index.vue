<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue';

import { pluginManager } from '@aigen-designer/manager';

const props = withDefaults(
  defineProps<{
    language?: string;
    modelValue?: unknown;
    title?: string;
  }>(),
  {
    language: 'json',
    modelValue: undefined,
    title: '编辑代码',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void;
}>();

const MonacoEditor = pluginManager.component.get('monacoEditor');

const visible = ref(false);
const draft = ref('');

function formatInitialCode(value: unknown): string {
  return typeof value === 'string'
    ? value
    : JSON.stringify(value ?? {}, null, 2);
}

function handleOpen() {
  draft.value = formatInitialCode(props.modelValue);
  visible.value = true;
}

function handleClose() {
  visible.value = false;
}

function handleSave() {
  if (props.language === 'json') {
    try {
      const parsed: unknown = JSON.parse(draft.value);
      emit('update:modelValue', parsed);
      handleClose();
    } catch {
      pluginManager.global.$message.error('JSON 格式有误，请检查后重试');
    }
    return;
  }

  emit('update:modelValue', draft.value);
  handleClose();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && visible.value) {
    handleClose();
  }
}

watch(
  visible,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeydown);
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <button type="button" class="aigen-code-btn" @click="handleOpen">
    &lt;/&gt; 编辑代码
  </button>

  <Teleport to="body">
    <div v-if="visible" class="aigen-code-modal-root">
      <div class="aigen-code-modal-mask" @click="handleClose"></div>
      <div
        class="aigen-code-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="props.title || '编辑代码'"
      >
        <div class="aigen-code-modal__header">
          <span class="aigen-code-modal__title">{{
            props.title || '编辑代码'
          }}</span>
          <button
            type="button"
            class="aigen-code-modal__close"
            aria-label="关闭"
            @click="handleClose"
          >
            ×
          </button>
        </div>

        <div class="aigen-code-modal__body">
          <component
            :is="MonacoEditor"
            v-if="MonacoEditor"
            v-model="draft"
            auto-toggle-theme
            bordered
            class="aigen-code-modal__editor"
            :language="props.language"
          />
          <textarea
            v-else
            v-model="draft"
            class="aigen-code-modal__textarea"
            spellcheck="false"
          ></textarea>
        </div>

        <div class="aigen-code-modal__footer">
          <button
            type="button"
            class="aigen-code-modal__btn aigen-code-modal__btn--secondary"
            @click="handleClose"
          >
            取消
          </button>
          <button
            type="button"
            class="aigen-code-modal__btn aigen-code-modal__btn--primary"
            @click="handleSave"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.aigen-code-btn {
  width: 100%;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--aigen-text-main);
  cursor: pointer;
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.aigen-code-btn:hover {
  color: var(--aigen-primary);
  border-color: var(--aigen-primary);
}

.aigen-code-modal-root {
  position: fixed;
  inset: 0;
  z-index: 3100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.aigen-code-modal-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.aigen-code-modal {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 700px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 96px);
  overflow: hidden;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}

.aigen-code-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--aigen-border);
}

.aigen-code-modal__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-code-modal__close {
  padding: 2px 6px;
  font-size: 20px;
  line-height: 1;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: transparent;
  border: none;
}

.aigen-code-modal__close:hover {
  color: var(--aigen-destructive);
}

.aigen-code-modal__body {
  height: 420px;
  padding: 12px 16px;
  min-height: 0;
}

.aigen-code-modal__editor {
  width: 100%;
  height: 100%;
}

.aigen-code-modal__textarea {
  width: 100%;
  height: 100%;
  padding: 8px 10px;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
  color: var(--aigen-text-main);
  resize: none;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.aigen-code-modal__textarea:focus {
  border-color: var(--aigen-primary);
}

.aigen-code-modal__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--aigen-border);
}

.aigen-code-modal__btn {
  padding: 6px 16px;
  font-size: 13px;
  color: var(--aigen-text-main);
  cursor: pointer;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-code-modal__btn--primary {
  color: var(--aigen-primary-foreground, #fff);
  background: var(--aigen-primary);
  border-color: var(--aigen-primary);
}

.aigen-code-modal__btn--primary:hover {
  opacity: 0.9;
}

.aigen-code-modal__btn--secondary:hover {
  color: var(--aigen-primary);
  border-color: var(--aigen-primary);
}
</style>
