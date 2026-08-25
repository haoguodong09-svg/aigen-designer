<script lang="ts" setup>
import type { ComponentSchema, ComputedField } from '@aigen-designer/types';

import type { ExpressionField } from '../../../components/AigenActionDrawer/helper';

import { computed, reactive, ref } from 'vue';

import { useDesignerContext } from '@aigen-designer/hooks';
import { findSchemas, FormulaEngine, getUUID } from '@aigen-designer/utils';

import {
  buildMockFormData,
  formatPreviewValue,
} from '../../../components/AigenActionDrawer/helper';
import { parseComputedDependencies } from './linkHelper';

/**
 * 计算字段子模块（B4.3）：
 * - 列表：目标字段 = 公式；
 * - 新建 / 编辑：目标字段（页面输入组件字段）+ 公式编辑 + 实时预览 + 依赖字段自动解析；
 * - 保存写入 pageSchema.computed（ComputedField，id = getUUID()，enabled 默认 true），经 revoke.push 入撤销栈。
 * 运行期由 P3 页面级求值器（WP-C：依赖字段变化即重算 → setValueByPath(formData, targetField)）接管；
 * 本模块只做设计态数据读写与求值展示（预览基于模拟数据，不触发任何运行时事件）。
 */
const designer = useDesignerContext();
const pageSchema = designer.pageSchema;
const revoke = designer.revoke;

const formulaEngine = new FormulaEngine();

/** 页面输入组件字段（label + field + type） */
const inputFields = computed<ExpressionField[]>(() => {
  const schemas = findSchemas(
    pageSchema.schemas,
    (item) => Boolean(item.input) && Boolean(item.field),
  ) as ComponentSchema[];
  return schemas.map((item) => ({
    field: item.field as string,
    label: item.label ?? (item.field as string),
    type: item.type,
  }));
});

/** 计算字段列表 */
const computedFields = computed<ComputedField[]>(
  () => pageSchema.computed ?? [],
);

/** 新建 / 编辑表单草稿 */
interface ComputedDraft {
  expression: string;
  targetField: string;
}

const formVisible = ref(false);
const editingId = ref('');
const formError = ref('');
const draft = reactive<ComputedDraft>({ expression: '', targetField: '' });

/** 实时预览（设计态安全：基于模拟数据求值，仅展示，不触发运行时事件） */
const preview = computed(() => {
  const expression = draft.expression.trim();
  if (!expression) {
    return { state: 'empty' as const, text: '输入公式后自动预览' };
  }
  const result = formulaEngine.calculate(expression, {
    formData: buildMockFormData(inputFields.value),
  });
  if (result === null || result === undefined) {
    return {
      state: 'error' as const,
      text: '公式无法解析或计算为空，请检查语法（如 $formData.字段、SUM(...)）',
    };
  }
  return { state: 'ok' as const, text: formatPreviewValue(result) };
});

/** 依赖字段（解析 $formData.* 引用） */
const dependencies = computed(() =>
  parseComputedDependencies(draft.expression),
);

function getTargetFieldLabel(field: string): string {
  const item = inputFields.value.find((f) => f.field === field);
  return item ? item.label : field;
}

function handleCreate() {
  editingId.value = '';
  Object.assign(draft, { expression: '', targetField: '' });
  formError.value = '';
  formVisible.value = true;
}

function handleEdit(item: ComputedField) {
  editingId.value = item.id;
  Object.assign(draft, {
    expression: item.expression,
    targetField: item.targetField,
  });
  formError.value = '';
  formVisible.value = true;
}

function handleCancel() {
  formVisible.value = false;
  editingId.value = '';
}

function handleSave() {
  formError.value = '';
  const targetField = draft.targetField;
  if (!targetField) {
    formError.value = '请选择目标字段';
    return;
  }
  const expression = draft.expression.trim();
  if (!expression) {
    formError.value = '请输入计算公式';
    return;
  }

  const item: ComputedField = {
    enabled: true,
    expression,
    id: editingId.value || getUUID(),
    targetField,
  };
  const list = pageSchema.computed ?? [];
  pageSchema.computed = editingId.value
    ? list.map((c) => (c.id === item.id ? item : c))
    : [...list, item];
  revoke.push('计算字段编辑');
  formVisible.value = false;
  editingId.value = '';
}

