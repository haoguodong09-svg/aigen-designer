<script lang="ts" setup>
import type { AigenNodeInstance, ComponentSchema } from '@aigen-designer/types';

import type { VNode } from 'vue';

import { usePageManager } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';

type FormItemCheckPayload = {
  message?: string;
  result?: boolean;
};

defineOptions({
  inheritAttrs: false,
});
const props = defineProps<{
  checkPayload?: FormItemCheckPayload | null;
  formItemProps: ComponentSchema;
  hasFormItem?: boolean;
}>();

// 接收页面管理对象
const pageManager = usePageManager();
// 获取插件管理器中的表单项组件
const FormItem = pluginManager.component.get('form-item');

/**
 * 当 FormItem 组件挂载时，向父组件发送 formItemRef
 */
const addFormItemInstance = (vNode: VNode) => {
  if (vNode.component) {
    pageManager.addComponentInstance(
      `${props.formItemProps.id}_formItem`,
      vNode.component as AigenNodeInstance,
    );
  }
};
</script>

<template>
  <FormItem
    v-if="props.hasFormItem"
    :check-payload="props.checkPayload"
    :data-aigen-id="props.formItemProps?.id"
    v-bind="props.formItemProps"
    :class="{ 'aigen-hidden': props.formItemProps.props?.hidden }"
    @vue:mounted="addFormItemInstance"
  >
    <slot></slot>
  </FormItem>
  <slot v-else></slot>
</template>
