<script setup lang="ts">
import type { editor } from 'monaco-editor';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

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
    showFormatBtn?: boolean;
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
    showFormatBtn: true,
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
    !editContainer.value?.parentElement?.contains(target)
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  isFullScreen.value = false;
  syncEditorLayout();
}

const FORMATTABLE_LANGUAGES = new Set([
  'css',
  'html',
  'javascript',
  'json',
  'typescript',
]);

const showFormatButton = computed(
  () =>
    props.showFormatBtn &&
    !props.readOnly &&
    FORMATTABLE_LANGUAGES.has(props.language),
);

function applyFormattedText(formatted: string) {
  if (!monacoEditor) return;
  const raw = monacoEditor.getValue();
  const clean = formatted.replace(/\n$/, '');
  if (clean === raw) return;
  const model = monacoEditor.getModel();
  if (model) {
    monacoEditor.pushUndoStop();
    monacoEditor.executeEdits('format', [
      { range: model.getFullModelRange(), text: clean },
    ]);
    monacoEditor.pushUndoStop();
  } else {
    monacoEditor.setValue(clean);
  }
}

async function formatWithPrettier(
  code: string,
  language: string,
): Promise<null | string> {
  try {
    const prettierMod = await import('prettier/standalone');
    const prettier = prettierMod.default ?? prettierMod;
    if (language === 'json') {
      const [babelMod, estreeMod] = await Promise.all([
        import('prettier/plugins/babel'),
        import('prettier/plugins/estree'),
      ]);
      return await prettier.format(code, {
        parser: 'json',
        plugins: [babelMod.default ?? babelMod, estreeMod.default ?? estreeMod],
        tabWidth: 2,
      });
    }
    if (language === 'javascript' || language === 'typescript') {
      const [babelMod, estreeMod] = await Promise.all([
        import('prettier/plugins/babel'),
        import('prettier/plugins/estree'),
      ]);
      return await prettier.format(code, {
        parser: language === 'typescript' ? 'typescript' : 'babel',
        plugins: [babelMod.default ?? babelMod, estreeMod.default ?? estreeMod],
        semi: true,
        singleQuote: true,
        tabWidth: 2,
      });
    }
    if (language === 'css') {
      const postcssMod = await import('prettier/plugins/postcss');
      return await prettier.format(code, {
        parser: 'css',
        plugins: [postcssMod.default ?? postcssMod],
        tabWidth: 2,
      });
    }
    if (language === 'html') {
      const htmlMod = await import('prettier/plugins/html');
      return await prettier.format(code, {
        parser: 'html',
        plugins: [htmlMod.default ?? htmlMod],
        tabWidth: 2,
      });
    }
  } catch {
    return null;
  }
  return null;
}

