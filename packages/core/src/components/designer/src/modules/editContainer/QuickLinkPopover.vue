<script lang="ts" setup>
import type { ActionsModel, ComponentSchema } from '@aigen-designer/types';
import type {
  RuleBehavior,
  RuleDraft,
  RuleOperator,
} from '@aigen-designer/utils';

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import { AigenIcon, useBindModel } from '@aigen-designer/base-ui';
import { useDesignerContext, useLinkMode } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import {
  buildReactiveRule,
  getBehaviorLabel,
  RULE_BEHAVIOR_OPTIONS,
  setValueByPath,
  UNARY_OPERATORS,
  upsertReactiveRule,
} from '@aigen-designer/utils';

defineOptions({
  name: 'QuickLinkPopover',
});

const linkMode = useLinkMode();
const designer = useDesignerContext();
const revoke = designer.revoke;

const popoverRef = ref<HTMLDivElement | null>(null);

/** UI 框架标准 Select 与 Input 组件适配 */
const SelectComponent = pluginManager.component.get('select');
const InputComponent = pluginManager.component.get('input');
const { bindModel: selectBindModel } = useBindModel('select');
const { bindModel: inputBindModel } = useBindModel('input');

/** 动作配置抽屉（pluginManager 注册的异步组件） */
const AigenActionDrawer = pluginManager.component.get('aigenActionDrawer');
interface AigenActionDrawerExpose {
  handleOpen: () => void;
}
const drawerRef = ref<AigenActionDrawerExpose | null>(null);
const pendingSource = ref<ComponentSchema | null>(null);

/** 源+目标都选齐后显示气泡 */
const visible = computed(() =>
  Boolean(linkMode.source.value && linkMode.target.value),
);

const sourceSchema = computed(() => linkMode.source.value);
const targetSchema = computed(() => linkMode.target.value);

const sourceLabel = computed(
  () =>
    sourceSchema.value?.label ||
    sourceSchema.value?.field ||
    sourceSchema.value?.type ||
    '',
);

const targetLabel = computed(
  () =>
    targetSchema.value?.label ||
    targetSchema.value?.field ||
    targetSchema.value?.type ||
    '',
);

/** 当前激活的模式页签：rule 声明式联动规则 | method 命令式方法动作 */
const activeMode = ref<'method' | 'rule'>('rule');

// 选定源组件时，根据组件性质自动设置合适的默认模式
watch(
  () => sourceSchema.value?.type,
  (type) => {
    activeMode.value = type === 'button' ? 'method' : 'rule';
  },
  { immediate: true },
);

/** 源组件的可选项列表（如 select、radio、switch） */
const sourceOptions = computed(() => {
  const source = sourceSchema.value;
  if (!source) return [];
  const options = source.componentProps?.options;
  if (Array.isArray(options)) {
    return options.map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { label: String(opt), value: opt };
      }
      return {
        label: String(opt.label ?? opt.value),
        value: opt.value ?? opt.label,
      };
    });
  }
  if (source.type === 'switch' || source.type === 'checkbox') {
    return [
      { label: '开启 / 选中 (true)', value: true },
      { label: '关闭 / 未选 (false)', value: false },
    ];
  }
  return [];
});

/** 目标组件暴露的方法列表 */
interface MethodOption {
  describe: string;
  type: string;
}

const targetMethods = computed<MethodOption[]>(() => {
  const target = targetSchema.value;
  if (!target) return [];
  const config = pluginManager.component.getConfigByType(target.type);
  const actions = config?.config?.action;
  if (Array.isArray(actions) && actions.length > 0) {
    return actions.map((item) => ({
      describe: item.describe || item.type,
      type: item.type,
    }));
  }
  if (target.type === 'form') {
    return [
      { describe: '校验表单', type: 'validate' },
      { describe: '重置表单', type: 'reset' },
      { describe: '获取数据', type: 'getData' },
    ];
  }
  if (target.input) {
    return [
      { describe: '重置数据', type: 'reset' },
      { describe: '获取焦点', type: 'focus' },
    ];
  }
  if (['dialog', 'drawer', 'modal'].includes(target.type)) {
    return [
      { describe: '打开', type: 'open' },
      { describe: '关闭', type: 'close' },
    ];
  }
  return [];
});

