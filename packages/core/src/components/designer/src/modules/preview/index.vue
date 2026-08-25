<script lang="ts" setup>
import type { ComponentSchema, PageSchema } from '@aigen-designer/types';

import { computed, nextTick, ref } from 'vue';

import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { deepClone, findSchemas } from '@aigen-designer/utils';

import { AigenBuilder } from '../../../../builder';

const props = withDefaults(
  defineProps<{
    hideConfirm?: boolean;
    width?: string;
  }>(),
  {
    width: '900px',
  },
);
const MonacoEditor = pluginManager.component.get('monacoEditor');
const Modal = pluginManager.component.get('modal');
const monacoEditorRef = ref<any>(null);

const visible = ref(false);
const dataVisible = ref(false);
const formValues = ref({});
// 预览使用的页面数据快照：打开预览时深拷贝一次，避免直接引用设计器的响应式数据
// 导致编辑页面时触发预览全量重建
const previewSchema = ref<null | PageSchema>(null);

const { pageSchema, props: designerProps } = useDesignerContext();
const kb = ref<any>(null);

const getFormNames = computed(() => {
  // 查找页面 schema 中所有类型为 'form' 的组件，并将其转换为 ComponentSchema[] 类型
  const formNames = (
    findSchemas(
      pageSchema.schemas,
      (schemas) => schemas.type.includes('form') && schemas.props?.name,
    ) as ComponentSchema[]
  )
    // 提取每个 form 组件的名称（从 props 中获取 name 属性）
    .map((schemas) => schemas.props?.name);

  // 使用 Set 去重后返回表单组件名称数组
  return [...new Set(formNames)];
});

function handleCloseData() {
  dataVisible.value = false;
}

function handleClose() {
  visible.value = false;
}

function handleOpen() {
  visible.value = true;
  // 传入深拷贝快照，预览与设计器数据解耦
  previewSchema.value = deepClone(pageSchema);
}

async function handleOk() {
  // 如果没有表单组件，则弹出提示并返回
  if (!getFormNames.value.length) {
    pluginManager.global.$message.error('缺少表单组件!');
    return;
  }

  try {
    let values: any = {};

    // 遍历获取的表单组件名称并进行验证
    for (const name of getFormNames.value) {
      values[`${name}`] = await kb.value.validate(name);
    }

    // 如果只有一个表单组件时，直接赋值给 values
    if (getFormNames.value.length === 1) {
      values = values[getFormNames.value[0]];
    }

    // 将验证后的表单数据转换为 JSON 字符串格式，并赋值给 formValues
    formValues.value = JSON.stringify(values, null, 2);

    // 在下一次 DOM 更新时，将 formValues 的值设置到 Monaco Editor 中
    nextTick(() => {
      monacoEditorRef.value?.setValue(formValues.value);
    });

    // 显示数据弹窗
    dataVisible.value = true;
  } catch (error) {
    // 捕获并输出错误
    console.error(error);
  }
}

const getCanvasPadding = computed(() => {
  return typeof designerProps.canvasPadding === 'number'
    ? `${designerProps.canvasPadding}px`
    : designerProps.canvasPadding;
});

defineExpose({
  handleOpen,
});
</script>
<template>
  <Modal
    v-model="visible"
    title="预览"
    :width="width"
    :hide-confirm="props.hideConfirm"
    ok-text="表单数据"
    @close="handleClose"
    @ok="handleOk"
  >
    <div
      class="min-w-750px translate-y-0px h-full rounded"
      :style="{ padding: getCanvasPadding }"
    >
      <AigenBuilder v-if="visible" ref="kb" :page-schema="previewSchema" />
      <!-- 表单数据 start -->
      <Modal
        v-model="dataVisible"
        title="表单数据"
        width="860px"
        @close="handleCloseData"
        @ok="handleCloseData"
      >
        <div class="h-full rounded">
          <MonacoEditor
            ref="monacoEditorRef"
            auto-toggle-theme
            read-only
            class="editor h-full"
            :model-value="formValues"
          />
        </div>
      </Modal>
      <!-- 表单数据 end -->
    </div>
  </Modal>
</template>
