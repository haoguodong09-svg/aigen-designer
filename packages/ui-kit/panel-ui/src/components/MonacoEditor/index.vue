<script setup lang="ts">
import type { editor } from 'monaco-editor';

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import { useTheme } from '@aigen-designer/hooks';
import * as monaco from 'monaco-editor';

const props = withDefaults(
  defineProps<{
    allowFullscreen?: boolean;
    autoToggleTheme?: boolean;
    bordered?: boolean;
    config?: editor.IStandaloneEditorConstructionOptions;
    language?: string;
    lineNumbers?: 'off' | 'on';
    modelValue?: string;
    readOnly?: boolean;
    theme?: 'hc-black' | 'vs-dark' | 'vs-light';
    valueFormat?: string;
  }>(),
  {
    allowFullscreen: true,
    config: () => ({
      minimap: {
        enabled: false,
      },
      selectOnLineNumbers: true,
    }),
    language: 'json',
    lineNumbers: 'on',
    modelValue: '',
    readOnly: false,
    theme: 'vs-light',
    valueFormat: 'string',
  },
);

const emit = defineEmits(['update:modelValue']);

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 13;

const isFullScreen = ref(false);
// JSON 格式错误提示（valueFormat 为 json 时的错误边界）
const jsonError = ref('');
const fontSize = ref(props.config?.fontSize ?? DEFAULT_FONT_SIZE);

const fullScreenStyle = `position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
  z-index: 2999 !important;`;

const editContainer = ref<HTMLElement | null>(null);

let monacoEditor: monaco.editor.IStandaloneCodeEditor | null = null;
const { isDark } = useTheme();

function handleToggleTheme() {
  if (isDark.value) {
    monaco.editor.setTheme('vs-dark');
  } else {
    monaco.editor.setTheme('vs-light');
  }
}

/**
 * 全屏切换 / 容器尺寸变化后重新布局 Monaco。
 * automaticLayout 能处理大部分场景，但全屏是 fixed 定位突变，
 * 需要等 DOM 更新后再主动 layout 一次，避免编辑器仍按旧尺寸渲染。
 */
function syncEditorLayout() {
  nextTick(() => {
    requestAnimationFrame(() => {
      monacoEditor?.layout();
    });
  });
}

function applyFontSize() {
  monacoEditor?.updateOptions({ fontSize: fontSize.value });
}

function clampFontSize(value: number) {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value));
}

function setFontSize(value: number) {
  fontSize.value = clampFontSize(value);
  applyFontSize();
}

function zoomIn() {
  setFontSize(fontSize.value + 1);
}

function zoomOut() {
  setFontSize(fontSize.value - 1);
}

function resetFontSize() {
  setFontSize(DEFAULT_FONT_SIZE);
}

function toggleFullscreen() {
  if (!props.allowFullscreen) return;
  isFullScreen.value = !isFullScreen.value;
  syncEditorLayout();
}

/**
 * 全屏时 Esc 仅退出全屏，不关闭外层动作抽屉。
 * 使用捕获阶段监听，先于抽屉的 window keydown 执行。
 */
function handleFullscreenKeydown(event: KeyboardEvent) {
  if (!isFullScreen.value || event.key !== 'Escape') return;
  // 仅当焦点在编辑器内时接管 Esc，避免抢占上层弹窗（如表达式插入器）的关闭行为
  const target = event.target as HTMLElement | null;
  if (
    target &&
    target !== document.body &&
    !editContainer.value?.contains(target)
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  isFullScreen.value = false;
  syncEditorLayout();
}

/**
 * 设置文本
 * @param text
 */
function setValue(text: string) {
  monacoEditor?.setValue(text || '');
}

/**
 * 光标处插入文本
 * @param text
 */
function insertText(text: string) {
  // 获取光标位置
  const position = monacoEditor?.getPosition();
  // 未获取到光标位置信息
  if (!position) {
    return;
  }
  // 插入
  monacoEditor?.executeEdits('', [
    {
      range: new monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column,
      ),
      text,
    },
  ]);
  // 设置新的光标位置
  monacoEditor?.setPosition({
    ...position,
    column: position.column + text.length,
  });
  // 重新聚焦
  monacoEditor?.focus();
}

