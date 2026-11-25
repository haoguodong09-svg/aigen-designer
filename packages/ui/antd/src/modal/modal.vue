<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed, ref, useAttrs, useSlots } from 'vue';

import { Button, Modal, Space, version } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    cancelText?: string;
    componentSchema?: ComponentSchema;
    fixedHeight?: boolean;
    footer?: boolean;
    hideConfirm?: boolean;
    okText?: string;
  }>(),
  {
    cancelText: '关闭',
    componentSchema: () => ({
      type: 'modal',
    }),
    fixedHeight: true,
    footer: true,
    okText: '确定',
  },
);
const emits = defineEmits(['ok', 'close', 'update:modelValue']);
const versionArray = version.split('.');
const firstNumber = Number.parseInt(versionArray[0]);

const attrs = useAttrs();
const slots = useSlots();
const confirmLoading = ref(false);
const customTitle = ref<null | string>(null);

const dialogStyle = {
  bottom: '30px',
  left: '150px',
  minHeight: '500px',
  minWidth: '700px',
  position: 'absolute',
  right: '150px',
  top: '56px',
  width: 'auto',
};

const getProps = computed<Record<string, any>>(() => ({
  ...props.componentSchema,
  ...attrs,
  bodyStyle: {
    height: props.fixedHeight ? 'calc(100vh - 108px)' : 'auto',
    padding: 0,
  },
  confirmLoading: confirmLoading.value,
  dialogStyle,
  footer: null,
  'onUpdate:open': updateModelValue,
  'onUpdate:visible': updateModelValue,
  open: attrs.modelValue,
  style: props.fixedHeight ? 'top:20px' : '',
  title: customTitle.value ?? props.componentSchema?.label ?? '',
  visible: firstNumber > 3 ? undefined : attrs.modelValue,
  wrapClassName: 'aigen-modal-ant',
  children: null,
}));

const children = computed(() => props.componentSchema?.children ?? []);
const titleSlotNodes = computed(
  () => props.componentSchema?.slots?.title ?? [],
);
const footerSlotNodes = computed(
  () => props.componentSchema?.slots?.footer ?? [],
);
const hasTitleSlot = computed(() =>
  Boolean(slots.title || props.componentSchema?.slots?.title),
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
  <Modal v-bind="getProps">
    <template v-if="hasTitleSlot" #title>
      <slot name="title">
        <slot
          v-for="item in titleSlotNodes"
          name="node"
          :component-schema="item"
        ></slot>
      </slot>
    </template>
    <div class="aigen-modal-main aigen-scoped">
      <slot>
        <slot name="edit-node">
          <slot
            v-for="item in children"
            name="node"
            :component-schema="item"
          ></slot>
        </slot>
      </slot>
    </div>
    <div v-if="hasFooterSlot" class="aigen-modal-footer">
      <slot name="footer">
        <slot
          v-for="item in footerSlotNodes"
          name="node"
          :component-schema="item"
        ></slot>
      </slot>
    </div>
    <div v-else-if="props.footer" class="aigen-modal-footer">
      <Space align="end">
        <Button @click="handleClose"> {{ props.cancelText }} </Button>
        <Button
          v-if="!props.hideConfirm"
          :loading="confirmLoading"
          type="primary"
          @click="handleOk"
        >
          {{ props.okText }}
        </Button>
      </Space>
    </div>
  </Modal>
</template>
