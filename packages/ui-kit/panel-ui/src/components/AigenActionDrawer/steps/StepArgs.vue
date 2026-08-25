<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { ActionDraft, ExpressionField, ExpressionModel } from '../helper';

import { computed, ref, watch } from 'vue';

import { AigenNode } from '@aigen-designer/base-ui';
import { useDesignerContext, usePageManager } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { findSchemas, getUUID } from '@aigen-designer/utils';

import aigenScriptEdit from '../../aigenActionModal/aigenScriptEdit.vue';
import ExpressionInsert from '../../ExpressionInsert/index.vue';
import { getArgsArray, isExpressionValue, stringifyArgs } from '../helper';

/**
 * Step4 · 参数配置：
 * - component：复用 aigenArgsEditor 的 AigenNode 渲染思路逐项渲染 actionArgsConfigs，
 *   每项右侧提供 [fx] 表达式插入按钮（aigenArgsEditor 无插槽，故在本组件内按同样逻辑渲染）；
 * - setAttr 特殊处理：属性选择器为下拉（config.attribute 过滤 props.* 项，label 为中文名）+ 值输入框；
 * - custom：函数名下拉 + 「编辑页面脚本」入口（内嵌 aigenScriptEdit，Monaco 编辑 pageSchema.script）；
 * - public：提示「该公共函数无参数配置」；
 * - 高级折叠区（默认收起）：动作命名/备注/延迟 ms（P3 生效）/条件（P3 生效，P1 仅保存字段）。
 * 参数值支持表达式：表达式插入器产出的 { __isExpression__: true, content } 直接作为 args 数组元素，
 * 与运行时 doActions 的表达式分支完全对齐（设计态仅求值展示，不触发运行时事件）。
 */
const props = defineProps<{
  actionItem: ActionDraft;
  componentSchema: ComponentSchema | null;
}>();

const emit = defineEmits<{
  (e: 'change', patch: Partial<ActionDraft>): void;
}>();

const { pageSchema } = useDesignerContext();
const pageManager = usePageManager();

/** args 数组（JSON 字符串 ↔ 数组双向同步，与 ActionsModel.args 约定一致） */
const argsArray = ref<unknown[]>(getArgsArray(props.actionItem.args));

watch(
  () => props.actionItem.args,
  (value) => {
    argsArray.value = getArgsArray(value);
  },
);

function setArg(index: number, value: unknown) {
  const values = [...argsArray.value];
  values[index] = value;
  argsArray.value = values;
  emit('change', { args: stringifyArgs(values) });
}

/** 指定下标参数是否为表达式对象 */
function isExprValue(index: number): boolean {
  return isExpressionValue(argsArray.value[index]);
}

/** 表达式内容展示文本 */
function getExpressionContent(index: number): string {
  const value = argsArray.value[index];
  return isExpressionValue(value) ? value.content : '';
}

/** 组件动作参数配置（逻辑迁移自旧 modal:97-122，含「设置数据」特殊替换） */
const actionArgsConfigs = computed<ComponentSchema[]>(() => {
  if (props.actionItem.type !== 'component' || !props.componentSchema) {
    return [];
  }
  const config = pluginManager.component.getConfigByType(
    props.componentSchema.type,
  );
  const action = config?.config.action ?? [];
  const matched = action.find(
    (item) => item.type === props.actionItem.methodName,
  );
  if (!matched?.argsConfigs) return [];
  // 不直接改写共享 config，构造新数组（「设置数据」替换为当前组件 schema 作参数表单）
  return matched.argsConfigs.map((item) => {
    if (item.label === '设置数据') {
      return {
        ...props.componentSchema,
        field: '0',
        id: getUUID(),
        label: '设置数据',
      } as ComponentSchema;
    }
    return item;
  });
});

/** 参数项显隐（show 支持 boolean / 函数，逻辑同 aigenArgsEditor） */
function isShow(item: ComponentSchema): boolean {
  if (typeof item.show === 'boolean') return item.show;
  if (typeof item.show === 'function') {
    return item.show({
      values: argsArray.value as unknown as Record<string, any>,
    });
  }
  return true;
}

