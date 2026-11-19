<script lang="ts" setup>
import type {
  ExpressionField,
  ExpressionModel,
} from '../AigenActionDrawer/helper';

import { computed, nextTick, ref, watch } from 'vue';

import { AigenIcon, AigenTooltip } from '@aigen-designer/base-ui';
import { FormulaEngine } from '@aigen-designer/utils';

import {
  buildMockFormData,
  formatPreviewValue,
} from '../AigenActionDrawer/helper';

/**
 * 表达式插入器：为动作参数 / 联动规则提供「变量 + 内置函数」的公式编辑能力。
 * 产出 { __isExpression__: true, content }，与运行时 doActions 的表达式分支完全对齐，
 * 设计态仅做求值展示（预览基于模拟上下文），不触发任何运行时事件。
 *
 * 三栏编号引导式布局：① 选择变量与函数 → ② 编写公式（示例 / 运算符 / 空态引导）
 * → ③ 预览结果；所有「怎么用」的信息内联在界面中，不依赖 hover title。
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

/** 标题旁问号提示：完整用法说明 */
const headerHelpTip =
  '此处编写的是公式表达式：保存后参数以公式对象形式存储，动作 / 联动执行时才实时求值。' +
  '用法：① 在左栏点击变量与函数插入到光标处；② 在中栏用运算符组合成公式；' +
  '③ 右栏基于模拟数据实时预览结果；确认后点「插入表达式」写回参数。' +
  '预览为模拟数据（$event[0] = true、$prev = 10），运行时以真实数据计算。';

