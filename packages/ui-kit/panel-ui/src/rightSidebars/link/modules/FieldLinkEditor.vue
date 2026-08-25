<script lang="ts" setup>
import type {
  ActionsModel,
  ComponentSchema,
  ConditionGroup,
  FieldLink,
} from '@aigen-designer/types';

import type {
  ExpressionField,
  ExpressionModel,
} from '../../../components/AigenActionDrawer/helper';
import type { ConditionOperator, LinkEntry } from './linkHelper';

import { computed, reactive, ref } from 'vue';

import { useDesignerContext } from '@aigen-designer/hooks';
import {
  compileLinks,
  findSchemas,
  getUUID,
  setValueByPath,
} from '@aigen-designer/utils';

import { isExpressionValue } from '../../../components/AigenActionDrawer/helper';
import ExpressionInsert from '../../../components/ExpressionInsert/index.vue';
import {
  collectLinkEntries,
  getSchemaLabel,
  LINK_BEHAVIOR_LABELS,
  LINK_BEHAVIOR_OPTIONS,
} from './linkHelper';

/**
 * 字段联动子模块（B4.2）：
 * - 列表视图平铺展示页面全部联动规则（聚合各元素 schema.links）；
 * - 新建 / 编辑表单：源字段 + 行为 + 目标元素 + 赋值内容（常量 / 表达式）+ 可选条件；
 * - 保存写入「源元素」schema.links（FieldLink，id = getUUID()，enabled 默认 true），经 revoke.push 入撤销栈。
 * 运行时编译契约（WP-B ↔ WP-C 接线，B4.5 双写策略）：
 *   import { compileLinks } from '@aigen-designer/utils';
 *   const actions = compileLinks(sourceSchema, pageSchema); // 动作携带 linkId = link.id
 * 保存 / 启停用时把源元素 links 重编译写回 on[change]（按 linkId 整体去重替换，
 * 保留无 linkId 的手工动作如快捷气泡 / 事件面板写入的动作）；
 * 删除时按 linkId 从源元素 on[change] 过滤编译动作。
 * 设计态安全：本模块只读写 schema 数据与求值展示，不触发任何运行时事件。
 */
const designer = useDesignerContext();
const pageSchema = designer.pageSchema;
const revoke = designer.revoke;

/** 页面输入组件字段（label + field + type，复用 ExpressionInsert 的字段收集方式） */
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

/** 页面全部元素（label + id，联动目标候选） */
const targetOptions = computed(() => {
  const schemas = findSchemas(pageSchema.schemas, (item) =>
    Boolean(item.id),
  ) as ComponentSchema[];
  return schemas.map((item) => ({
    id: item.id as string,
    label: getSchemaLabel(item),
  }));
});

/** 聚合后的联动规则列表（按元素遍历顺序） */
const linkEntries = computed<LinkEntry[]>(() => collectLinkEntries(pageSchema));

/** 条件比较运算符（简单版） */
const CONDITION_OPERATORS = new Set<ConditionOperator>([
  '!=',
  '<',
  '<=',
  '==',
  '>',
  '>=',
]);

/** 新建 / 编辑表单草稿 */
interface LinkDraft {
  behavior: '' | FieldLink['behavior'];
  conditionField: string;
  conditionOperator: ConditionOperator;
  conditionValue: string;
  constantValue: string;
  expressionValue: string;
  sourceField: string;
  targetId: string;
  useCondition: boolean;
  valueMode: 'constant' | 'expression';
}

function createEmptyDraft(): LinkDraft {
  return {
    behavior: '',
    conditionField: '',
    conditionOperator: '==',
    conditionValue: '',
    constantValue: '',
    expressionValue: '',
    sourceField: '',
    targetId: '',
    useCondition: false,
    valueMode: 'constant',
  };
}

const formVisible = ref(false);
const editingEntry = ref<LinkEntry | null>(null);
const formError = ref('');
const draft = reactive<LinkDraft>(createEmptyDraft());

/* ---------------- 表达式插入器 ---------------- */

