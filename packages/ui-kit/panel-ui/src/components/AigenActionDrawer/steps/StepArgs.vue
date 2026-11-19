<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { ActionDraft, ExpressionField, ExpressionModel } from '../helper';

import { computed, nextTick, ref, watch } from 'vue';

import {
  AigenCollapse,
  AigenCollapsePanel,
  AigenIcon,
  AigenNode,
  AigenTooltip,
  useBindModel,
} from '@aigen-designer/base-ui';
import { useDesignerContext, usePageManager } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { findSchemas, getUUID } from '@aigen-designer/utils';

import aigenScriptEdit from '../../aigenActionModal/aigenScriptEdit.vue';
import ExpressionInsert from '../../ExpressionInsert/index.vue';
import { getArgsArray, isExpressionValue, stringifyArgs } from '../helper';

/**
 * 参数配置（单屏动作编辑器的「参数与高级设置」区域）：
 * - 组件方法：按组件元数据 argsConfigs 渲染语义化表单，支持表达式；
 * - 自定义/公共函数：支持任意数量、任意类型的调用参数（不再限制为“事件参数”）；
 * - 事件广播：事件名 + 自由载荷（常量 / 公式）；
 * - API：URL、HTTP 方法、请求体；
 * - 页面跳转：URL、打开方式；
 * - 高级：动作命名、备注、延迟、执行条件、错误策略；
 * - 「自由参数」模式允许直接编辑 JSON 参数数组，覆盖所有未被元数据覆盖的场景。
 */
const props = defineProps<{
  actionItem: ActionDraft;
  componentSchema: ComponentSchema | null;
}>();

const emit = defineEmits<{
  (e: 'change', patch: Partial<ActionDraft>): void;
}>();

const SelectComponent = pluginManager.component.get('select');
const { bindModel } = useBindModel('select');

const { pageSchema } = useDesignerContext();
const pageManager = usePageManager();

/** args 数组（JSON 字符串 ↔ 数组双向同步） */
const argsArray = ref<unknown[]>(getArgsArray(props.actionItem.args));

watch(
  () => props.actionItem.args,
  (value) => {
    argsArray.value = getArgsArray(value);
  },
);

function commitArgs(values: unknown[]) {
  argsArray.value = values;
  emit('change', { args: stringifyArgs(values) });
}

function setArg(index: number, value: unknown) {
  const values = [...argsArray.value];
  values[index] = value;
  commitArgs(values);
}

function addArg() {
  commitArgs([...argsArray.value, '']);
}

