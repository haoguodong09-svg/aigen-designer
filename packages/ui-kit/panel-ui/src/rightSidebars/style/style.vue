<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { Ref } from 'vue';

import { computed, inject, ref } from 'vue';

import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';

import AttributeGroup from '../attribute/modules/AttributeGroup.vue';
import AigenAttributeItem from '../attribute/modules/attributeItem.vue';
import { provideStyleState } from './composables/useStyleState';
import BackgroundGroup from './modules/BackgroundGroup.vue';
import BorderGroup from './modules/BorderGroup.vue';
import EffectsGroup from './modules/EffectsGroup.vue';
import LayoutGroup from './modules/LayoutGroup.vue';
import PositionGroup from './modules/PositionGroup.vue';
import SizeGroup from './modules/SizeGroup.vue';
import SpacingGroup from './modules/SpacingGroup.vue';
import StyleTopBar from './modules/StyleTopBar.vue';
import TypographyGroup from './modules/TypographyGroup.vue';

const designer = useDesignerContext();
const componentConfigs = pluginManager.component.getComponentConfigs();

provideStyleState(designer);

const selectedNode = computed(() => designer.state.selectedNode);
const injectedExpanded = inject<null | Ref<boolean>>(
  'aigen-style-all-expanded',
  null,
);
const allExpanded = injectedExpanded ?? ref(true);

const customComponentStyles = computed<ComponentSchema[]>(() => {
  if (!selectedNode.value || !selectedNode.value.type) {
    return [];
  }
  return componentConfigs[selectedNode.value.type]?.config?.style ?? [];
});
</script>

<template>
  <div class="aigen-style-panel aigen-style-view">
    <div v-if="!selectedNode" class="aigen-style-empty">请在画布中选择组件</div>

    <template v-else>
      <StyleTopBar />

      <div class="aigen-style-scroll">
        <AttributeGroup title="布局" :default-expanded="allExpanded">
          <LayoutGroup />
        </AttributeGroup>

        <AttributeGroup title="间距" :default-expanded="allExpanded">
          <SpacingGroup />
        </AttributeGroup>

        <AttributeGroup title="尺寸" :default-expanded="allExpanded">
          <SizeGroup />
        </AttributeGroup>

        <AttributeGroup title="定位" :default-expanded="allExpanded">
          <PositionGroup />
        </AttributeGroup>

        <AttributeGroup title="文本" :default-expanded="allExpanded">
          <TypographyGroup />
        </AttributeGroup>

        <AttributeGroup title="背景" :default-expanded="allExpanded">
          <BackgroundGroup />
        </AttributeGroup>

        <AttributeGroup title="边框" :default-expanded="allExpanded">
          <BorderGroup />
        </AttributeGroup>

        <AttributeGroup title="效果" :default-expanded="allExpanded">
          <EffectsGroup />
        </AttributeGroup>

        <AttributeGroup
          v-if="customComponentStyles.length > 0"
          title="组件扩展样式"
          :count="customComponentStyles.length"
          :default-expanded="allExpanded"
        >
          <div
            v-for="item in customComponentStyles"
            :key="item.field"
            class="aigen-style-ext-item"
          >
            <AigenAttributeItem :schema="item" />
          </div>
        </AttributeGroup>
      </div>
    </template>
  </div>
</template>

<style lang="less">
@import './stylePanel.less';

.aigen-style-panel {
  height: 100%;
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  background: var(--aigen-designer-background);
}

.aigen-style-empty {
  padding: 40px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-style-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.aigen-style-ext-item {
  margin-bottom: 6px;
}
</style>
