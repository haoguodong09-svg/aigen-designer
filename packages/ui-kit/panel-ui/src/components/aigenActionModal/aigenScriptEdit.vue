<script lang="ts" setup>
import { computed } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import { useDesignerContext, usePageManager } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';

const props = withDefaults(
  defineProps<{
    /** 是否展示编辑器内标题（嵌入动作抽屉时由外层统一提供标题） */
    showHeader?: boolean;
  }>(),
  {
    showHeader: true,
  },
);

const MonacoEditor = pluginManager.component.get('monacoEditor');
const MonacoEditorConfig = {
  fontSize: 13,
  minimap: {
    enabled: false,
  },
  selectOnLineNumbers: true,
  theme: 'vs-light',
};
const pageManager = usePageManager();
const { pageSchema } = useDesignerContext();

const hasScriptError = computed(() => pageManager.scriptError.value !== null);
const errorMessage = computed(() => {
  const error = pageManager.scriptError.value;
  if (!error) return '';
  return error instanceof Error ? error.message : String(error);
});
</script>

<template>
  <div class="aigen-script-editor">
    <div v-if="props.showHeader" class="aigen-script-editor__head">
      <span class="aigen-script-editor__title">
        <AigenIcon name="icon--behavior--file-text" />
        页面脚本
      </span>
      <span class="aigen-script-editor__hint">
        通过 defineExpose 暴露的函数可在动作中选择
      </span>
    </div>
    <MonacoEditor
      v-model="pageSchema.script"
      auto-toggle-theme
      class="aigen-script-editor__body"
      :config="MonacoEditorConfig"
      language="javascript"
    />
    <div v-if="hasScriptError" class="aigen-script-editor__error">
      <AigenIcon name="icon--behavior--warning-circle" />
      脚本异常：{{ errorMessage }}
    </div>
  </div>
</template>

<style scoped>
.aigen-script-editor {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.aigen-script-editor__head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--aigen-secondary);
  border-bottom: 1px solid var(--aigen-border);
}

.aigen-script-editor__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--aigen-text-sm);
  font-weight: 500;
  color: var(--aigen-text-main);
}

.aigen-script-editor__title .iconfont {
  color: var(--aigen-primary);
}

.aigen-script-editor__hint {
  overflow: hidden;
  font-size: 11px;
  color: var(--aigen-text-helper);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-script-editor__body {
  flex: 1;
  min-height: 0;
}

.aigen-script-editor__error {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 11px;
  color: var(--aigen-destructive);
  background: color-mix(in oklab, var(--aigen-destructive) 6%, transparent);
  border-top: 1px solid var(--aigen-border);
}
</style>
