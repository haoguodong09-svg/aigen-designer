<script lang="ts" setup>
import type { ComponentSchema, ComputedField } from '@aigen-designer/types';

import type { ExpressionField } from '../../../components/AigenActionDrawer/helper';

import { computed, reactive, ref, watch } from 'vue';

import { useDesignerContext } from '@aigen-designer/hooks';
import { findSchemas, FormulaEngine, getUUID } from '@aigen-designer/utils';

import {
  buildMockFormData,
  formatPreviewValue,
} from '../../../components/AigenActionDrawer/helper';
import { parseComputedDependencies } from '../../link/modules/linkHelper';

/**
 * 计算字段编辑器（方案C-E2：计算字段由独立 link_view 面板迁移至元素属性面板，
 * 钉钉宜搭模式：公式字段配置在字段属性里）。
 * - props.targetField：当前选中元素的 field，本模块只展示该元素的计算字段；
 * - 列表：pageSchema.computed 中 targetField === props.targetField 的条目（一个元素通常一条，
 *   显示公式 + 启停用 + 编辑/删除）；
 * - 新建 / 编辑：目标字段只读展示（当前元素 label（field））+ 公式编辑 + FormulaEngine 实时预览
 *   （buildMockFormData 模拟数据）+ 依赖字段自动解析（parseComputedDependencies）；
 * - 保存：ComputedField { id: editingId || getUUID(), targetField: props.targetField, expression, enabled: true }
 *   → 更新 pageSchema.computed + revoke.push('计算字段')；校验：公式必填、预览错误提示。
 * 设计态安全：预览基于模拟数据仅做求值展示，不触发任何运行时事件；
 * 运行期由 P3 页面级求值器（WP-C：依赖字段变化即重算 → setValueByPath(formData, targetField)）接管。
 */
const props = defineProps<{
  targetField: string;
}>();

const designer = useDesignerContext();
const pageSchema = designer.pageSchema;
const revoke = designer.revoke;

const formulaEngine = new FormulaEngine();

/** 页面输入组件字段（label + field + type）——供 buildMockFormData 构造模拟数据 */
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

/** 目标字段展示名：当前选中元素 label（field），从 useDesignerContext 的 selectedNode 取 label */
const targetFieldLabel = computed(() => {
  const node = designer.state.selectedNode;
  return node?.label ?? props.targetField;
});

/** 当前元素的计算字段列表（按 targetField 过滤） */
const computedFields = computed<ComputedField[]>(() =>
  (pageSchema.computed ?? []).filter(
    (c) => c.targetField === props.targetField,
  ),
);

/** 新建 / 编辑表单草稿（目标字段固定为当前元素，无需选择） */
interface ComputedDraft {
  expression: string;
}

const formVisible = ref(false);
const editingId = ref('');
const formError = ref('');
const draft = reactive<ComputedDraft>({ expression: '' });

/** 目标字段切换时重置表单（防御性：正常情况下父级按 selectedNode.id 重建本组件） */
watch(
  () => props.targetField,
  () => {
    if (formVisible.value) {
      formVisible.value = false;
      editingId.value = '';
      draft.expression = '';
      formError.value = '';
    }
  },
);

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

function handleCreate() {
  editingId.value = '';
  draft.expression = '';
  formError.value = '';
  formVisible.value = true;
}

function handleEdit(item: ComputedField) {
  editingId.value = item.id;
  draft.expression = item.expression;
  formError.value = '';
  formVisible.value = true;
}

function handleCancel() {
  formVisible.value = false;
  editingId.value = '';
}

function handleSave() {
  formError.value = '';
  const expression = draft.expression.trim();
  if (!expression) {
    formError.value = '请输入计算公式';
    return;
  }
  if (preview.value.state === 'error') {
    formError.value = preview.value.text;
    return;
  }

  const item: ComputedField = {
    enabled: true,
    expression,
    id: editingId.value || getUUID(),
    targetField: props.targetField,
  };
  const list = pageSchema.computed ?? [];
  pageSchema.computed = editingId.value
    ? list.map((c) => (c.id === item.id ? item : c))
    : [...list, item];
  revoke.push('计算字段');
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
  revoke.push('计算字段');
}

function handleToggle(item: ComputedField, enabled: boolean) {
  pageSchema.computed = (pageSchema.computed ?? []).map((c) =>
    c.id === item.id ? { ...c, enabled } : c,
  );
  revoke.push('计算字段');
}

function handleToggleChange(item: ComputedField, event: Event) {
  handleToggle(item, (event.target as HTMLInputElement).checked);
}
</script>

