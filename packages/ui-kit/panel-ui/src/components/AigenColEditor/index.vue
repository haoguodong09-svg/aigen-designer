<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { PropType } from 'vue';

import { ref } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';

import { AigenIcon } from '@aigen-designer/base-ui';
import { pluginManager } from '@aigen-designer/manager';
import { getUUID } from '@aigen-designer/utils';
import { useVModel } from '@vueuse/core';

const props = defineProps({
  modelValue: {
    default: () => [],
    type: Array as PropType<ComponentSchema[]>,
  },
});
const emit = defineEmits(['update:modelValue']);

const Radio = pluginManager.component.get('radio');
const Number = pluginManager.component.get('number');

const attrOptions = [
  {
    label: 'span',
    value: 'span',
  },
  {
    label: 'xs',
    value: 'xs',
  },
  {
    label: 'sm',
    value: 'sm',
  },
  {
    label: 'md',
    value: 'md',
  },
  {
    label: 'lg',
    value: 'lg',
  },
  {
    label: 'xl',
    value: 'xl',
  },
  {
    label: 'offset',
    value: 'offset',
  },
  {
    label: 'push',
    value: 'push',
  },
  {
    label: 'pull',
    value: 'pull',
  },
];

const selectedAttr = ref('span');
const innerValue = useVModel(props, 'modelValue', emit);

/**
 * 新增栅格Col
 */
function handleAdd() {
  const colItem = {
    id: getUUID(),
    props: {
      span: 12,
    },
    type: 'col',
    children: [],
  };
  innerValue.value = [...innerValue.value, colItem];
}

/**
 * 删除栅格Col
 * @param index
 */
function handleDelete(index: number) {
  innerValue.value = innerValue.value.filter(
    (item, itemIdx) => itemIdx !== index,
  );
}
</script>
<template>
  <div class="aigen-col-editor">
    <div class="aigen-col-editor-radio">
      <div class="text-$aigen-text-helper text-sm">选择需要配置的属性：</div>
      <Radio
        v-model:value="selectedAttr"
        :options="attrOptions"
      />
    </div>
    <VueDraggable
      v-model="innerValue"
      item-key="id"
      :component-data="{
        type: 'transition-group',
      }"
      class="edit-col-range"
      :animation="200"
      :gorup="{ name: 'edit-col-range' }"
      handle=".handle"
    >
      <div
        v-for="(item, index) in innerValue"
        :key="item.id"
        class="aigen-col-editor-item text-16px text-$aigen-text-secondary mb-2 grid grid-cols-[16px_auto_16px] items-center gap-2"
      >
        <AigenIcon class="handle mr-2 cursor-move" name="icon--aigen--drag" />
        <Number
          :key="selectedAttr"
          v-model:value="item.props[selectedAttr]"
          style="width: 100%"
          :min="1"
          :max="24"
        />
        <template v-if="innerValue.length > 1">
          <AigenIcon
            class="hover:text-$aigen-destructive cursor-pointer"
            name="icon--aigen--delete-outline-rounded"
            @click="handleDelete(index)"
          />
        </template>
      </div>
    </VueDraggable>
    <div class="aigen-button ghost primary" @click="handleAdd">添加列</div>
  </div>
</template>
<style scoped lang="less">
@import './index.less';
</style>