/** 智能快捷预设 (Smart Presets) */
interface SmartPreset {
  behavior?: RuleBehavior;
  conditionValue?: any;
  icon?: string;
  label: string;
  methodName?: string;
  operator?: RuleOperator;
  type: 'method' | 'rule';
}

const smartPresets = computed<SmartPreset[]>(() => {
  const source = sourceSchema.value;
  const target = targetSchema.value;
  if (!source || !target) return [];

  const presets: SmartPreset[] = [];

  // 1. Switch / Checkbox
  if (source.type === 'switch' || source.type === 'checkbox') {
    presets.push(
      {
        behavior: 'SHOW',
        conditionValue: true,
        icon: 'icon--behavior--eye',
        label: '开启时显示',
        operator: '==',
        type: 'rule',
      },
      {
        behavior: 'HIDE',
        conditionValue: true,
        icon: 'icon--aigen--visibility-off-outline-rounded',
        label: '开启时隐藏',
        operator: '==',
        type: 'rule',
      },
      {
        behavior: 'ENABLE',
        conditionValue: true,
        icon: 'icon--aigen--lock-open-outline',
        label: '开启时启用',
        operator: '==',
        type: 'rule',
      },
      {
        behavior: 'DISABLE',
        conditionValue: true,
        icon: 'icon--aigen--lock-outline',
        label: '开启时禁用',
        operator: '==',
        type: 'rule',
      },
    );
    return presets;
  }

  // 2. Select / Radio
  if (
    ['radio', 'select'].includes(source.type) &&
    sourceOptions.value.length > 0
  ) {
    const topOptions = sourceOptions.value.slice(0, 2);
    for (const opt of topOptions) {
      presets.push(
        {
          behavior: 'SHOW',
          conditionValue: opt.value,
          icon: 'icon--behavior--eye',
          label: `选「${opt.label}」时显示`,
          operator: '==',
          type: 'rule',
        },
        {
          behavior: 'REQUIRED',
          conditionValue: opt.value,
          icon: 'icon--behavior--warning-circle',
          label: `选「${opt.label}」时必填`,
          operator: '==',
          type: 'rule',
        },
      );
    }
    return presets;
  }

  // 3. Button
  if (source.type === 'button') {
    if (target.type === 'form') {
      presets.push(
        {
          icon: 'icon--behavior--check',
          label: '点击校验表单',
          methodName: 'validate',
          type: 'method',
        },
        {
          icon: 'icon--behavior--clear',
          label: '点击重置表单',
          methodName: 'reset',
          type: 'method',
        },
      );
    } else if (['dialog', 'drawer', 'modal'].includes(target.type)) {
      presets.push({
        icon: 'icon--behavior--eye',
        label: '点击打开弹窗',
        methodName: 'open',
        type: 'method',
      });
    } else if (target.input) {
      presets.push({
        icon: 'icon--behavior--clear',
        label: '点击重置目标值',
        methodName: 'reset',
        type: 'method',
      });
    }
    return presets;
  }

  // 4. 通用输入联动
  if (source.input && target.input) {
    presets.push({
      behavior: 'CLEAR',
      conditionValue: '',
      icon: 'icon--behavior--clear',
      label: '源变动时清空目标',
      operator: 'notEmpty',
      type: 'rule',
    });
  }

  return presets;
});

/** 自定义联动规则配置状态 */
const selectedOperator = ref<RuleOperator>('==');
const customConditionValue = ref<any>('');
const selectedBehavior = ref<RuleBehavior>('SHOW');

/** 快捷选项：条件运算符 */
const OPERATORS: Array<{ label: string; value: RuleOperator }> = [
  { label: '始终 (无条件)', value: 'always' },
  { label: '等于 (==)', value: '==' },
  { label: '不等于 (!=)', value: '!=' },
  { label: '不为空', value: 'notEmpty' },
  { label: '为空', value: 'empty' },
];

const EVENT_OPTIONS = [
  { label: '点击 (click)', value: 'click' },
  { label: '改变 (change)', value: 'change' },
];

const targetMethodOptions = computed(() => {
  return targetMethods.value.map((m) => ({
    label: `${m.describe} (${m.type})`,
    value: m.type,
  }));
});

/** 自定义动作配置状态 */
const selectedMethod = ref<string>('');
const selectedEvent = ref<string>('click');

