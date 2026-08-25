<script lang="ts" setup>
import type {
  ExpressionField,
  ExpressionModel,
} from '../AigenActionDrawer/helper';

import { computed, nextTick, ref, watch } from 'vue';

import { FormulaEngine } from '@aigen-designer/utils';

import {
  buildMockFormData,
  formatPreviewValue,
} from '../AigenActionDrawer/helper';

/**
 * 表达式插入器：为动作参数提供「表单字段引用 + 内置函数」的公式编辑能力。
 * 产出 { __isExpression__: true, content }，与运行时 doActions 的表达式分支完全对齐，
 * 设计态仅做求值展示（预览基于当前页面数据的模拟值），不触发任何运行时事件。
 */

/** 表单字段列表（页面输入组件：label + field + type） */
const props = withDefaults(
  defineProps<{
    fields: ExpressionField[];
    /** 初始公式内容（编辑已存在的表达式时回填） */
    initialContent?: string;
    visible: boolean;
  }>(),
  {
    initialContent: '',
  },
);

const emit = defineEmits<{
  (e: 'confirm', value: ExpressionModel): void;
  (e: 'update:visible', value: boolean): void;
}>();

/** 内置函数库（与 FormulaEngine 内置函数一致），各带一句中文说明 */
const BUILTIN_FUNCTIONS: Array<{ description: string; name: string }> = [
  { description: '取绝对值，如 ABS(-5) = 5', name: 'ABS' },
  { description: '求平均值，如 AVERAGE(1, 2, 3) = 2', name: 'AVERAGE' },
  { description: '条件判断，如 IF(数量 > 0, "是", "否")', name: 'IF' },
  { description: '取最大值，如 MAX(1, 5, 3) = 5', name: 'MAX' },
  { description: '取最小值，如 MIN(1, 5, 3) = 1', name: 'MIN' },
  { description: '亩转平方米，如 MU_TO_SQM(1) = 666.67', name: 'MU_TO_SQM' },
  { description: '求和，如 SUM(数量, 单价)', name: 'SUM' },
];

const formulaEngine = new FormulaEngine();
const content = ref('');
const editorRef = ref<HTMLTextAreaElement | null>(null);
const parseError = ref('');

// 打开时重置为初始内容
watch(
  () => props.visible,
  (val) => {
    if (val) {
      content.value = props.initialContent ?? '';
      parseError.value = '';
    }
  },
);

/** 字段列表：转换为 label + field + type */
const fieldItems = computed(() => {
  return props.fields
    .filter((item) => Boolean(item.field))
    .map((item) => ({
      field: item.field,
      label: item.label || item.field,
      type: item.type,
    }));
});

/** 实时预览：用当前表单模拟数据求值（设计态安全，仅展示） */
const preview = computed(() => {
  const expression = content.value.trim();
  if (!expression) {
    return { state: 'empty' as const, text: '输入表达式后自动预览' };
  }
  const formData = buildMockFormData(fieldItems.value);
  // 事件参数为模拟值（$event[0]=true），仅供预览展示，设计态不触发任何运行时事件
  const result = formulaEngine.calculate(expression, {
    event: [true, { type: 'change' }],
    formData,
  });
  if (result === null || result === undefined) {
    return {
      state: 'error' as const,
      text: '表达式无法解析或计算为空，请检查语法（如 $formData.字段、SUM(...)）',
    };
  }
  return { state: 'ok' as const, text: formatPreviewValue(result) };
});

/** 在光标处插入文本（字段 / 函数名） */
function insertText(text: string) {
  const ta = editorRef.value;
  if (ta) {
    const start = ta.selectionStart ?? content.value.length;
    const end = ta.selectionEnd ?? content.value.length;
    content.value =
      content.value.slice(0, start) + text + content.value.slice(end);
    nextTick(() => {
      ta.selectionStart = start + text.length;
      ta.selectionEnd = start + text.length;
      ta.focus();
    });
  } else {
    content.value += text;
  }
  parseError.value = '';
}

/** 点击字段：插入引用（$ 前缀的事件参数原样插入，其余补 $formData. 前缀） */
function insertField(field: string) {
  insertText(field.startsWith('$') ? field : `$formData.${field}`);
}

