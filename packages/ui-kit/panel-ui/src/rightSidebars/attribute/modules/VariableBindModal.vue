<script lang="ts" setup>
import type {
  ComponentSchema,
  JSExpressionBinding,
} from '@aigen-designer/types';

import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import { DESIGNER_CONTEXT_KEY, PAGE_MANAGER_KEY } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import {
  isJSExpressionBinding,
  isJSExpressionVar,
  isStateAccessorVar,
  previewJSExpression,
  unwrapVarDefaultValue,
} from '@aigen-designer/utils';

interface FormFieldItem {
  field: string;
  label: string;
  type: string;
}

interface PageVarItem {
  name: string;
  preview: string;
  rawValue: unknown;
  valueType: string;
}

interface QuickSnippetItem {
  code: string;
  desc: string;
}

type SourceTab = 'formData' | 'funcs' | 'snippets' | 'vars';

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

const QUICK_SNIPPETS: QuickSnippetItem[] = [
  { code: 'vars.greeting', desc: '读取页面变量（greeting 示例）' },
  { code: 'vars.enabled ? true : false', desc: '基于页面变量的条件三元判断' },
  { code: "formData.xx === '1'", desc: '判断表单字段值是否等于指定值' },
  { code: 'true', desc: '布尔常量：真' },
  { code: 'false', desc: '布尔常量：假' },
  { code: '[]', desc: '空数组常量' },
  { code: '{}', desc: '空对象常量' },
];

const designer = inject(DESIGNER_CONTEXT_KEY, null);
const pageManager = inject(PAGE_MANAGER_KEY, null);

const MonacoEditor = pluginManager.component.get('monacoEditor');
const monacoEditorRef = ref<any>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const activeTab = ref<SourceTab>('vars');
const searchKeyword = ref('');
const exprCode = ref('');

const isCurrentlyBound = computed(() =>
  isJSExpressionBinding(props.modelValue),
);
const canConfirm = computed(() => Boolean(exprCode.value.trim()));

function formatPreviewValue(val: unknown): string {
  if (val === undefined) return 'undefined';
  if (typeof val === 'function') return '[Function]';
  try {
    const str = JSON.stringify(val);
    if (str === undefined) return String(val);
    return str.length > 64 ? `${str.slice(0, 61)}...` : str;
  } catch {
    return String(val);
  }
}

function detectValueType(val: unknown): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

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

const allPageVars = computed<PageVarItem[]>(() => {
  const rawVars = designer?.pageSchema?.vars ?? pageManager?.vars?.value ?? {};
  const runtimeVars = pageManager?.vars?.value ?? {};
  return Object.entries(rawVars).map(([name, val]) => {
    const hasRuntime = Object.prototype.hasOwnProperty.call(runtimeVars, name);
    const displayVal = hasRuntime
      ? runtimeVars[name]
      : unwrapVarDefaultValue(val);
    let valueType = detectValueType(displayVal);
    if (isStateAccessorVar(val)) {
      valueType = val.accessor.getter?.value ? 'computed' : 'setter';
    } else if (isJSExpressionVar(unwrapVarDefaultValue(val))) {
      valueType = 'expr';
    }
    return {
      name,
      preview: formatPreviewValue(displayVal),
      rawValue: displayVal,
      valueType,
    };
  });
});

const allFormFields = computed(() =>
  collectFormFields(designer?.pageSchema?.schemas ?? []),
);

const allFuncNames = computed(() =>
  Object.keys(pageManager?.funcs.value ?? {}),
);

const sourceTabs = computed<
  Array<{ count: number; key: SourceTab; label: string }>
>(() => [
  { count: allPageVars.value.length, key: 'vars', label: '变量' },
  { count: allFormFields.value.length, key: 'formData', label: '表单' },
  { count: allFuncNames.value.length, key: 'funcs', label: '方法' },
  { count: QUICK_SNIPPETS.length, key: 'snippets', label: '片段' },
]);

const normalizedKeyword = computed(() =>
  searchKeyword.value.trim().toLowerCase(),
);