const exprVisible = ref(false);

function openExpression() {
  exprVisible.value = true;
}

function handleExpressionConfirm(value: ExpressionModel) {
  draft.valueMode = 'expression';
  draft.expressionValue = value.content;
}

/* ---------------- 表单打开 / 关闭 ---------------- */

function handleCreate() {
  Object.assign(draft, createEmptyDraft());
  editingEntry.value = null;
  formError.value = '';
  formVisible.value = true;
}

/** 简单条件项（FieldLink.when 的第一条 items 解析结果） */
interface SimpleConditionItem {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

function getConditionItem(when?: ConditionGroup): null | SimpleConditionItem {
  const first = when?.items?.[0];
  if (!first || !('field' in first)) return null;
  const operator = CONDITION_OPERATORS.has(first.operator as ConditionOperator)
    ? (first.operator as ConditionOperator)
    : '==';
  return { field: first.field, operator, value: first.value };
}

function handleEdit(entry: LinkEntry) {
  editingEntry.value = entry;
  const link = entry.link;
  const value = link.value;
  const isExpr = isExpressionValue(value);
  const condition = getConditionItem(link.when);
  Object.assign(draft, {
    behavior: link.behavior,
    conditionField: condition?.field ?? '',
    conditionOperator: condition?.operator ?? '==',
    conditionValue: typeof condition?.value === 'string' ? condition.value : '',
    constantValue: isExpr || typeof value !== 'string' ? '' : value,
    expressionValue: isExpr ? value.content : '',
    sourceField: link.sourceField,
    targetId: link.targetId,
    useCondition: Boolean(condition),
    valueMode: isExpr ? 'expression' : 'constant',
  });
  formError.value = '';
  formVisible.value = true;
}

function handleCancel() {
  formVisible.value = false;
  editingEntry.value = null;
}

/* ---------------- 保存 / 删除 / 启停用 ---------------- */

/** 按 field 查找源元素 schema（findSchemas once 模式，未找到返回 null） */
function findSchemaByField(field: string): ComponentSchema | null {
  const found = findSchemas(
    pageSchema.schemas,
    (item) => item.field === field,
    true,
  );
  return (found as ComponentSchema | false) || null;
}

/** 按 id 查找元素 schema（未找到返回 null，避免 findSchemaById 抛错） */
function findSchemaByIdSafe(id: string): ComponentSchema | null {
  const found = findSchemas(pageSchema.schemas, (item) => item.id === id, true);
  return (found as ComponentSchema | false) || null;
}

/** 从指定元素的 links 中移除某条规则 */
function removeLinkFromOwner(ownerId: string, linkId: string) {
  const owner = findSchemaByIdSafe(ownerId);
  if (!owner || !Array.isArray(owner.links)) return;
  owner.links = owner.links.filter((item) => item.id !== linkId);
}

/**
 * 按 linkId 从元素 on[change] 过滤编译动作（WP-C 契约：删除 / 旧源清理）。
 * 仅当确实存在匹配的编译动作时才写回（避免产生无意义的 on.change 空数组）。
 */
function removeCompiledActionsFromOwner(ownerId: string, linkId: string) {
  const owner = findSchemaByIdSafe(ownerId);
  if (!owner) return;
  const on = (owner.on ?? {}) as Record<string, ActionsModel[]>;
  const changeList = Array.isArray(on.change) ? on.change : [];
  const rest = changeList.filter((item) => item.linkId !== linkId);
  if (rest.length !== changeList.length) {
    setValueByPath(owner, 'on', { ...on, change: rest });
  }
}

/**
 * 把源元素 links 全部重编译写回 on[change]（WP-B ↔ WP-C 契约接线，B4.5 双写策略）：
 * - 保留无 linkId 的手工动作（快捷气泡 setAttr / 事件面板手动添加的动作）；
 * - 全部带 linkId 的编译动作按当前 links 重建（按 linkId 整体去重替换，自愈：
 *   编辑 / 启停用 / 删除后 on[change] 与 links 完全一致，无陈旧编译产物）；
 * - 停用规则不编译（compileLinks 语义），目标元素不存在的规则被过滤（fail-safe）；
 * - 无 on 且无任何动作时跳过写回，避免 schema 噪音。
 */
function resyncLinksToOn(schema: ComponentSchema) {
  const on = (schema.on ?? {}) as Record<string, ActionsModel[]>;
  const changeList = Array.isArray(on.change) ? on.change : [];
  const manual = changeList.filter((item) => !item.linkId);
  const compiled = compileLinks(schema, pageSchema);
  if (!schema.on && manual.length === 0 && compiled.length === 0) return;
  setValueByPath(schema, 'on', { ...on, change: [...manual, ...compiled] });
}

function handleSave() {
  formError.value = '';
  const sourceField = draft.sourceField;
  if (!sourceField) {
    formError.value = '请选择源字段';
    return;
  }
  const behavior = draft.behavior;
  if (!behavior) {
    formError.value = '请选择联动行为';
    return;
  }
  const targetId = draft.targetId;
  if (!targetId) {
    formError.value = '请选择目标元素';
    return;
  }
  if (
    behavior === 'SET_VALUE' &&
    draft.valueMode === 'expression' &&
    !draft.expressionValue.trim()
  ) {
    formError.value = '请输入赋值表达式';
    return;
  }
  if (draft.useCondition && !draft.conditionField) {
    formError.value = '请选择条件字段';
    return;
  }

  const sourceSchema = findSchemaByField(sourceField);
  if (!sourceSchema) {
    formError.value = '未找到源字段对应的组件，请检查字段配置';
    return;
  }

  // 构造 FieldLink（设计态视图模型；key 按字母序）
  const link: FieldLink = {
    behavior,
    enabled: true,
    id: editingEntry.value?.link.id ?? getUUID(),
    sourceField,
    targetId,
  };
  if (behavior === 'SET_VALUE') {
    link.value =
      draft.valueMode === 'expression'
        ? { __isExpression__: true, content: draft.expressionValue.trim() }
        : draft.constantValue;
  }
  if (draft.useCondition && draft.conditionField) {
    link.when = {
      logic: 'AND',
      items: [
        {
          field: draft.conditionField,
          operator: draft.conditionOperator,
          value: draft.conditionValue,
        },
      ],
    };
  }

  // 编辑时先从旧源元素移除，再写入新源元素（源字段可能已变更）
  if (editingEntry.value) {
    removeLinkFromOwner(editingEntry.value.ownerId, link.id);
    // 旧源元素的 on[change] 编译产物按 linkId 清理（源字段变更后旧源不再持有该规则）
    removeCompiledActionsFromOwner(editingEntry.value.ownerId, link.id);
  }
  const links = sourceSchema.links ?? [];
  sourceSchema.links = [...links, link];
  // WP-C 契约接线：把源元素 links 编译写回 on[change]（按 linkId 去重替换，
  // 保留无 linkId 的手工动作；停用规则不编译），预览 / 发布环境运行时生效
  resyncLinksToOn(sourceSchema);
  revoke.push('关联编辑');
  formVisible.value = false;
  editingEntry.value = null;
}

function handleDelete(entry: LinkEntry) {
  removeLinkFromOwner(entry.ownerId, entry.link.id);
  // WP-C 契约：按 linkId 从源元素 on[change] 过滤编译动作
  removeCompiledActionsFromOwner(entry.ownerId, entry.link.id);
  if (editingEntry.value?.link.id === entry.link.id) {
    formVisible.value = false;
    editingEntry.value = null;
  }
  revoke.push('关联编辑');
}

function handleToggle(entry: LinkEntry, enabled: boolean) {
  const owner = findSchemaByIdSafe(entry.ownerId);
  if (!owner || !Array.isArray(owner.links)) return;
  owner.links = owner.links.map((item) =>
    item.id === entry.link.id ? { ...item, enabled } : item,
  );
  // 启停用后同步编译产物：停用规则不编译（移除），启用规则重建（按 linkId 定位）
  resyncLinksToOn(owner);
  revoke.push('关联编辑');
}

function handleToggleChange(entry: LinkEntry, event: Event) {
  handleToggle(entry, (event.target as HTMLInputElement).checked);
}

/* ---------------- 展示辅助 ---------------- */

function getBehaviorLabel(behavior: FieldLink['behavior']): string {
  return LINK_BEHAVIOR_LABELS[behavior];
}

function getSourceFieldLabel(field: string): string {
  const item = inputFields.value.find((f) => f.field === field);
  return item ? item.label : field;
}

function getTargetLabel(targetId: string): string {
  const schema = findSchemaByIdSafe(targetId);
  return schema ? getSchemaLabel(schema) : targetId;
}

function getValueText(link: FieldLink): string {
  const value = link.value;
  if (isExpressionValue(value)) {
    return `表达式 ${value.content}`;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined || value === null) {
    return '';
  }
  return JSON.stringify(value);
}
</script>

<template>
  <div class="aigen-link-field-editor">
    <!-- 模块头：标题 + 新建 -->
    <div class="aigen-link-module-head">
      <span class="aigen-link-module-title">字段联动</span>
      <button type="button" class="aigen-link-add-btn" @click="handleCreate">
        + 新建
      </button>
    </div>

