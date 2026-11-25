<script lang="ts" setup>
import type {
  ComponentSchema,
  JSExpressionBinding,
} from '@aigen-designer/types';

import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { DESIGNER_CONTEXT_KEY, PAGE_MANAGER_KEY } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';

interface FormFieldItem {
  field: string;
  label: string;
  type: string;
}

interface QuickSnippetItem {
  code: string;
  desc: string;
}

type SourceTab = 'formData' | 'funcs' | 'snippets';

const props = defineProps<{
  fieldLabel?: string;
  fieldName?: string;
  modelValue?: unknown;
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'confirm', value: JSExpressionBinding): void;
  (e: 'remove'): void;
  (e: 'update:open', value: boolean): void;
}>();

const SOURCE_TABS: Array<{ key: SourceTab; label: string }> = [
  { key: 'formData', label: '表单字段 (formData)' },
  { key: 'funcs', label: '公共方法 (funcs)' },
  { key: 'snippets', label: '常用表达式' },
];

const QUICK_SNIPPETS: QuickSnippetItem[] = [
  { code: "formData.xx === '1'", desc: '判断字段值是否等于指定值' },
  { code: 'true', desc: '布尔值：真' },
  { code: 'false', desc: '布尔值：假' },
  { code: '[]', desc: '空数组' },
  { code: '{}', desc: '空对象' },
];

const designer = inject(DESIGNER_CONTEXT_KEY, null);
const pageManager = inject(PAGE_MANAGER_KEY, null);

const MonacoEditor = pluginManager.component.get('monacoEditor');
const monacoEditorRef = ref<any>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const activeTab = ref<SourceTab>('formData');
const searchKeyword = ref('');
const exprCode = ref('');

function isJSExpressionBinding(val: unknown): val is JSExpressionBinding {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    (val as Record<string, unknown>).type === 'JSExpression'
  );
}

const isCurrentlyBound = computed(() =>
  isJSExpressionBinding(props.modelValue),
);
const canConfirm = computed(() => Boolean(exprCode.value.trim()));

/**
 * 递归收集页面 Schema 中所有带 field 的组件节点
 */
function collectFormFields(schemas: ComponentSchema[] = []): FormFieldItem[] {
  const result: FormFieldItem[] = [];
  const seen = new Set<string>();

  function walk(nodes?: ComponentSchema[]) {
    if (!Array.isArray(nodes)) {
      return;
    }
    for (const node of nodes) {
      if (node.field && !seen.has(node.field)) {
        seen.add(node.field);
        result.push({
          field: node.field,
          label: node.label || node.field,
          type: node.type,
        });
      }
      if (node.children?.length) {
        walk(node.children);
      }
      if (node.slots) {
        for (const slotNodes of Object.values(node.slots)) {
          walk(slotNodes);
        }
      }
    }
  }

  walk(schemas);
  return result;
}

const allFormFields = computed(() =>
  collectFormFields(designer?.pageSchema?.schemas ?? []),
);

const allFuncNames = computed(() =>
  Object.keys(pageManager?.funcs.value ?? {}),
);

const normalizedKeyword = computed(() =>
  searchKeyword.value.trim().toLowerCase(),
);

const filteredFormFields = computed(() => {
  const kw = normalizedKeyword.value;
  if (!kw) {
    return allFormFields.value;
  }
  return allFormFields.value.filter(
    (item) =>
      item.field.toLowerCase().includes(kw) ||
      item.label.toLowerCase().includes(kw),
  );
});

const filteredFuncs = computed(() => {
  const kw = normalizedKeyword.value;
  if (!kw) {
    return allFuncNames.value;
  }
  return allFuncNames.value.filter((name) => name.toLowerCase().includes(kw));
});

const filteredSnippets = computed(() => {
  const kw = normalizedKeyword.value;
  if (!kw) {
    return QUICK_SNIPPETS;
  }
  return QUICK_SNIPPETS.filter(
    (item) =>
      item.code.toLowerCase().includes(kw) ||
      item.desc.toLowerCase().includes(kw),
  );
});

function insertCode(text: string) {
  if (MonacoEditor && monacoEditorRef.value) {
    const editor = monacoEditorRef.value.getEditor?.();
    if (editor?.getPosition?.() && monacoEditorRef.value.insertText) {
      monacoEditorRef.value.insertText(text);
      return;
    }
    exprCode.value += text;
    monacoEditorRef.value.setValue?.(exprCode.value);
    return;
  }

  const textarea = textareaRef.value;
  if (textarea) {
    const start = textarea.selectionStart ?? exprCode.value.length;
    const end = textarea.selectionEnd ?? exprCode.value.length;
    exprCode.value =
      exprCode.value.slice(0, start) + text + exprCode.value.slice(end);
    nextTick(() => {
      textarea.selectionStart = start + text.length;
      textarea.selectionEnd = start + text.length;
      textarea.focus();
    });
    return;
  }

  exprCode.value += text;
}

