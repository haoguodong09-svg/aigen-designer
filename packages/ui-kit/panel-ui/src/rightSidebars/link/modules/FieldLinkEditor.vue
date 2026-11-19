<script lang="ts" setup>
import type {
  ComponentSchema,
  ConditionGroup,
  ReactiveRule,
} from '@aigen-designer/types';

import type {
  ExpressionField,
  ExpressionModel,
} from '../../../components/AigenActionDrawer/helper';
import type { RuleDraft, RuleOperator } from './ruleHelper';

import { computed, onMounted, reactive, ref } from 'vue';

import { AigenIcon, useBindModel } from '@aigen-designer/base-ui';
import { useDesignerContext, usePageManager } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { deepClone, findSchemas } from '@aigen-designer/utils';

import { isExpressionValue } from '../../../components/AigenActionDrawer/helper';
import ExpressionInsert from '../../../components/ExpressionInsert/index.vue';
import { getSchemaLabel } from './linkHelper';
import {
  buildReactiveRule,
  createEmptyRuleDraft,
  getBehaviorLabel,
  getRuleSimpleCondition,
  getRuleSummary,
  inferRuleBehavior,
  migrateLegacyLinksToRules,
  RULE_BEHAVIOR_OPTIONS,
  RULE_OPERATOR_OPTIONS,
  UNARY_OPERATORS,
} from './ruleHelper';

/**
 * 「字段联动」声明式规则编辑器。
 *
 * 设计目标：
 * - 单一真相源：只读写 pageSchema.reactiveRules，不再生成 schema.links / on.change 编译动作；
 * - 首屏即生效：运行时 ReactiveRuleEngine 在数据回填后立即求值，条件反转自动复位；
 * - 自然语言心智：当「字段」「条件」「值」时 → 对「目标」显示/隐藏/禁用/赋值…；
 * - 零门槛：当前选中字段自动预填、常用模板一键套用、比较值按字段类型提供选项。
 */

const designer = useDesignerContext();
const pageManager = usePageManager();
const pageSchema = designer.pageSchema;
const revoke = designer.revoke;

const SelectComponent = pluginManager.component.get('select');
const { bindModel } = useBindModel('select');

/** 页面输入组件字段（label + field + type + schema） */
const inputSchemas = computed(
  () =>
    findSchemas(
      pageSchema.schemas,
      (item) => Boolean(item.input) && Boolean(item.field),
    ) as ComponentSchema[],
);

const inputFields = computed<ExpressionField[]>(() =>
  inputSchemas.value.map((item) => ({
    field: item.field as string,
    label: item.label ?? (item.field as string),
    type: item.type,
  })),
);

/** 页面全部元素（联动目标候选） */
const allSchemas = computed(
  () =>
    findSchemas(pageSchema.schemas, (item) =>
      Boolean(item.id),
    ) as ComponentSchema[],
);

const targetOptions = computed(() =>
  allSchemas.value.map((item) => ({
    label: `${getSchemaLabel(item)}（${item.id}）`,
    value: item.id as string,
  })),
);

const sourceFieldOptions = computed(() =>
  inputSchemas.value.map((item) => ({
    label:
      item.label && item.label !== item.field
        ? `${item.label}（${item.field}）`
        : String(item.field),
    value: item.field as string,
  })),
);

const operatorOptions = RULE_OPERATOR_OPTIONS.map((item) => ({
  label: item.label,
  value: item.value,
}));

const behaviorOptions = RULE_BEHAVIOR_OPTIONS;

/** 规则列表 */
const ruleEntries = computed<ReactiveRule[]>(
  () => pageSchema.reactiveRules ?? [],
);

/* ---------------- 旧数据升轨 ---------------- */

onMounted(() => {
  // 存量 schema.links → reactiveRules（一次性、幂等）
  migrateLegacyLinksToRules(pageSchema);
});

/* ---------------- 表单草稿 ---------------- */

const draft = reactive<RuleDraft>(createEmptyRuleDraft());
const formVisible = ref(false);
const editingId = ref<null | string>(null);
const formError = ref('');

const behaviorModel = computed({
  get: () => draft.behavior,
  set: (value: string) => {
    draft.behavior = value as RuleDraft['behavior'];
  },
});

