<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, inject, onMounted, ref } from 'vue';

import { useDesignerContext } from '@aigen-designer/hooks';
import { findSchemaById } from '@aigen-designer/utils';

import AigenEditScreenContainer from './editScreenContainer.vue';
import AigenNodeItem from './nodeItem.vue';
import AigenPreviewWidgets from './previewWidgets.vue';

const aigenEditRangeRef = ref<HTMLDivElement | null>(null);
const aigenPreviewWidgetsRef = ref<null | typeof AigenPreviewWidgets>(null);

const { pageSchema, props, setSelectedNode } = useDesignerContext();
const contextMenu = inject('contextMenu', {
  close: () => {},
  open: (_event: Event, _schema: ComponentSchema) => {},
});
const rootSchema = computed(() => {
  return pageSchema.schemas[0];
});

const getEditRangestyle = computed(() => {
  const padding =
    typeof props.canvasPadding === 'number'
      ? `${props.canvasPadding}px`
      : props.canvasPadding;
  return {
    height: '100%',
    padding,
    width: '100%',
  };
});

function setSelectedNodeById(aigenId) {
  const schema = findSchemaById(pageSchema.schemas, aigenId);
  setSelectedNode(schema);
  contextMenu.close();
}

onMounted(() => {
  aigenPreviewWidgetsRef.value?.handleInit(aigenEditRangeRef.value);

  // 监听 aigenEditRangeRef 点击事件
  aigenEditRangeRef.value?.addEventListener('click', (event: any) => {
    event.stopPropagation();
    let aigenId = event.target.dataset?.aigenId;
    if (!aigenId) {
      // 查询其父级的 aigenId
      let parent = event.target.parentElement;
      while (parent) {
        if (parent.dataset?.aigenId) {
          aigenId = parent.dataset.aigenId;
          break;
        }
        parent = parent.parentElement;

        // 如果是点击操作栏，不处理
        if (parent?.classList?.contains('aigen-selected-widget')) {
          return;
        }
      }
    }
    setSelectedNodeById(aigenId);
  });
});
</script>
<template>
  <section class="aigen-edit-canvas">
    <AigenEditScreenContainer>
      <div
        ref="aigenEditRangeRef"
        class="aigen-edit-range relative overflow-auto rounded-md"
        :style="getEditRangestyle"
      >
        <AigenNodeItem :schema="rootSchema" />
        <AigenPreviewWidgets ref="aigenPreviewWidgetsRef" />
      </div>
    </AigenEditScreenContainer>
  </section>
</template>
