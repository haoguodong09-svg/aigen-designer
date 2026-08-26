<script lang="ts" setup>
import type { ActionsModel, ComponentSchema } from '@aigen-designer/types';

import type { ActionDraft, ActionType } from './helper';

import { computed, onBeforeUnmount, reactive, ref, toRaw, watch } from 'vue';

import { useDesignerContext } from '@aigen-designer/hooks';
import { deepClone, findSchemaById } from '@aigen-designer/utils';

import {
  buildCacheKey,
  createEmptyDraft,
  getArgsArray,
  isExpressionValue,
} from './helper';
import StepArgs from './steps/StepArgs.vue';
import StepMethod from './steps/StepMethod.vue';
import StepTarget from './steps/StepTarget.vue';
import StepType from './steps/StepType.vue';

/**
 * 动作配置四步向导抽屉（720px 右侧滑出），替代 1200px 旧弹窗。
 * - API 与旧 aigenActionModal 完全一致：expose { handleOpen, handleOpenEdit }；emit add/edit。
 * - 自包含实现：Teleport 到 body + fixed 定位 + CSS transform 过渡，不依赖三套 UI 适配包的 drawer。
 * - 设计态安全：仅做求值/展示，不触发任何运行时事件。
 */
const emit = defineEmits<{
  (e: 'add', action: ActionsModel): void;
  (e: 'edit', action: ActionsModel): void;
}>();

const { pageSchema } = useDesignerContext();

const visible = ref(false);
const isAdd = ref(true);
const currentStep = ref(0);
const saveError = ref('');
/** 画布点选时遮罩不拦截指针，保证可透视点选画布元素 */
const maskPassive = ref(false);
const componentSchema = ref<ComponentSchema | null>(null);
const stepTargetRef = ref<InstanceType<typeof StepTarget> | null>(null);

const state = reactive<{
  actionItem: ActionDraft;
  /** 参数缓存：componentId + methodName → args 字符串（与旧 modal 约定一致） */
  cacheData: Record<string, string>;
}>({
  actionItem: createEmptyDraft(),
  cacheData: {},
});

/** 四步步骤条元数据 */
const stepsMeta = [
  { index: 0, title: '动作类型' },
  { index: 1, title: '目标组件' },
  { index: 2, title: '动作方法' },
  { index: 3, title: '参数配置' },
];

/** 目标组件步骤仅在「操作组件」类型下需要（custom/public 跳过） */
const targetStepSkipped = computed(() => state.actionItem.type !== 'component');

/** 步骤完成标记：已填步骤打勾 */
const stepDoneMap = computed<Record<number, boolean>>(() => ({
  0: state.actionItem.type !== '',
  1: Boolean(state.actionItem.componentId),
  2: Boolean(state.actionItem.methodName),
  3: false,
}));

function isStepDone(index: number): boolean {
  return stepDoneMap.value[index] === true;
}

/** 步骤可点击回跳：仅可跳转到已走过的步骤（或当前步骤） */
function isStepClickable(index: number): boolean {
  if (index === 1 && targetStepSkipped.value) return false;
  return index <= currentStep.value;
}

function jumpToStep(index: number) {
  if (!isStepClickable(index)) return;
  currentStep.value = index;
  saveError.value = '';
}

/** 打开：新增模式（默认 Step1 选中「操作组件」） */
function handleOpen() {
  visible.value = true;
  isAdd.value = true;
  saveError.value = '';
  currentStep.value = 0;
  maskPassive.value = false;
  componentSchema.value = null;
  Object.assign(state.actionItem, createEmptyDraft());
  state.actionItem.type = 'component';
  state.cacheData = {};
}

/** 打开：编辑模式（按 action 预填并直达已填步骤） */
function handleOpenEdit(action: ActionsModel) {
  visible.value = true;
  isAdd.value = false;
  saveError.value = '';
  maskPassive.value = false;
  componentSchema.value = null;

  if (action.componentId) {
    const targetSchema = findSchemaById(pageSchema.schemas, action.componentId);
    if (targetSchema) {
      componentSchema.value = targetSchema;
    } else {
      // 组件已被删除，回退到步骤 1 让用户重新选择
      componentSchema.value = null;
      state.actionItem.componentId = null;
      state.actionItem.methodName = '';
      state.actionItem.args = null;
      currentStep.value = 1;
      saveError.value = '目标组件已从页面中移除，请重新选择';
      return;
    }
  }

  Object.assign(state.actionItem, {
    args: action.args ?? null,
    componentId: action.componentId ?? null,
    condition: action.condition ?? null,
    delay: action.delay ?? null,
    enabled: action.enabled ?? true,
    methodName: action.methodName ?? '',
    name: action.name ?? '',
    remark: action.remark ?? '',
    type: action.type,
  });
  state.cacheData = {};

  // 直达已填步骤
  if (action.type === 'component') {
    currentStep.value = action.componentId ? (action.methodName ? 3 : 2) : 1;
  } else {
    currentStep.value = action.methodName ? 3 : 2;
  }
}

