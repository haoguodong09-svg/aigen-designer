<script setup lang="ts">
import type { editor } from 'monaco-editor';

import { nextTick, onMounted, ref, watch } from 'vue';

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

const isFullScreen = ref(false);
// JSON 格式错误提示（valueFormat 为 json 时的错误边界）
const jsonError = ref('');

const fullScreenStyle = `position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2999;`;

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
    language: props.language,
    lineNumbers: props.lineNumbers,
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
});

defineExpose({
  insertText,
  setValue,
});
</script>
<template>
  <div
    ref="editContainer"
    :class="{
      bordered: props.bordered,
      'has-error': !!jsonError,
    }"
    :style="isFullScreen ? fullScreenStyle : ''"
    class="aigen-code-editor relative"
  >
    <div
      class="z-999 text-$aigen-text-helper absolute right-4 top-2 cursor-pointer text-xl"
      @click="isFullScreen = !isFullScreen"
      v-if="props.allowFullscreen"
    >
      <AigenIcon
        :name="
          isFullScreen
            ? `icon--aigen--close-fullscreen`
            : `icon--aigen--open-fullscreen`
        "
      />
    </div>
    <div
      v-if="jsonError"
      class="aigen-code-editor-error absolute bottom-1 left-2 z-10 text-xs text-red-500"
    >
      {{ jsonError }}
    </div>
  </div>
</template>
<style lang="less" scoped>
.aigen-code-editor {
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
</style>
