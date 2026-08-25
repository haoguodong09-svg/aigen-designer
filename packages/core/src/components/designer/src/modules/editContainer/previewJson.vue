<script lang="ts" setup>
import { onUnmounted, ref, watchEffect } from 'vue';

import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { useClipboard } from '@vueuse/core';

const Modal = pluginManager.component.get('modal');
const MonacoEditor = pluginManager.component.get('monacoEditor');
const MonacoEditorConfig = {
  minimap: {
    enabled: false,
  },
  readOnly: true,
  selectOnLineNumbers: true,
  theme: 'vs-light',
};
const monacoEditorRef = ref<any>(null);
const visible = ref(false);
const { pageSchema } = useDesignerContext();
const { copied, copy } = useClipboard();

// 编辑器组件未加载时的重试参数：有限次重试，避免加载失败时无限循环
const RETRY_INTERVAL = 300;
const MAX_RETRY_COUNT = 20;
let retryCount = 0;
let openTimer: null | number = null;
watchEffect(() => {
  if (copied.value) {
    pluginManager.global.$message.success('复制成功');
  }
});

function handleClose() {
  // 关闭时重置重试计数，下次打开可重新尝试
  retryCount = 0;
  // visible.value = false;
  const content = JSON.stringify(pageSchema, null, 2);
  copy(content);
}

// 打开预览页面
function handleOpen() {
  visible.value = true;
  if (monacoEditorRef.value) {
    monacoEditorRef.value.setValue(JSON.stringify(pageSchema, null, 2));
    return;
  }
  // 编辑器组件未加载，延时重新调用函数（有限重试，防止加载失败时无限循环）
  if (retryCount >= MAX_RETRY_COUNT) return;
  retryCount++;
  openTimer = window.setTimeout(() => {
    if (visible.value) {
      handleOpen();
    }
  }, RETRY_INTERVAL);
}

onUnmounted(() => {
  // 卸载时清理重试定时器，避免泄漏
  if (openTimer !== null) {
    window.clearTimeout(openTimer);
    openTimer = null;
  }
});

/**
 * 导出数据
 */
function handleExportData(fileName = `aigen-data.json`) {
  const content = JSON.stringify(pageSchema, null, 2);
  const encodedUri = `data:text/json;charset=utf-8,${encodeURIComponent(content)}`;
  const actions = document.createElement('a');
  actions.setAttribute('href', encodedUri);
  actions.setAttribute('download', fileName);
  actions.click();
}

defineExpose({
  handleOpen,
});
</script>
<template>
  <Modal
    v-model="visible"
    title="查看数据"
    class="w-900px"
    width="900px"
    ok-text="导出数据"
    cancel-text="一键复制"
    @close="handleClose"
    @ok="handleExportData"
  >
    <div class="min-w-750px h-full rounded">
      <MonacoEditor
        ref="monacoEditorRef"
        class="editor h-full"
        auto-toggle-theme
        read-only
        :config="MonacoEditorConfig"
        language="json"
      />
    </div>
  </Modal>
</template>