const operatorModel = computed({
  get: () => draft.operator,
  set: (value: string) => {
    draft.operator = value as RuleOperator;
  },
});

/** 源字段 schema（用于比较值控件类型与选项） */
const sourceSchema = computed(
  () =>
    inputSchemas.value.find((item) => item.field === draft.sourceField) ?? null,
);

/** 比较值控件类型：select / boolean / number / text */
const conditionValueKind = computed<'boolean' | 'number' | 'options' | 'text'>(
  () => {
    const type = sourceSchema.value?.type ?? '';
    const hasOptions = Array.isArray(sourceSchema.value?.props?.options);
    if (
      hasOptions &&
      ['cascader', 'checkbox', 'radio', 'select'].includes(type)
    ) {
      return 'options';
    }
    if (type === 'switch' || type === 'checkbox') return 'boolean';
    if (['input-number', 'number', 'rate', 'slider'].includes(type)) {
      return 'number';
    }
    return 'text';
  },
);

/** 源字段可选项（select/radio 的 props.options） */
const conditionValueOptions = computed(() => {
  const options = sourceSchema.value?.props?.options;
  if (!Array.isArray(options)) return [];
  return options.map((item: any) =>
    typeof item === 'object'
      ? {
          label: String(item.label ?? item.value ?? ''),
          value: typeof item.value === 'object' ? item.value : item.value,
        }
      : { label: String(item), value: item },
  );
});

/** 布尔比较值下拉 */
const booleanOptions = [
  { label: '是（true）', value: true },
  { label: '否（false）', value: false },
];

/** 比较值统一模型：下拉可能返回布尔/数字/字符串，文本输入返回字符串 */
const conditionValueModel = computed({
  get: () => draft.conditionValue,
  set: (value: any) => {
    draft.conditionValue = value;
  },
});

/** 是否需要输入比较值 */
const needConditionValue = computed(
  () => draft.operator !== 'always' && !UNARY_OPERATORS.has(draft.operator),
);

/** 当前行为是否需要配置“赋的值” */
const needValue = computed(() => draft.behavior === 'SET_VALUE');

/* ---------------- 表达式插入 ---------------- */

const exprVisible = ref(false);
const exprInitial = ref('');

function openExpression() {
  exprInitial.value = draft.expressionValue;
  exprVisible.value = true;
}

function handleExpressionConfirm(value: ExpressionModel) {
  draft.valueMode = 'expression';
  draft.expressionValue = value.content;
}

/* ---------------- 新建 / 编辑 / 删除 ---------------- */

function handleCreate() {
  const selected = designer.state.selectedNode;
  const defaultSource = selected?.field
    ? String(selected.field)
    : (inputSchemas.value[0]?.field ?? '');

  Object.assign(draft, createEmptyRuleDraft(), {
    sourceField: defaultSource,
    targetId: selected && selected.id && !selected.input ? selected.id : '',
  });
  editingId.value = null;
  formError.value = '';
  formVisible.value = true;
}

/** 快捷模板：一键预填常用句式 */
function applyTemplate(template: 'CLEAR' | 'DISABLE' | 'HIDE' | 'SET_VALUE') {
  const selected = designer.state.selectedNode;
  const defaultSource = selected?.field
    ? String(selected.field)
    : (inputSchemas.value[0]?.field ?? '');
  Object.assign(draft, createEmptyRuleDraft(), {
    behavior: template,
    sourceField: defaultSource,
    targetId: selected && selected.id && !selected.input ? selected.id : '',
  });
  if (template === 'HIDE' || template === 'DISABLE') {
    draft.operator = '==';
  }
  editingId.value = null;
  formError.value = '';
  formVisible.value = true;
}

function handleEdit(rule: ReactiveRule) {
  const condition = getRuleSimpleCondition(rule);
  const behavior = inferRuleBehavior(rule);
  const computedValue = rule.effects.computedValue;
  Object.assign(draft, createEmptyRuleDraft(), {
    behavior,
    conditionValue:
      condition && condition.value !== undefined ? condition.value : '',
    constantValue:
      behavior === 'SET_VALUE' &&
      !isExpressionValue(computedValue) &&
      typeof computedValue !== 'object'
        ? String(computedValue ?? '')
        : '',
    expressionValue: isExpressionValue(computedValue)
      ? computedValue.content
      : '',
    operator: condition ? condition.operator : 'always',
    sourceField: condition?.field ?? '',
    targetId: rule.targetField,
    valueMode: isExpressionValue(computedValue) ? 'expression' : 'constant',
  });
  editingId.value = rule.id;
  formError.value = '';
  formVisible.value = true;
}