    <!-- 联动规则列表 -->
    <div v-if="linkEntries.length" class="aigen-link-list">
      <div
        v-for="entry in linkEntries"
        :key="entry.link.id"
        class="aigen-link-item"
        :class="{ 'aigen-link-item--disabled': entry.link.enabled === false }"
      >
        <label
          class="aigen-switch aigen-switch--small"
          :class="{
            'aigen-switch--checked': entry.link.enabled !== false,
          }"
          title="启停用"
        >
          <input
            type="checkbox"
            class="aigen-switch__input"
            :checked="entry.link.enabled !== false"
            @change="handleToggleChange(entry, $event)"
          />
          <span class="aigen-switch__slider"></span>
        </label>
        <div class="aigen-link-item__main">
          <div class="aigen-link-item__summary" :title="entry.link.sourceField">
            当「{{ getSourceFieldLabel(entry.link.sourceField) }}」变化
          </div>
          <div
            class="aigen-link-item__summary aigen-link-item__summary--action"
          >
            → {{ getBehaviorLabel(entry.link.behavior) }}「{{
              getTargetLabel(entry.link.targetId)
            }}」
            <span
              v-if="entry.link.behavior === 'SET_VALUE'"
              class="aigen-link-item__value"
              :title="getValueText(entry.link)"
            >
              = {{ getValueText(entry.link) }}
            </span>
          </div>
        </div>
        <div class="aigen-link-item__ops">
          <button type="button" title="编辑" @click="handleEdit(entry)">
            编辑
          </button>
          <button
            type="button"
            class="aigen-link-item__del"
            title="删除"
            @click="handleDelete(entry)"
          >
            删除
          </button>
        </div>
      </div>
    </div>
    <div v-else class="aigen-link-empty">
      暂无联动规则，点击右上角「+ 新建」添加
    </div>

    <!-- 新建 / 编辑表单（内联展开） -->
    <div v-if="formVisible" class="aigen-link-form">
      <div class="aigen-link-form__row">
        <span class="aigen-link-form__label">源字段</span>
        <select v-model="draft.sourceField" class="aigen-link-select">
          <option value="" disabled>请选择源字段</option>
          <option
            v-for="item in inputFields"
            :key="item.field"
            :value="item.field"
          >
            {{ item.label }}（{{ item.field }}）
          </option>
        </select>
      </div>

      <div class="aigen-link-form__row">
        <span class="aigen-link-form__label">行为</span>
        <select v-model="draft.behavior" class="aigen-link-select">
          <option value="" disabled>请选择行为</option>
          <option
            v-for="opt in LINK_BEHAVIOR_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="aigen-link-form__row">
        <span class="aigen-link-form__label">目标元素</span>
        <select v-model="draft.targetId" class="aigen-link-select">
          <option value="" disabled>请选择目标元素</option>
          <option v-for="item in targetOptions" :key="item.id" :value="item.id">
            {{ item.label }}（{{ item.id }}）
          </option>
        </select>
      </div>

      <!-- 赋值内容（行为 = 赋值时显示） -->
      <div v-if="draft.behavior === 'SET_VALUE'" class="aigen-link-form__row">
        <span class="aigen-link-form__label">赋值内容</span>
        <div class="aigen-link-form__value">
          <div class="aigen-link-form__value-mode">
            <label class="aigen-radio">
              <input v-model="draft.valueMode" type="radio" value="constant" />
              常量
            </label>
            <label class="aigen-radio">
              <input
                v-model="draft.valueMode"
                type="radio"
                value="expression"
              />
              表达式
            </label>
          </div>
          <input
            v-if="draft.valueMode === 'constant'"
            v-model="draft.constantValue"
            type="text"
            class="aigen-link-input"
            placeholder="输入常量值"
          />
          <div v-else class="aigen-link-expr">
            <input
              v-model="draft.expressionValue"
              type="text"
              class="aigen-link-input"
              placeholder="如：$formData.qty * $formData.price"
            />
            <button
              type="button"
              class="aigen-link-fx"
              title="使用表达式插入器"
              @click="openExpression"
            >
              fx
            </button>
          </div>
        </div>
      </div>

      <!-- 可选条件（简单版：字段 + 运算符 + 值） -->
      <div class="aigen-link-form__row">
        <span class="aigen-link-form__label">条件</span>
        <label class="aigen-link-condition-toggle">
          <input v-model="draft.useCondition" type="checkbox" />
          启用条件（可选）
        </label>
      </div>
      <div v-if="draft.useCondition" class="aigen-link-form__condition">
        <select v-model="draft.conditionField" class="aigen-link-select">
          <option value="" disabled>条件字段</option>
          <option
            v-for="item in inputFields"
            :key="item.field"
            :value="item.field"
          >
            {{ item.label }}
          </option>
        </select>
        <select
          v-model="draft.conditionOperator"
          class="aigen-link-select aigen-link-select--op"
        >
          <option v-for="op in CONDITION_OPERATORS" :key="op" :value="op">
            {{ op }}
          </option>
        </select>
        <input
          v-model="draft.conditionValue"
          type="text"
          class="aigen-link-input"
          placeholder="条件值"
        />
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

    <ExpressionInsert
      v-model:visible="exprVisible"
      :fields="inputFields"
      @confirm="handleExpressionConfirm"
    />
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

