<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, ref, useAttrs } from 'vue';

import { NButton, NModal, NSpace } from 'naive-ui';

const props = withDefaults(
  defineProps<{
    cancelText?: string;
    componentSchema?: ComponentSchema;
    hideConfirm?: boolean;
    okText?: string;
    width?: string;
  }>(),
  {
    cancelText: '关闭',
    componentSchema: () => ({
      type: 'modal',
    }),
    okText: '确定',
    width: '900px',
  },
);

const emit = defineEmits(['ok', 'close', 'update:modelValue']);
const attrs = useAttrs();
const confirmLoading = ref(false);
const customTitle = ref<null | string>(null);

const getProps = computed<Record<string, any>>(() => ({
  ...props.componentSchema,
  class: 'aigen-modal-n',
  preset: 'card',
  show: attrs.modelValue,
  title: customTitle.value ?? props.componentSchema?.label ?? '',
}));

const children = computed(() => props.componentSchema?.children ?? []);

const handleOk = () => {
  emit('ok');
};

function updateModelValue(value = false) {
  emit('update:modelValue', value);
}

function handleClose() {
  emit('close');
}

function open() {
  updateModelValue(true);
}

function close() {
  updateModelValue(false);
}

function toggle() {
  updateModelValue(!attrs.modelValue);
}

function setConfirmLoading(loading: boolean) {
  confirmLoading.value = loading;
}

function setTitle(title: string) {
  customTitle.value = title;
}

defineExpose({
  close,
  open,
  setConfirmLoading,
  setTitle,
  toggle,
});
</script>

<template>
  <NModal
    v-bind="getProps"
    :title="customTitle ?? getProps.label ?? ''"
    class="aigen-modal-n aigen-scoped"
    preset="card"
    :style="{ width }"
    @update:show="updateModelValue"
  >
    <div class="aigen-modal-main">
      <slot>
        <slot name="edit-node">
          <template v-if="children.length > 0">
            <slot
              v-for="node in children"
              name="node"
              :component-schema="node"
            ></slot>
          </template>
        </slot>
      </slot>
    </div>

    <div class="aigen-modal-footer">
      <NSpace justify="end">
        <NButton @click="handleClose"> {{ props.cancelText }} </NButton>
        <NButton
          v-if="!props.hideConfirm"
          :loading="confirmLoading"
          type="primary"
          @click="handleOk"
        >
          {{ props.okText }}
        </NButton>
      </NSpace>
    </div>
  </NModal>
</template>