function handleCancel() {
  formVisible.value = false;
  editingId.value = null;
  formError.value = '';
}

/** 替换整个规则数组并记录撤销栈 */
function commitRules(nextRules: ReactiveRule[], message: string) {
  const before = deepClone(pageSchema.reactiveRules ?? []);
  const after = deepClone(nextRules);
  pageSchema.reactiveRules = after;
  // 设计态即时反馈：规则变化后立即重新求值（首屏/编辑时无需触发交互）
  pageManager.reactiveEngine?.evaluateAllRules?.();
  revoke.push({
    redo: () => {
      pageSchema.reactiveRules = deepClone(after);
      pageManager.reactiveEngine?.evaluateAllRules?.();
    },
    type: message,
    undo: () => {
      pageSchema.reactiveRules = deepClone(before);
      pageManager.reactiveEngine?.evaluateAllRules?.();
    },
  });
}

function handleSave() {
  formError.value = '';
  if (!draft.behavior) {
    formError.value = '请选择联动效果';
    return;
  }
  if (!draft.targetId) {
    formError.value = '请选择受影响的目标元素';
    return;
  }
  if (draft.operator !== 'always' && !draft.sourceField) {
    formError.value = '请选择判断条件的字段';
    return;
  }
  if (
    draft.behavior === 'SET_VALUE' &&
    draft.valueMode === 'expression' &&
    !draft.expressionValue.trim()
  ) {
    formError.value = '请输入赋值公式，或改用常量';
    return;
  }

  const rule = buildReactiveRule(draft, editingId.value ?? undefined);
  if (!rule) {
    formError.value = '规则配置不完整';
    return;
  }

  const rules = [...(pageSchema.reactiveRules ?? [])];
  const index = rules.findIndex((item) => item.id === rule.id);
  if (index === -1) {
    rules.push(rule);
  } else {
    rule.enabled = rules[index].enabled !== false;
    rules.splice(index, 1, rule);
  }
  commitRules(rules, editingId.value ? '编辑联动规则' : '新增联动规则');
  formVisible.value = false;
  editingId.value = null;
}

function handleDelete(rule: ReactiveRule) {
  commitRules(
    (pageSchema.reactiveRules ?? []).filter((item) => item.id !== rule.id),
    '删除联动规则',
  );
  if (editingId.value === rule.id) {
    formVisible.value = false;
    editingId.value = null;
  }
}

function handleToggle(rule: ReactiveRule, enabled: boolean) {
  commitRules(
    (pageSchema.reactiveRules ?? []).map((item) =>
      item.id === rule.id ? { ...item, enabled } : item,
    ),
    '启停用联动规则',
  );
}

function handleToggleChange(rule: ReactiveRule, event: Event) {
  handleToggle(rule, (event.target as HTMLInputElement).checked);
}

/* ---------------- 展示辅助 ---------------- */

function getFieldLabel(field: string): string {
  const schema = inputSchemas.value.find((item) => item.field === field);
  return schema ? getSchemaLabel(schema) : field;
}

function getTargetLabel(targetId: string): string {
  const schema = allSchemas.value.find((item) => item.id === targetId);
  return schema ? getSchemaLabel(schema) : `${targetId}（已删除）`;
}

function getSummary(rule: ReactiveRule): string {
  return getRuleSummary(rule, getFieldLabel, getTargetLabel);
}

/** 规则是否引用已删除目标（设计态断链提示） */
function isTargetMissing(rule: ReactiveRule): boolean {
  return !allSchemas.value.some((item) => item.id === rule.targetField);
}

/** 展示当前条件的人话（列表卡片副标题） */
function getConditionHint(rule: ReactiveRule): string {
  const condition: ConditionGroup | undefined = rule.condition;
  const first = condition?.items?.[0];
  const behavior = inferRuleBehavior(rule);
  if (behavior === 'SET_VALUE' || behavior === 'CLEAR') {
    return '条件满足时执行赋值 / 清空';
  }
  if (!first || !('field' in first)) return '始终生效';
  return '条件满足时生效，不满足自动恢复';
}
</script>