function removeArg(index: number) {
  const values = [...argsArray.value];
  values.splice(index, 1);
  commitArgs(values);
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

/** 清除表达式，恢复为直接值编辑 */
function clearExpression(index: number, schema: ComponentSchema | null = null) {
  const fallback =
    schema && (schema.type === 'switch' || schema.type === 'checkbox')
      ? false
      : '';
  setArg(index, fallback);
}

/* ---------------- 组件方法参数 ---------------- */

const isComponent = computed(() => props.actionItem.type === 'component');

/** 组件动作参数配置（逻辑迁移自旧 modal，含「设置数据」特殊替换） */
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

/** 参数项显隐（show 支持 boolean / 函数） */
function isShow(item: ComponentSchema): boolean {
  if (typeof item.show === 'boolean') return item.show;
  if (typeof item.show === 'function') {
    return item.show({
      values: argsArray.value as unknown as Record<string, any>,
    });
  }
  return true;
}

/** 构造 AigenNode 渲染所需的属性编辑 schema */
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

/** setAttr 特殊处理 */
const isSetAttr = computed(
  () =>
    props.actionItem.type === 'component' &&
    props.actionItem.methodName === 'setAttr' &&
    Boolean(props.componentSchema),
);

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

const selectedAttr = computed({
  get: () =>
    typeof argsArray.value[0] === 'string'
      ? (argsArray.value[0] as string)
      : '',
  set: (value: string) => {
    const values = [value, ''];
    commitArgs(values);
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

watch(
  () => isSetAttr.value,
  (val) => {
    if (val && argsArray.value.length === 0) {
      commitArgs(['', '']);
    }
  },
  { immediate: true },
);

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

/* ---------------- 自由参数模式（JSON） ---------------- */

const argsMode = ref<'form' | 'json'>('form');
const jsonText = ref('');
const jsonError = ref('');
const jsonPlaceholder =
  'JSON 数组，例如 ["选项1", {"__isExpression__": true, "content": "$event[0]"}]';
/** 「自由参数（JSON）」标题旁问号提示：说明 JSON 与「添加参数」的用法 */
const jsonHelpTip =
  '用法：以 JSON 数组整体编辑调用参数，数组每一项对应一个参数。' +
  '支持常量（字符串 / 数字 / 布尔）与公式对象，' +
  '公式写法如 {"__isExpression__": true, "content": "$event[0]"}，' +
  '可用 $event[0]、$formData、$prev 等上下文。' +
  '编辑后点击「应用 JSON」生效，并与上方参数表单双向同步；' +
  '也可以先用「添加参数」逐个追加，再在此处整体微调。';

watch(argsMode, (mode) => {
  if (mode === 'json') {
    jsonText.value = JSON.stringify(argsArray.value, null, 2);
    jsonError.value = '';
  }
});

/** 「自由参数（JSON）」使用与高级设置相同的折叠面板，保持视觉一致 */
const jsonPanels = computed<string[]>({
  get: () => (argsMode.value === 'json' ? ['json'] : []),
  set: (value) => {
    argsMode.value = value.includes('json') ? 'json' : 'form';
  },
});

function applyJsonArgs() {
  try {
    const parsed = JSON.parse(jsonText.value || '[]');
    if (!Array.isArray(parsed)) {
      jsonError.value = '参数必须是 JSON 数组，例如 ["选项1", true]';
      return;
    }
    jsonError.value = '';
    commitArgs(parsed);
  } catch (error) {
    jsonError.value = `JSON 解析失败：${(error as Error).message}`;
  }
}

/* ---------------- 自定义函数参数 ---------------- */

const isCustom = computed(() => props.actionItem.type === 'custom');
const isPublic = computed(() => props.actionItem.type === 'public');
const isEvent = computed(() => props.actionItem.type === 'event');
const isApi = computed(() => props.actionItem.type === 'api');
const isNavigate = computed(() => props.actionItem.type === 'navigate');

const customFuncs = computed(() =>
  Object.keys(pageManager.funcs.value).filter(
    (name) => typeof pageManager.funcs.value[name] === 'function',
  ),
);

const customFuncOptions = computed(() =>
  customFuncs.value.map((name) => ({ label: name, value: name })),
);

const customMethodName = computed({
  get: () => props.actionItem.methodName,
  set: (value: string) => emit('change', { methodName: value }),
});

const scriptOpen = ref(false);
const scriptPanelRef = ref<HTMLElement | null>(null);

/** 展开页面脚本时滚动到编辑器，避免在抽屉底部“看不见全屏/缩放工具栏” */
function toggleScriptEditor() {
  scriptOpen.value = !scriptOpen.value;
  if (scriptOpen.value) {
    nextTick(() => {
      scriptPanelRef.value?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  }
}

/** 重新解析页面脚本，刷新可选函数列表（脚本修改后无需重开抽屉） */
function refreshCustomFuncs() {
  pageManager.setMethods(pageSchema.script ?? '', true);
}

/* ---------------- 公共函数语义参数 ---------------- */

/** 公共方法的语义化参数标签；空数组表示使用通用「参数 1/2…」 */
const publicArgLabels = computed<string[]>(() => {
  switch (props.actionItem.methodName) {
    case 'emitEvent': {
      return ['事件名', '事件数据（可选）'];
    }
    case 'getVar': {
      return ['变量名'];
    }
    case 'setVar': {
      return ['变量名', '变量值'];
    }
    default: {
      return [];
    }
  }
});

/** 进入公共函数时按语义初始化参数结构 */
watch(
  () => [props.actionItem.type, props.actionItem.methodName],
  ([type, methodName]) => {
    if (type !== 'public') return;
    if (
      (methodName === 'emitEvent' || methodName === 'setVar') &&
      argsArray.value.length === 0
    ) {
      commitArgs(['', '']);
    } else if (methodName === 'getVar' && argsArray.value.length === 0) {
      commitArgs(['']);
    }
  },
  { immediate: true },
);

/* ---------------- 事件广播 ---------------- */

const eventName = computed({
  get: () => props.actionItem.methodName,
  set: (value: string) => emit('change', { methodName: value }),
});

const eventPayloadMode = ref<'constant' | 'expression'>('constant');
const eventPayloadText = ref('');

watch(
  () => props.actionItem.args,
  () => {
    const value = argsArray.value[0];
    if (isExpressionValue(value)) {
      eventPayloadMode.value = 'expression';
      eventPayloadText.value = value.content;
    } else if (value !== undefined) {
      eventPayloadMode.value = 'constant';
      eventPayloadText.value =
        typeof value === 'string' ? value : JSON.stringify(value);
    }
  },
  { immediate: true },
);

function commitEventPayload() {
  const text = eventPayloadText.value.trim();
  if (eventPayloadMode.value === 'expression') {
    commitArgs([text ? { __isExpression__: true, content: text } : undefined]);
    return;
  }
  if (!text) {
    commitArgs([]);
    return;
  }
  try {
    commitArgs([JSON.parse(text)]);
  } catch {
    commitArgs([text]);
  }
}

/* ---------------- API ---------------- */

const apiUrl = computed({
  get: () => props.actionItem.target ?? '',
  set: (value: string) => emit('change', { target: value }),
});

const apiMethod = computed({
  get: () => props.actionItem.methodName || 'get',
  set: (value: string) => emit('change', { methodName: value }),
});

const apiMethodOptions = [
  { label: 'GET 查询', value: 'get' },
  { label: 'POST 新增', value: 'post' },
  { label: 'PUT 更新', value: 'put' },
  { label: 'DELETE 删除', value: 'delete' },
  { label: 'PATCH 局部更新', value: 'patch' },
];

/* ---------------- 页面跳转 ---------------- */

const navigateUrl = computed({
  get: () => props.actionItem.target ?? '',
  set: (value: string) => emit('change', { target: value }),
});

const navigateTarget = computed({
  get: () => (argsArray.value[1] as string) || '_self',
  set: (value: string) => {
    const values = [...argsArray.value];
    values[1] = value;
    commitArgs(values);
  },
});

const navigateTargetOptions = [
  { label: '当前窗口', value: '_self' },
  { label: '新窗口', value: '_blank' },
];

/* ---------------- 表达式插入 ---------------- */

const exprVisible = ref(false);
const exprTargetIndex = ref(0);
const exprInitial = ref('');

/** 表达式插入器字段：事件参数 + 页面输入组件 + 管道上下文 */
const expressionFields = computed<ExpressionField[]>(() => {
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
    {
      field: '$prev',
      label: '上一步动作的返回值（管道）',
      type: 'event',
    },
    {
      field: '$formData',
      label: '当前表单数据对象',
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
  exprInitial.value = getExpressionContent(index);
  exprVisible.value = true;
}

function handleExpressionConfirm(value: ExpressionModel) {
  setArg(exprTargetIndex.value, value);
}

/* ---------------- 高级设置 ---------------- */

const advancedOpen = ref<string[]>([]);

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

const onErrorModel = computed({
  get: () => props.actionItem.onError ?? 'abort',
  set: (value: string) =>
    emit('change', { onError: value as ActionDraft['onError'] }),
});

const onErrorOptions = [
  { label: '失败即中断后续动作', value: 'abort' },
  { label: '失败后继续执行', value: 'continue' },
];

/* ---------------- 执行条件 ---------------- */

const CONDITION_OPERATORS = [
  { label: '等于', value: '==' },
  { label: '不等于', value: '!=' },
  { label: '包含', value: 'contains' },
  { label: '为空', value: 'empty' },
  { label: '不为空', value: 'notEmpty' },
  { label: '大于', value: '>' },
  { label: '大于等于', value: '>=' },
  { label: '小于', value: '<' },
  { label: '小于等于', value: '<=' },
];

const conditionFieldOptions = computed(() => {
  const inputSchemas = findSchemas(
    pageSchema.schemas,
    (item) => Boolean(item.input) && Boolean(item.field),
  ) as ComponentSchema[];
  return inputSchemas.map((item) => ({
    label: item.label ?? String(item.field),
    value: item.field as string,
  }));
});

const conditionEnabled = ref(false);
const conditionField = ref('');
const conditionOperator = ref('==');
const conditionValue = ref('');

watch(
  () => props.actionItem.condition,
  (condition) => {
    const first = condition?.items?.[0];
    if (!first || !('field' in first)) {
      conditionEnabled.value = false;
      conditionField.value = '';
      conditionValue.value = '';
      return;
    }
    conditionEnabled.value = true;
    conditionField.value = first.field;
    conditionOperator.value = String(first.operator);
    conditionValue.value =
      first.value === undefined || first.value === null
        ? ''
        : String(first.value);
  },
  { immediate: true },
);

function commitCondition() {
  if (!conditionEnabled.value || !conditionField.value) {
    emit('change', { condition: null });
    return;
  }
  const item: any = {
    field: conditionField.value,
    operator: conditionOperator.value,
  };
  if (!['empty', 'notEmpty'].includes(conditionOperator.value)) {
    item.value = conditionValue.value;
  }
  emit('change', { condition: { logic: 'AND', items: [item] } });
}

watch(
  [conditionEnabled, conditionField, conditionOperator, conditionValue],
  () => commitCondition(),
);
</script>

<template>
  <div class="aigen-step-args">
    <!-- 事件广播 -->
    <div v-if="isEvent" class="aigen-step-args-body">
      <div class="aigen-step-args-row">
        <span class="aigen-step-args-row-label">事件名</span>
        <div class="aigen-step-args-row-input">
          <input
            v-model="eventName"
            type="text"
            class="aigen-step-args-input"
            placeholder="如：order:created（供 emitEvent / 脚本订阅）"
          />
        </div>
      </div>
      <div class="aigen-step-args-row aigen-step-args-row--top">
        <span class="aigen-step-args-row-label">事件数据</span>
        <div class="aigen-step-args-row-input">
          <div class="aigen-step-args-mode">
            <label class="aigen-radio">
              <input v-model="eventPayloadMode" type="radio" value="constant" />
              常量 / JSON
            </label>
            <label class="aigen-radio">
              <input
                v-model="eventPayloadMode"
                type="radio"
                value="expression"
              />
              公式
            </label>
            <button
              type="button"
              class="aigen-step-args-fx"
              title="使用公式"
              @click="openExpression(0)"
            >
              ƒx
            </button>
          </div>
          <textarea
            v-model="eventPayloadText"
            class="aigen-step-args-textarea"
            rows="3"
            :placeholder="
              eventPayloadMode === 'expression'
                ? '如：$event[0] 或 $formData'
                : '可留空；支持 JSON，如 {&quot;id&quot;: 1}'
            "
            @blur="commitEventPayload"
          ></textarea>
        </div>
      </div>
      <p class="aigen-step-args-tip">
        事件广播后，可通过页面的「公共函数
        emitEvent」或脚本订阅；事件名自定义，不受预置列表限制。
      </p>
    </div>

    <!-- API 请求 -->
    <div v-else-if="isApi" class="aigen-step-args-body">
      <div class="aigen-step-args-row">
        <span class="aigen-step-args-row-label">请求地址</span>
        <div class="aigen-step-args-row-input">
          <input
            v-model="apiUrl"
            type="text"
            class="aigen-step-args-input"
            placeholder="https://api.example.com/users"
          />
        </div>
      </div>
      <div class="aigen-step-args-row">
        <span class="aigen-step-args-row-label">请求方法</span>
        <div class="aigen-step-args-row-input">
          <component
            :is="SelectComponent"
            v-model:[bindModel]="apiMethod"
            :options="apiMethodOptions"
            style="width: 100%"
          />
        </div>
      </div>
      <div class="aigen-step-args-row aigen-step-args-row--top">
        <span class="aigen-step-args-row-label">请求数据</span>
        <div class="aigen-step-args-row-input">
          <div class="aigen-step-args-mode">
            <span class="aigen-step-args-mode-text">JSON 或公式</span>
            <button
              type="button"
              class="aigen-step-args-fx"
              title="使用公式（如 $prev、$formData）"
              @click="openExpression(0)"
            >
              ƒx
            </button>
          </div>
          <textarea
            v-model="eventPayloadText"
            class="aigen-step-args-textarea"
            rows="4"
            placeholder="可留空；GET 时作为查询参数，其余作为 JSON Body"
            @blur="commitEventPayload"
          ></textarea>
        </div>
      </div>
      <p class="aigen-step-args-tip">
        接口返回值会自动进入管道上下文：下一步动作可用 $prev 引用。
      </p>
    </div>

    <!-- 页面跳转 -->
    <div v-else-if="isNavigate" class="aigen-step-args-body">
      <div class="aigen-step-args-row">
        <span class="aigen-step-args-row-label">跳转地址</span>
        <div class="aigen-step-args-row-input">
          <input
            v-model="navigateUrl"
            type="text"
            class="aigen-step-args-input"
            placeholder="https://… 或 /path"
          />
        </div>
      </div>
      <div class="aigen-step-args-row">
        <span class="aigen-step-args-row-label">打开方式</span>
        <div class="aigen-step-args-row-input">
          <component
            :is="SelectComponent"
            v-model:[bindModel]="navigateTarget"
            :options="navigateTargetOptions"
            style="width: 100%"
          />
        </div>
      </div>
    </div>

    <!-- 操作组件 -->
    <div
      v-else-if="isComponent && componentSchema"
      class="aigen-step-args-body"
    >
      <div v-if="actionItem.methodName" class="aigen-step-args-head">
        「{{ targetLabel }}」→ {{ methodLabel }}
      </div>

      <!-- setAttr：属性下拉 + 值输入框 -->
      <div v-if="isSetAttr" class="aigen-step-args-setattr">
        <div class="aigen-step-args-row">
          <span class="aigen-step-args-row-label">选择属性</span>
          <div class="aigen-step-args-row-input">
            <component
              :is="SelectComponent"
              v-model:[bindModel]="selectedAttr"
              :options="attrOptions"
              placeholder="请选择属性"
              style="width: 100%"
            />
          </div>
        </div>
        <p v-if="selectedAttr === 'defaultValue'" class="aigen-step-args-tip">
          默认值属于初始化属性：动作触发时会立即把该值应用到目标元素的当前值。
        </p>
        <div v-if="selectedAttrSchema" class="aigen-step-args-row">
          <span class="aigen-step-args-row-label">属性值</span>
          <div class="aigen-step-args-row-input">
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
              v-else
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
            ƒx
          </button>
        </div>
        <div v-else class="aigen-step-args-empty">请先选择属性</div>
      </div>

      <!-- 普通参数 -->
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
            ƒx
          </button>
        </div>
      </div>
      <div
        v-else-if="!argsMode || argsArray.length === 0"
        class="aigen-step-args-empty"
      >
        该方法没有预置参数；如需传参，切换到「自由参数」或添加参数。
      </div>

      <!-- 自由追加参数 -->
      <div v-if="!isSetAttr" class="aigen-step-args-list">
        <div
          v-for="(_, index) in argsArray.slice(actionArgsConfigs.length)"
          :key="`free-${index}`"
          class="aigen-step-args-row"
        >
          <span class="aigen-step-args-row-label">
            参数 {{ actionArgsConfigs.length + index + 1 }}
          </span>
          <div class="aigen-step-args-row-input">
            <div
              v-if="isExprValue(actionArgsConfigs.length + index)"
              class="aigen-step-args-expr-chip"
            >
              <span
                class="aigen-step-args-expr-chip-code"
                :title="getExpressionContent(actionArgsConfigs.length + index)"
              >
                {{ getExpressionContent(actionArgsConfigs.length + index) }}
              </span>
              <button
                type="button"
                class="aigen-step-args-expr-chip-btn"
                @click="openExpression(actionArgsConfigs.length + index)"
              >
                编辑
              </button>
              <button
                type="button"
                class="aigen-step-args-expr-chip-btn"
                @click="clearExpression(actionArgsConfigs.length + index)"
              >
                改为直接值
              </button>
            </div>
            <input
              v-else
              type="text"
              class="aigen-step-args-input"
              :value="argsArray[actionArgsConfigs.length + index]"
              placeholder="参数值"
              @input="
                setArg(
                  actionArgsConfigs.length + index,
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
          </div>
          <button
            type="button"
            class="aigen-step-args-fx"
            title="使用表达式"
            @click="openExpression(actionArgsConfigs.length + index)"
          >
            ƒx
          </button>
          <button
            type="button"
            class="aigen-step-args-remove"
            title="删除参数"
            @click="removeArg(actionArgsConfigs.length + index)"
          >
            ×
          </button>
        </div>
      </div>
      <button
        type="button"
        class="aigen-button ghost primary aigen-step-args-add"
        @click="addArg"
      >
        <AigenIcon name="icon--aigen--add-rounded" />
        添加参数
      </button>
    </div>

    <!-- 自定义函数 -->
    <div v-else-if="isCustom" class="aigen-step-args-body">
      <div class="aigen-step-args-card">
        <div class="aigen-step-args-card__head">
          <span class="aigen-step-args-card__title">
            <AigenIcon name="icon--behavior--edit" />
            函数配置
          </span>
          <span class="aigen-step-args-card__hint">
            从页面脚本 defineExpose 的函数中选择
          </span>
        </div>

        <div class="aigen-step-args-row">
          <span class="aigen-step-args-row-label">自定义函数</span>
          <div class="aigen-step-args-row-input aigen-step-args-select-action">
            <component
              :is="SelectComponent"
              v-model:[bindModel]="customMethodName"
              :options="customFuncOptions"
              placeholder="请选择函数"
              style="width: 100%"
            />
            <button
              type="button"
              class="aigen-button aigen-step-args-icon-btn"
              title="重新解析页面脚本，刷新函数列表"
              aria-label="刷新函数列表"
              @click="refreshCustomFuncs"
            >
              <AigenIcon name="icon--behavior--reload" />
            </button>
          </div>
        </div>
        <p v-if="!customFuncs.length" class="aigen-step-args-tip">
          页面脚本中暂无可调用函数，请展开下方「页面脚本」并通过 defineExpose
          暴露函数。
        </p>

        <!-- 自由参数行 -->
        <div
          v-for="(_, index) in argsArray"
          :key="`custom-${index}`"
          class="aigen-step-args-row"
        >
          <span class="aigen-step-args-row-label">参数 {{ index + 1 }}</span>
          <div class="aigen-step-args-row-input">
            <div v-if="isExprValue(index)" class="aigen-step-args-expr-chip">
              <span
                class="aigen-step-args-expr-chip-code"
                :title="getExpressionContent(index)"
              >
                {{ getExpressionContent(index) }}
              </span>
              <button
                type="button"
                class="aigen-step-args-expr-chip-btn"
                @click="openExpression(index)"
              >
                编辑
              </button>
              <button
                type="button"
                class="aigen-step-args-expr-chip-btn"
                @click="clearExpression(index)"
              >
                改为直接值
              </button>
            </div>
            <input
              v-else
              type="text"
              class="aigen-step-args-input"
              :value="argsArray[index]"
              placeholder="参数值（可选公式）"
              @input="setArg(index, ($event.target as HTMLInputElement).value)"
            />
          </div>
          <button
            type="button"
            class="aigen-step-args-fx"
            title="使用表达式"
            @click="openExpression(index)"
          >
            ƒx
          </button>
          <button
            type="button"
            class="aigen-step-args-remove"
            title="删除参数"
            @click="removeArg(index)"
          >
            ×
          </button>
        </div>
        <button
          type="button"
          class="aigen-button ghost primary aigen-step-args-add"
          @click="addArg"
        >
          <AigenIcon name="icon--aigen--add-rounded" />
          添加调用参数
        </button>
        <p class="aigen-step-args-tip">
          参数按顺序传入，可使用 ƒx 引用事件参数、表单字段或上一步返回值。
        </p>
      </div>

      <!-- 页面脚本：独立卡片，编辑器自带全屏 / 字号缩放工具栏 -->
      <div ref="scriptPanelRef" class="aigen-step-args-script-panel">
        <div class="aigen-step-args-script-head">
          <span class="aigen-step-args-script-head__title">
            <AigenIcon name="icon--behavior--file-text" />
            页面脚本
          </span>
          <span class="aigen-step-args-script-head__hint">改动影响全页</span>
          <button
            type="button"
            class="aigen-button aigen-step-args-script-toggle-btn"
            @click="toggleScriptEditor"
          >
            <AigenIcon
              :name="
                scriptOpen ? 'icon--behavior--arrowup' : 'icon--behavior--edit'
              "
            />
            {{ scriptOpen ? '收起脚本' : '编辑页面脚本' }}
          </button>
        </div>
        <div v-if="scriptOpen" class="aigen-step-args-script">
          <aigenScriptEdit :show-header="false" />
        </div>
      </div>
    </div>

    <!-- 公共函数 -->
    <div v-else-if="isPublic" class="aigen-step-args-body">
      <div
        v-for="(label, index) in publicArgLabels.length
          ? publicArgLabels
          : argsArray.map((_, i) => `参数 ${i + 1}`)"
        :key="`public-${index}`"
        class="aigen-step-args-row"
      >
        <span class="aigen-step-args-row-label">{{ label }}</span>
        <div class="aigen-step-args-row-input">
          <div v-if="isExprValue(index)" class="aigen-step-args-expr-chip">
            <span
              class="aigen-step-args-expr-chip-code"
              :title="getExpressionContent(index)"
            >
              {{ getExpressionContent(index) }}
            </span>
            <button
              type="button"
              class="aigen-step-args-expr-chip-btn"
              @click="openExpression(index)"
            >
              编辑
            </button>
            <button
              type="button"
              class="aigen-step-args-expr-chip-btn"
              @click="clearExpression(index)"
            >
              改为直接值
            </button>
          </div>
          <input
            v-else
            type="text"
            class="aigen-step-args-input"
            :value="argsArray[index]"
            placeholder="参数值（可选公式）"
            @input="setArg(index, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <button
          type="button"
          class="aigen-step-args-fx"
          title="使用表达式"
          @click="openExpression(index)"
        >
          ƒx
        </button>
        <button
          v-if="!publicArgLabels.length || index >= publicArgLabels.length"
          type="button"
          class="aigen-step-args-remove"
          title="删除参数"
          @click="removeArg(index)"
        >
          ×
        </button>
      </div>
      <button
        type="button"
        class="aigen-button ghost primary aigen-step-args-add"
        @click="addArg"
      >
        <AigenIcon name="icon--aigen--add-rounded" />
        添加参数
      </button>
      <p class="aigen-step-args-tip">
        参数会按顺序传给公共函数；公共函数由插件注册，可在插件中扩展。
      </p>
    </div>

    <!-- 自由参数（JSON）模式：与高级设置共用折叠面板样式 -->
    <AigenCollapse v-model="jsonPanels">
      <AigenCollapsePanel name="json">
        <template #header>
          <span class="aigen-step-args-json-head">
            <span class="aigen-step-args-json-title">自由参数（JSON）</span>
            <AigenTooltip
              trigger="hover"
              placement="top"
              :mouse-enter-delay="200"
              :content="jsonHelpTip"
            >
              <span
                class="aigen-step-args-json-help"
                aria-label="自由参数（JSON）使用说明"
                @click.stop
              >
                <AigenIcon name="icon--aigen--help-outline-rounded" />
              </span>
            </AigenTooltip>
          </span>
        </template>
        <div class="aigen-step-args-json-body">
          <textarea
            v-model="jsonText"
            class="aigen-step-args-textarea"
            rows="6"
            spellcheck="false"
            :placeholder="jsonPlaceholder"
            @blur="applyJsonArgs"
          ></textarea>
          <div class="aigen-step-args-json-foot">
            <span v-if="jsonError" class="aigen-step-args-error">{{
              jsonError
            }}</span>
            <span v-else class="aigen-step-args-tip">
              支持任意常量与表达式对象，不受组件元数据限制。
            </span>
            <button
              type="button"
              class="aigen-button small"
              @click="applyJsonArgs"
            >
              应用 JSON
            </button>
          </div>
        </div>
      </AigenCollapsePanel>
    </AigenCollapse>

    <!-- 高级设置 -->
    <AigenCollapse v-model="advancedOpen">
      <AigenCollapsePanel name="advanced" title="高级设置（可选）">
        <div class="aigen-step-args-advanced-body">
          <div class="aigen-step-args-row">
            <span class="aigen-step-args-row-label">动作名称</span>
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
          </div>
          <div class="aigen-step-args-row">
            <span class="aigen-step-args-row-label">失败策略</span>
            <div class="aigen-step-args-row-input">
              <component
                :is="SelectComponent"
                v-model:[bindModel]="onErrorModel"
                :options="onErrorOptions"
                style="width: 100%"
              />
            </div>
          </div>

          <!-- 执行条件 -->
          <div class="aigen-step-args-row aigen-step-args-row--top">
            <span class="aigen-step-args-row-label">执行条件</span>
            <div class="aigen-step-args-row-input">
              <label class="aigen-check">
                <input v-model="conditionEnabled" type="checkbox" />
                满足条件时才执行本动作
              </label>
              <div v-if="conditionEnabled" class="aigen-step-args-condition">
                <component
                  :is="SelectComponent"
                  v-model:[bindModel]="conditionField"
                  :options="conditionFieldOptions"
                  placeholder="判断字段"
                  style="width: 100%"
                />
                <div class="aigen-step-args-condition__row">
                  <component
                    :is="SelectComponent"
                    v-model:[bindModel]="conditionOperator"
                    :options="CONDITION_OPERATORS"
                    style="width: 100%"
                  />
                  <input
                    v-model="conditionValue"
                    type="text"
                    class="aigen-step-args-input"
                    placeholder="比较值"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </AigenCollapsePanel>
    </AigenCollapse>

    <ExpressionInsert
      v-model:visible="exprVisible"
      :fields="expressionFields"
      :initial-content="exprInitial"
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

/* 自定义函数配置卡片 */
.aigen-step-args-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  background: var(--aigen-background);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius);
}

.aigen-step-args-card__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--aigen-border);
}

.aigen-step-args-card__title {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  font-size: var(--aigen-text-sm);
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-step-args-card__title .iconfont {
  color: var(--aigen-primary);
}

.aigen-step-args-card__hint {
  overflow: hidden;
  font-size: 11px;
  color: var(--aigen-text-helper);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-step-args-select-action {
  display: flex;
  align-items: center;
  gap: 6px;
}

.aigen-step-args-select-action > :first-child {
  flex: 1;
  min-width: 0;
}

.aigen-step-args-icon-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 15px;
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
  gap: 8px;
}

.aigen-step-args-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aigen-step-args-row--top {
  align-items: flex-start;
}

.aigen-step-args-row-label {
  flex-shrink: 0;
  width: 78px;
  overflow: hidden;
  font-size: 13px;
  color: var(--aigen-text-main);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-step-args-row--top .aigen-step-args-row-label {
  padding-top: 5px;
}

.aigen-step-args-row-input {
  flex: 1;
  min-width: 0;
}

.aigen-step-args-setattr {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.aigen-step-args-expr-chip {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 32px;
  padding: 0 8px;
  color: var(--aigen-primary);
  background-color: var(--aigen-primary-faded);
  border: 1px dashed var(--aigen-primary);
  border-radius: var(--aigen-radius);
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
  font-size: 12px;
  color: inherit;
  cursor: pointer;
  background-color: transparent;
  border: none;

  &:hover {
    text-decoration: underline;
  }
}

.aigen-step-args-fx {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 30px;
  height: 32px;
  padding: 0 8px;
  font-family: monospace;
  font-size: 12px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: var(--aigen-background);
  border: 1px solid var(--aigen-border);
  border-radius: calc(var(--aigen-radius) - 2px);
  transition: all 0.2s ease-out-quart;
}

.aigen-step-args-fx:hover {
  color: var(--aigen-primary);
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
}

.aigen-step-args-remove {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  font-size: 14px;
  line-height: 1;
  color: var(--aigen-text-helper);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 4px;
}

.aigen-step-args-remove:hover {
  color: var(--aigen-destructive);
  background: var(--aigen-muted);
}

.aigen-step-args-add {
  align-self: flex-start;
  gap: 4px;
  height: 32px;
  font-size: var(--aigen-text-sm);
}

.aigen-step-args-input,
.aigen-step-args-textarea {
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

.aigen-step-args-textarea {
  height: auto;
  min-height: 56px;
  padding: 6px 8px;
  font-family: inherit;
  resize: vertical;
}

.aigen-step-args-input:focus,
.aigen-step-args-textarea:focus {
  border-color: var(--aigen-primary);
}

.aigen-step-args-input--num {
  flex: 1;
  width: auto;
  min-width: 80px;
}

.aigen-step-args-tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--aigen-text-helper);
}

.aigen-step-args-empty {
  padding: 12px 0;
  font-size: 13px;
  color: var(--aigen-text-helper);
  text-align: center;
}

.aigen-step-args-script-panel {
  overflow: hidden;
  background: var(--aigen-background);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius);
}

.aigen-step-args-script-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--aigen-secondary);
}

.aigen-step-args-script-head__title {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  font-size: var(--aigen-text-sm);
  font-weight: 500;
  color: var(--aigen-text-main);
}

.aigen-step-args-script-head__title .iconfont {
  color: var(--aigen-primary);
}

.aigen-step-args-script-head__hint {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  color: var(--aigen-text-helper);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-step-args-script-head .aigen-button {
  flex-shrink: 0;
  gap: 4px;
  font-size: var(--aigen-text-sm);
}

.aigen-step-args-script {
  height: 360px;
  overflow: hidden;
  border-top: 1px solid var(--aigen-border);
}

.aigen-step-args-advanced-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.aigen-step-args-mode {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.aigen-step-args-mode-text {
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-radio {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
}

.aigen-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
}

.aigen-step-args-condition {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.aigen-step-args-condition__row {
  display: flex;
  gap: 6px;
}

.aigen-step-args-condition__row > * {
  flex: 1;
  min-width: 0;
}

/* 自由参数 JSON */
.aigen-step-args-json-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* 与折叠面板默认标题保持一致的字号字重 */
.aigen-step-args-json-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--aigen-text-main);
}

.aigen-step-args-json-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--aigen-text-helper);
  cursor: help;
  transition: color 0.2s ease-out-quart;

  &:hover {
    color: var(--aigen-primary);
  }
}

.aigen-step-args-json-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.aigen-step-args-json-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.aigen-step-args-error {
  font-size: 12px;
  color: var(--aigen-destructive);
}
</style>