function handleClose() {
  // 通知 StepTarget 清理 picking 模式（移除 document 级监听器）
  if (
    stepTargetRef.value &&
    typeof stepTargetRef.value.stopPicking === 'function'
  ) {
    stepTargetRef.value.stopPicking();
  }
  visible.value = false;
  maskPassive.value = false;
  componentSchema.value = null;
  state.cacheData = {};
  saveError.value = '';
}

/** Esc 关闭抽屉 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && visible.value) {
    handleClose();
  }
}

watch(
  () => visible.value,
  (val) => {
    if (val) {
      window.addEventListener('keydown', handleKeydown);
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});

/** 下一步（含步骤间校验，内联错误提示，禁止 alert） */
function handleNext() {
  saveError.value = '';
  if (currentStep.value === 0) {
    if (state.actionItem.type === '') {
      saveError.value = '请先选择动作类型';
      return;
    }
    // custom/public 跳过目标组件步骤
    currentStep.value = targetStepSkipped.value ? 2 : 1;
    return;
  }
  if (currentStep.value === 1) {
    if (!state.actionItem.componentId) {
      saveError.value = '请先选择目标组件';
      return;
    }
    currentStep.value = 2;
    return;
  }
  if (currentStep.value === 2) {
    if (!state.actionItem.methodName) {
      saveError.value = '请先选择动作方法';
      return;
    }
    currentStep.value = 3;
    return;
  }
  handleSave();
}

/** 上一步（custom/public 从动作方法回退直接到动作类型） */
function handlePrev() {
  if (currentStep.value === 0) return;
  if (currentStep.value === 2 && targetStepSkipped.value) {
    currentStep.value = 0;
  } else {
    currentStep.value -= 1;
  }
  saveError.value = '';
}

/** 选择目标组件：缓存旧参数、清空方法、按新目标恢复缓存 */
function handleSelectTarget(payload: { id: string; schema: ComponentSchema }) {
  if (state.actionItem.args) {
    state.cacheData[
      buildCacheKey(state.actionItem.componentId, state.actionItem.methodName)
    ] = state.actionItem.args;
  }
  state.actionItem.componentId = payload.id;
  state.actionItem.methodName = '';
  componentSchema.value = payload.schema;
  state.actionItem.args =
    state.cacheData[buildCacheKey(payload.id, '')] ?? null;
  saveError.value = '';
}

/** 选择动作方法：缓存旧参数、恢复新方法的缓存参数 */
function handleMethodChange(value: string) {
  if (state.actionItem.args) {
    state.cacheData[
      buildCacheKey(state.actionItem.componentId, state.actionItem.methodName)
    ] = state.actionItem.args;
  }
  state.actionItem.methodName = value;
  state.actionItem.args =
    state.cacheData[buildCacheKey(state.actionItem.componentId, value)] ?? null;
  saveError.value = '';
}

/** StepArgs 变更补丁 */
function handleActionChange(patch: Partial<ActionDraft>) {
  Object.assign(state.actionItem, patch);
}

/** 组装最终动作对象（与运行时 ActionsModel 对齐，P1 仅保存字段） */
function buildActionPayload(): ActionsModel {
  const item = toRaw(state.actionItem);
  return {
    args: item.args ?? undefined,
    componentId: item.componentId,
    condition: item.condition ?? undefined,
    delay: item.delay ?? undefined,
    enabled: item.enabled,
    methodName: item.methodName,
    name: item.name || undefined,
    remark: item.remark || undefined,
    type: item.type as ActionsModel['type'],
  };
}