<template>
  <div class="aigen-link-field-editor">
    <!-- 模块头：标题 + 新建 -->
    <div class="aigen-link-module-head">
      <div class="aigen-link-module-title-wrap">
        <span class="aigen-link-module-title">
          <AigenIcon
            class="aigen-link-module-icon"
            name="icon--behavior--thunderbolt"
          />
          字段联动
        </span>
        <span class="aigen-link-module-sub">条件满足时自动改变其它元素</span>
      </div>
      <button type="button" class="aigen-link-add-btn" @click="handleCreate">
        <AigenIcon name="icon--aigen--add-rounded" />
        新建规则
      </button>
    </div>

    <!-- 规则列表 -->
    <div v-if="ruleEntries.length" class="aigen-link-list">
      <div
        v-for="rule in ruleEntries"
        :key="rule.id"
        class="aigen-rule-card"
        :class="{ 'aigen-rule-card--disabled': rule.enabled === false }"
      >
        <div class="aigen-rule-card__head">
          <label
            class="aigen-switch aigen-switch--small"
            :class="{ 'aigen-switch--checked': rule.enabled !== false }"
            title="启停用"
          >
            <input
              type="checkbox"
              class="aigen-switch__input"
              :checked="rule.enabled !== false"
              @change="handleToggleChange(rule, $event)"
            />
            <span class="aigen-switch__slider"></span>
          </label>
          <span class="aigen-rule-card__summary" :title="getSummary(rule)">
            <AigenIcon
              class="aigen-rule-card__summary-icon"
              name="icon--behavior--thunderbolt"
            />
            {{ getSummary(rule) }}
          </span>
        </div>
        <div class="aigen-rule-card__foot">
          <span class="aigen-rule-card__hint">{{
            getConditionHint(rule)
          }}</span>
          <span v-if="isTargetMissing(rule)" class="aigen-rule-card__warn">
            <AigenIcon name="icon--behavior--warning-circle" />
            目标元素已删除
          </span>
          <span class="aigen-rule-card__ops">
            <button
              type="button"
              title="编辑"
              aria-label="编辑规则"
              @click="handleEdit(rule)"
            >
              <AigenIcon name="icon--behavior--edit" />
            </button>
            <button
              type="button"
              class="aigen-rule-card__del"
              title="删除"
              aria-label="删除规则"
              @click="handleDelete(rule)"
            >
              <AigenIcon name="icon--behavior--delete" />
            </button>
          </span>
        </div>
      </div>
    </div>
    <div v-else class="aigen-link-empty">
      还没有联动规则。用一句自然语言即可配置：<br />
      「当 客户类型 等于 企业 时，显示 税号」。
    </div>

    <!-- 快捷模板（仅空态展示，降低首次配置门槛） -->
    <div
      v-if="!ruleEntries.length && !formVisible"
      class="aigen-rule-templates"
    >
      <div class="aigen-rule-templates__title">常用场景一键开始</div>
      <button type="button" @click="applyTemplate('HIDE')">
        <AigenIcon name="icon--aigen--visibility-off-outline-rounded" />
        字段等于某值时隐藏另一个元素
      </button>
      <button type="button" @click="applyTemplate('DISABLE')">
        <AigenIcon name="icon--aigen--lock-outline" />
        字段等于某值时禁用另一个元素
      </button>
      <button type="button" @click="applyTemplate('SET_VALUE')">
        <AigenIcon name="icon--aigen--edit-square-outline-rounded" />
        根据公式给另一个元素赋值
      </button>
      <button type="button" @click="applyTemplate('CLEAR')">
        <AigenIcon name="icon--behavior--clear" />
        条件满足时清空另一个元素
      </button>
    </div>

    <!-- 新建 / 编辑表单 -->
    <div v-if="formVisible" class="aigen-rule-form">
      <div class="aigen-rule-form__title">
        {{ editingId ? '编辑联动规则' : '新建联动规则' }}
      </div>

      <!-- IF 条件 -->
      <div class="aigen-rule-form__section">
        <div class="aigen-rule-form__section-title">
          <span class="aigen-rule-form__section-index">1</span>
          <span class="aigen-rule-form__section-label">当满足条件</span>
        </div>
        <div class="aigen-rule-form__row">
          <span class="aigen-rule-form__label">判断字段</span>
          <div class="aigen-rule-form__control">
            <component
              :is="SelectComponent"
              v-model:[bindModel]="draft.sourceField"
              :disabled="draft.operator === 'always'"
              :options="sourceFieldOptions"
              placeholder="选择要判断的字段"
              style="width: 100%"
            />
          </div>
        </div>
        <div class="aigen-rule-form__row">
          <span class="aigen-rule-form__label">判断关系</span>
          <div class="aigen-rule-form__control">
            <component
              :is="SelectComponent"
              v-model:[bindModel]="operatorModel"
              :options="operatorOptions"
              style="width: 100%"
            />
          </div>
        </div>

        <div v-if="needConditionValue" class="aigen-rule-form__row">
          <span class="aigen-rule-form__label">比较值</span>
          <div class="aigen-rule-form__control">
            <component
              v-if="
                conditionValueKind === 'options' && conditionValueOptions.length
              "
              :is="SelectComponent"
              v-model:[bindModel]="conditionValueModel"
              :options="conditionValueOptions"
              placeholder="选择比较值"
              style="width: 100%"
            />
            <component
              v-else-if="conditionValueKind === 'boolean'"
              :is="SelectComponent"
              v-model:[bindModel]="conditionValueModel"
              :options="booleanOptions"
              placeholder="选择是 / 否"
              style="width: 100%"
            />
            <input
              v-else
              v-model="draft.conditionValue"
              :type="conditionValueKind === 'number' ? 'number' : 'text'"
              class="aigen-rule-input"
              placeholder="输入比较值"
            />
          </div>
        </div>
        <p v-if="draft.operator === 'always'" class="aigen-rule-form__tip">
          无条件规则：页面加载后立即生效（如“始终禁用某元素”）。
        </p>
      </div>

      <!-- THEN 效果 -->
      <div class="aigen-rule-form__section">
        <div class="aigen-rule-form__section-title">
          <span class="aigen-rule-form__section-index">2</span>
          <span class="aigen-rule-form__section-label">则执行联动</span>
        </div>
        <div class="aigen-rule-form__row">
          <span class="aigen-rule-form__label">联动效果</span>
          <div class="aigen-rule-form__control">
            <div class="aigen-rule-behavior-grid">
              <button
                v-for="opt in behaviorOptions"
                :key="opt.value"
                type="button"
                class="aigen-rule-behavior"
                :class="{
                  'aigen-rule-behavior--active': draft.behavior === opt.value,
                }"
                :title="opt.description"
                @click="behaviorModel = opt.value"
              >
                <AigenIcon class="aigen-rule-behavior__icon" :name="opt.icon" />
                <span class="aigen-rule-behavior__label">{{ opt.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 赋值内容 -->
        <div v-if="needValue" class="aigen-rule-form__row">
          <span class="aigen-rule-form__label">赋的值</span>
          <div class="aigen-rule-form__control aigen-rule-form__value">
            <div class="aigen-rule-form__value-mode">
              <label class="aigen-radio">
                <input
                  v-model="draft.valueMode"
                  type="radio"
                  value="constant"
                />
                常量
              </label>
              <label class="aigen-radio">
                <input
                  v-model="draft.valueMode"
                  type="radio"
                  value="expression"
                />
                公式
              </label>
            </div>
            <input
              v-if="draft.valueMode === 'constant'"
              v-model="draft.constantValue"
              type="text"
              class="aigen-rule-input"
              placeholder="如：0、未填写、true"
            />
            <div v-else class="aigen-rule-expr">
              <input
                v-model="draft.expressionValue"
                type="text"
                class="aigen-rule-input"
                placeholder="如：$formData.qty * $formData.price"
              />
              <button
                type="button"
                class="aigen-rule-fx"
                title="打开公式插入器"
                @click="openExpression"
              >
                ƒx
              </button>
            </div>
          </div>
        </div>

        <div class="aigen-rule-form__row">
          <span class="aigen-rule-form__label">影响目标</span>
          <div class="aigen-rule-form__control">
            <component
              :is="SelectComponent"
              v-model:[bindModel]="draft.targetId"
              :options="targetOptions"
              placeholder="选择要显示/隐藏/禁用/赋值的元素"
              style="width: 100%"
            />
          </div>
        </div>
      </div>

      <!-- 预览句 -->
      <div class="aigen-rule-preview">
        <span class="aigen-rule-preview__label">
          <AigenIcon name="icon--behavior--eye" />
          规则预览
        </span>
        <span class="aigen-rule-preview__text">
          <template v-if="!draft.behavior || !draft.targetId">
            选择判断条件、联动效果和目标元素后，这里会生成一句可读的规则说明。
          </template>
          <template v-else-if="draft.operator === 'always'">
            始终 {{ getBehaviorLabel(draft.behavior) }}「{{
              getTargetLabel(draft.targetId)
            }}」
          </template>
          <template v-else>
            当「{{ getFieldLabel(draft.sourceField) }}」
            {{
              operatorOptions.find((item) => item.value === draft.operator)
                ?.label
            }}{{
              needConditionValue ? `「${String(draft.conditionValue)}」` : ''
            }}
            时， {{ getBehaviorLabel(draft.behavior) }}「{{
              getTargetLabel(draft.targetId)
            }}」
          </template>
        </span>
      </div>

      <div class="aigen-rule-form__footer">
        <span v-if="formError" class="aigen-rule-form__error">
          {{ formError }}
        </span>
        <div class="aigen-rule-form__actions">
          <button
            type="button"
            class="aigen-button small"
            @click="handleCancel"
          >
            取消
          </button>
          <button
            type="button"
            class="aigen-button small primary"
            @click="handleSave"
          >
            保存规则
          </button>
        </div>
      </div>
    </div>

    <ExpressionInsert
      v-model:visible="exprVisible"
      :fields="inputFields"
      :initial-content="exprInitial"
      @confirm="handleExpressionConfirm"
    />
  </div>
</template>

<style scoped>
/* 模块头 */
.aigen-link-module-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.aigen-link-module-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.aigen-link-module-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--aigen-text-sm);
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-link-module-icon {
  color: var(--aigen-primary);
  font-size: 14px;
}

.aigen-link-module-sub {
  font-size: 11px;
  color: var(--aigen-text-helper);
}

.aigen-link-add-btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  font-size: var(--aigen-text-sm);
  color: var(--aigen-primary);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--aigen-border);
  border-radius: calc(var(--aigen-radius) - 2px);
  transition: all 0.2s ease-out-quart;
}