/** 构造 AigenNode 渲染所需的属性编辑 schema（同 aigenArgsEditor 的 props 归一化） */
function buildPropertySchema(item: ComponentSchema): ComponentSchema {
  return {
    ...item,
    noFormItem: true,
    props: {
      ...item.props,
      field: undefined,
      hidden: false,
      input: false,
    },
    show: true,
  };
}

/** 目标组件展示名 */
const targetLabel = computed(() => {
  if (!props.componentSchema) return '';
  return (
    props.componentSchema.label ??
    pluginManager.component.getConfigByType(props.componentSchema.type)
      ?.defaultSchema.label ??
    '未命名组件'
  );
});

/** 当前方法展示名 */
const methodLabel = computed(() => {
  if (props.actionItem.type !== 'component' || !props.componentSchema) {
    return props.actionItem.methodName;
  }
  const action =
    pluginManager.component.getConfigByType(props.componentSchema.type)?.config
      .action ?? [];
  const matched = action.find(
    (item) => item.type === props.actionItem.methodName,
  );
  return matched
    ? (matched.describe ?? matched.description ?? matched.type)
    : props.actionItem.methodName;
});

/* ---------------- setAttr 特殊处理 ---------------- */

const isSetAttr = computed(
  () =>
    props.actionItem.type === 'component' &&
    props.actionItem.methodName === 'setAttr' &&
    Boolean(props.componentSchema),
);

/** 可修改属性列表：config.attribute 中以 props. 开头的项 */
const componentAttributes = computed(() => {
  if (!props.componentSchema) return [];
  const config = pluginManager.component.getConfigByType(
    props.componentSchema.type,
  );
  return (config?.config.attribute ?? []).filter(({ field }) =>
    String(field).startsWith('props'),
  );
});

const attrOptions = computed(() =>
  componentAttributes.value.map((attr) => ({
    label: attr.label ?? String(attr.field).replace('props.', ''),
    value: String(attr.field).replace('props.', ''),
  })),
);

/** 属性选择：args[0] 为属性名（不含 props. 前缀，与运行时 setAttr(key, value) 对齐） */
const selectedAttr = computed({
  get: () =>
    typeof argsArray.value[0] === 'string'
      ? (argsArray.value[0] as string)
      : '',
  set: (value: string) => {
    setArg(0, value);
    setArg(1, undefined);
  },
});

const selectedAttrSchema = computed(() => {
  const name = selectedAttr.value;
  if (!name) return null;
  return (
    componentAttributes.value.find(
      (attr) => String(attr.field).replace('props.', '') === name,
    ) ?? null
  );
});

/** 注：setAttr 属性值为 select（输入类型/尺寸等）时仍走 AigenNode 渲染组件下拉，
 * 弹层遮挡问题由抽屉遮罩 z-index（1000 < antd 1050 / elementPlus 2000+ / naive 3000+）解决。 */

/**
 * 清除表达式，恢复为直接值编辑。
 * 按对应属性的控件类型给合理默认值（switch/checkbox → false，其余 → 空字符串），
 * 避免回退到 undefined/null 造成"保存后静默不生效"。
 */
function clearExpression(index: number, schema: ComponentSchema | null = null) {
  const attrSchema = schema ?? (index === 1 ? selectedAttrSchema.value : null);
  const fallback =
    attrSchema &&
    (attrSchema.type === 'switch' || attrSchema.type === 'checkbox')
      ? false
      : '';
  setArg(index, fallback);
}

// 进入 setAttr 且无缓存参数时，初始化参数结构 [属性名, 属性值]
watch(
  () => isSetAttr.value,
  (val) => {
    if (val && argsArray.value.length === 0) {
      setArg(0, '');
    }
  },
  { immediate: true },
);

/* ---------------- 自定义函数 ---------------- */

const isCustom = computed(() => props.actionItem.type === 'custom');

const customFuncs = computed(() =>
  Object.keys(pageManager.funcs.value).filter(
    (name) => typeof pageManager.funcs.value[name] === 'function',
  ),
);

const customMethodName = computed({
  get: () => props.actionItem.methodName,
  set: (value: string) => emit('change', { methodName: value }),
});

