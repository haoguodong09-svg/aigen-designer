<script lang="ts" setup>
import type { ActionsModel, ComponentSchema } from '@aigen-designer/types';

import type { ActionDraft, ActionType } from './helper';

import { computed, onBeforeUnmount, reactive, ref, toRaw, watch } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
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
 * 动作配置抽屉（720px 右侧滑出）。
 *
 * 交互重构：从「4 步向导」改为「单屏渐进式编辑」——
 * 类型、目标、方法、参数、高级设置同屏可见；
 * 选择即生效，无需下一步 / 上一步，配置一个动作从 8~10 次点击降到 2~4 次。
 * API/事件广播/页面跳转/自由参数全部开放，不再受预置参数表单限制。
 * API 与旧版一致：expose { handleOpen, handleOpenEdit }；emit add/edit。
 */
const emit = defineEmits<{
  (e: 'add', action: ActionsModel): void;
  (e: 'edit', action: ActionsModel): void;
}>();

const designer = useDesignerContext();
const { pageSchema } = designer;

const visible = ref(false);
const isAdd = ref(true);
const saveError = ref('');
const componentSchema = ref<ComponentSchema | null>(null);

const state = reactive<{
  actionItem: ActionDraft;
  /** 参数缓存：componentId + methodName → args 字符串 */
  cacheData: Record<string, string>;
}>({
  actionItem: createEmptyDraft(),
  cacheData: {},
});

const drawerTitle = computed(() => (isAdd.value ? '添加动作' : '编辑动作'));

/** 参数区标题：按当前动作类型给出连续的步骤编号与准确语义 */
const argsSectionTitle = computed<{ label: string; step: string }>(() => {
  switch (state.actionItem.type) {
    case 'api': {
      return { label: '请求配置', step: '2' };
    }
    case 'component': {
      return { label: '参数与高级设置', step: '4' };
    }
    case 'custom': {
      return { label: '函数参数与页面脚本', step: '2' };
    }
    case 'event': {
      return { label: '事件配置', step: '2' };
    }
    case 'navigate': {
      return { label: '跳转配置', step: '2' };
    }
    case 'public': {
      return { label: '参数与高级设置', step: '3' };
    }
    default: {
      return { label: '参数与高级设置', step: '2' };
    }
  }
});

/** 打开：新增模式（默认操作组件，并智能预选当前组件） */
function handleOpen() {
  visible.value = true;
  isAdd.value = true;
  saveError.value = '';
  componentSchema.value = null;
  Object.assign(state.actionItem, createEmptyDraft());
  state.actionItem.type = 'component';
  state.cacheData = {};

  const selectedNode = designer.state.selectedNode;
  if (selectedNode && selectedNode.id) {
    componentSchema.value = selectedNode;
    state.actionItem.componentId = selectedNode.id;
  }
}

/** 打开：编辑模式（按 action 预填） */
function handleOpenEdit(action: ActionsModel) {
  visible.value = true;
  isAdd.value = false;
  saveError.value = '';
  componentSchema.value = null;

  if (action.componentId) {
    const targetSchema = findSchemaById(pageSchema.schemas, action.componentId);
    if (targetSchema) {
      componentSchema.value = targetSchema;
    } else {
      // 组件已被删除：保留原 id 提示断链，引导重新选择
      saveError.value = '目标组件已从页面中移除，请重新选择';
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
    onError: action.onError ?? 'abort',
    remark: action.remark ?? '',
    target: action.target ?? null,
    type: action.type,
  });
  state.cacheData = {};
}