watch(
  targetMethods,
  (methods) => {
    selectedMethod.value = methods.length > 0 ? methods[0].type : '';
  },
  { immediate: true },
);

const popoverPlacement = ref<'bottom' | 'top'>('bottom');

/** 定位：锚定在目标元素旁，优先贴在目标下方中央，绝不遮挡左右侧边栏 */
function updatePosition() {
  const target = linkMode.target.value;
  const element = popoverRef.value;
  if (!target?.id || !element) return;
  const anchor = document.querySelector(
    `[data-aigen-id="${target.id}"]`,
  ) as HTMLElement | null;
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const popRect = element.getBoundingClientRect();

  // 1. 水平居中对齐目标元素
  let left = rect.left + (rect.width - popRect.width) / 2;

  // 2. 垂直优先置于目标下方，空间不足则置于上方
  let top = rect.bottom + 10;
  popoverPlacement.value = 'bottom';
  if (top + popRect.height > window.innerHeight - 16) {
    const topAbove = rect.top - popRect.height - 10;
    if (topAbove >= 60) {
      top = topAbove;
      popoverPlacement.value = 'top';
    } else {
      top = Math.max(60, window.innerHeight - popRect.height - 16);
    }
  }

  // 3. 边界钳制：严格限制在左右侧边栏之间（画布可视区），绝不覆盖组件库或属性面板
  const leftSidebar = document.querySelector(
    '.aigen-layout-left, .aigen-activity-bar, .aigen-panel-container',
  ) as HTMLElement | null;
  const rightSidebar = document.querySelector(
    '.aigen-layout-right, .aigen-right-sidebar',
  ) as HTMLElement | null;

  const minLeft =
    (leftSidebar ? leftSidebar.getBoundingClientRect().right : 270) + 16;
  const maxLeft =
    (rightSidebar
      ? rightSidebar.getBoundingClientRect().left
      : window.innerWidth - 330) -
    popRect.width -
    16;

  left =
    maxLeft >= minLeft
      ? Math.max(minLeft, Math.min(left, maxLeft))
      : Math.max(16, Math.min(left, window.innerWidth - popRect.width - 16));

  element.style.left = `${Math.round(left)}px`;
  element.style.top = `${Math.round(top)}px`;
}

watch(
  () => [visible.value, linkMode.target.value?.id],
  () => {
    if (visible.value) {
      nextTick(updatePosition);
    }
  },
);

function handleViewportChange() {
  if (visible.value) {
    updatePosition();
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleViewportChange, true);
  window.addEventListener('resize', handleViewportChange);
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleViewportChange, true);
  window.removeEventListener('resize', handleViewportChange);
});

/** 写入声明式响应式规则 (ReactiveRule) */
function applyReactiveRule(
  behavior: RuleBehavior,
  operator: RuleOperator = '==',
  conditionValue: any = undefined,
) {
  const source = sourceSchema.value;
  const target = targetSchema.value;
  if (!source || !target) return;

  const sourceField = (source.field as string) || (source.id as string);
  const targetId = (target.id as string) || (target.field as string);

  const draft: RuleDraft = {
    behavior,
    conditionValue: UNARY_OPERATORS.has(operator) ? undefined : conditionValue,
    constantValue: '',
    expressionValue: '',
    operator,
    sourceField,
    targetId,
    valueMode: 'constant',
  };

  const rule = buildReactiveRule(draft);
  if (!rule) {
    pluginManager.global.$message?.error('创建联动规则失败');
    return;
  }

  upsertReactiveRule(designer.pageSchema, rule);
  revoke.push('建立字段联动');
  pluginManager.global.$message?.success(
    `已建立「${sourceLabel.value}」➔「${targetLabel.value}」${getBehaviorLabel(behavior)}规则`,
  );
  linkMode.exit();
}

/** 写入命令式方法动作 (ActionsModel) */
function applyMethodAction(methodName: string, eventName?: string) {
  const source = sourceSchema.value;
  const target = targetSchema.value;
  if (!source || !target || !methodName) return;

  const event = eventName || (source.type === 'button' ? 'click' : 'change');
  const action: ActionsModel = {
    args: '[]',
    componentId: target.id ?? '',
    enabled: true,
    methodName,
    type: 'component',
  };

  const on = (source.on ?? {}) as Record<string, ActionsModel[]>;
  const list = Array.isArray(on[event]) ? [...on[event]] : [];
  list.push(action);
  setValueByPath(source, 'on', { ...on, [event]: list });
  revoke.push('建立动作关联');
  pluginManager.global.$message?.success(
    `已关联「${sourceLabel.value}」${event} ➔「${targetLabel.value}」${methodName}`,
  );
  linkMode.exit();
}

