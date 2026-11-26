<script lang="ts" setup>
import type { JSExpressionBinding } from '@aigen-designer/types';

import type { PseudoState } from '../utils/cssCodec';

import { computed, defineAsyncComponent, h, onMounted, ref } from 'vue';

import { AigenIcon, AigenTooltip } from '@aigen-designer/base-ui';
import { useDesignerContext } from '@aigen-designer/hooks';

import VariableBindModal from '../../attribute/modules/VariableBindModal.vue';
import { useStyleState } from '../composables/useStyleState';
import { PSEUDO_STATE_OPTIONS } from '../utils/cssCodec';
import StyleSelect from './StyleSelect.vue';

const loadMonacoEditor = () =>
  import('../../../components/MonacoEditor/index.vue');

const MonacoEditor = defineAsyncComponent({
  delay: 0,
  loader: loadMonacoEditor,
  loadingComponent: {
    render() {
      return h(
        'div',
        { class: 'aigen-style-modal__loading' },
        '编辑器加载中...',
      );
    },
  },
});

const designer = useDesignerContext();

const {
  activeClassName,
  addClassName,
  allCssClasses,
  applyInlineCssText,
  classList,
  globalCss,
  inlineCssPreview,
  inlineCssText,
  isStyleExpressionBound,
  pseudoState,
  removeClassName,
  selectedNode,
  setActiveClassName,
  setGlobalCss,
  setPseudoState,
} = useStyleState();

// 行内样式代码弹窗
const inlineMounted = ref(false);
const inlineModalOpen = ref(false);
const inlineDraft = ref('');

function openInlineModal() {
  inlineDraft.value = inlineCssText.value;
  inlineMounted.value = true;
  inlineModalOpen.value = true;
}

function saveInlineModal() {
  applyInlineCssText(inlineDraft.value);
  inlineModalOpen.value = false;
}

// 全局样式代码弹窗
const globalMounted = ref(false);
const globalModalOpen = ref(false);
const globalDraft = ref('');

function openGlobalModal() {
  globalDraft.value = globalCss.value;
  globalMounted.value = true;
  globalModalOpen.value = true;
}

function saveGlobalModal() {
  setGlobalCss(globalDraft.value);
  globalModalOpen.value = false;
}

// 样式面板挂载后后台预加载 MonacoEditor，避免首次打开弹窗等待
onMounted(() => {
  setTimeout(() => {
    void loadMonacoEditor();
  }, 150);
});

// 变量绑定弹窗（绑定整个 props.style）
const bindModalOpen = ref(false);
const currentStyleValue = computed(() => selectedNode.value?.props?.style);

function handleConfirmBind(expr: JSExpressionBinding) {
  if (!selectedNode.value) return;
  if (!selectedNode.value.props) selectedNode.value.props = {};
  selectedNode.value.props.style = expr;
  designer.revoke.push('绑定样式表达式');
  bindModalOpen.value = false;
}

function handleRemoveBind() {
  if (!selectedNode.value?.props) return;
  selectedNode.value.props.style = {};
  designer.revoke.push('解除样式绑定');
  bindModalOpen.value = false;
}

// 类名输入与自动提示
const newClassInput = ref('');
const showClassDropdown = ref(false);

const filteredSuggestions = computed(() => {
  const kw = newClassInput.value.trim().toLowerCase();
  return allCssClasses.value.filter(
    (cls) =>
      !classList.value.includes(cls) && (!kw || cls.toLowerCase().includes(kw)),
  );
});

function handleCommitClass(cls?: string) {
  const target = (cls ?? newClassInput.value).trim();
  if (!target) return;
  addClassName(target);
  newClassInput.value = '';
  showClassDropdown.value = false;
}

function handleClassBlur() {
  setTimeout(() => {
    showClassDropdown.value = false;
  }, 150);
}
</script>