function handleClose() {
  visible.value = false;
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

function handleTypeChange(value: '' | ActionType) {
  const prevType = state.actionItem.type;
  state.actionItem.type = value;
  saveError.value = '';

  // 切换类型时清理不兼容字段，防止旧配置残留
  if (value === prevType) return;
  state.actionItem.methodName = '';
  state.actionItem.args = null;
  state.actionItem.target = null;
  state.actionItem.condition = null;

  if (value === 'component') {
    const selectedNode = designer.state.selectedNode;
    if (selectedNode?.id) {
      componentSchema.value = selectedNode;
      state.actionItem.componentId = selectedNode.id;
    }
    return;
  }

  state.actionItem.componentId = null;
  componentSchema.value = null;

  if (value === 'api') {
    state.actionItem.methodName = 'get';
  }
  if (value === 'navigate') {
    state.actionItem.methodName = 'navigate';
    state.actionItem.args = '["", "_self"]';
  }
}

/** 组装最终动作对象 */
function buildActionPayload(): ActionsModel {
  const item = toRaw(state.actionItem);
  // 尾部 undefined 参数会在 JSON 序列化后变成 null，保存前裁掉
  const args = getArgsArray(item.args);
  while (args.length > 0 && args[args.length - 1] === undefined) {
    args.pop();
  }
  return {
    args: args.length > 0 ? JSON.stringify(args) : undefined,
    componentId: item.componentId,
    condition: item.condition ?? undefined,
    delay: item.delay ?? undefined,
    enabled: item.enabled,
    methodName: item.methodName,
    name: item.name || undefined,
    onError: item.onError,
    remark: item.remark || undefined,
    target: item.target ?? undefined,
    type: item.type as ActionsModel['type'],
  };
}

/** 保存校验 */
function handleSave() {
  saveError.value = '';
  const item = state.actionItem;

  if (!item.type) {
    saveError.value = '请选择动作类型';
    return;
  }

  switch (item.type) {
    case 'api': {
      if (!item.target?.trim()) {
        saveError.value = '请填写请求地址';
        return;
      }

      break;
    }
    case 'component': {
      if (!item.componentId) {
        saveError.value = '请选择目标组件';
        return;
      }
      if (!item.methodName) {
        saveError.value = '请选择动作方法';
        return;
      }
      if (item.methodName === 'setAttr' && componentSchema.value) {
        const args = getArgsArray(item.args);
        if (typeof args[0] !== 'string' || args[0].trim() === '') {
          saveError.value = '请选择要设置的属性';
          return;
        }
        if (
          !isExpressionValue(args[1]) &&
          (args[1] === undefined || args[1] === null)
        ) {
          saveError.value =
            '请设置属性值（可点击 ƒx 使用表达式，如 $event[0]）';
          return;
        }
      }

      break;
    }
    case 'custom':
    case 'public': {
      if (!item.methodName) {
        saveError.value =
          item.type === 'custom' ? '请选择自定义函数' : '请选择公共函数';
        return;
      }

      break;
    }
    case 'event': {
      if (!item.methodName.trim()) {
        saveError.value = '请填写事件名';
        return;
      }

      break;
    }
    case 'navigate': {
      if (!item.target?.trim()) {
        saveError.value = '请填写跳转地址';
        return;
      }

      break;
    }
    // No default
  }

  const payload = deepClone(buildActionPayload());
  if (isAdd.value) {
    emit('add', payload);
  } else {
    emit('edit', payload);
  }
  handleClose();
}

defineExpose({
  handleOpen,
  handleOpenEdit,
});
</script>

<template>
  <Teleport to="body">
    <Transition name="aigen-drawer-mask">
      <div v-if="visible" class="aigen-drawer-mask" @click="handleClose"></div>
    </Transition>
    <Transition name="aigen-drawer-slide">
      <div
        v-if="visible"
        class="aigen-drawer-panel aigen-scoped"
        role="dialog"
        aria-modal="true"
      >
        <div class="aigen-drawer-header">
          <div class="aigen-drawer-title-wrap">
            <span class="aigen-drawer-title">{{ drawerTitle }}</span>
            <span class="aigen-drawer-subtitle">
              选择一个类型并填写配置，保存后立即出现在事件动作列表中
            </span>
          </div>
          <button
            type="button"
            class="aigen-drawer-close"
            title="关闭"
            @click="handleClose"
          >
            <AigenIcon name="icon--behavior--close" />
          </button>
        </div>

        <div class="aigen-drawer-body">
          <!-- ① 类型 -->
          <section class="aigen-drawer-section">
            <div class="aigen-drawer-section-title">
              <span class="aigen-drawer-section-index">1</span>
              <span class="aigen-drawer-section-label">做什么</span>
            </div>
            <StepType
              :type="state.actionItem.type"
              @update:type="handleTypeChange"
            />
          </section>

          <!-- ② 目标组件 + 方法 -->
          <section
            v-if="state.actionItem.type === 'component'"
            class="aigen-drawer-section"
          >
            <div class="aigen-drawer-section-title">
              <span class="aigen-drawer-section-index">2</span>
              <span class="aigen-drawer-section-label">对哪个组件</span>
            </div>
            <StepTarget
              :component-id="state.actionItem.componentId"
              :component-schema="componentSchema"
              @select="handleSelectTarget"
            />
          </section>

          <section
            v-if="state.actionItem.type === 'component'"
            class="aigen-drawer-section"
          >
            <div class="aigen-drawer-section-title">
              <span class="aigen-drawer-section-index">3</span>
              <span class="aigen-drawer-section-label">执行什么方法</span>
            </div>
            <StepMethod
              :component-schema="componentSchema"
              :method-name="state.actionItem.methodName"
              :type="state.actionItem.type"
              @update:method-name="handleMethodChange"
            />
          </section>

          <section
            v-else-if="state.actionItem.type === 'public'"
            class="aigen-drawer-section"
          >
            <div class="aigen-drawer-section-title">
              <span class="aigen-drawer-section-index">2</span>
              <span class="aigen-drawer-section-label">选择公共函数</span>
            </div>
            <StepMethod
              :component-schema="componentSchema"
              :method-name="state.actionItem.methodName"
              :type="state.actionItem.type"
              @update:method-name="handleMethodChange"
            />
          </section>

          <!-- ③ 参数 / 高级设置（所有类型共用） -->
          <section class="aigen-drawer-section">
            <div class="aigen-drawer-section-title">
              <span class="aigen-drawer-section-index">
                {{ argsSectionTitle.step }}
              </span>
              <span class="aigen-drawer-section-label">
                {{ argsSectionTitle.label }}
              </span>
            </div>
            <StepArgs
              :action-item="state.actionItem"
              :component-schema="componentSchema"
              @change="handleActionChange"
            />
          </section>
        </div>

        <div class="aigen-drawer-footer">
          <div class="aigen-drawer-footer-error">
            <span v-if="saveError" class="aigen-drawer-error">
              {{ saveError }}
            </span>
            <span v-else class="aigen-drawer-footer-hint">
              配置完成后点击保存；参数支持 ƒx 公式与自由 JSON
            </span>
          </div>
          <div class="aigen-drawer-footer-actions">
            <button type="button" class="aigen-button" @click="handleClose">
              取消
            </button>
            <button
              type="button"
              class="aigen-button primary"
              @click="handleSave"
            >
              保存动作
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
  z-index: 1000;
  background: rgba(0, 0, 0, 0.35);
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
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--aigen-border);
}

.aigen-drawer-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.aigen-drawer-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-drawer-subtitle {
  font-size: 11px;
  color: var(--aigen-text-helper);
}

.aigen-drawer-close {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 16px;
  line-height: 1;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 4px;
}

.aigen-drawer-close:hover {
  color: var(--aigen-destructive);
  background: var(--aigen-muted);
}

.aigen-drawer-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding: 16px;
  overflow: auto;
}

.aigen-drawer-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aigen-drawer-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-drawer-section-index {
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

.aigen-drawer-section-label {
  flex-shrink: 0;
}

.aigen-drawer-section-title::after {
  flex: 1;
  height: 1px;
  background: var(--aigen-border);
  content: '';
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
}

.aigen-drawer-error {
  font-size: 12px;
  color: var(--aigen-destructive);
}

.aigen-drawer-footer-hint {
  font-size: 11px;
  color: var(--aigen-text-helper);
}

.aigen-drawer-footer-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.aigen-drawer-footer-actions .aigen-button {
  font-family: inherit;
  font-size: var(--aigen-text-sm);
}
</style>