/** 点击智能预设胶囊 */
function handlePresetClick(preset: SmartPreset) {
  if (preset.type === 'rule' && preset.behavior) {
    applyReactiveRule(
      preset.behavior,
      preset.operator ?? '==',
      preset.conditionValue,
    );
  } else if (preset.type === 'method' && preset.methodName) {
    applyMethodAction(preset.methodName);
  }
}

/** 提交自定义联动规则表单 */
function handleSaveCustomRule() {
  applyReactiveRule(
    selectedBehavior.value,
    selectedOperator.value,
    customConditionValue.value,
  );
}

/** 提交自定义方法调用表单 */
function handleSaveCustomMethod() {
  if (!selectedMethod.value) {
    pluginManager.global.$message?.warning('请选择要调用的方法');
    return;
  }
  applyMethodAction(selectedMethod.value, selectedEvent.value);
}

/** 直达右侧「行为」面板高级配置 */
function handleGoToBehaviorPanel() {
  const source = sourceSchema.value;
  if (source) {
    designer.setSelectedNode(source);
  }
  pluginManager.panel.setActiveRightSidebar?.('event_view');
  linkMode.exit();
}

/** 自定义动作：打开动作配置抽屉 */
function handleOpenDrawer() {
  const source = sourceSchema.value;
  if (!source) return;
  pendingSource.value = source;
  drawerRef.value?.handleOpen();
  linkMode.exit();
}

function handleDrawerAdd(action: ActionsModel) {
  if (pendingSource.value) {
    const on = (pendingSource.value.on ?? {}) as Record<string, ActionsModel[]>;
    const list = Array.isArray(on.change) ? [...on.change] : [];
    list.push(action);
    setValueByPath(pendingSource.value, 'on', { ...on, change: list });
    revoke.push('属性编辑');
    pendingSource.value = null;
  }
}