const scriptOpen = ref(false);

/* ---------------- 公共函数 ---------------- */

const isPublic = computed(() => props.actionItem.type === 'public');

/* ---------------- 表达式插入 ---------------- */

const exprVisible = ref(false);
const exprTargetIndex = ref(0);

/** 表达式插入器字段列表：事件参数 + 页面输入组件（label + field + type） */
const expressionFields = computed<ExpressionField[]>(() => {
  // 事件参数：运行时 doActions 将触发事件的原生参数作为 $event 数组传入公式上下文
  // （如「值变化时」= [新值, 原生事件]，表达式写 $event[0] 取新值）
  const eventParams: ExpressionField[] = [
    {
      field: '$event[0]',
      label: '事件参数①（如「值变化时」的新值）',
      type: 'event',
    },
    {
      field: '$event[1]',
      label: '事件参数②（如 原生事件对象）',
      type: 'event',
    },
  ];
  const inputSchemas = findSchemas(
    pageSchema.schemas,
    (item) => Boolean(item.input) && Boolean(item.field),
  ) as ComponentSchema[];
  return [
    ...eventParams,
    ...inputSchemas.map((item) => ({
      field: item.field as string,
      label: item.label ?? (item.field as string),
      type: item.type,
    })),
  ];
});

function openExpression(index: number) {
  exprTargetIndex.value = index;
  exprVisible.value = true;
}

function handleExpressionConfirm(value: ExpressionModel) {
  setArg(exprTargetIndex.value, value);
}

/* ---------------- 高级折叠区（P1 仅保存字段） ---------------- */

const advancedOpen = ref(false);

const nameText = computed({
  get: () => props.actionItem.name,
  set: (value: string) => emit('change', { name: value }),
});

const remarkText = computed({
  get: () => props.actionItem.remark,
  set: (value: string) => emit('change', { remark: value }),
});

const delayText = computed({
  get: () =>
    props.actionItem.delay === null || props.actionItem.delay === undefined
      ? ''
      : String(props.actionItem.delay),
  set: (value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') {
      emit('change', { delay: null });
      return;
    }
    const parsed = Number(trimmed);
    emit('change', { delay: Number.isNaN(parsed) ? null : parsed });
  },
});
</script>