.aigen-link-add-btn:hover {
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
}

/* 规则卡片 */
.aigen-link-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aigen-rule-card {
  padding: 8px 10px;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  transition: border-color 0.2s;
}

.aigen-rule-card:hover {
  border-color: var(--aigen-primary);
}

.aigen-rule-card--disabled {
  opacity: 0.55;
}

.aigen-rule-card__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.aigen-rule-card__summary {
  display: flex;
  flex: 1;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  font-size: var(--aigen-text-sm);
  line-height: 1.6;
  color: var(--aigen-text-main);
  word-break: break-all;
}

.aigen-rule-card__summary-icon {
  flex-shrink: 0;
  margin-top: 3px;
  color: var(--aigen-primary);
}

.aigen-rule-card__foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding-left: 34px;
}

.aigen-rule-card__hint {
  flex: 1;
  overflow: hidden;
  font-size: 11px;
  color: var(--aigen-text-helper);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-rule-card__warn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--aigen-destructive);
}

.aigen-rule-card__ops {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
}

.aigen-rule-card__ops button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 14px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  transition: all 0.2s ease-out-quart;
}

.aigen-rule-card__ops button:hover {
  color: var(--aigen-primary);
  background: var(--aigen-primary-faded);
}

.aigen-rule-card__ops .aigen-rule-card__del:hover {
  color: var(--aigen-destructive);
}