function handleCancel() {
  pendingSource.value = null;
  linkMode.exit();
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="popoverRef"
      class="aigen-quick-link-popover"
      :class="`placement-${popoverPlacement}`"
    >
      <!-- 头部：路径指引 -->
      <div class="aigen-popover-header">
        <div class="aigen-popover-title">
          <AigenIcon
            name="icon--aigen--account-tree-outline-rounded"
            class="mr-1.5 text-[15px] text-[#1677ff]"
          />
          <span>建立关联</span>
        </div>
        <button
          type="button"
          class="aigen-popover-close-btn flex items-center justify-center"
          title="关闭 (Esc)"
          @click="handleCancel"
        >
          <AigenIcon name="icon--behavior--close" class="text-[12px]" />
        </button>
      </div>

      <!-- 节点流向卡片 -->
      <div class="aigen-node-flow-bar">
        <span
          class="aigen-node-pill aigen-node-pill--source flex items-center"
          :title="sourceSchema?.id"
        >
          <AigenIcon
            name="icon--behavior--thunderbolt"
            class="mr-1 text-[11px] text-[#1677ff]"
          />
          <span>源: {{ sourceLabel }}</span>
        </span>
        <div class="aigen-node-flow-arrow flex items-center justify-center">
          <AigenIcon
            name="icon--aigen--arrow-forward-ios-rounded"
            class="aigen-node-arrow text-[10px]"
          />
        </div>
        <span
          class="aigen-node-pill aigen-node-pill--target flex items-center"
          :title="targetSchema?.id"
        >
          <AigenIcon
            name="icon--behavior--experiment"
            class="mr-1 text-[11px] text-[#52c41a]"
          />
          <span>目标: {{ targetLabel }}</span>
        </span>
      </div>

      <!-- 模式切换页签 -->
      <div class="aigen-mode-tabs">
        <button
          type="button"
          class="aigen-mode-tab-btn flex items-center justify-center gap-1"
          :class="{ active: activeMode === 'rule' }"
          @click="activeMode = 'rule'"
        >
          <AigenIcon name="icon--behavior--thunderbolt" class="text-[13px]" />
          <span>字段联动 (声明式)</span>
        </button>
        <button
          type="button"
          class="aigen-mode-tab-btn flex items-center justify-center gap-1"
          :class="{ active: activeMode === 'method' }"
          @click="activeMode = 'method'"
        >
          <AigenIcon name="icon--behavior--experiment" class="text-[13px]" />
          <span>触发动作 (命令式)</span>
        </button>
      </div>

      <!-- 智能场景快捷预设 -->
      <div v-if="smartPresets.length > 0" class="aigen-preset-section">
        <div class="aigen-section-title">快捷预设场景：</div>
        <div class="aigen-preset-list">
          <button
            v-for="(preset, idx) in smartPresets"
            :key="idx"
            type="button"
            class="aigen-preset-pill"
            @click="handlePresetClick(preset)"
          >
            <AigenIcon v-if="preset.icon" :name="preset.icon" class="mr-1" />
            <span>{{ preset.label }}</span>
          </button>
        </div>
      </div>

      <!-- 声明式联动微表单 -->
      <div v-if="activeMode === 'rule'" class="aigen-custom-section">
        <div class="aigen-section-title">自定义联动规则：</div>

        <!-- 触发条件 When -->
        <div class="aigen-field-row">
          <span class="aigen-row-label">条件:</span>
          <component
            :is="SelectComponent"
            v-if="SelectComponent"
            v-model:[selectBindModel]="selectedOperator"
            :options="OPERATORS"
            :dropdown-style="{ zIndex: 3000 }"
            size="small"
            style="flex: 1; min-width: 0"
          />
          <select v-else v-model="selectedOperator" class="aigen-input-select">
            <option v-for="op in OPERATORS" :key="op.value" :value="op.value">
              {{ op.label }}
            </option>
          </select>

          <!-- 比较值（非一元运算时显示） -->
          <template
            v-if="
              !UNARY_OPERATORS.has(selectedOperator) &&
              selectedOperator !== 'always'
            "
          >
            <component
              :is="SelectComponent"
              v-if="sourceOptions.length > 0 && SelectComponent"
              v-model:[selectBindModel]="customConditionValue"
              :options="sourceOptions"
              :dropdown-style="{ zIndex: 3000 }"
              placeholder="选择比较值"
              size="small"
              style="flex: 1; min-width: 0"
            />
            <select
              v-else-if="sourceOptions.length > 0"
              v-model="customConditionValue"
              class="aigen-input-select"
            >
              <option
                v-for="(opt, idx) in sourceOptions"
                :key="idx"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
            <component
              :is="InputComponent"
              v-else-if="InputComponent"
              v-model:[inputBindModel]="customConditionValue"
              placeholder="比较值"
              size="small"
              style="flex: 1; min-width: 0"
            />
            <input
              v-else
              v-model="customConditionValue"
              type="text"
              class="aigen-input-text"
              placeholder="比较值"
            />
          </template>
        </div>

        <!-- 目标效应 Then -->
        <div class="aigen-field-row">
          <span class="aigen-row-label">效应:</span>
          <div class="aigen-behavior-grid">
            <button
              v-for="b in RULE_BEHAVIOR_OPTIONS"
              :key="b.value"
              type="button"
              class="aigen-behavior-btn"
              :class="{ active: selectedBehavior === b.value }"
              :title="b.description"
              @click="selectedBehavior = b.value"
            >
              <AigenIcon :name="b.icon" class="text-12px mr-1" />
              <span>{{ b.label }}</span>
            </button>
          </div>
        </div>

        <div class="aigen-form-action-row">
          <button
            type="button"
            class="aigen-btn-primary w-full"
            @click="handleSaveCustomRule"
          >
            <AigenIcon name="icon--behavior--check" class="text-13px" />
            <span>保存联动规则</span>
          </button>
        </div>
      </div>

      <!-- 命令式方法动作微表单 -->
      <div v-if="activeMode === 'method'" class="aigen-custom-section">
        <div class="aigen-section-title">触发目标方法：</div>

        <div class="aigen-field-row">
          <span class="aigen-row-label">触发事件:</span>
          <component
            :is="SelectComponent"
            v-if="SelectComponent"
            v-model:[selectBindModel]="selectedEvent"
            :options="EVENT_OPTIONS"
            :dropdown-style="{ zIndex: 3000 }"
            size="small"
            style="flex: 1; min-width: 0"
          />
          <select v-else v-model="selectedEvent" class="aigen-input-select">
            <option
              v-for="ev in EVENT_OPTIONS"
              :key="ev.value"
              :value="ev.value"
            >
              {{ ev.label }}
            </option>
          </select>
        </div>

        <div class="aigen-field-row">
          <span class="aigen-row-label">目标方法:</span>
          <template v-if="targetMethodOptions.length > 0">
            <component
              :is="SelectComponent"
              v-if="SelectComponent"
              v-model:[selectBindModel]="selectedMethod"
              :options="targetMethodOptions"
              :dropdown-style="{ zIndex: 3000 }"
              placeholder="选择目标方法"
              size="small"
              style="flex: 1; min-width: 0"
            />
            <select v-else v-model="selectedMethod" class="aigen-input-select">
              <option
                v-for="m in targetMethodOptions"
                :key="m.value"
                :value="m.value"
              >
                {{ m.label }}
              </option>
            </select>
          </template>
          <template v-else>
            <component
              :is="InputComponent"
              v-if="InputComponent"
              v-model:[inputBindModel]="selectedMethod"
              placeholder="如 validate / reset"
              size="small"
              style="flex: 1; min-width: 0"
            />
            <input
              v-else
              v-model="selectedMethod"
              type="text"
              class="aigen-input-text"
              placeholder="如 validate / reset"
            />
          </template>
        </div>

        <div class="aigen-form-action-row">
          <button
            type="button"
            class="aigen-btn-primary flex-1"
            @click="handleSaveCustomMethod"
          >
            <AigenIcon name="icon--behavior--check" class="text-13px" />
            <span>保存动作关联</span>
          </button>
          <button
            type="button"
            class="aigen-btn-secondary"
            title="打开动作配置抽屉进行高级自定义"
            @click="handleOpenDrawer"
          >
            <AigenIcon name="icon--behavior--edit" class="text-12px" />
            <span>高级抽屉…</span>
          </button>
        </div>
      </div>

      <!-- 底部栏：高级跳转与取消 -->
      <div class="aigen-popover-footer">
        <button
          type="button"
          class="aigen-footer-link flex items-center gap-1"
          @click="handleGoToBehaviorPanel"
        >
          <span>去「行为」面板高级编辑</span>
          <AigenIcon
            name="icon--aigen--arrow-forward-ios-rounded"
            class="text-[9px]"
          />
        </button>
        <button type="button" class="aigen-btn-cancel" @click="handleCancel">
          取消 (Esc)
        </button>
      </div>

      <!-- 独立动作抽屉 -->
      <component
        :is="AigenActionDrawer"
        v-if="AigenActionDrawer"
        ref="drawerRef"
        @add="handleDrawerAdd"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.aigen-quick-link-popover {
  position: fixed;
  z-index: 1010;
  box-sizing: border-box;
  width: 380px;
  max-width: calc(100vw - 24px);
  padding: 14px;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border, #e5e7eb);
  border-radius: var(--aigen-radius, 8px);
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.14),
    0 2px 6px rgba(0, 0, 0, 0.04);
  font-family: inherit;
  user-select: none;
  transition:
    top 0.15s ease-out,
    left 0.15s ease-out;
}

