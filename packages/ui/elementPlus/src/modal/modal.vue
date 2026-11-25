<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, ref, useAttrs, useSlots } from 'vue';

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
const slots = useSlots();
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
const headerSlotNodes = computed(
  () => props.componentSchema?.slots?.header ?? [],
);
const footerSlotNodes = computed(
  () => props.componentSchema?.slots?.footer ?? [],
);
const hasHeaderSlot = computed(() =>
  Boolean(slots.header || props.componentSchema?.slots?.header),
);
const hasFooterSlot = computed(() =>
  Boolean(slots.footer || props.componentSchema?.slots?.footer),
);

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
    <template v-if="hasHeaderSlot" #header>
      <slot name="header">
        <slot
          v-for="node in headerSlotNodes"
          name="node"
          :component-schema="node"
        ></slot>
      </slot>
    </template>
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
        <slot v-if="hasFooterSlot" name="footer">
          <slot
            v-for="node in footerSlotNodes"
            name="node"
            :component-schema="node"
          ></slot>
        </slot>
        <template v-else>
          <ElButton @click="handleClose"> {{ props.cancelText }} </ElButton>
          <ElButton
            v-if="!props.hideConfirm"
            :loading="confirmLoading"
            type="primary"
            @click="handleOk"
          >
            {{ props.okText }}
          </ElButton>
        </template>
      </div>
    </template>
  </ElDialog>
</template>
