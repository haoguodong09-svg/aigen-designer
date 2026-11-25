<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, ref, useAttrs, useSlots } from 'vue';

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
const slots = useSlots();
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
    <template v-if="hasHeaderSlot" #header>
      <slot name="header">
        <slot
          v-for="node in headerSlotNodes"
          name="node"
          :component-schema="node"
        ></slot>
      </slot>
    </template>
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

    <div v-if="hasFooterSlot" class="aigen-modal-footer">
      <slot name="footer">
        <slot
          v-for="node in footerSlotNodes"
          name="node"
          :component-schema="node"
        ></slot>
      </slot>
    </div>
    <div v-else class="aigen-modal-footer">
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