onMounted(() => {
  monacoEditor = monaco.editor.create(editContainer.value as HTMLElement, {
    value: getValue(),
    ...props.config,
    automaticLayout: true,
    fontSize: props.config?.fontSize ?? fontSize.value,
    language: props.language,
    lineNumbers: props.lineNumbers,
    mouseWheelZoom: props.config?.mouseWheelZoom ?? true,
    // 预留右上角工具栏高度，避免首行代码被缩放/全屏按钮遮挡
    padding: { top: 30, ...props.config?.padding },
    readOnly: props.readOnly,
    scrollBeyondLastLine: false,
    theme: props.theme,
  });

  // 自动切换主题
  if (props.autoToggleTheme) {
    watch(
      () => isDark.value,
      () => {
        nextTick(() => handleToggleTheme());
      },
      {
        immediate: true,
      },
    );
  }

  // 获取值
  function getValue() {
    // valueFormat 为json 格式，需要转换处理
    if (props.valueFormat === 'json' && props.modelValue) {
      return JSON.stringify(props.modelValue, null, 2);
    }
    return props.modelValue ?? '';
  }

  // 监听值变化
  monacoEditor.onDidChangeModelContent(() => {
    const currenValue = monacoEditor?.getValue();

    // valueFormat 为json 格式，需要转换处理
    if (props.valueFormat === 'json' && currenValue) {
      try {
        // 非法 JSON 时仅展示错误态，不向上抛异常导致编辑器崩溃
        jsonError.value = '';
        emit('update:modelValue', JSON.parse(currenValue));
      } catch (error) {
        jsonError.value = `JSON 格式错误：${(error as Error).message}`;
      }
      return;
    }

    jsonError.value = '';
    emit('update:modelValue', currenValue ?? '');
  });

  window.addEventListener('keydown', handleFullscreenKeydown, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleFullscreenKeydown, true);
  monacoEditor?.dispose();
  monacoEditor = null;
});

defineExpose({
  getEditor: () => monacoEditor,
  getFontSize: () => fontSize.value,
  insertText,
  resetFontSize,
  setFontSize,
  setValue,
  toggleFullscreen,
  zoomIn,
  zoomOut,
});
</script>
<template>
  <div
    ref="editContainer"
    :class="{
      bordered: props.bordered,
      'has-error': !!jsonError,
      'aigen-code-editor--fullscreen': isFullScreen,
    }"
    :style="isFullScreen ? fullScreenStyle : ''"
    class="aigen-code-editor"
  >
    <!-- 缩放 / 全屏工具栏：放在编辑器右上角 -->
    <div class="aigen-code-editor-toolbar" @click.stop @mousedown.stop>
      <button
        type="button"
        title="缩小字号"
        aria-label="缩小字号"
        @click="zoomOut"
      >
        <AigenIcon name="icon--aigen--minus-rounded" />
      </button>
      <button
        type="button"
        class="aigen-code-editor-fontsize"
        title="点击恢复默认字号"
        @click="resetFontSize"
      >
        {{ fontSize }}px
      </button>
      <button
        type="button"
        title="放大字号"
        aria-label="放大字号"
        @click="zoomIn"
      >
        <AigenIcon name="icon--aigen--add-rounded" />
      </button>
      <template v-if="props.allowFullscreen">
        <span class="aigen-code-editor-divider"></span>
        <button
          type="button"
          :title="isFullScreen ? '退出全屏（Esc）' : '全屏编辑'"
          :aria-label="isFullScreen ? '退出全屏' : '全屏编辑'"
          @click="toggleFullscreen"
        >
          <AigenIcon
            :name="
              isFullScreen
                ? `icon--aigen--close-fullscreen`
                : `icon--aigen--open-fullscreen`
            "
          />
        </button>
      </template>
    </div>
    <div v-if="jsonError" class="aigen-code-editor-error">
      {{ jsonError }}
    </div>
  </div>
</template>
<style lang="less" scoped>
.aigen-code-editor {
  position: relative;
  width: 100%;
  min-height: 150px;
  :deep(.monaco-editor) {
    height: 100%;
  }

  &.bordered {
    border: 1px solid var(--aigen-border);
  }

  &.has-error {
    border: 1px solid #f56c6c;
  }
}

.aigen-code-editor--fullscreen {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 2999 !important;
  background: var(
    --aigen-designer-background,
    var(--aigen-background, #ffffff)
  );
  border: none;
}

.aigen-code-editor-error {
  position: absolute;
  bottom: 4px;
  left: 8px;
  z-index: 10;
  max-width: calc(100% - 16px);
  font-size: 11px;
  color: var(--aigen-destructive);
}

.aigen-code-editor-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: color-mix(in oklab, var(--aigen-background) 92%, transparent);
  border: 1px solid var(--aigen-border);
  border-radius: calc(var(--aigen-radius) - 2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(4px);
}

.aigen-code-editor-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 3px;
  font-size: 14px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 3px;
  transition: all 0.2s ease-out-quart;
}

.aigen-code-editor-toolbar button:hover {
  color: var(--aigen-primary);
  background: var(--aigen-primary-faded);
}

.aigen-code-editor-toolbar .aigen-code-editor-fontsize {
  min-width: 32px;
  font-size: 10px;
  color: var(--aigen-text-helper);
}

.aigen-code-editor-divider {
  width: 1px;
  height: 14px;
  margin: 0 2px;
  background: var(--aigen-border);
}
</style>