function handleDelete(item: ComputedField) {
  pageSchema.computed = (pageSchema.computed ?? []).filter(
    (c) => c.id !== item.id,
  );
  if (editingId.value === item.id) {
    formVisible.value = false;
    editingId.value = '';
  }
  revoke.push('计算字段编辑');
}

function handleToggle(item: ComputedField, enabled: boolean) {
  pageSchema.computed = (pageSchema.computed ?? []).map((c) =>
    c.id === item.id ? { ...c, enabled } : c,
  );
  revoke.push('计算字段编辑');
}

function handleToggleChange(item: ComputedField, event: Event) {
  handleToggle(item, (event.target as HTMLInputElement).checked);
}
</script>

<template>
  <div class="aigen-link-computed">
    <!-- 模块头：标题 + 新建 -->
    <div class="aigen-link-module-head">
      <span class="aigen-link-module-title">计算字段</span>
      <button type="button" class="aigen-link-add-btn" @click="handleCreate">
        + 新建
      </button>
    </div>

    <!-- 计算字段列表 -->
    <div v-if="computedFields.length" class="aigen-link-list">
      <div
        v-for="item in computedFields"
        :key="item.id"
        class="aigen-link-item"
        :class="{ 'aigen-link-item--disabled': item.enabled === false }"
      >
        <label
          class="aigen-switch aigen-switch--small"
          :class="{ 'aigen-switch--checked': item.enabled !== false }"
          title="启停用"
        >
          <input
            type="checkbox"
            class="aigen-switch__input"
            :checked="item.enabled !== false"
            @change="handleToggleChange(item, $event)"
          />
          <span class="aigen-switch__slider"></span>
        </label>
        <div class="aigen-link-item__main">
          <div class="aigen-link-item__summary" :title="item.targetField">
            {{ getTargetFieldLabel(item.targetField) }} =
          </div>
          <div
            class="aigen-link-item__summary aigen-link-item__summary--action"
            :title="item.expression"
          >
            {{ item.expression }}
          </div>
        </div>
        <div class="aigen-link-item__ops">
          <button type="button" title="编辑" @click="handleEdit(item)">
            编辑
          </button>
          <button
            type="button"
            class="aigen-link-item__del"
            title="删除"
            @click="handleDelete(item)"
          >
            删除
          </button>
        </div>
      </div>
    </div>
    <div v-else class="aigen-link-empty">
      暂无计算字段，点击右上角「+ 新建」添加
    </div>

    <!-- 新建 / 编辑表单（内联展开） -->
    <div v-if="formVisible" class="aigen-link-form">
      <div class="aigen-link-form__row">
        <span class="aigen-link-form__label">目标字段</span>
        <select v-model="draft.targetField" class="aigen-link-select">
          <option value="" disabled>请选择目标字段</option>
          <option
            v-for="item in inputFields"
            :key="item.field"
            :value="item.field"
          >
            {{ item.label }}（{{ item.field }}）
          </option>
        </select>
      </div>

      <div class="aigen-link-form__row aigen-link-form__row--top">
        <span class="aigen-link-form__label">计算公式</span>
        <textarea
          v-model="draft.expression"
          class="aigen-link-textarea"
          placeholder="如：$formData.qty * $formData.price"
          spellcheck="false"
        ></textarea>
      </div>

      <!-- 依赖字段自动解析 -->
      <div v-if="dependencies.length" class="aigen-link-form__deps">
        <span class="aigen-link-form__deps-label">依赖字段：</span>
        <span
          v-for="dep in dependencies"
          :key="dep"
          class="aigen-link-form__dep"
        >
          $formData.{{ dep }}
        </span>
      </div>

      <!-- 实时预览 -->
      <div class="aigen-link-form__preview">
        <div class="aigen-link-form__preview-label">实时预览</div>
        <template v-if="preview.state === 'empty'">
          <span class="aigen-link-form__preview-hint">{{ preview.text }}</span>
        </template>
        <template v-else-if="preview.state === 'error'">
          <span class="aigen-link-form__preview-error">{{ preview.text }}</span>
        </template>
        <template v-else>
          <span class="aigen-link-form__preview-value">{{ preview.text }}</span>
        </template>
      </div>

      <div class="aigen-link-form__footer">
        <span v-if="formError" class="aigen-link-form__error">
          {{ formError }}
        </span>
        <div class="aigen-link-form__actions">
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
            @click="handleSave"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 模块头 */