<template>
  <div class="aigen-attr-computed">
    <!-- 计算字段列表 -->
    <div v-if="computedFields.length" class="aigen-attr-computed__list">
      <div
        v-for="item in computedFields"
        :key="item.id"
        class="aigen-attr-computed__item"
        :class="{
          'aigen-attr-computed__item--disabled': item.enabled === false,
        }"
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
        <div class="aigen-attr-computed__item-main">
          <div
            class="aigen-attr-computed__item-summary"
            :title="item.expression"
          >
            = {{ item.expression }}
          </div>
        </div>
        <div class="aigen-attr-computed__item-ops">
          <button type="button" title="编辑" @click="handleEdit(item)">
            编辑
          </button>
          <button
            type="button"
            class="aigen-attr-computed__item-del"
            title="删除"
            @click="handleDelete(item)"
          >
            删除
          </button>
        </div>
      </div>
    </div>
    <div v-else class="aigen-attr-computed__empty">暂无计算字段</div>

    <!-- 新建 -->
    <button
      type="button"
      class="aigen-attr-computed__add"
      @click="handleCreate"
    >
      ＋ 新建计算字段
    </button>

    <!-- 新建 / 编辑表单（内联展开） -->
    <div v-if="formVisible" class="aigen-attr-computed__form">
      <!-- 目标字段只读展示（当前元素 label（field）） -->
      <div class="aigen-attr-computed__row">
        <span class="aigen-attr-computed__row-label">目标字段</span>
        <div class="aigen-attr-computed__row-value">
          {{ targetFieldLabel }}（{{ targetField }}）
        </div>
      </div>

      <div class="aigen-attr-computed__row aigen-attr-computed__row--top">
        <span class="aigen-attr-computed__row-label">计算公式</span>
        <textarea
          v-model="draft.expression"
          class="aigen-attr-computed__textarea"
          placeholder="如：$formData.qty * $formData.price"
          spellcheck="false"
        ></textarea>
      </div>

      <!-- 依赖字段自动解析 -->
      <div v-if="dependencies.length" class="aigen-attr-computed__deps">
        <span class="aigen-attr-computed__deps-label">依赖字段：</span>
        <span
          v-for="dep in dependencies"
          :key="dep"
          class="aigen-attr-computed__dep"
        >
          $formData.{{ dep }}
        </span>
      </div>

      <!-- 实时预览 -->
      <div class="aigen-attr-computed__preview">
        <div class="aigen-attr-computed__preview-label">实时预览</div>
        <template v-if="preview.state === 'empty'">
          <span class="aigen-attr-computed__preview-hint">
            {{ preview.text }}
          </span>
        </template>
        <template v-else-if="preview.state === 'error'">
          <span class="aigen-attr-computed__preview-error">
            {{ preview.text }}
          </span>
        </template>
        <template v-else>
          <span class="aigen-attr-computed__preview-value">
            {{ preview.text }}
          </span>
        </template>
      </div>

      <div class="aigen-attr-computed__footer">
        <span v-if="formError" class="aigen-attr-computed__error">
          {{ formError }}
        </span>
        <div class="aigen-attr-computed__actions">
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
/* 计算字段区块（迁移至元素属性面板后，aigen-* 前缀；布局参照 attributeItem：label 左侧、控件右侧） */
.aigen-attr-computed {
  padding: 0 16px 12px;
}

/* 列表 */
.aigen-attr-computed__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.aigen-attr-computed__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-attr-computed__item--disabled {
  opacity: 0.55;
}

.aigen-attr-computed__item-main {
  flex: 1;
  min-width: 0;
}

.aigen-attr-computed__item-summary {
  overflow: hidden;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--aigen-text-main);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-attr-computed__item-ops {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

.aigen-attr-computed__item-ops button {
  padding: 2px 6px;
  font-size: 12px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
}

.aigen-attr-computed__item-ops button:hover {
  color: var(--aigen-primary);
}

.aigen-attr-computed__item-ops .aigen-attr-computed__item-del:hover {
  color: var(--aigen-destructive);
}

.aigen-attr-computed__empty {
  padding: 10px 0;
  font-size: 12px;
  color: var(--aigen-text-helper);
  text-align: center;
}

/* 新建按钮（虚线全宽，属性面板常见新增交互） */
.aigen-attr-computed__add {
  width: 100%;
  padding: 6px 0;
  font-size: 12px;
  color: var(--aigen-primary);
  cursor: pointer;
  background: transparent;
  border: 1px dashed var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-attr-computed__add:hover {
  border-color: var(--aigen-primary);
  opacity: 0.85;
}

/* 表单 */
.aigen-attr-computed__form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding: 10px;
  background: var(--aigen-secondary, #f5f6f8);
  border: 1px dashed var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-attr-computed__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aigen-attr-computed__row--top {
  align-items: flex-start;
}

/* label 左侧、控件右侧（与 attributeItem 的 80px 标签宽度对齐） */
.aigen-attr-computed__row-label {
  flex-shrink: 0;
  width: 80px;
  font-size: 12px;
  line-height: 32px;
  color: var(--aigen-text-main);
}

.aigen-attr-computed__row-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  color: var(--aigen-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-attr-computed__textarea {
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

.aigen-attr-computed__textarea:focus {
  border-color: var(--aigen-primary);
}

/* 依赖字段 */
.aigen-attr-computed__deps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  padding-left: 88px;
}

.aigen-attr-computed__deps-label {
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-attr-computed__dep {
  padding: 1px 6px;
  font-size: 11px;
  font-family: monospace;
  color: var(--aigen-primary);
  background: var(--aigen-primary-faded);
  border-radius: 8px;
}

/* 实时预览 */
.aigen-attr-computed__preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 88px;
}

.aigen-attr-computed__preview-label {
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-attr-computed__preview-hint {
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-attr-computed__preview-error {
  font-size: 12px;
  color: var(--aigen-destructive);
}

.aigen-attr-computed__preview-value {
  font-size: 13px;
  font-family: monospace;
  color: var(--aigen-primary);
  word-break: break-all;
}

/* 底部 */
.aigen-attr-computed__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.aigen-attr-computed__error {
  font-size: 12px;
  color: var(--aigen-destructive);
}

.aigen-attr-computed__actions {
  display: flex;
  gap: 8px;
}

/* 启停用 switch（aigen 风格，本地定义，不依赖具体 UI 库） */
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