<template>
  <div class="aigen-style-top">
    <!-- 行内样式 -->
    <div class="aigen-style-top__section">
      <div class="aigen-style-top__row-head">
        <span class="aigen-style-top__label">行内样式</span>
      </div>

      <div class="aigen-style-inline-row">
        <button
          type="button"
          class="aigen-style-code-preview"
          title="点击编辑行内样式 (:root)"
          @click="openInlineModal"
        >
          <span class="aigen-style-code-preview__text">
            {{ inlineCssPreview }}
          </span>
          <AigenIcon
            name="icon--aigen--edit-square-outline-rounded"
            class="aigen-style-code-preview__edit"
          />
        </button>

        <AigenTooltip content="绑定动态样式表达式" placement="left">
          <button
            type="button"
            class="aigen-style-bind-btn"
            :class="{ 'is-bound': isStyleExpressionBound }"
            title="绑定动态样式表达式"
            @click="bindModalOpen = true"
          >
            &gt;_
          </button>
        </AigenTooltip>
      </div>
    </div>

    <!-- 全局样式 -->
    <div class="aigen-style-top__section">
      <div class="aigen-style-top__row-head">
        <span class="aigen-style-top__label">
          全局样式
          <AigenTooltip
            content="为组件添加全局类名，选择伪类状态后在下方的可视化配置器中直接编辑对应状态样式"
            placement="top"
          >
            <AigenIcon
              name="icon--aigen--help-outline-rounded"
              class="aigen-style-help-icon"
            />
          </AigenTooltip>
        </span>
        <button
          type="button"
          class="aigen-style-text-btn"
          title="编辑页面全局 CSS"
          @click="openGlobalModal"
        >
          <AigenIcon name="icon--aigen--code" />
          <span>编辑全局样式</span>
        </button>
      </div>

      <div class="aigen-style-class-box">
        <div class="aigen-style-class-chips">
          <span
            v-for="cls in classList"
            :key="cls"
            class="aigen-style-class-chip"
            :class="{ 'is-active': activeClassName === cls }"
            @click="setActiveClassName(cls)"
          >
            <span class="aigen-style-class-chip__name">.{{ cls }}</span>
            <button
              type="button"
              class="aigen-style-class-chip__remove"
              title="移除类名"
              @click.stop="removeClassName(cls)"
            >
              ×
            </button>
          </span>

          <div class="aigen-style-class-input-wrap">
            <input
              v-model="newClassInput"
              type="text"
              class="aigen-style-class-input"
              placeholder="添加类名 (回车)"
              @focus="showClassDropdown = true"
              @blur="handleClassBlur"
              @keydown.enter.prevent="handleCommitClass()"
            />
            <div
              v-if="showClassDropdown && filteredSuggestions.length > 0"
              class="aigen-style-class-dropdown"
            >
              <button
                v-for="cls in filteredSuggestions"
                :key="cls"
                type="button"
                class="aigen-style-class-dropdown__item"
                @mousedown.prevent="handleCommitClass(cls)"
              >
                .{{ cls }}
              </button>
            </div>
          </div>
        </div>

        <div class="aigen-style-state-wrap">
          <StyleSelect
            :model-value="pseudoState"
            :options="PSEUDO_STATE_OPTIONS"
            title="伪类状态"
            @change="(val) => setPseudoState(val as PseudoState)"
          />
        </div>
      </div>

      <div v-if="pseudoState !== 'none'" class="aigen-style-state-hint">
        正在编辑
        <code>.{{ activeClassName }}:{{ pseudoState }}</code>
        伪类样式
      </div>
    </div>

    <!-- 行内样式编辑弹窗 -->
    <Teleport to="body">
      <div
        v-if="inlineMounted"
        v-show="inlineModalOpen"
        class="aigen-style-modal-mask"
        @click.self="inlineModalOpen = false"
      >
        <div class="aigen-style-modal">
          <div class="aigen-style-modal__header">
            <span>编辑行内样式</span>
            <button
              type="button"
              class="aigen-style-modal__close"
              @click="inlineModalOpen = false"
            >
              <AigenIcon name="icon--aigen--close" />
            </button>
          </div>
          <div class="aigen-style-modal__body">
            <MonacoEditor
              v-model="inlineDraft"
              language="css"
              style="height: 320px"
            />
          </div>
          <div class="aigen-style-modal__footer">
            <button
              type="button"
              class="aigen-style-btn"
              @click="inlineModalOpen = false"
            >
              取消
            </button>
            <button
              type="button"
              class="aigen-style-btn is-primary"
              @click="saveInlineModal"
            >
              保存
            </button>
          </div>
        </div>
      </div>

      <!-- 全局 CSS 编辑弹窗 -->
      <div
        v-if="globalMounted"
        v-show="globalModalOpen"
        class="aigen-style-modal-mask"
        @click.self="globalModalOpen = false"
      >
        <div class="aigen-style-modal is-wide">
          <div class="aigen-style-modal__header">
            <span>Css 编辑（页面全局样式）</span>
            <button
              type="button"
              class="aigen-style-modal__close"
              @click="globalModalOpen = false"
            >
              <AigenIcon name="icon--aigen--close" />
            </button>
          </div>
          <div class="aigen-style-modal__body">
            <MonacoEditor
              v-model="globalDraft"
              language="css"
              style="height: 380px"
            />
          </div>
          <div class="aigen-style-modal__footer">
            <button
              type="button"
              class="aigen-style-btn"
              @click="globalModalOpen = false"
            >
              取消
            </button>
            <button
              type="button"
              class="aigen-style-btn is-primary"
              @click="saveGlobalModal"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <VariableBindModal
      v-model:open="bindModalOpen"
      field-label="行内样式 (props.style)"
      field-name="props.style"
      :model-value="currentStyleValue"
      @confirm="handleConfirmBind"
      @remove="handleRemoveBind"
    />
  </div>
</template>