/** 点击内置函数：插入函数名并等待输入参数 */
function insertFunction(name: string) {
  insertText(`${name}(`);
}

function handleConfirm() {
  if (!content.value.trim()) {
    parseError.value = '请输入表达式内容';
    return;
  }
  emit('confirm', { __isExpression__: true, content: content.value.trim() });
  emit('update:visible', false);
}

function handleCancel() {
  emit('update:visible', false);
}

// Esc 关闭（捕获阶段优先于抽屉的 Esc 监听，避免连带关闭抽屉）
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.visible) {
    event.stopPropagation();
    emit('update:visible', false);
  }
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      window.addEventListener('keydown', handleKeydown, true);
    } else {
      window.removeEventListener('keydown', handleKeydown, true);
    }
  },
  { immediate: true },
);
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="aigen-expression-insert-root">
      <div class="aigen-expression-insert-mask" @click="handleCancel"></div>
      <div class="aigen-expression-insert" role="dialog" aria-modal="true">
        <div class="aigen-expression-insert-header">
          <span class="aigen-expression-insert-title">表达式插入器</span>
          <button
            type="button"
            class="aigen-expression-insert-close"
            title="关闭"
            @click="handleCancel"
          >
            ×
          </button>
        </div>
        <div class="aigen-expression-insert-body">
          <!-- 左列：表单字段 + 内置函数 -->
          <div
            class="aigen-expression-insert-col aigen-expression-insert-col--left"
          >
            <div class="aigen-expression-insert-group-title">表单字段</div>
            <div v-if="fieldItems.length" class="aigen-expression-insert-list">
              <button
                v-for="item in fieldItems"
                :key="item.field"
                type="button"
                class="aigen-expression-insert-item"
                :title="`插入 ${item.field.startsWith('$') ? item.field : `$formData.${item.field}`}`"
                @click="insertField(item.field)"
              >
                <span class="aigen-expression-insert-item-label">{{
                  item.label
                }}</span>
                <span class="aigen-expression-insert-item-field">{{
                  item.field
                }}</span>
              </button>
            </div>
            <div v-else class="aigen-expression-insert-empty">
              页面暂无输入组件字段
            </div>

            <div
              class="aigen-expression-insert-group-title aigen-expression-insert-group-title--mt"
            >
              内置函数
            </div>
            <div class="aigen-expression-insert-list">
              <button
                v-for="fn in BUILTIN_FUNCTIONS"
                :key="fn.name"
                type="button"
                class="aigen-expression-insert-item aigen-expression-insert-item--fn"
                :title="fn.description"
                @click="insertFunction(fn.name)"
              >
                <span class="aigen-expression-insert-item-label">{{
                  fn.name
                }}</span>
                <span class="aigen-expression-insert-item-desc">{{
                  fn.description
                }}</span>
              </button>
            </div>
          </div>

          <!-- 中列：公式编辑区 -->
          <div
            class="aigen-expression-insert-col aigen-expression-insert-col--center"
          >
            <div class="aigen-expression-insert-group-title">公式编辑</div>
            <textarea
              ref="editorRef"
              v-model="content"
              class="aigen-expression-insert-editor"
              placeholder="如：$formData.qty * $formData.price"
              spellcheck="false"
            ></textarea>
            <div class="aigen-expression-insert-tips">
              点击左侧字段 / 函数自动插入，也可直接输入
            </div>
          </div>

          <!-- 右列：实时预览 -->
          <div
            class="aigen-expression-insert-col aigen-expression-insert-col--right"
          >
            <div class="aigen-expression-insert-group-title">实时预览</div>
            <div class="aigen-expression-insert-preview">
              <template v-if="preview.state === 'empty'">
                <span class="aigen-expression-insert-preview-hint">{{
                  preview.text
                }}</span>
              </template>
              <template v-else-if="preview.state === 'error'">
                <span class="aigen-expression-insert-preview-error">{{
                  preview.text
                }}</span>
              </template>
              <template v-else>
                <div class="aigen-expression-insert-preview-value">
                  {{ preview.text }}
                </div>
              </template>
            </div>
            <div class="aigen-expression-insert-tips">
              预览基于当前页面数据（模拟值）
            </div>
          </div>
        </div>
        <div class="aigen-expression-insert-footer">
          <span v-if="parseError" class="aigen-expression-insert-error">{{
            parseError
          }}</span>
          <div class="aigen-expression-insert-footer-actions">
            <button
              type="button"
              class="aigen-btn aigen-btn--secondary"
              @click="handleCancel"
            >
              取消
            </button>
            <button
              type="button"
              class="aigen-btn aigen-btn--primary"
              @click="handleConfirm"
            >
              插入表达式
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.aigen-expression-insert-root {
  position: fixed;
  inset: 0;
  z-index: 3100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.aigen-expression-insert-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.aigen-expression-insert {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 880px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 96px);
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.aigen-expression-insert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--aigen-border);
}