/** 保存：methodName 必填（内联错误），emit 前 deepClone，保存后关闭 */
function handleSave() {
  const { methodName, type } = state.actionItem;
  if (!methodName) {
    saveError.value = '请先选择动作方法';
    return;
  }

  // setAttr 参数校验：StepArgs 已产出 [属性名, 属性值] 结构，此处只校验不再规整。
  // （旧弹窗按"全量属性列表索引"取值的规整逻辑已废弃——args 结构变化后索引错位，
  //   会把用户填写的属性值覆盖为 undefined/null，导致动作"配置了却不生效"。）
  if (
    type === 'component' &&
    methodName === 'setAttr' &&
    componentSchema.value
  ) {
    const args = getArgsArray(state.actionItem.args);
    const attrName = args[0];
    const attrValue = args[1];
    if (typeof attrName !== 'string' || attrName.trim() === '') {
      saveError.value = '请选择要设置的属性';
      return;
    }
    if (
      !isExpressionValue(attrValue) &&
      (attrValue === undefined || attrValue === null)
    ) {
      saveError.value = '请设置属性值（可点击 fx 使用表达式，如 $event[0]）';
      return;
    }
  }

  // 通用兜底：参数数组含 undefined 会被 JSON.stringify 序列化为 null，静默失效。
  // 保存前拦截，要求所有参数有值（可显式填 0 / false / 空字符串，或用表达式）。
  if (getArgsArray(state.actionItem.args).includes(undefined)) {
    saveError.value = '请补全所有参数（空参数不会生效，可点击 fx 使用表达式）';
    return;
  }

  const payload = deepClone(buildActionPayload());
  if (isAdd.value) {
    emit('add', payload);
  } else {
    emit('edit', payload);
  }
  handleClose();
}

/** 画布点选模式下遮罩不拦截指针 */
function handlePickChange(picking: boolean) {
  maskPassive.value = picking;
}

function handleTypeChange(value: '' | ActionType) {
  const prevType = state.actionItem.type;
  state.actionItem.type = value;
  // 切换类型时清理不兼容的字段，防止残留导致步骤状态不一致
  if (value === 'component') {
    if (prevType !== 'component') {
      state.actionItem.methodName = '';
      state.actionItem.args = null;
    }
  } else if (
    (value === 'custom' || value === 'public') &&
    prevType !== 'custom' &&
    prevType !== 'public'
  ) {
    state.actionItem.componentId = null;
    state.actionItem.methodName = '';
    state.actionItem.args = null;
    componentSchema.value = null;
  }
}

defineExpose({
  handleOpen,
  handleOpenEdit,
});
</script>

<template>
  <Teleport to="body">
    <Transition name="aigen-drawer-mask">
      <div
        v-if="visible"
        class="aigen-drawer-mask"
        :class="{ 'aigen-drawer-mask--passive': maskPassive }"
        @click="handleClose"
      ></div>
    </Transition>
    <Transition name="aigen-drawer-slide">
      <div
        v-if="visible"
        class="aigen-drawer-panel"
        role="dialog"
        aria-modal="true"
      >
        <div class="aigen-drawer-header">
          <span class="aigen-drawer-title">动作配置</span>
          <button
            type="button"
            class="aigen-drawer-close"
            title="关闭"
            @click="handleClose"
          >
            ×
          </button>
        </div>
        <div class="aigen-drawer-steps">
          <button
            v-for="step in stepsMeta"
            :key="step.index"
            type="button"
            class="aigen-drawer-step"
            :class="{
              'aigen-drawer-step--active': currentStep === step.index,
              'aigen-drawer-step--done': isStepDone(step.index),
              'aigen-drawer-step--skipped':
                step.index === 1 && targetStepSkipped,
            }"
            :disabled="!isStepClickable(step.index)"
            @click="jumpToStep(step.index)"
          >
            <span class="aigen-drawer-step-num">
              {{ isStepDone(step.index) ? '✓' : step.index + 1 }}
            </span>
            <span class="aigen-drawer-step-title">{{ step.title }}</span>
            <span
              v-if="step.index === 1 && targetStepSkipped"
              class="aigen-drawer-step-skip"
            >
              跳过
            </span>
          </button>
        </div>
        <div class="aigen-drawer-body">
          <StepType
            v-if="currentStep === 0"
            :type="state.actionItem.type"
            @update:type="handleTypeChange"
          />
          <StepTarget
            ref="stepTargetRef"
            v-else-if="currentStep === 1"
            :component-id="state.actionItem.componentId"
            :component-schema="componentSchema"
            @pick-change="handlePickChange"
            @select="handleSelectTarget"
          />
          <StepMethod
            v-else-if="currentStep === 2"
            :component-schema="componentSchema"
            :method-name="state.actionItem.methodName"
            :type="state.actionItem.type"
            @update:method-name="handleMethodChange"
          />
          <StepArgs
            v-else
            :action-item="state.actionItem"
            :component-schema="componentSchema"
            @change="handleActionChange"
          />
        </div>
        <div class="aigen-drawer-footer">
          <div class="aigen-drawer-footer-error">
            <span v-if="saveError" class="aigen-drawer-error">{{
              saveError
            }}</span>
          </div>
          <div class="aigen-drawer-footer-actions">
            <button
              v-if="currentStep > 0"
              type="button"
              class="aigen-drawer-btn aigen-drawer-btn--secondary"
              @click="handlePrev"
            >
              上一步
            </button>
            <button
              v-if="currentStep < 3"
              type="button"
              class="aigen-drawer-btn aigen-drawer-btn--primary"
              @click="handleNext"
            >
              下一步
            </button>
            <button
              v-else
              type="button"
              class="aigen-drawer-btn aigen-drawer-btn--primary"
              @click="handleSave"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.aigen-drawer-mask {
  position: fixed;
  inset: 0;
  /* 1000：低于各 UI 库弹层（antd dropdown 1050 / elementPlus popper 2000+ / naive 3000+），
     保证抽屉内组件的下拉、日期选择等弹层可正常弹出且不被遮罩拦截 */
  z-index: 1000;
  background: rgba(0, 0, 0, 0.35);
}

