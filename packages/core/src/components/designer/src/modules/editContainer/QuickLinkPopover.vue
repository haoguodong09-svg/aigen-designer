<script lang="ts" setup>
import type { ActionsModel, ComponentSchema } from '@aigen-designer/types';

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import { useDesignerContext, useLinkMode } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { setValueByPath } from '@aigen-designer/utils';

defineOptions({
  name: 'QuickLinkPopover',
});

const linkMode = useLinkMode();
const designer = useDesignerContext();
const revoke = designer.revoke;

const popoverRef = ref<HTMLDivElement | null>(null);
/** 动作配置抽屉（pluginManager 注册的异步组件，仅用其公开 API handleOpen / add 事件） */
const AigenActionDrawer = pluginManager.component.get('aigenActionDrawer');
interface AigenActionDrawerExpose {
  handleOpen: () => void;
}
const drawerRef = ref<AigenActionDrawerExpose | null>(null);
/** 自定义动作保存时写入的源元素（打开抽屉前捕获，避免退出模式后源被清空） */
const pendingSource = ref<ComponentSchema | null>(null);

/** 源+目标都选齐后显示气泡 */
const visible = computed(() =>
  Boolean(linkMode.source.value && linkMode.target.value),
);
const sourceLabel = computed(
  () => linkMode.source.value?.label ?? linkMode.source.value?.type ?? '',
);
const targetLabel = computed(
  () => linkMode.target.value?.label ?? linkMode.target.value?.type ?? '',
);

/** 源元素是否为输入组件（显示/隐藏、禁用/启用 快捷动作仅对输入组件开放） */
const sourceIsInput = computed(() => {
  const schema = linkMode.source.value;
  if (!schema) return false;
  if (schema.input) return true;
  const config = pluginManager.component.getConfigByType(schema.type);
  return Boolean(config?.defaultSchema.input);
});

/**
 * 定位：锚定在目标元素旁（getBoundingClientRect，视口坐标 + fixed 定位，
 * 跟随画布缩放/滚动；至少打开时定位一次，滚动/缩放时更新）
 */
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
  let left = rect.right + 8;
  let top = rect.top;
  // 视口边界钳制
  if (left + popRect.width > window.innerWidth - 8) {
    left = rect.left - popRect.width - 8;
  }
  if (left < 8) left = 8;
  if (top + popRect.height > window.innerHeight - 8) {
    top = window.innerHeight - popRect.height - 8;
  }
  if (top < 8) top = 8;
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
}

// 打开时定位一次；目标变化（如重新点选目标）时重新定位
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

/** 生成 setAttr 动作（属性值用表达式 $event[0]，跟随源元素值） */
function buildSetAttrAction(attrName: 'disabled' | 'hidden'): ActionsModel {
  return {
    args: JSON.stringify([
      attrName,
      { __isExpression__: true, content: '$event[0]' },
    ]),
    componentId: linkMode.target.value?.id ?? '',
    enabled: true,
    methodName: 'setAttr',
    type: 'component',
  };
}

/** 写入源元素 on[change]（无 on 则创建）并记录撤销（参照 panel-ui 事件面板写回模式） */
function appendActionToSource(action: ActionsModel, schema: ComponentSchema) {
  const on = (schema.on ?? {}) as Record<string, ActionsModel[]>;
  const changeList = Array.isArray(on.change) ? [...on.change] : [];
  changeList.push(action);
  setValueByPath(schema, 'on', { ...on, change: changeList });
  revoke.push('属性编辑');
}

/** 快捷动作：显示/隐藏 → setAttr hidden；禁用/启用 → setAttr disabled；完成即退出模式 */
function handleQuickAction(attrName: 'disabled' | 'hidden') {
  const source = linkMode.source.value;
  if (!source) return;
  appendActionToSource(buildSetAttrAction(attrName), source);
  linkMode.exit();
}

/** 自定义动作…：打开动作配置抽屉（预置目标留待后续；add 事件写回源元素） */
function handleOpenDrawer() {
  const source = linkMode.source.value;
  if (!source) return;
  pendingSource.value = source;
  drawerRef.value?.handleOpen();
  // 退出关联模式，避免画布点选与抽屉自身的点选步骤冲突
  linkMode.exit();
}

/** 抽屉保存动作后写回源元素 on[change] */
function handleDrawerAdd(action: ActionsModel) {
  if (pendingSource.value) {
    appendActionToSource(action, pendingSource.value);
    pendingSource.value = null;
  }
}

/** 取消：关闭气泡并退出关联模式 */
function handleCancel() {
  pendingSource.value = null;
  linkMode.exit();
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" ref="popoverRef" class="aigen-quick-link-popover">
      <div class="aigen-quick-link-title">
        🔗 建立关联 源「{{ sourceLabel }}」→ 目标「{{ targetLabel }}」
      </div>
      <div class="aigen-quick-link-actions">
        <button
          type="button"
          class="aigen-quick-link-btn"
          :disabled="!sourceIsInput"
          @click="handleQuickAction('hidden')"
        >
          显示/隐藏
        </button>
        <button
          type="button"
          class="aigen-quick-link-btn"
          :disabled="!sourceIsInput"
          @click="handleQuickAction('disabled')"
        >
          禁用/启用
        </button>
        <button
          type="button"
          class="aigen-quick-link-btn"
          @click="handleOpenDrawer"
        >
          自定义动作…
        </button>
      </div>
      <div class="aigen-quick-link-footer">
        <span v-if="!sourceIsInput" class="aigen-quick-link-hint">
          源元素需为输入组件才能使用快捷联动
        </span>
        <button
          type="button"
          class="aigen-quick-link-btn aigen-quick-link-btn--ghost"
          @click="handleCancel"
        >
          取消
        </button>
      </div>
      <!-- 抽屉独立于气泡存在（气泡随模式退出卸载，抽屉需保持挂载以便异步加载） -->
      <component
        v-if="AigenActionDrawer"
        :is="AigenActionDrawer"
        ref="drawerRef"
        @add="handleDrawerAdd"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.aigen-quick-link-popover {
  position: fixed;
  z-index: 2000;
  box-sizing: border-box;
  width: 280px;
  padding: 12px;
  background: var(--aigen-background);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
}

.aigen-quick-link-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--aigen-text-main);
  overflow-wrap: break-word;
}

.aigen-quick-link-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.aigen-quick-link-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
}

.aigen-quick-link-btn {
  padding: 5px 10px;
  font-size: 12px;
  color: var(--aigen-text-main);
  cursor: pointer;
  background: var(--aigen-background);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius);
  transition:
    border-color 0.2s,
    color 0.2s,
    opacity 0.2s;
}

.aigen-quick-link-btn:hover:not(:disabled) {
  color: var(--aigen-primary);
  border-color: var(--aigen-primary);
}

.aigen-quick-link-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.aigen-quick-link-btn--ghost {
  border-color: transparent;
}

.aigen-quick-link-hint {
  font-size: 11px;
  color: var(--aigen-text-helper);
}
</style>
