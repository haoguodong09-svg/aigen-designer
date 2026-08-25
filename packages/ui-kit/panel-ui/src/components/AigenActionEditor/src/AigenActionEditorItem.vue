<script lang="ts" setup>
import type { PropType } from 'vue';

import { VueDraggable } from 'vue-draggable-plus';

import { AigenIcon } from '@aigen-designer/base-ui';
import { useDesignerContext } from '@aigen-designer/hooks';
import { findSchemaById } from '@aigen-designer/utils';

const props = defineProps({
  allEvents: {
    default: () => [],
    type: Array as PropType<any>,
  },
  events: {
    default: () => ({}),
    type: Object as PropType<any>,
  },
  itemEvents: {
    default: () => [],
    type: Array as PropType<any>,
  },
  modelValue: {
    default: () => ({}),
    type: Object as PropType<any>,
  },
});
const emit = defineEmits(['add', 'edit', 'update:modelValue']);

const { pageSchema } = useDesignerContext();

/**
 * 打开动作配置窗口
 * @param type
 */
function handleOpen(type: string) {
  emit('add', type);
}

/**
 * 获取组件label
 * @param id
 */
function getLabel(id: string) {
  const schema = findSchemaById(pageSchema.schemas, id);
  return schema?.label;
}

/**
 * 删除
 * @param index
 */
function handleDelete(index: number | string, type: string) {
  const newEvents = getNewEvents(type);
  newEvents[type] = props.events[type].filter(
    (_item: any, i: number) => index !== i,
  );
  if (!newEvents[type]?.length) {
    delete newEvents[type];
  }
  emit('update:modelValue', newEvents);
}

/**
 * 修改事件
 * @param index
 * @param type
 * @param action
 */
function handleEdit(index: number | string, type: string, action: any) {
  emit('edit', index, type, action);
}

/**
 * 获取新的事件数据，过滤空数据
 * @param type
 */
function getNewEvents(type: string) {
  const newEvents: { [type: string]: any } = {};
  props.allEvents.forEach((item: any) => {
    if (props.events[item.type].length === 0) {
      return false;
    }
    if (item.type === type) {
      return false;
    }
    newEvents[item.type] = props.events[item.type];
  });
  return newEvents;
}
</script>
<template>
  <div v-for="item in itemEvents" :key="item.type" class="aigen-event-item">
    <div class="aigen-event-info">
      <div class="aigen-event-label" :title="item.describe ?? item.description">
        {{ item.describe ?? item.description }}
      </div>
      <div
        class="aigen-event-btn text-$aigen-text-secondary flex items-center text-lg"
      >
        <AigenIcon
          name="icon--aigen--add-rounded"
          @click="handleOpen(item.type)"
        />
      </div>
    </div>
    <div class="aigen-action-editor-main">
      <VueDraggable
        v-model="props.events[item.type]"
        item-key="id"
        :component-data="{
          type: 'transition-group',
        }"
        group="option-list"
        handle=".handle"
        :animation="200"
      >
        <div
          v-for="(action, index) in props.events[item.type]"
          class="aigen-editor-item rounded"
          :key="action.id"
        >
          <div class="w-36px flex items-center text-lg">
            <AigenIcon
              class="handle text-$aigen-text-helper mr-2 cursor-move text-lg"
              name="icon--aigen--drag"
            />
          </div>
          <div class="flex-1">
            <div v-if="action.type === 'component'">
              {{ getLabel(action.componentId) }}
            </div>
            <div v-else-if="action.type === 'custom'">自定义函数</div>
            <div v-else-if="action.type === 'public'">公共函数</div>
            {{ action.methodName }}
          </div>
          <div class="aigen-action-box text-$aigen-text-helper text-lg">
            <div
              class="aigen-edit-btn"
              @click="handleEdit(index, item.type, action)"
            >
              <AigenIcon name="icon--aigen--page-info-outline-rounded" />
            </div>
            <div class="aigen-del-btn" @click="handleDelete(index, item.type)">
              <AigenIcon name="icon--aigen--delete-outline-rounded" />
            </div>
          </div>
        </div>
      </VueDraggable>
    </div>
  </div>
</template>