/* 画布点选时遮罩不拦截指针，保证可透视点选画布元素 */
.aigen-drawer-mask--passive {
  pointer-events: none;
}

.aigen-drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  width: 720px;
  max-width: 100vw;
  height: 100vh;
  background: var(--aigen-background, #fff);
  border-left: 1px solid var(--aigen-border);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.12);
}

.aigen-drawer-mask-enter-active,
.aigen-drawer-mask-leave-active {
  transition: opacity 0.24s ease;
}

.aigen-drawer-mask-enter-from,
.aigen-drawer-mask-leave-to {
  opacity: 0;
}

.aigen-drawer-slide-enter-active,
.aigen-drawer-slide-leave-active {
  transition: transform 0.24s ease;
}

.aigen-drawer-slide-enter-from,
.aigen-drawer-slide-leave-to {
  transform: translateX(100%);
}

.aigen-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--aigen-border);
}

.aigen-drawer-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-drawer-close {
  padding: 2px 8px;
  font-size: 20px;
  line-height: 1;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  border: none;
  background: transparent;
}

.aigen-drawer-close:hover {
  color: var(--aigen-destructive);
}

.aigen-drawer-steps {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--aigen-border);
}

.aigen-drawer-step {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 13px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  border: none;
  border-radius: 4px;
  background: transparent;
}

.aigen-drawer-step:hover:not(:disabled) {
  background: var(--aigen-primary-faded);
}

.aigen-drawer-step:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.aigen-drawer-step--active {
  font-weight: 600;
  color: var(--aigen-primary);
  background: var(--aigen-primary-faded);
}

.aigen-drawer-step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 12px;
  border-radius: 50%;
  background: var(--aigen-muted);
}

.aigen-drawer-step--done .aigen-drawer-step-num {
  color: var(--aigen-primary-foreground);
  background: var(--aigen-primary);
}

.aigen-drawer-step--skipped {
  opacity: 0.6;
}

.aigen-drawer-step-skip {
  font-size: 11px;
  color: var(--aigen-text-helper);
}

.aigen-drawer-body {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow: auto;
}

.aigen-drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--aigen-border);
}

.aigen-drawer-footer-error {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.aigen-drawer-error {
  font-size: 12px;
  color: var(--aigen-destructive);
}

.aigen-drawer-footer-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.aigen-drawer-btn {
  padding: 6px 16px;
  font-size: 13px;
  color: var(--aigen-text-main);
  cursor: pointer;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-drawer-btn--primary {
  color: var(--aigen-primary-foreground);
  background: var(--aigen-primary);
  border-color: var(--aigen-primary);
}

.aigen-drawer-btn--primary:hover {
  opacity: 0.9;
}

.aigen-drawer-btn--secondary:hover {
  color: var(--aigen-primary);
  border-color: var(--aigen-primary);
}
</style>