/* 规则列表 */
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
}

.aigen-link-item__value {
  color: var(--aigen-primary);
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

/* 新建 / 编辑表单 */
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

.aigen-link-form__label {
  flex-shrink: 0;
  width: 64px;
  font-size: 12px;
  color: var(--aigen-text-main);
}

.aigen-link-select,
.aigen-link-input {
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

.aigen-link-select:focus,
.aigen-link-input:focus {
  border-color: var(--aigen-primary);
}

.aigen-link-select--op {
  flex: 0 0 64px;
}

.aigen-link-form__value {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 6px;
}

.aigen-link-form__value-mode {
  display: flex;
  gap: 12px;
}

.aigen-radio {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
}

.aigen-link-expr {
  display: flex;
  gap: 6px;
}

.aigen-link-fx {
  flex-shrink: 0;
  padding: 2px 8px;
  font-size: 12px;
  font-family: monospace;
  color: var(--aigen-primary);
  cursor: pointer;
  background: var(--aigen-primary-faded);
  border: 1px solid var(--aigen-primary);
  border-radius: 4px;
}

.aigen-link-fx:hover {
  opacity: 0.85;
}

.aigen-link-condition-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
}

.aigen-link-form__condition {
  display: flex;
  gap: 6px;
  padding-left: 72px;
}

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