.aigen-link-empty {
  padding: 14px 12px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--aigen-text-helper);
  text-align: center;
  background: var(--aigen-secondary, #f8f9fa);
  border: 1px dashed var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

/* 快捷模板 */
.aigen-rule-templates {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.aigen-rule-templates__title {
  margin-bottom: 2px;
  font-size: 11px;
  color: var(--aigen-text-helper);
}

.aigen-rule-templates button {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  font-size: var(--aigen-text-sm);
  color: var(--aigen-text-main);
  text-align: left;
  cursor: pointer;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  transition: all 0.2s ease-out-quart;
}

.aigen-rule-templates button .iconfont {
  color: var(--aigen-text-secondary);
}

.aigen-rule-templates button:hover {
  color: var(--aigen-primary);
  border-color: var(--aigen-primary);
  background: var(--aigen-primary-faded);
}

.aigen-rule-templates button:hover .iconfont {
  color: var(--aigen-primary);
}

/* 表单 */
.aigen-rule-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
  padding: 12px;
  background: var(--aigen-secondary, #f5f6f8);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-rule-form__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-rule-form__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--aigen-border);
}

.aigen-rule-form__section:last-of-type {
  padding-bottom: 0;
  border-bottom: none;
}

.aigen-rule-form__section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-rule-form__section-index {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: var(--aigen-primary);
  background: var(--aigen-primary-faded);
  border-radius: 50%;
}

.aigen-rule-form__section-label {
  flex-shrink: 0;
}

.aigen-rule-form__row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.aigen-rule-form__label {
  flex-shrink: 0;
  width: 60px;
  padding-top: 9px;
  font-size: 12px;
  color: var(--aigen-text-main);
}

.aigen-rule-form__control {
  flex: 1;
  min-width: 0;
}

.aigen-rule-form__value {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.aigen-rule-form__value-mode {
  display: flex;
  gap: 12px;
}

.aigen-rule-input {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 0 8px;
  font-size: 14px;
  color: var(--aigen-text-main);
  outline: none;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-rule-input:focus {
  border-color: var(--aigen-primary);
}

.aigen-radio {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
}

.aigen-rule-expr {
  display: flex;
  align-items: center;
  gap: 6px;
}

.aigen-rule-fx {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  font-family: monospace;
  color: var(--aigen-primary);
  cursor: pointer;
  background: var(--aigen-primary-faded);
  border: 1px solid var(--aigen-primary);
  border-radius: 4px;
}

/* 行为选择网格 */
.aigen-rule-behavior-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.aigen-rule-behavior {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 2px;
  font-size: 11px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: var(--aigen-secondary, #f8f9fa);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  transition: all 0.2s;
}

/* 悬停仅作用于未选中项，避免选中态（主色底）被主色文字覆盖导致文字不可见 */
.aigen-rule-behavior:not(.aigen-rule-behavior--active):hover {
  color: var(--aigen-primary);
  border-color: var(--aigen-primary);
}

.aigen-rule-behavior--active {
  color: var(--aigen-primary-foreground);
  background: var(--aigen-primary);
  border-color: var(--aigen-primary);
}

.aigen-rule-behavior__icon {
  font-size: 14px;
  line-height: 1;
}

.aigen-rule-behavior--active .aigen-rule-behavior__icon {
  filter: grayscale(0.1);
}

.aigen-rule-behavior__label {
  white-space: nowrap;
}

.aigen-rule-form__tip {
  margin: 0;
  padding-left: 68px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--aigen-text-helper);
}

/* 规则预览 */
.aigen-rule-preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--aigen-primary-faded);
  border-left: 3px solid var(--aigen-primary);
  border-radius: 4px;
}

.aigen-rule-preview__label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--aigen-primary);
}

.aigen-rule-preview__text {
  font-size: 12px;
  line-height: 1.6;
  color: var(--aigen-text-main);
  word-break: break-all;
}

.aigen-rule-form__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.aigen-rule-form__error {
  font-size: 12px;
  color: var(--aigen-destructive);
}

.aigen-rule-form__actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  margin-left: auto;
}

.aigen-rule-form__actions .aigen-button {
  font-family: inherit;
  font-size: var(--aigen-text-sm);
}

/* 启停用 switch */
.aigen-switch {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  width: 30px;
  height: 16px;
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
  background-color: var(--aigen-border);
  border-radius: 999px;
  transition: background-color 0.2s;
}

.aigen-switch__slider::before {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  background-color: var(--aigen-background);
  border-radius: 50%;
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
</style>