<style lang="less" scoped>
.aigen-style-top {
  padding: 8px 10px;
  border-bottom: 1px solid var(--aigen-border);
  background: var(--aigen-designer-background);
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__section {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  &__row-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__label {
    font-size: 12px;
    font-weight: 600;
    color: var(--aigen-text-main);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__head-actions {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
}

.aigen-style-help-icon {
  font-size: 12px;
  color: var(--aigen-text-helper);
  cursor: help;
}

.aigen-style-icon-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: var(--aigen-muted);
    color: var(--aigen-text-main);
  }
}

.aigen-style-text-btn {
  height: 22px;
  padding: 0 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-primary);
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;

  &:hover {
    background: var(--aigen-primary-faded);
  }
}

.aigen-style-inline-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.aigen-style-code-preview {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: var(--aigen-secondary);
  color: var(--aigen-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--aigen-primary);
    color: var(--aigen-text-main);
  }

  &__text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__edit {
    flex-shrink: 0;
    font-size: 13px;
    color: var(--aigen-text-helper);
  }
}

.aigen-style-bind-btn {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-muted-foreground, #94a3b8);
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    color: var(--aigen-primary);
    background: var(--aigen-secondary, rgba(0, 0, 0, 0.04));
  }

  &.is-bound {
    color: var(--aigen-primary);
    background: rgba(22, 119, 255, 0.1);
    border-color: rgba(22, 119, 255, 0.25);
  }
}

.aigen-style-class-box {
  display: flex;
  align-items: stretch;
  gap: 6px;
}

.aigen-style-class-chips {
  flex: 1;
  min-width: 0;
  min-height: 28px;
  padding: 2px 6px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: var(--aigen-designer-background);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.aigen-style-class-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 20px;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--aigen-secondary);
  border: 1px solid var(--aigen-border);
  font-size: 11px;
  color: var(--aigen-text-main);
  cursor: pointer;
  max-width: 100%;

  &.is-active {
    background: var(--aigen-primary-faded);
    border-color: var(--aigen-primary);
    color: var(--aigen-primary);
  }

  &__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__remove {
    border: none;
    background: transparent;
    color: inherit;
    font-size: 12px;
    line-height: 1;
    padding: 0 1px;
    cursor: pointer;
    opacity: 0.7;

    &:hover {
      opacity: 1;
    }
  }
}

.aigen-style-class-input-wrap {
  position: relative;
  flex: 1;
  min-width: 68px;
}

.aigen-style-class-input {
  width: 100%;
  height: 22px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 11px;
  color: var(--aigen-text-main);

  &::placeholder {
    color: var(--aigen-text-helper);
  }
}

.aigen-style-class-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 20;
  margin-top: 2px;
  padding: 4px 0;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: var(--aigen-designer-background);
  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
  max-height: 140px;
  overflow-y: auto;

  &__item {
    width: 100%;
    padding: 4px 8px;
    border: none;
    background: transparent;
    text-align: left;
    font-size: 11px;
    color: var(--aigen-text-main);
    cursor: pointer;

    &:hover {
      background: var(--aigen-muted);
    }
  }
}

.aigen-style-state-wrap {
  width: 74px;
  flex-shrink: 0;
  display: flex;
  align-items: stretch;

  :deep(.aigen-ss-trigger.is-default) {
    height: 100%;
    min-height: 28px;
    font-size: 11px;
  }
}

.aigen-style-state-hint {
  font-size: 11px;
  color: var(--aigen-primary);
  background: var(--aigen-primary-faded);
  padding: 3px 6px;
  border-radius: 3px;

  code {
    font-family: ui-monospace, monospace;
    font-weight: 600;
  }
}
</style>

<style lang="less">
.aigen-style-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgb(0 0 0 / 45%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.aigen-style-modal {
  width: 520px;
  max-width: 92vw;
  background: var(--aigen-designer-background, #fff);
  border: 1px solid var(--aigen-border, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgb(0 0 0 / 18%);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &.is-wide {
    width: 680px;
  }

  &__header {
    height: 44px;
    padding: 0 16px;
    border-bottom: 1px solid var(--aigen-border, #e5e7eb);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
    font-weight: 600;
    color: var(--aigen-text-main, #1f2937);
  }

  &__close {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--aigen-text-secondary, #6b7280);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    &:hover {
      background: var(--aigen-muted, #f3f4f6);
    }
  }

  &__body {
    padding: 12px 16px;
  }

  &__loading {
    height: 320px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--aigen-text-helper, #9ca3af);
    background: var(--aigen-secondary, #f9fafb);
    border-radius: 4px;
  }

  &__textarea {
    width: 100%;
    height: 300px;
    padding: 10px;
    border: 1px solid var(--aigen-border, #e5e7eb);
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    resize: vertical;
    outline: none;
  }

  &__footer {
    padding: 10px 16px;
    border-top: 1px solid var(--aigen-border, #e5e7eb);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}

.aigen-style-btn {
  height: 30px;
  padding: 0 14px;
  border: 1px solid var(--aigen-border, #d1d5db);
  border-radius: 4px;
  background: var(--aigen-designer-background, #fff);
  color: var(--aigen-text-main, #374151);
  font-size: 12px;
  cursor: pointer;

  &.is-primary {
    border-color: var(--aigen-primary, #1677ff);
    background: var(--aigen-primary, #1677ff);
    color: #fff;
  }
}
</style>