const filteredPageVars = computed(() => {
  const kw = normalizedKeyword.value;
  if (!kw) return allPageVars.value;
  return allPageVars.value.filter(
    (item) =>
      item.name.toLowerCase().includes(kw) ||
      item.preview.toLowerCase().includes(kw),
  );
});

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

const livePreview = computed(() => {
  if (!exprCode.value.trim()) {
    return null;
  }
  const formSnapshot =
    typeof pageManager?.getFormData === 'function'
      ? pageManager.getFormData()
      : (pageManager?.pageFormData ?? {});
  const varsSnapshot =
    pageManager?.vars?.value ?? designer?.pageSchema?.vars ?? {};
  return previewJSExpression(exprCode.value, {
    formData: formSnapshot as Record<string, unknown>,
    funcs: pageManager?.funcs.value ?? {},
    state: pageManager ?? undefined,
    vars: varsSnapshot,
  });
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

function handleClearEditor() {
  exprCode.value = '';
  if (MonacoEditor && monacoEditorRef.value) {
    monacoEditorRef.value.setValue?.('');
  }
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

function handleAfterEnter() {
  monacoEditorRef.value?.getEditor?.()?.layout?.();
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return;
  if (event.key === 'Escape') {
    handleClose();
    return;
  }
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key === 'Enter' &&
    canConfirm.value
  ) {
    event.preventDefault();
    handleConfirm();
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
      activeTab.value = allPageVars.value.length > 0 ? 'vars' : 'formData';
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
    <Transition
      name="aigen-bind-modal-fade"
      appear
      @after-enter="handleAfterEnter"
    >
      <div v-if="props.open" class="aigen-bind-modal-root">
        <div class="aigen-bind-modal-mask" @click="handleClose"></div>
        <div
          class="aigen-bind-modal"
          role="dialog"
          aria-modal="true"
          aria-label="绑定变量与表达式"
        >
          <!-- 企业化顶部标题栏 -->
          <div class="aigen-bind-modal__header">
            <div class="aigen-bind-modal__title-group">
              <span class="aigen-bind-modal__title-icon">
                <AigenIcon name="icon--aigen--terminal-rounded" />
              </span>
              <div class="aigen-bind-modal__title-meta">
                <div class="aigen-bind-modal__title-row">
                  <span class="aigen-bind-modal__title">变量与表达式绑定</span>
                  <span
                    v-if="props.fieldLabel || props.fieldName"
                    class="aigen-bind-modal__target-chip"
                  >
                    <span>{{ props.fieldLabel }}</span>
                    <code v-if="props.fieldName">{{ props.fieldName }}</code>
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="aigen-bind-modal__close"
              title="关闭 (Esc)"
              aria-label="关闭"
              @click="handleClose"
            >
              <AigenIcon name="icon--aigen--close" />
            </button>
          </div>

          <!-- 双栏工作台主体 -->
          <div class="aigen-bind-modal__body">
            <!-- 左侧上下文浏览栏 -->
            <aside class="aigen-bind-modal__sidebar">
              <div class="aigen-bind-modal__tabs" role="tablist">
                <button
                  v-for="tab in sourceTabs"
                  :key="tab.key"
                  type="button"
                  role="tab"
                  class="aigen-bind-modal__tab"
                  :class="{ 'is-active': activeTab === tab.key }"
                  :aria-selected="activeTab === tab.key"
                  @click="activeTab = tab.key"
                >
                  <span>{{ tab.label }}</span>
                  <span
                    v-if="tab.count > 0"
                    class="aigen-bind-modal__tab-count"
                  >
                    {{ tab.count }}
                  </span>
                </button>
              </div>

              <div class="aigen-bind-modal__search-wrap">
                <AigenIcon
                  name="icon--aigen--search-rounded"
                  class="aigen-bind-modal__search-icon"
                />
                <input
                  v-model="searchKeyword"
                  type="text"
                  class="aigen-bind-modal__search"
                  placeholder="筛选名称、路径或片段..."
                />
                <button
                  v-if="searchKeyword"
                  type="button"
                  class="aigen-bind-modal__search-clear"
                  title="清空筛选"
                  @click="searchKeyword = ''"
                >
                  <AigenIcon name="icon--aigen--close" />
                </button>
              </div>

              <div class="aigen-bind-modal__list">
                <!-- 页面变量 (vars) -->
                <template v-if="activeTab === 'vars'">
                  <button
                    v-for="item in filteredPageVars"
                    :key="item.name"
                    type="button"
                    class="aigen-bind-modal__item"
                    :title="`点击插入 vars.${item.name}`"
                    @click="insertCode(`vars.${item.name}`)"
                  >
                    <div class="aigen-bind-modal__item-head">
                      <span class="aigen-bind-modal__item-label">
                        {{ item.name }}
                      </span>
                      <span class="aigen-bind-modal__item-badge">
                        {{ item.valueType }}
                      </span>
                    </div>
                    <div class="aigen-bind-modal__item-foot">
                      <code class="aigen-bind-modal__item-code">
                        vars.{{ item.name }}
                      </code>
                      <span class="aigen-bind-modal__item-preview">
                        = {{ item.preview }}
                      </span>
                    </div>
                  </button>
                  <div
                    v-if="!filteredPageVars.length"
                    class="aigen-bind-modal__empty"
                  >
                    <p class="aigen-bind-modal__empty-title">暂无页面变量</p>
                    <p class="aigen-bind-modal__empty-desc">
                      可在左侧活动栏「变量」面板中新建页面变量
                    </p>
                  </div>
                </template>

                <!-- 表单字段 (formData) -->
                <template v-else-if="activeTab === 'formData'">
                  <button
                    v-for="item in filteredFormFields"
                    :key="item.field"
                    type="button"
                    class="aigen-bind-modal__item"
                    :title="`点击插入 formData.${item.field}`"
                    @click="insertCode(`formData.${item.field}`)"
                  >
                    <div class="aigen-bind-modal__item-head">
                      <span class="aigen-bind-modal__item-label">
                        {{ item.label }}
                      </span>
                      <span class="aigen-bind-modal__item-badge">
                        {{ item.type }}
                      </span>
                    </div>
                    <div class="aigen-bind-modal__item-foot">
                      <code class="aigen-bind-modal__item-code">
                        formData.{{ item.field }}
                      </code>
                    </div>
                  </button>
                  <div
                    v-if="!filteredFormFields.length"
                    class="aigen-bind-modal__empty"
                  >
                    <p class="aigen-bind-modal__empty-title">
                      暂无匹配的表单字段
                    </p>
                    <p class="aigen-bind-modal__empty-desc">
                      向画布添加输入组件并配置数据字段后即可在此引用
                    </p>
                  </div>
                </template>

                <!-- 公共方法 (funcs) -->
                <template v-else-if="activeTab === 'funcs'">
                  <button
                    v-for="name in filteredFuncs"
                    :key="name"
                    type="button"
                    class="aigen-bind-modal__item"
                    :title="`点击插入 funcs.${name}()`"
                    @click="insertCode(`funcs.${name}()`)"
                  >
                    <div class="aigen-bind-modal__item-head">
                      <span class="aigen-bind-modal__item-label">{{
                        name
                      }}</span>
                      <span class="aigen-bind-modal__item-badge">fn</span>
                    </div>
                    <div class="aigen-bind-modal__item-foot">
                      <code class="aigen-bind-modal__item-code">
                        funcs.{{ name }}()
                      </code>
                    </div>
                  </button>
                  <div
                    v-if="!filteredFuncs.length"
                    class="aigen-bind-modal__empty"
                  >
                    <p class="aigen-bind-modal__empty-title">暂无可用方法</p>
                    <p class="aigen-bind-modal__empty-desc">
                      可通过页面脚本 defineExpose 暴露自定义方法
                    </p>
                  </div>
                </template>

                <!-- 常用片段 -->
                <template v-else>
                  <button
                    v-for="item in filteredSnippets"
                    :key="item.code"
                    type="button"
                    class="aigen-bind-modal__item"
                    :title="`点击插入 ${item.code}`"
                    @click="insertCode(item.code)"
                  >
                    <div class="aigen-bind-modal__item-head">
                      <code class="aigen-bind-modal__item-label">{{
                        item.code
                      }}</code>
                    </div>
                    <div class="aigen-bind-modal__item-foot">
                      <span class="aigen-bind-modal__item-desc">{{
                        item.desc
                      }}</span>
                    </div>
                  </button>
                  <div
                    v-if="!filteredSnippets.length"
                    class="aigen-bind-modal__empty"
                  >
                    <p class="aigen-bind-modal__empty-title">
                      暂无匹配的代码片段
                    </p>
                  </div>
                </template>
              </div>
            </aside>

            <!-- 右侧表达式编辑器工作区 -->
            <section class="aigen-bind-modal__editor-pane">
              <div class="aigen-bind-modal__editor-bar">
                <div class="aigen-bind-modal__editor-bar-left">
                  <span class="aigen-bind-modal__editor-title">JS 表达式</span>
                  <span
                    class="aigen-bind-modal__status-tag"
                    :class="isCurrentlyBound ? 'is-bound' : 'is-unbound'"
                  >
                    {{ isCurrentlyBound ? '已绑定' : '未绑定' }}
                  </span>
                </div>
                <button
                  v-if="exprCode"
                  type="button"
                  class="aigen-bind-modal__bar-action"
                  @click="handleClearEditor"
                >
                  清空
                </button>
              </div>

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
                  placeholder="请输入 JS 表达式，例如：vars.greeting"
                  spellcheck="false"
                ></textarea>
              </div>

              <!-- 实时求值预览条 -->
              <div
                class="aigen-bind-modal__preview-bar"
                :class="{
                  'is-ok': livePreview?.ok,
                  'is-error': livePreview && !livePreview.ok,
                }"
              >
                <template v-if="livePreview">
                  <span class="aigen-bind-modal__preview-dot"></span>
                  <span class="aigen-bind-modal__preview-label">
                    {{ livePreview.ok ? '求值预览' : '表达式异常' }}
                  </span>
                  <code class="aigen-bind-modal__preview-value">
                    {{
                      livePreview.ok
                        ? formatPreviewValue(livePreview.value)
                        : livePreview.error
                    }}
                  </code>
                </template>
                <template v-else>
                  <span class="aigen-bind-modal__preview-tip">
                    支持 <code>vars.xxx</code> / <code>formData.xxx</code> /
                    <code>funcs.xx()</code> 或三元表达式，无需包裹
                    <code>&#123;&#123; &#125;&#125;</code>
                  </span>
                </template>
              </div>
            </section>
          </div>

          <!-- 底部操作栏 -->
          <div class="aigen-bind-modal__footer">
            <div>
              <button
                v-if="isCurrentlyBound"
                type="button"
                class="aigen-bind-modal__btn aigen-bind-modal__btn--danger"
                @click="handleRemove"
              >
                <AigenIcon name="icon--aigen--trash" />
                <span>移除绑定</span>
              </button>
            </div>
            <div class="aigen-bind-modal__footer-actions">
              <span class="aigen-bind-modal__shortcut">Ctrl + Enter 确认</span>
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
                确定绑定
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
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
  padding: 24px;
}

.aigen-bind-modal-fade-enter-active,
.aigen-bind-modal-fade-leave-active {
  transition: opacity 0.2s ease;

  .aigen-bind-modal-mask {
    transition: opacity 0.2s ease;
  }

  .aigen-bind-modal {
    transition:
      transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
      opacity 0.2s ease;
  }
}

.aigen-bind-modal-fade-enter-from,
.aigen-bind-modal-fade-leave-to {
  opacity: 0;

  .aigen-bind-modal-mask {
    opacity: 0;
  }

  .aigen-bind-modal {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
}

.aigen-bind-modal-mask {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
}

.aigen-bind-modal {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 820px;
  height: 540px;
  max-height: calc(100vh - 48px);
  background: var(--aigen-designer-background, var(--aigen-background, #fff));
  color: var(--aigen-text-main);
  border: 1px solid var(--aigen-border);
  border-radius: 6px;
  box-shadow:
    0 20px 48px rgba(15, 23, 42, 0.2),
    0 4px 12px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.aigen-bind-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 52px;
  padding: 0 18px;
  border-bottom: 1px solid var(--aigen-border);
  flex-shrink: 0;
}

.aigen-bind-modal__title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.aigen-bind-modal__title-icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--aigen-primary-faded, rgba(22, 119, 255, 0.1));
  color: var(--aigen-primary, #1677ff);
  font-size: 15px;
  flex-shrink: 0;
}

.aigen-bind-modal__title-meta {
  min-width: 0;
}

.aigen-bind-modal__title-row {
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

.aigen-bind-modal__target-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 360px;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid var(--aigen-border);
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.03));
  font-size: 11px;
  color: var(--aigen-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    color: var(--aigen-primary, #1677ff);
  }
}

.aigen-bind-modal__close {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background: var(--aigen-muted, rgba(0, 0, 0, 0.05));
    color: var(--aigen-text-main);
  }
}

.aigen-bind-modal__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 292px 1fr;
  overflow: hidden;
}

.aigen-bind-modal__sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-right: 1px solid var(--aigen-border);
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.015));
  min-height: 0;
  overflow: hidden;
}

