<script lang="ts" setup>
import type { ComponentSchema, FormDataModel } from '@aigen-designer/types';
import type { FormInst } from 'naive-ui';

import { computed, onMounted, ref } from 'vue';

import { provideBuilderDisabled, useForm } from '@aigen-designer/hooks';
import { deepClone, findSchemas } from '@aigen-designer/utils';
import { NForm } from 'naive-ui/lib/form';

interface FormInstance extends InstanceType<typeof NForm> {
  clearValidate?: () => void;
  getData?: () => FormDataModel;
  resetData: () => void;
  setData?: (data: FormDataModel) => void;
}

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    componentSchema: ComponentSchema;
    disabled?: boolean;
  }>(),
  {
    componentSchema: () => ({ type: '' }),
    disabled: false,
  },
);

provideBuilderDisabled(computed(() => props.disabled));

const form = ref<FormInstance | null>(null);
const { formData, formInstances } = useForm(
  props.componentSchema?.props?.name ?? 'default',
);
/**
 * 获取表单数据
 */
function getData(): FormDataModel {
  return formData;
}

/**
 * 设置表单数据
 * @param data
 */
function setData(data: FormDataModel) {
  Object.assign(formData, data);
}

/**
 * 重置表单数据
 * 语义与 antd/elementPlus 的 resetFields 对齐：将各字段重置为 schema 默认值，
 * 无默认值时置空；默认值深拷贝赋值，避免与 schema 共享引用
 */
function resetData() {
  form.value?.restoreValidation();

  const inputSchemas = findSchemas(
    props.componentSchema.children ?? [],
    (schema) => Boolean(schema.input),
  );

  if (Array.isArray(inputSchemas)) {
    inputSchemas.forEach((schema) => {
      const defaultValue = schema.props?.defaultValue;
      formData[schema.field!] =
        defaultValue === undefined ? undefined : deepClone(defaultValue);
    });
  }
}

/**
 * 校验表单数据
 */
function validate(): ReturnType<FormInst['validate']> | undefined {
  return form.value?.validate();
}

/**
 * 清除的表单验证信息
 */
function clearValidate() {
  return form.value?.restoreValidation();
}

// form组件需要特殊处理
onMounted(async (): Promise<void> => {
  if (
    props.componentSchema?.type === 'form' &&
    formInstances.value &&
    form.value
  ) {
    const name =
      props.componentSchema?.props?.name ??
      props.componentSchema?.name ??
      ('default' as string);

    formInstances.value[name] = form.value as any;
    form.value.getData = getData;
    form.value.setData = setData;
    form.value.resetData = resetData;
  }
});

const formProps = computed(() => {
  const recordProps = props.componentSchema!.props;
  // labelLayout 对齐 antd 语义：fixed 固定标签宽度 / flex 自适应标签宽度
  // naive-ui 通过 label-width 控制：fixed 使用配置的 labelWidth，flex 使用 auto 自适应
  if (recordProps.labelLayout === 'flex') {
    return {
      ...recordProps,
      labelWidth: 'auto',
    };
  }
  return recordProps;
});

const children = computed(() => {
  return props.componentSchema!.children ?? [];
});

defineExpose({
  clearValidate,
  form,
  getData,
  resetData,
  setData,
  validate,
});
</script>
<template>
  <NForm ref="form" :model="formData" v-bind="formProps">
    <slot name="edit-node">
      <slot
        v-for="item in children"
        name="node"
        :component-schema="item"
      ></slot>
    </slot>
  </NForm>
</template>