<template>
  <div class="aigen-step-args">
    <!-- 操作组件：参数配置 -->
    <div
      v-if="props.actionItem.type === 'component' && props.componentSchema"
      class="aigen-step-args-body"
    >
      <div class="aigen-step-args-head">
        「{{ targetLabel }}」→ {{ methodLabel }}
      </div>

      <!-- setAttr：属性下拉 + 值输入框 -->
      <div v-if="isSetAttr" class="aigen-step-args-setattr">
        <div class="aigen-step-args-row">
          <span class="aigen-step-args-row-label">选择属性</span>
          <select v-model="selectedAttr" class="aigen-step-args-select">
            <option value="" disabled>请选择属性</option>
            <option
              v-for="opt in attrOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>
        <p v-if="selectedAttr === 'defaultValue'" class="aigen-step-args-tip">
          默认值属于初始化属性：动作触发时会立即把该值应用到目标元素的当前值。
        </p>
        <div v-if="selectedAttrSchema" class="aigen-step-args-row">
          <span class="aigen-step-args-row-label">属性值</span>
          <div class="aigen-step-args-row-input">
            <!-- 表达式值：展示为 chip（编辑/改为直接值），避免把表达式对象传给控件触发类型告警 -->
            <div v-if="isExprValue(1)" class="aigen-step-args-expr-chip">
              <span
                class="aigen-step-args-expr-chip-code"
                :title="getExpressionContent(1)"
              >
                {{ getExpressionContent(1) }}
              </span>
              <button
                type="button"
                class="aigen-step-args-expr-chip-btn"
                @click="openExpression(1)"
              >
                编辑
              </button>
              <button
                type="button"
                class="aigen-step-args-expr-chip-btn"
                @click="clearExpression(1, selectedAttrSchema)"
              >
                改为直接值
              </button>
            </div>
            <AigenNode
              is-property
              :component-schema="buildPropertySchema(selectedAttrSchema)"
              :model-value="argsArray[1]"
              @update:model-value="setArg(1, $event)"
            />
          </div>
          <button
            type="button"
            class="aigen-step-args-fx"
            title="使用表达式"
            @click="openExpression(1)"
          >
            fx
          </button>
        </div>
        <div v-else class="aigen-step-args-empty">请先选择属性</div>
      </div>

      <!-- 普通参数：AigenNode 渲染（同 aigenArgsEditor）+ 每项 [fx] -->
      <div v-else-if="actionArgsConfigs.length" class="aigen-step-args-list">
        <div
          v-for="item in actionArgsConfigs"
          :key="item.id"
          v-show="isShow(item)"
          class="aigen-step-args-row"
        >
          <span class="aigen-step-args-row-label" :title="item.label">
            {{ item.label }}
          </span>
          <div class="aigen-step-args-row-input">
            <!-- 表达式值：展示为 chip，避免把表达式对象传给控件触发类型告警 -->
            <div
              v-if="isExprValue(Number(item.field))"
              class="aigen-step-args-expr-chip"
            >
              <span
                class="aigen-step-args-expr-chip-code"
                :title="getExpressionContent(Number(item.field))"
              >
                {{ getExpressionContent(Number(item.field)) }}
              </span>
              <button
                type="button"
                class="aigen-step-args-expr-chip-btn"
                @click="openExpression(Number(item.field))"
              >
                编辑
              </button>
              <button
                type="button"
                class="aigen-step-args-expr-chip-btn"
                @click="clearExpression(Number(item.field), item)"
              >
                改为直接值
              </button>
            </div>
            <AigenNode
              v-else
              is-property
              :component-schema="buildPropertySchema(item)"
              :model-value="argsArray[Number(item.field)]"
              @update:model-value="setArg(Number(item.field), $event)"
            />
          </div>
          <button
            type="button"
            class="aigen-step-args-fx"
            title="使用表达式"
            @click="openExpression(Number(item.field))"
          >
            fx
          </button>
        </div>
      </div>
      <div v-else class="aigen-step-args-empty">该动作无参数配置</div>
    </div>

    <!-- 自定义函数 -->
    <div v-else-if="isCustom" class="aigen-step-args-body">
      <div class="aigen-step-args-row">
        <span class="aigen-step-args-row-label">自定义函数</span>
        <select v-model="customMethodName" class="aigen-step-args-select">
          <option value="" disabled>请选择函数</option>
          <option v-for="name in customFuncs" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
      </div>
      <p class="aigen-step-args-tip">
        自定义函数来自页面脚本，通过 defineExpose
        暴露；调用参数由触发事件传入，无需在此配置。
      </p>
      <button
        type="button"
        class="aigen-step-args-script-toggle"
        @click="scriptOpen = !scriptOpen"
      >
        {{ scriptOpen ? '收起页面脚本' : '编辑页面脚本' }}
      </button>
      <div v-if="scriptOpen" class="aigen-step-args-script">
        <div class="aigen-step-args-script-tip">
          页面级自定义函数脚本，改动影响全页
        </div>
        <aigenScriptEdit />
      </div>
    </div>

    <!-- 公共函数 -->
    <div v-else-if="isPublic" class="aigen-step-args-body">
      <div class="aigen-step-args-empty">该公共函数无参数配置</div>
      <p class="aigen-step-args-tip">
        公共函数由插件注册，参数由插件内部处理，无需额外配置。
      </p>
    </div>

    <!-- 高级折叠区 -->
    <div class="aigen-step-args-advanced">
      <button
        type="button"
        class="aigen-step-args-advanced-toggle"
        @click="advancedOpen = !advancedOpen"
      >
        {{ advancedOpen ? '收起高级设置' : '高级设置' }}
      </button>
      <div v-show="advancedOpen" class="aigen-step-args-advanced-body">
        <div class="aigen-step-args-row">
          <span class="aigen-step-args-row-label">动作命名</span>
          <input
            v-model="nameText"
            type="text"
            class="aigen-step-args-input"
            placeholder="给动作起个名字（可选）"
          />
        </div>
        <div class="aigen-step-args-row">
          <span class="aigen-step-args-row-label">备注</span>
          <textarea
            v-model="remarkText"
            class="aigen-step-args-textarea"
            placeholder="备注信息（可选）"
          ></textarea>
        </div>
        <div class="aigen-step-args-row">
          <span class="aigen-step-args-row-label">延迟 ms</span>
          <input
            v-model="delayText"
            type="number"
            min="0"
            class="aigen-step-args-input aigen-step-args-input--num"
            placeholder="0"
          />
          <span class="aigen-step-args-p3">P3 生效</span>
        </div>
        <div class="aigen-step-args-row aigen-step-args-row--condition">
          <span class="aigen-step-args-row-label">条件</span>
          <div class="aigen-step-args-condition-note">
            条件支持按字段比较（如 数量 &gt;
            0）控制动作是否执行，将在后续版本开放配置；当前仅保存字段。
          </div>
        </div>
      </div>
    </div>

    <ExpressionInsert
      v-model:visible="exprVisible"
      :fields="expressionFields"
      @confirm="handleExpressionConfirm"
    />
  </div>
