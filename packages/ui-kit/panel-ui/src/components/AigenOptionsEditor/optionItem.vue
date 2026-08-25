<script lang="ts" setup>
import { inject } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';

import { AigenIcon, useBindModel } from '@aigen-designer/base-ui';
import { pluginManager } from '@aigen-designer/manager';
import { useVModel } from '@vueuse/core';

import { OPTIONS_EDITOR_TREE_KEY } from './optionsEditorContext';

interface Option {
  children?: Option[];
  label: string;
  value: string;
}

defineOptions({
  name: 'AigenOptionItem',
});

const props = defineProps<{
  modelValue: Option[];
}>();
const emit = defineEmits(['update:modelValue']);
const Input = pluginManager.component.get('input');
const { bindModel } = useBindModel('input');
const tree = inject(OPTIONS_EDITOR_TREE_KEY, false);
const innerValue = useVModel(props, 'modelValue', emit);

/**
 *  添加选项子选项
 */
function handleAddChildren(option: Option) {
  const childrenOption: Option = {
    label: '',
    value: '',
  };

  if (option.children) {
    option.children.push(childrenOption);
  } else {
    option.children = [childrenOption];
  }
}

/**
 * 删除选项
 * @param index
 */
function handleRemove(index: number) {
  innerValue.value = innerValue.value.filter((_item, i) => i !== index);
}
</script>

<template>
  <VueDraggable
    v-model="innerValue"
    item-key="id"
    :component-data="{
      type: 'transition-group',
    }"
    group="option-list"
    handle=".handle"
    :animation="200"
  >
    <div v-for="(option, index) in innerValue" :key="index">
      <div
        :class="
          tree
            ? 'grid-cols-[16px_auto_auto_16px_16px]'
            : 'grid-cols-[16px_auto_auto_16px]'
        "
        class="option-item text-16px text-$aigen-text-secondary mb-2 grid items-center gap-2"
      >
        <AigenIcon class="handle mr-2 cursor-move" name="icon--aigen--drag" />
        <Input v-model:[bindModel]="option.label" placeholder="label" />
        <Input v-model:[bindModel]="option.value" placeholder="value" />
        <AigenIcon
          v-if="tree"
          class="text-lg! cursor-pointer"
          name="icon--aigen--add-rounded"
          @click="handleAddChildren(option)"
        />
        <AigenIcon
          class="hover:text-red cursor-pointer"
          name="icon--aigen--delete-outline-rounded"
          @click="handleRemove(index)"
        />
      </div>
      <div v-if="option.children" class="pl-4">
        <AigenOptionItem v-model="option.children" />
      </div>
    </div>
  </VueDraggable>
</template>