.aigen-expression-insert-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-expression-insert-close {
  padding: 2px 6px;
  font-size: 20px;
  line-height: 1;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  border: none;
  background: transparent;
}

.aigen-expression-insert-close:hover {
  color: var(--aigen-destructive);
}

.aigen-expression-insert-body {
  display: grid;
  grid-template-columns: 300px 1fr 240px;
  gap: 12px;
  padding: 12px 16px;
  min-height: 360px;
  overflow: hidden;
}

.aigen-expression-insert-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.aigen-expression-insert-col--left {
  padding-right: 12px;
  border-right: 1px solid var(--aigen-border);
}

.aigen-expression-insert-col--right {
  padding-left: 12px;
  border-left: 1px solid var(--aigen-border);
}

.aigen-expression-insert-group-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-expression-insert-group-title--mt {
  margin-top: 16px;
}

.aigen-expression-insert-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
}

.aigen-expression-insert-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  font-size: 12px;
  color: var(--aigen-text-main);
  text-align: left;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
}

.aigen-expression-insert-item:hover {
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
}

.aigen-expression-insert-item-label {
  flex-shrink: 0;
  font-weight: 500;
}

.aigen-expression-insert-item-field {
  overflow: hidden;
  color: var(--aigen-text-helper);
  font-family: monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-expression-insert-item-desc {
  overflow: hidden;
  color: var(--aigen-text-helper);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-expression-insert-empty {
  padding: 8px 0;
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-expression-insert-editor {
  flex: 1;
  min-height: 200px;
  padding: 8px 10px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--aigen-text-main);
  resize: none;
  outline: none;
  background: var(--aigen-secondary, #f5f6f8);
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
}

.aigen-expression-insert-editor:focus {
  border-color: var(--aigen-primary);
}

.aigen-expression-insert-preview {
  flex: 1;
  min-height: 200px;
  padding: 8px 10px;
  font-size: 13px;
  overflow: auto;
  background: var(--aigen-secondary, #f5f6f8);
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
}

.aigen-expression-insert-preview-value {
  color: var(--aigen-primary);
  font-family: monospace;
  word-break: break-all;
}

.aigen-expression-insert-preview-error {
  color: var(--aigen-destructive);
  word-break: break-all;
}

.aigen-expression-insert-preview-hint {
  color: var(--aigen-text-helper);
}

.aigen-expression-insert-tips {
  margin-top: 8px;
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-expression-insert-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--aigen-border);
}

.aigen-expression-insert-error {
  font-size: 12px;
  color: var(--aigen-destructive);
}

.aigen-expression-insert-footer-actions {
  display: flex;
  gap: 8px;
}

/* 按钮样式（aigen-btn 为组件内约定类名，此处本地定义，避免依赖全局样式） */
.aigen-btn {
  padding: 6px 16px;
  font-size: 13px;
  color: var(--aigen-text-main);
  cursor: pointer;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-btn--primary {
  color: var(--aigen-primary-foreground);
  background: var(--aigen-primary);
  border-color: var(--aigen-primary);
}

.aigen-btn--primary:hover {
  opacity: 0.9;
}

.aigen-btn--secondary:hover {
  color: var(--aigen-primary);
  border-color: var(--aigen-primary);
}
</style>