function handleClose() {
  emit('update:open', false);
}

function handleConfirm() {
  const value = exprCode.value.trim();
  if (!value) {
    return;
  }
  emit('confirm', { type: 'JSExpression', value });
  emit('update:open', false);
}

function handleRemove() {
  emit('remove');
  emit('update:open', false);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) {
    handleClose();
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      exprCode.value = isJSExpressionBinding(props.modelValue)
        ? String(props.modelValue.value ?? '')
        : '';
      searchKeyword.value = '';
      activeTab.value = 'formData';
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
  <Teleport to="body">
    <div v-if="props.open" class="aigen-bind-modal-root">
      <div class="aigen-bind-modal-mask" @click="handleClose"></div>
      <div
        class="aigen-bind-modal"
        role="dialog"
        aria-modal="true"
        aria-label="绑定变量 / JS表达式"
      >
        <div class="aigen-bind-modal__header">
          <div class="aigen-bind-modal__title-group">
            <span class="aigen-bind-modal__title">绑定变量 / JS表达式</span>
            <span
              v-if="props.fieldLabel || props.fieldName"
              class="aigen-bind-modal__target"
            >
              <span>{{ props.fieldLabel }}</span>
              <span v-if="props.fieldLabel && props.fieldName"> · </span>
              <code v-if="props.fieldName">{{ props.fieldName }}</code>
            </span>
          </div>
          <button
            type="button"
            class="aigen-bind-modal__close"
            title="关闭"
            aria-label="关闭"
            @click="handleClose"
          >
            ×
          </button>
        </div>

        <div class="aigen-bind-modal__body">
          <div class="aigen-bind-modal__sidebar">
            <input
              v-model="searchKeyword"
              type="text"
              class="aigen-bind-modal__search"
              placeholder="搜索字段、方法或表达式..."
            />

            <div class="aigen-bind-modal__tabs" role="tablist">
              <button
                v-for="tab in SOURCE_TABS"
                :key="tab.key"
                type="button"
                role="tab"
                class="aigen-bind-modal__tab"
                :class="{ 'is-active': activeTab === tab.key }"
                :aria-selected="activeTab === tab.key"
                @click="activeTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>

            <div class="aigen-bind-modal__list">
              <template v-if="activeTab === 'formData'">
                <button
                  v-for="item in filteredFormFields"
                  :key="item.field"
                  type="button"
                  class="aigen-bind-modal__item"
                  :title="`插入 formData.${item.field}`"
                  @click="insertCode(`formData.${item.field}`)"
                >
                  <span class="aigen-bind-modal__item-label">{{
                    item.label
                  }}</span>
                  <code class="aigen-bind-modal__item-code">
                    formData.{{ item.field }}
                  </code>
                </button>
                <div
                  v-if="!filteredFormFields.length"
                  class="aigen-bind-modal__empty"
                >
                  暂无匹配的表单字段
                </div>
              </template>

              <template v-else-if="activeTab === 'funcs'">
                <button
                  v-for="name in filteredFuncs"
                  :key="name"
                  type="button"
                  class="aigen-bind-modal__item"
                  :title="`插入 funcs.${name}()`"
                  @click="insertCode(`funcs.${name}()`)"
                >
                  <span class="aigen-bind-modal__item-label">{{ name }}</span>
                  <code class="aigen-bind-modal__item-code">
                    funcs.{{ name }}()
                  </code>
                </button>
                <div
                  v-if="!filteredFuncs.length"
                  class="aigen-bind-modal__empty"
                >
                  暂无可用的公共方法
                </div>
              </template>

              <template v-else>
                <button
                  v-for="item in filteredSnippets"
                  :key="item.code"
                  type="button"
                  class="aigen-bind-modal__item"
                  :title="`插入 ${item.code}`"
                  @click="insertCode(item.code)"
                >
                  <code class="aigen-bind-modal__item-label">{{
                    item.code
                  }}</code>
                  <span class="aigen-bind-modal__item-code">{{
                    item.desc
                  }}</span>
                </button>
                <div
                  v-if="!filteredSnippets.length"
                  class="aigen-bind-modal__empty"
                >
                  暂无匹配的常用表达式
                </div>
              </template>
            </div>
          </div>

          <div class="aigen-bind-modal__editor-pane">
            <div class="aigen-bind-modal__editor-wrap">
              <MonacoEditor
                v-if="MonacoEditor"
                ref="monacoEditorRef"
                v-model="exprCode"
                auto-toggle-theme
                bordered
                language="javascript"
                line-numbers="on"
                :allow-fullscreen="false"
                class="aigen-bind-modal__monaco"
              />
              <textarea
                v-else
                ref="textareaRef"
                v-model="exprCode"
                class="aigen-bind-modal__textarea"
                placeholder="请输入 JS 表达式，例如：formData.xx === '1'"
                spellcheck="false"
              ></textarea>
            </div>
            <p class="aigen-bind-modal__hint">
              用法：直接输入 JS 表达式（如 <code>formData.name</code>、
              <code>funcs.check()</code> 或三元表达式），无需包裹
              <code>&#123;&#123; &#125;&#125;</code>。
            </p>
          </div>
        </div>

        <div class="aigen-bind-modal__footer">
          <div>
            <button
              v-if="isCurrentlyBound"
              type="button"
              class="aigen-bind-modal__btn aigen-bind-modal__btn--danger"
              @click="handleRemove"
            >
              移除绑定
            </button>
          </div>
          <div class="aigen-bind-modal__footer-actions">
            <button
              type="button"
              class="aigen-bind-modal__btn"
              @click="handleClose"
            >
              取消
            </button>
            <button
              type="button"
              class="aigen-bind-modal__btn aigen-bind-modal__btn--primary"
              :disabled="!canConfirm"
              @click="handleConfirm"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="less" scoped>
.aigen-bind-modal-root {
  position: fixed;
  inset: 0;
  z-index: 3100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.aigen-bind-modal-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.aigen-bind-modal {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 720px;
  max-height: calc(100vh - 64px);
  background: var(--aigen-designer-background, var(--aigen-background, #fff));
  color: var(--aigen-text-main);
  border: 1px solid var(--aigen-border);
  border-radius: 8px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.22);
  overflow: hidden;
}

.aigen-bind-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--aigen-border);
}

.aigen-bind-modal__title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.aigen-bind-modal__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--aigen-text-main);
  white-space: nowrap;
}