.aigen-bind-modal__tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
  padding: 3px;
  border-radius: 4px;
  border: 1px solid var(--aigen-border);
  background: var(--aigen-designer-background, var(--aigen-background, #fff));
}

.aigen-bind-modal__tab {
  height: 26px;
  padding: 0 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-secondary);
  font-size: 11px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;

  &:hover {
    color: var(--aigen-text-main);
    background: var(--aigen-secondary, rgba(0, 0, 0, 0.03));
  }

  &.is-active {
    background: var(--aigen-primary-faded, rgba(22, 119, 255, 0.1));
    color: var(--aigen-primary, #1677ff);
    font-weight: 600;
  }
}

.aigen-bind-modal__tab-count {
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: rgba(148, 163, 184, 0.2);
  font-size: 10px;
  line-height: 14px;
  text-align: center;
}

.aigen-bind-modal__tab.is-active .aigen-bind-modal__tab-count {
  background: rgba(22, 119, 255, 0.16);
}

.aigen-bind-modal__search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: var(--aigen-designer-background, var(--aigen-background, #fff));
  transition: border-color 0.15s ease;

  &:focus-within {
    border-color: var(--aigen-primary, #1677ff);
  }
}

.aigen-bind-modal__search-icon {
  font-size: 13px;
  color: var(--aigen-text-helper, #94a3b8);
  flex-shrink: 0;
}

.aigen-bind-modal__search {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--aigen-text-main);
  font-size: 12px;
}

.aigen-bind-modal__search-clear {
  border: 0;
  padding: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: transparent;
  color: var(--aigen-text-helper, #94a3b8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;

  &:hover {
    color: var(--aigen-text-main);
    background: var(--aigen-muted, rgba(0, 0, 0, 0.06));
  }
}

.aigen-bind-modal__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
}

.aigen-bind-modal__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: var(--aigen-designer-background, var(--aigen-background, #fff));
  color: var(--aigen-text-main);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;

  &:hover {
    border-color: var(--aigen-primary, #1677ff);
    background: var(--aigen-primary-faded, rgba(22, 119, 255, 0.04));
    box-shadow: 0 1px 4px rgba(22, 119, 255, 0.1);
  }
}

.aigen-bind-modal__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
}

.aigen-bind-modal__item-label {
  font-weight: 500;
  color: var(--aigen-text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-bind-modal__item-badge {
  flex-shrink: 0;
  height: 18px;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.04));
  color: var(--aigen-text-secondary);
  font-size: 10px;
  line-height: 18px;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.aigen-bind-modal__item-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.aigen-bind-modal__item-code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  color: var(--aigen-primary, #1677ff);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-bind-modal__item-preview {
  flex: 1;
  min-width: 0;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  color: var(--aigen-text-helper, #94a3b8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-bind-modal__item-desc {
  font-size: 11px;
  color: var(--aigen-text-helper, #94a3b8);
  line-height: 1.4;
}

.aigen-bind-modal__empty {
  padding: 28px 12px;
  text-align: center;
}

.aigen-bind-modal__empty-title {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--aigen-text-secondary);
}

.aigen-bind-modal__empty-desc {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--aigen-text-helper, #94a3b8);
}

.aigen-bind-modal__editor-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  min-width: 0;
  min-height: 0;
}

.aigen-bind-modal__editor-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 24px;
  flex-shrink: 0;
}

.aigen-bind-modal__editor-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aigen-bind-modal__editor-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-bind-modal__status-tag {
  height: 18px;
  padding: 0 6px;
  border-radius: 3px;
  font-size: 10px;
  line-height: 18px;

  &.is-bound {
    background: rgba(22, 119, 255, 0.12);
    color: var(--aigen-primary, #1677ff);
  }

  &.is-unbound {
    background: var(--aigen-secondary, rgba(0, 0, 0, 0.05));
    color: var(--aigen-text-helper, #94a3b8);
  }
}

.aigen-bind-modal__bar-action {
  border: 0;
  padding: 2px 6px;
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-secondary);
  font-size: 11px;
  cursor: pointer;

  &:hover {
    color: var(--aigen-primary, #1677ff);
    background: var(--aigen-secondary, rgba(0, 0, 0, 0.04));
  }
}

.aigen-bind-modal__editor-wrap {
  flex: 1;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  overflow: hidden;
}

.aigen-bind-modal__monaco {
  flex: 1;
  min-height: 200px;
  height: 100%;
}

.aigen-bind-modal__textarea {
  flex: 1;
  width: 100%;
  min-height: 200px;
  padding: 10px 12px;
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

.aigen-bind-modal__preview-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid var(--aigen-border);
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.02));
  font-size: 11px;
  flex-shrink: 0;
  overflow: hidden;

  &.is-ok {
    border-color: rgba(34, 197, 94, 0.35);
    background: rgba(34, 197, 94, 0.06);

    .aigen-bind-modal__preview-dot {
      background: #22c55e;
    }
  }

  &.is-error {
    border-color: rgba(239, 68, 68, 0.35);
    background: rgba(239, 68, 68, 0.06);

    .aigen-bind-modal__preview-dot {
      background: #ef4444;
    }

    .aigen-bind-modal__preview-value {
      color: #ef4444;
    }
  }
}

.aigen-bind-modal__preview-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.aigen-bind-modal__preview-label {
  font-weight: 500;
  color: var(--aigen-text-secondary);
  flex-shrink: 0;
}

.aigen-bind-modal__preview-value {
  flex: 1;
  min-width: 0;
  font-family: 'SFMono-Regular', Consolas, monospace;
  color: var(--aigen-text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-bind-modal__preview-tip {
  color: var(--aigen-text-helper, #94a3b8);
  line-height: 1.4;

  code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    color: var(--aigen-text-main);
  }
}

.aigen-bind-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 52px;
  padding: 0 18px;
  border-top: 1px solid var(--aigen-border);
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.015));
  flex-shrink: 0;
}

.aigen-bind-modal__footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aigen-bind-modal__shortcut {
  margin-right: 4px;
  font-size: 11px;
  color: var(--aigen-text-helper, #94a3b8);
}

.aigen-bind-modal__btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 4px;
  border: 1px solid var(--aigen-border);
  background: var(--aigen-designer-background, var(--aigen-background, #fff));
  color: var(--aigen-text-main);
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--aigen-primary);
    color: var(--aigen-primary);
  }

  &:disabled {
    opacity: 0.45;
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
    border-color: rgba(239, 68, 68, 0.45);
    color: var(--aigen-destructive, #ef4444);

    &:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.08);
      border-color: var(--aigen-destructive, #ef4444);
      color: var(--aigen-destructive, #ef4444);
    }
  }
}
</style>
