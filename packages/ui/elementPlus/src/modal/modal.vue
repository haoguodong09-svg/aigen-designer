<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, ref, useAttrs } from 'vue';

import { ElButton, ElDialog } from 'element-plus';

const props = withDefaults(
  defineProps<{
    cancelText?: string;
    componentSchema?: ComponentSchema;
    hideConfirm?: boolean;
    okText?: string;
  }>(),
  {
    cancelText: '关闭',
    componentSchema: () => ({
      type: 'modal',
    }),
    okText: '确定',
  },
);

const emits = defineEmits(['ok', 'close', 'update:modelValue']);
const attrs = useAttrs();
const confirmLoading = ref(false);
const customTitle = ref<null | string>(null);

const getProps = computed<Record<string, any>>(() => ({
  ...props.componentSchema,
  ...attrs,
  class: 'aigen-el-modal aigen-scoped',
  'destroy-on-close': true,
  title: customTitle.value ?? props.componentSchema?.label ?? '',
}));

const children = computed(() => props.componentSchema?.children ?? []);

function handleOk() {
  emits('ok');
}

function updateModelValue(value = false) {
  emits('update:modelValue', value);
}

function handleClose() {
  emits('close');
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
  <ElDialog
    v-bind="getProps"
    :title="customTitle ?? getProps.label ?? ''"
    destroy-on-close
    append-to-body
    @update:model-value="updateModelValue"
  >
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
    <template #footer>
      <div class="aigen-el-modal-footer">
        <ElButton @click="handleClose"> {{ props.cancelText }} </ElButton>
        <ElButton
          v-if="!props.hideConfirm"
          :loading="confirmLoading"
          type="primary"
          @click="handleOk"
        >
          {{ props.okText }}
        </ElButton>
      </div>
    </template>
  </ElDialog>
</template>