.aigen-link-module-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.aigen-link-module-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--aigen-text-main);
}

.aigen-link-add-btn {
  padding: 3px 10px;
  font-size: 12px;
  color: var(--aigen-primary);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--aigen-primary);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-link-add-btn:hover {
  opacity: 0.85;
}

/* 列表 */
.aigen-link-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.aigen-link-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-link-item--disabled {
  opacity: 0.55;
}

.aigen-link-item__main {
  flex: 1;
  min-width: 0;
}

.aigen-link-item__summary {
  overflow: hidden;
  font-size: 12px;
  line-height: 1.6;
  color: var(--aigen-text-main);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-link-item__summary--action {
  color: var(--aigen-text-secondary);
  font-family: monospace;
}

.aigen-link-item__ops {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

.aigen-link-item__ops button {
  padding: 2px 6px;
  font-size: 12px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
}

.aigen-link-item__ops button:hover {
  color: var(--aigen-primary);
}

.aigen-link-item__ops .aigen-link-item__del:hover {
  color: var(--aigen-destructive);
}

.aigen-link-empty {
  padding: 16px 0;
  font-size: 12px;
  color: var(--aigen-text-helper);
  text-align: center;
}

/* 表单 */
.aigen-link-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding: 10px;
  background: var(--aigen-secondary, #f5f6f8);
  border: 1px dashed var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-link-form__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aigen-link-form__row--top {
  align-items: flex-start;
}

.aigen-link-form__label {
  flex-shrink: 0;
  width: 64px;
  font-size: 12px;
  color: var(--aigen-text-main);
}

.aigen-link-select {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  font-size: 13px;
  color: var(--aigen-text-main);
  outline: none;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  box-sizing: border-box;
}

.aigen-link-select:focus {
  border-color: var(--aigen-primary);
}

.aigen-link-textarea {
  flex: 1;
  min-width: 0;
  min-height: 64px;
  padding: 6px 8px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--aigen-text-main);
  resize: vertical;
  outline: none;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  box-sizing: border-box;
}

.aigen-link-textarea:focus {
  border-color: var(--aigen-primary);
}

/* 依赖字段 */
.aigen-link-form__deps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  padding-left: 72px;
}

.aigen-link-form__deps-label {
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-link-form__dep {
  padding: 1px 6px;
  font-size: 11px;
  font-family: monospace;
  color: var(--aigen-primary);
  background: var(--aigen-primary-faded);
  border-radius: 8px;
}

/* 实时预览 */
.aigen-link-form__preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 72px;
}

.aigen-link-form__preview-label {
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-link-form__preview-hint {
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-link-form__preview-error {
  font-size: 12px;
  color: var(--aigen-destructive);
}

.aigen-link-form__preview-value {
  font-size: 13px;
  font-family: monospace;
  color: var(--aigen-primary);
  word-break: break-all;
}

/* 底部 */
.aigen-link-form__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.aigen-link-form__error {
  font-size: 12px;
  color: var(--aigen-destructive);
}

.aigen-link-form__actions {
  display: flex;
  gap: 8px;
}

/* 启停用 switch（aigen 风格，不依赖具体 UI 库） */
.aigen-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 30px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
}

.aigen-switch--small {
  width: 26px;
  height: 14px;
}

.aigen-switch__input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}

.aigen-switch__slider {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background-color: var(--aigen-border);
  transition: background-color 0.2s;
}

.aigen-switch__slider::before {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--aigen-background);
  content: '';
  transition: transform 0.2s;
}

.aigen-switch--small .aigen-switch__slider::before {
  width: 10px;
  height: 10px;
}

.aigen-switch--checked .aigen-switch__slider {
  background-color: var(--aigen-primary);
}

.aigen-switch--checked .aigen-switch__slider::before {
  transform: translateX(14px);
}

.aigen-switch--small.aigen-switch--checked .aigen-switch__slider::before {
  transform: translateX(12px);
}

/* 按钮（本地定义，避免依赖全局样式） */
.aigen-btn {
  padding: 5px 14px;
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