.aigen-node-flow-arrow {
  color: #94a3b8;
  padding: 0 4px;
}

:global(.ant-select-dropdown),
:global(.ant-select-dropdown-placement-bottomLeft),
:global(.ant-select-dropdown-placement-topLeft),
:global(.el-popper.is-pure),
:global(.el-popper),
:global(.n-base-select-menu) {
  z-index: 3000 !important;
}

.aigen-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.aigen-popover-title {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--aigen-text-main, #1f2937);
}

.aigen-popover-close-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  line-height: 1;
  color: var(--aigen-text-helper, #9ca3af);
  cursor: pointer;
}
.aigen-popover-close-btn:hover {
  color: var(--aigen-text-main, #1f2937);
}

.aigen-node-flow-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 10px;
  background: #f8fafc;
  border: 1px dashed var(--aigen-border, #e2e8f0);
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 12px;
}

.aigen-node-pill {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.aigen-node-pill--source {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.aigen-node-pill--target {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.aigen-node-arrow {
  color: #94a3b8;
  font-size: 12px;
}

.aigen-mode-tabs {
  display: flex;
  gap: 4px;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.aigen-mode-tab-btn {
  flex: 1;
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 500;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;
}

.aigen-mode-tab-btn.active {
  background: #fff;
  color: var(--aigen-primary, #2563eb);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.aigen-preset-section {
  margin-bottom: 12px;
}

.aigen-section-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--aigen-text-helper, #64748b);
  margin-bottom: 6px;
}

.aigen-preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.aigen-preset-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: #eff6ff;
  color: var(--aigen-primary, #2563eb);
  border: 1px solid #dbeafe;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.aigen-preset-pill:hover {
  background: #dbeafe;
  border-color: #bfdbfe;
}

.aigen-custom-section {
  border-top: 1px solid #f1f5f9;
  padding-top: 10px;
  margin-bottom: 10px;
}

.aigen-field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}

.aigen-row-label {
  width: 54px;
  flex-shrink: 0;
  color: #64748b;
}

.aigen-input-select,
.aigen-input-text {
  flex: 1;
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  background: #fff;
  border: 1px solid var(--aigen-border, #cbd5e1);
  border-radius: 4px;
  outline: none;
}
.aigen-input-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 14px 14px;
  padding-right: 24px;
  cursor: pointer;
}
.aigen-input-select:focus,
.aigen-input-text:focus {
  border-color: var(--aigen-primary, #2563eb);
}

.aigen-behavior-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}

.aigen-behavior-btn {
  display: inline-flex;
  align-items: center;
  padding: 3px 6px;
  background: #fff;
  border: 1px solid var(--aigen-border, #cbd5e1);
  border-radius: 4px;
  font-size: 11px;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s;
}
.aigen-behavior-btn:hover {
  border-color: var(--aigen-primary, #2563eb);
  color: var(--aigen-primary, #2563eb);
}
.aigen-behavior-btn.active {
  background: #eff6ff;
  border-color: var(--aigen-primary, #2563eb);
  color: var(--aigen-primary, #2563eb);
  font-weight: 500;
}

.aigen-form-action-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

/* 主要操作按钮（参考 Ant Design Vue 按钮规范） */
.aigen-btn-primary,
.aigen-btn-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  background: var(--aigen-primary, #1677ff);
  color: #ffffff;
  border: 1px solid var(--aigen-primary, #1677ff);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 2px 0 rgba(5, 145, 255, 0.08);
  transition: all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
  user-select: none;
}
.aigen-btn-primary.w-full,
.aigen-btn-submit.w-full {
  width: 100%;
}
.aigen-btn-primary.flex-1,
.aigen-btn-submit.flex-1 {
  flex: 1;
  min-width: 0;
}
.aigen-btn-primary:hover,
.aigen-btn-submit:hover {
  background: #4096ff;
  border-color: #4096ff;
  box-shadow: 0 2px 6px rgba(22, 119, 255, 0.25);
}
.aigen-btn-primary:active,
.aigen-btn-submit:active {
  background: #0958d9;
  border-color: #0958d9;
  box-shadow: none;
  transform: translateY(1px);
}

/* 次要 / 辅助操作按钮（如高级动作抽屉） */
.aigen-btn-secondary,
.aigen-btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  padding: 0 10px;
  background: #ffffff;
  color: #334155;
  border: 1px solid var(--aigen-border, #d9d9d9);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 400;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.02);
  transition: all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
  user-select: none;
}
.aigen-btn-secondary:hover,
.aigen-btn-ghost:hover {
  color: var(--aigen-primary, #1677ff);
  border-color: var(--aigen-primary, #1677ff);
  background: #f0f7ff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}
.aigen-btn-secondary:active,
.aigen-btn-ghost:active {
  color: #0958d9;
  border-color: #0958d9;
  background: #e6f4ff;
  box-shadow: none;
  transform: translateY(1px);
}

.aigen-popover-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}

.aigen-footer-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--aigen-primary, #1677ff);
  cursor: pointer;
  transition: all 0.15s;
}
.aigen-footer-link:hover {
  color: #4096ff;
  background: #eff6ff;
}

.aigen-btn-cancel {
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}
.aigen-btn-cancel:hover {
  color: #1e293b;
  background: #f1f5f9;
}
</style>