</template>

<style scoped>
.aigen-step-args-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.aigen-step-args-head {
  margin-bottom: 2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--aigen-text-main);
}

.aigen-step-args-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.aigen-step-args-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.aigen-step-args-row--condition {
  align-items: flex-start;
}

.aigen-step-args-row-label {
  flex-shrink: 0;
  width: 72px;
  font-size: 13px;
  color: var(--aigen-text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-step-args-row-input {
  flex: 1;
  min-width: 0;
}

/* 表达式值 chip：参数为表达式对象时的展示与编辑入口 */
.aigen-step-args-expr-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px 8px;
  border: 1px dashed var(--aigen-primary);
  border-radius: var(--aigen-radius);
  color: var(--aigen-primary);
  background-color: var(--aigen-primary-faded);
}

.aigen-step-args-expr-chip-code {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-family: monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-step-args-expr-chip-btn {
  flex-shrink: 0;
  padding: 0 2px;
  border: none;
  color: inherit;
  background-color: transparent;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.aigen-step-args-fx {
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

.aigen-step-args-fx:hover {
  opacity: 0.85;
}

.aigen-step-args-select,
.aigen-step-args-input {
  width: 100%;
  padding: 5px 8px;
  font-size: 13px;
  color: var(--aigen-text-main);
  outline: none;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  box-sizing: border-box;
}

.aigen-step-args-select:focus,
.aigen-step-args-input:focus {
  border-color: var(--aigen-primary);
}

.aigen-step-args-input--num {
  flex: 1;
  width: auto;
  min-width: 80px;
}

.aigen-step-args-textarea {
  flex: 1;
  min-width: 0;
  min-height: 56px;
  padding: 5px 8px;
  font-size: 13px;
  color: var(--aigen-text-main);
  resize: vertical;
  outline: none;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  box-sizing: border-box;
}

.aigen-step-args-textarea:focus {
  border-color: var(--aigen-primary);
}

.aigen-step-args-tip {
  margin: 0;
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-step-args-empty {
  padding: 12px 0;
  font-size: 13px;
  color: var(--aigen-text-helper);
  text-align: center;
}

.aigen-step-args-p3 {
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 11px;
  color: var(--aigen-text-helper);
  background: var(--aigen-muted);
  border-radius: 8px;
}

.aigen-step-args-script-toggle {
  align-self: flex-start;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--aigen-primary);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--aigen-primary);
  border-radius: 4px;
}

.aigen-step-args-script {
  height: 280px;
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  overflow: hidden;
}

.aigen-step-args-script-tip {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--aigen-text-helper);
  background: var(--aigen-muted);
  border-bottom: 1px solid var(--aigen-border);
}

.aigen-step-args-advanced {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--aigen-border);
}

.aigen-step-args-advanced-toggle {
  padding: 0;
  font-size: 12px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: transparent;
  border: none;
}

.aigen-step-args-advanced-toggle:hover {
  color: var(--aigen-primary);
}

.aigen-step-args-advanced-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.aigen-step-args-condition-note {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--aigen-text-helper);
}
</style>