async function formatCode() {
  if (!monacoEditor) return;
  const raw = monacoEditor.getValue();

  // JSON 优先使用 JSON.stringify(parsed, null, 2)，避免 Prettier 默认 printWidth=80 将短 JSON 折叠成单行
  if (props.language === 'json') {
    try {
      const parsed = JSON.parse(raw);
      applyFormattedText(JSON.stringify(parsed, null, 2));
      return;
    } catch {
      // JSON 解析失败时继续尝试 Prettier / Monaco 内置格式化
    }
  }

  const prettierResult = await formatWithPrettier(raw, props.language);
  if (prettierResult !== null) {
    applyFormattedText(prettierResult);
    return;
  }

  await monacoEditor.getAction('editor.action.formatDocument')?.run();
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
    padding: { top: 8, ...props.config?.padding },
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

  // 动态响应 language 切换（如变量初值在 json 与 javascript 间切换）
  watch(
    () => props.language,
    (nextLang) => {
      const model = monacoEditor?.getModel();
      if (model && nextLang) {
        monaco.editor.setModelLanguage(model, nextLang);
      }
    },
  );

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
  formatCode,
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
    :class="{
      bordered: props.bordered,
      'has-error': !!jsonError,
      'aigen-code-editor--fullscreen': isFullScreen,
    }"
    :style="isFullScreen ? fullScreenStyle : ''"
    class="aigen-code-editor"
  >
    <!-- 顶部操作栏：参考 TinyEngine 扁平化图标栏，不遮挡代码首行 -->
    <div
      v-if="
        showFormatButton ||
        props.allowFullscreen ||
        $slots.toolbarStart ||
        $slots.buttons
      "
      class="aigen-code-editor-toolbar"
      @click.stop
      @mousedown.stop
    >
      <div class="aigen-code-editor-toolbar-start">
        <slot name="toolbarStart"></slot>
      </div>
      <div class="aigen-code-editor-buttons">
        <slot name="buttons"></slot>
        <button
          v-if="showFormatButton"
          type="button"
          class="aigen-code-editor-action-btn"
          title="格式化"
          aria-label="格式化"
          @click="formatCode"
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5.5 2.5C4.4 2.5 3.75 3.1 3.75 4.2V6.3C3.75 7.15 3.2 7.65 2.4 7.85V8.15C3.2 8.35 3.75 8.85 3.75 9.7V11.8C3.75 12.9 4.4 13.5 5.5 13.5"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M10.5 2.5C11.6 2.5 12.25 3.1 12.25 4.2V6.3C12.25 7.15 12.8 7.65 13.6 7.85V8.15C12.8 8.35 12.25 8.85 12.25 9.7V11.8C12.25 12.9 11.6 13.5 10.5 13.5"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M6.4 8H9.6"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <button
          v-if="props.allowFullscreen"
          type="button"
          class="aigen-code-editor-action-btn"
          :title="isFullScreen ? '退出全屏' : '全屏'"
          :aria-label="isFullScreen ? '退出全屏' : '全屏'"
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
      </div>
    </div>
    <div ref="editContainer" class="aigen-code-editor-canvas"></div>
    <div
      v-if="isFullScreen && $slots.fullscreenFooter"
      class="aigen-code-editor-fullscreen-footer"
    >
      <slot name="fullscreenFooter"></slot>
    </div>
    <div v-if="jsonError" class="aigen-code-editor-error">
      {{ jsonError }}
    </div>
  </div>
</template>
<style lang="less" scoped>
.aigen-code-editor {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 150px;

  :deep(.monaco-editor) {
    height: 100%;
  }

  &.bordered {
    border: 1px solid var(--aigen-border);
    border-radius: 4px;
    overflow: hidden;

    .aigen-code-editor-toolbar {
      border-bottom: 1px solid var(--aigen-border-light, #f0f0f0);
    }
  }

  &.has-error {
    border: 1px solid #f56c6c;
  }
}

.aigen-code-editor-canvas {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}

.aigen-code-editor--fullscreen {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 2999 !important;
  padding: 10px 16px 16px;
  box-sizing: border-box;
  background: var(
    --aigen-designer-background,
    var(--aigen-background, #ffffff)
  );
  border: none;

  .aigen-code-editor-toolbar {
    padding: 0 2px 6px;
    border-bottom: none;
  }

  .aigen-code-editor-canvas {
    border: 1px solid var(--aigen-border, #e5e7eb);
    border-radius: 6px;
  }
}

.aigen-code-editor-fullscreen-footer {
  margin-top: 8px;
  flex-shrink: 0;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  height: 26px;
  padding: 0 6px;
  background: transparent;
}

.aigen-code-editor-toolbar-start {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.aigen-code-editor-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.aigen-code-editor-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 14px;
  color: var(--aigen-text-secondary, #595959);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 4px;
  transition:
    color 0.16s ease,
    background-color 0.16s ease;
}

.aigen-code-editor-action-btn:hover {
  color: var(--aigen-text-primary, #191919);
  background: var(--aigen-fill-secondary, rgba(0, 0, 0, 0.06));
}
</style>
