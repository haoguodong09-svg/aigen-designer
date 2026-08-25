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
  <!-- 根节点必须是元素（display: contents 不产生盒子、不影响布局）：
       设计器节点链上可能存在运行时指令（如父级 v-show / 组件库内部指令），
       若根是非元素（组件/slot），Vue 会告警 "Runtime directive used on
       component with non-element root node" 且指令无法生效。 -->
  <div
    v-if="props.hasFormItem"
    class="aigen-form-item-wrap"
    style="display: contents"
  >
    <FormItem
      :check-payload="props.checkPayload"
      v-bind="props.formItemProps"
      :class="{ 'aigen-hidden': props.formItemProps.props?.hidden }"
      @vue:mounted="addFormItemInstance"
    >
      <slot></slot>
    </FormItem>
  </div>
  <!-- 无FormItem start -->
  <div v-else class="aigen-form-item-wrap" style="display: contents">
    <slot></slot>
  </div>
  <!-- 无FormItem end -->
</template>
