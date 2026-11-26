<script lang="ts" setup>
import type { VNode } from 'vue';

import { computed, onUpdated, ref, useAttrs } from 'vue';

import { FormItem } from 'ant-design-vue';

type FormItemCheckPayload = {
  message?: string;
  result?: boolean;
};

const props = defineProps<{
  checkPayload?: FormItemCheckPayload | null;
}>();

const rawAttrs = useAttrs();
const hostElRef = ref<HTMLElement | null>(null);

// Ant Design Vue FormItem 会将非 class 的 $attrs 透传给内部 .ant-form-item-row，
// 此处将其中的定位/布局属性同步回外层 .ant-form-item 根节点，确保无壳直出语义一致
function syncAttrsToHost(el?: HTMLElement | null) {
  const host = el ?? hostElRef.value;
  if (!(host instanceof HTMLElement)) return;
  hostElRef.value = host;

  const aigenId = rawAttrs['data-aigen-id'];
  if (typeof aigenId === 'string' && aigenId) {
    host.dataset.aigenId = aigenId;
    const row = host.querySelector(':scope > .ant-form-item-row');
    if (row instanceof HTMLElement && row.dataset.aigenId === aigenId) {
      delete row.dataset.aigenId;
    }
  }

  const draggable = rawAttrs.draggable;
  if (draggable !== undefined && draggable !== null) {
    host.setAttribute('draggable', String(draggable));
  }

  host.addEventListener('dragstart', (rawAttrs.onDragstart as any) ?? null);
  host.addEventListener('dragend', (rawAttrs.onDragend as any) ?? null);
  host.addEventListener('contextmenu', (rawAttrs.onContextmenu as any) ?? null);

  const styleObj = rawAttrs.style as Record<string, any> | undefined;
  if (styleObj && typeof styleObj === 'object') {
    for (const [k, v] of Object.entries(styleObj)) {
      if (v !== undefined && v !== null && v !== '') {
        (host.style as any)[k] = String(v);
      } else {
        (host.style as any)[k] = '';
      }
    }
  }
}

function handleMounted(vnode: VNode) {
  syncAttrsToHost(vnode.el as HTMLElement | null);
}

onUpdated(() => {
  syncAttrsToHost();
});

const attrs = computed<any>(() => {
  const {
    draggable: _draggable,
    onContextmenu: _onContextmenu,
    onDragend: _onDragend,
    onDragstart: _onDragstart,
    style: _style,
    ...rest
  } = rawAttrs;
  if (!props.checkPayload) {
    return rest;
  }

  return {
    ...rest,
    help:
      props.checkPayload.message ??
      (props.checkPayload.result ? '校验通过' : '校验失败'),
    validateStatus: props.checkPayload.result ? 'success' : 'error',
  };
});
</script>
<template>
  <FormItem v-bind="attrs" :name="attrs.field" @vue:mounted="handleMounted">
    <slot></slot>
  </FormItem>
</template>