.aigen-bind-modal__target {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--aigen-text-helper, #94a3b8);

  code {
    font-family: monospace;
  }
}

.aigen-bind-modal__close {
  border: 0;
  background: transparent;
  color: var(--aigen-text-secondary, var(--aigen-text-main));
  font-size: 18px;
  line-height: 1;
  padding: 2px 6px;
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    color: var(--aigen-primary);
  }
}

.aigen-bind-modal__body {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 320px;
  max-height: 460px;
  overflow: hidden;
}

.aigen-bind-modal__sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-right: 1px solid var(--aigen-border);
  min-height: 0;
  overflow: hidden;
}

.aigen-bind-modal__search {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-main);
  font-size: 12px;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: var(--aigen-primary);
  }
}

.aigen-bind-modal__tabs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aigen-bind-modal__tab {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-main);
  font-size: 12px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--aigen-secondary, rgba(0, 0, 0, 0.04));
  }

  &.is-active {
    color: var(--aigen-primary);
    border-color: var(--aigen-primary);
    background: var(--aigen-primary-faded, rgba(22, 119, 255, 0.08));
    font-weight: 500;
  }
}

.aigen-bind-modal__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aigen-bind-modal__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-main);
  font-size: 12px;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: var(--aigen-primary);
    background: var(--aigen-primary-faded, rgba(22, 119, 255, 0.08));
  }
}

.aigen-bind-modal__item-label {
  font-weight: 500;
  color: var(--aigen-text-main);
  word-break: break-all;
}

.aigen-bind-modal__item-code {
  font-size: 11px;
  color: var(--aigen-text-helper, #94a3b8);
  word-break: break-all;
}

.aigen-bind-modal__empty {
  padding: 16px 8px;
  text-align: center;
  font-size: 12px;
  color: var(--aigen-text-helper, #94a3b8);
}

.aigen-bind-modal__editor-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  min-width: 0;
  min-height: 0;
}

.aigen-bind-modal__editor-wrap {
  flex: 1;
  min-height: 240px;
  display: flex;
  flex-direction: column;
}

.aigen-bind-modal__monaco {
  flex: 1;
  min-height: 240px;
  height: 100%;
}

.aigen-bind-modal__textarea {
  flex: 1;
  width: 100%;
  min-height: 240px;
  padding: 10px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-main);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: var(--aigen-primary);
  }
}

.aigen-bind-modal__hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--aigen-text-helper, #94a3b8);

  code {
    font-family: monospace;
    color: var(--aigen-text-main);
  }
}

.aigen-bind-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--aigen-border);
}

.aigen-bind-modal__footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aigen-bind-modal__btn {
  height: 28px;
  padding: 0 12px;
  border-radius: 4px;
  border: 1px solid var(--aigen-border);
  background: transparent;
  color: var(--aigen-text-main);
  font-size: 12px;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--aigen-primary);
    color: var(--aigen-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--primary {
    border-color: var(--aigen-primary);
    background: var(--aigen-primary);
    color: var(--aigen-primary-foreground, #fff);

    &:hover:not(:disabled) {
      opacity: 0.9;
      color: var(--aigen-primary-foreground, #fff);
    }
  }

  &--danger {
    border-color: var(--aigen-destructive, #ef4444);
    color: var(--aigen-destructive, #ef4444);

    &:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.08);
      border-color: var(--aigen-destructive, #ef4444);
      color: var(--aigen-destructive, #ef4444);
    }
  }
}
</style>