/** 运算符快捷条：label 为展示文本，text 为实际插入内容 */
const OPERATORS: Array<{ label: string; text: string }> = [
  { label: '+', text: ' + ' },
  { label: '-', text: ' - ' },
  { label: '*', text: ' * ' },
  { label: '/', text: ' / ' },
  { label: '>', text: ' > ' },
  { label: '<', text: ' < ' },
  { label: '==', text: ' == ' },
  { label: '(', text: '(' },
  { label: ')', text: ')' },
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

/** 事件与上下文变量（$ 前缀，动作场景由系统注入；联动场景无此分组） */
const contextItems = computed(() =>
  fieldItems.value.filter((item) => item.field.startsWith('$')),
);

/** 页面表单字段（点击插入 $formData.字段名） */
const formItems = computed(() =>
  fieldItems.value.filter((item) => !item.field.startsWith('$')),
);

/**
 * 示例库：按当前场景动态生成，保证预览必出结果。
 * - 动作入口（含 $ 上下文）：事件值引用 / 管道运算 / 条件判断；
 * - 联动入口（仅表单字段）：字段条件判断 / 两字段比较。
 */
const examples = computed(() => {
  const list: Array<{ expr: string; label: string }> = [];
  if (contextItems.value.length) {
    list.push(
      { expr: '$event[0]', label: '引用事件值' },
      { expr: '$prev + 10', label: '上一步结果 + 10' },
      { expr: 'IF($event[0], "开启", "关闭")', label: '条件判断' },
    );
  }
  const [first, second] = formItems.value;
  if (first) {
    list.push({
      expr: `IF($formData.${first.field}, "条件成立", "条件不成立")`,
      label: `字段判断：${first.label}`,
    });
  }
  if (first && second) {
    list.push({
      expr: `$formData.${first.field} == $formData.${second.field}`,
      label: `两字段比较`,
    });
  }
  return list;
});

/** 实时预览：用模拟上下文求值（设计态安全，仅展示） */
const preview = computed(() => {
  const expression = content.value.trim();
  if (!expression) {
    return { state: 'empty' as const, text: '输入表达式后自动预览' };
  }
  const formData = buildMockFormData(fieldItems.value);
  // 模拟上下文与运行时结构一致：$event[0]=true、$prev=10，仅供预览展示
  const result = formulaEngine.calculate(expression, {
    event: [true, { type: 'change' }],
    formData,
    prev: 10,
    steps: {},
  });
  if (result === null || result === undefined) {
    return {
      state: 'error' as const,
      text: '表达式无法解析或计算为空，请检查语法（支持 $formData.字段、$event[0]、$prev 与 SUM / IF 等函数）',
    };
  }
  return { state: 'ok' as const, text: formatPreviewValue(result) };
});

const canConfirm = computed(() => Boolean(content.value.trim()));

/** 在光标处插入文本（字段 / 函数名 / 运算符） */
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

/** 点击运算符：二元运算符前后带空格，括号原样插入 */
function insertOperator(operator: { label: string; text: string }) {
  insertText(operator.text);
}

/** 点击示例：整条填入编辑器，立即看到预览效果 */
function applyExample(expr: string) {
  content.value = expr;
  parseError.value = '';
  nextTick(() => {
    editorRef.value?.focus();
  });
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

// Esc 关闭（不再 stopPropagation，允许抽屉同时响应 Escape 关闭）
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.visible) {
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
        <!-- 头部：标题 + 一句话定位 + 问号详解 -->
        <div class="aigen-expression-insert-header">
          <div class="aigen-expression-insert-header-main">
            <span class="aigen-expression-insert-title">表达式插入器</span>
            <span class="aigen-expression-insert-subtitle">
              把参数写成公式：点击左侧变量与函数组合，运行时实时计算
            </span>
            <AigenTooltip
              trigger="hover"
              placement="bottom"
              :mouse-enter-delay="200"
              :content="headerHelpTip"
            >
              <span
                class="aigen-expression-insert-help"
                aria-label="表达式插入器使用说明"
              >
                <AigenIcon name="icon--aigen--help-outline-rounded" />
              </span>
            </AigenTooltip>
          </div>
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
          <!-- ① 选择变量与函数 -->
          <div
            class="aigen-expression-insert-col aigen-expression-insert-col--left"
          >
            <div class="aigen-expression-insert-col-title">
              <span class="aigen-expression-insert-col-index">1</span>
              选择变量与函数
            </div>
            <div class="aigen-expression-insert-col-scroll">
              <template v-if="contextItems.length">
                <div class="aigen-expression-insert-group-title">
                  事件与上下文
                </div>
                <p class="aigen-expression-insert-group-hint">
                  动作执行时由系统注入：$event[0] 为触发事件的新值，$prev
                  为上一步动作的返回值，$formData 为当前表单数据
                </p>
                <div class="aigen-expression-insert-list">
                  <button
                    v-for="item in contextItems"
                    :key="item.field"
                    type="button"
                    class="aigen-expression-insert-item"
                    :title="`插入 ${item.field}`"
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
              </template>

              <div
                class="aigen-expression-insert-group-title aigen-expression-insert-group-title--mt"
              >
                表单字段
              </div>
              <p class="aigen-expression-insert-group-hint">
                点击插入
                <code>$formData.字段名</code>
                ，运行时取该字段的实际值
              </p>
              <div v-if="formItems.length" class="aigen-expression-insert-list">
                <button
                  v-for="item in formItems"
                  :key="item.field"
                  type="button"
                  class="aigen-expression-insert-item"
                  :title="`插入 $formData.${item.field}`"
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
              <p class="aigen-expression-insert-group-hint">
                点击插入函数名，在括号内填入参数
              </p>
              <div class="aigen-expression-insert-list">
                <button
                  v-for="fn in BUILTIN_FUNCTIONS"
                  :key="fn.name"
                  type="button"
                  class="aigen-expression-insert-item aigen-expression-insert-item--fn"
                  :title="fn.description"
                  @click="insertFunction(fn.name)"
                >
                  <span class="aigen-expression-insert-item-name">{{
                    fn.name
                  }}</span>
                  <span class="aigen-expression-insert-item-desc">{{
                    fn.description
                  }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- ② 编写公式 -->
          <div
            class="aigen-expression-insert-col aigen-expression-insert-col--center"
          >
            <div class="aigen-expression-insert-col-title">
              <span class="aigen-expression-insert-col-index">2</span>
              编写公式
            </div>
            <div
              v-if="examples.length"
              class="aigen-expression-insert-examples"
            >
              <span class="aigen-expression-insert-examples-label">
                试试示例
              </span>
              <button
                v-for="eg in examples"
                :key="eg.expr"
                type="button"
                class="aigen-expression-insert-examples-chip"
                :title="eg.expr"
                @click="applyExample(eg.expr)"
              >
                {{ eg.label }}
              </button>
            </div>
            <textarea
              ref="editorRef"
              v-model="content"
              class="aigen-expression-insert-editor"
              placeholder="如：$formData.qty * $formData.price"
              spellcheck="false"
            ></textarea>
            <div class="aigen-expression-insert-ops">
              <span class="aigen-expression-insert-ops-label">插入运算符</span>
              <button
                v-for="op in OPERATORS"
                :key="op.label"
                type="button"
                class="aigen-expression-insert-ops-btn"
                :title="`插入 ${op.label}`"
                @click="insertOperator(op)"
              >
                {{ op.label }}
              </button>
            </div>
            <!-- 空态三步引导：输入内容后自动隐藏 -->
            <div v-if="!content" class="aigen-expression-insert-guide">
              <div class="aigen-expression-insert-guide-title">如何使用</div>
              <ol class="aigen-expression-insert-guide-list">
                <li>点击左侧变量 / 函数，自动插入到光标处</li>
                <li>用运算符组合成公式，支持 + - * / 与比较、逻辑运算</li>
                <li>看右侧实时预览，确认后点「插入表达式」写回参数</li>
              </ol>
            </div>
          </div>

          <!-- ③ 预览结果 -->
          <div
            class="aigen-expression-insert-col aigen-expression-insert-col--right"
          >
            <div class="aigen-expression-insert-col-title">
              <span class="aigen-expression-insert-col-index">3</span>
              预览结果
            </div>
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
            <p class="aigen-expression-insert-preview-note">
              预览使用模拟数据：$event[0] = true、$prev =
              10，表单字段按组件类型取示例值；运行时以真实数据计算。
            </p>
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
              :disabled="!canConfirm"
              :title="canConfirm ? '把公式写回参数' : '请先输入表达式内容'"
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
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--aigen-border);
}

.aigen-expression-insert-header-main {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.aigen-expression-insert-title {
  flex-shrink: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-expression-insert-subtitle {
  overflow: hidden;
  font-size: 12px;
  color: var(--aigen-text-helper);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 问号提示图标（与 StepArgs 的自由参数提示同款交互） */
.aigen-expression-insert-help {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--aigen-text-helper);
  cursor: help;
  transition: color 0.2s ease-out-quart;
}

.aigen-expression-insert-help:hover {
  color: var(--aigen-primary);
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

/* 编号分区标题：与动作抽屉的 section-index 风格一致 */
.aigen-expression-insert-col-title {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-expression-insert-col-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 11px;
  font-weight: 500;
  color: var(--aigen-primary-foreground, #fff);
  background: var(--aigen-primary);
  border-radius: 50%;
}

/* 左栏内容整体滚动 */
.aigen-expression-insert-col-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.aigen-expression-insert-group-title {
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-expression-insert-group-title--mt {
  margin-top: 14px;
}

.aigen-expression-insert-group-hint {
  margin: 0 0 6px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--aigen-text-helper);
}

.aigen-expression-insert-group-hint code {
  font-family: monospace;
}

.aigen-expression-insert-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

/* 内置函数两行布局：函数名 + 完整说明，不再截断 */
.aigen-expression-insert-item--fn {
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
}

.aigen-expression-insert-item-name {
  font-family: monospace;
  font-weight: 600;
}

.aigen-expression-insert-item--fn .aigen-expression-insert-item-desc {
  overflow: hidden;
  color: var(--aigen-text-helper);
  line-height: 1.5;
  white-space: normal;
}

.aigen-expression-insert-empty {
  padding: 8px 0;
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-expression-insert-editor {
  flex: 1;
  min-height: 160px;
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

/* 示例 chips */
.aigen-expression-insert-examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.aigen-expression-insert-examples-label {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-expression-insert-examples-chip {
  overflow: hidden;
  max-width: 180px;
  padding: 2px 10px;
  font-size: 12px;
  color: var(--aigen-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: var(--aigen-primary-faded);
  border: 1px solid var(--aigen-primary);
  border-radius: 999px;
  transition: opacity 0.2s ease-out-quart;
}

.aigen-expression-insert-examples-chip:hover {
  opacity: 0.85;
}

/* 运算符快捷条 */
.aigen-expression-insert-ops {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}

.aigen-expression-insert-ops-label {
  margin-right: 2px;
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-expression-insert-ops-btn {
  min-width: 26px;
  height: 24px;
  padding: 0 6px;
  font-family: monospace;
  font-size: 12px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  transition: all 0.2s ease-out-quart;
}

.aigen-expression-insert-ops-btn:hover {
  color: var(--aigen-primary);
  border-color: var(--aigen-primary);
}

/* 空态三步引导卡 */
.aigen-expression-insert-guide {
  margin-top: 8px;
  padding: 10px;
  background: var(--aigen-primary-faded);
  border: 1px dashed var(--aigen-primary);
  border-radius: 4px;
}

.aigen-expression-insert-guide-title {
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--aigen-primary);
}

.aigen-expression-insert-guide-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--aigen-text-secondary);
}

.aigen-expression-insert-preview {
  flex: 1;
  min-height: 160px;
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

.aigen-expression-insert-preview-note {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.6;
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

.aigen-btn:disabled {
  cursor: not-allowed;
}

.aigen-btn--primary {
  color: var(--aigen-primary-foreground);
  background: var(--aigen-primary);
  border-color: var(--aigen-primary);
}

.aigen-btn--primary:hover {
  opacity: 0.9;
}

.aigen-btn--primary:disabled:hover {
  opacity: 1;
}

.aigen-btn--secondary:hover {
  color: var(--aigen-primary);
  border-color: var(--aigen-primary);
}
</style>
