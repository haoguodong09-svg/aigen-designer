<script lang="ts" setup>
import type {
  ComponentSchema,
  JSExpressionBinding,
} from '@aigen-designer/types';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  watchEffect,
} from 'vue';

import { AigenIcon, AigenNode } from '@aigen-designer/base-ui';
import { useDesignerContext, useTableMeta } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import {
  deepClone,
  getValueByPath,
  setValueByPath,
} from '@aigen-designer/utils';

import VariableBindModal from './VariableBindModal.vue';

const props = defineProps<{
  schema: ComponentSchema;
}>();
const designer = useDesignerContext();
const pageSchema = designer.pageSchema;
const revoke = designer.revoke;

const selectedNode = computed(() => {
  return designer.state.selectedNode;
});
const tableMeta = useTableMeta(pluginManager);

function isShow(item: ComponentSchema) {
  // show属性为boolean类型则直接返回
  if (typeof item.show === 'boolean') {
    return item.show;
  }

  // show属性为function类型则执行
  if (typeof item.show === 'function') {
    return item.show?.({
      tableMeta: tableMeta.value,
      values: selectedNode.value!,
    });
  }

  return true;
}
const componentConfigs = pluginManager.component.getComponentConfigs();

// 获取组件属性配置
const componentAttributes = computed(() => {
  if (!selectedNode.value || !selectedNode.value.type) {
    return [];
  }

  const baseAttributes =
    componentConfigs[selectedNode.value.type]?.config?.attribute ?? [];
  const allAttributes = [...baseAttributes];

  if (selectedNode.value.id === pageSchema.schemas[0]?.id) {
    allAttributes.push(
      {
        editData: pageSchema,
        field: 'canvas.width',
        label: '画布宽度',
        type: 'AigenInputSize',
      },
      {
        editData: pageSchema,
        field: 'canvas.height',
        label: '画布高度',
        type: 'AigenInputSize',
      },
    );
  }

  return allAttributes;
});

/**
 * 设置属性值
 */
function handleSetValue(
  value: any,
  field: string,
  item: ComponentSchema,
  editData: null | object = selectedNode.value,
) {
  if (typeof item.onChange === 'function') {
    item.onChange({
      componentAttributes,
      tableMeta: tableMeta?.value,
      value,
      values: editData!,
    });
  }
  // 判断是否同步修改属性值
  if (item.changeSync) {
    setValueByPath(editData!, field, value);
  } else {
    nextTick(() => {
      setValueByPath(editData!, field, value);
    });
  }
  // 将修改过的组件属性推入撤销操作的栈中
  revoke.push('属性编辑');
}

const modelValue = ref();
const bindModalOpen = ref(false);
const helpPopoverOpen = ref(false);

const hasLabelHelp = computed(() =>
  Boolean(props.schema.field || props.schema.description),
);

const labelHelpTitle = computed(() => {
  if (!hasLabelHelp.value) {
    return props.schema.label ?? '';
  }
  return `${props.schema.field ?? ''}${props.schema.description ? ` — ${props.schema.description}` : ''}`;
});

const isBound = computed(() =>
  Boolean(
    modelValue.value &&
      typeof modelValue.value === 'object' &&
      (modelValue.value as Record<string, unknown>).type === 'JSExpression',
  ),
);

const boundExpressionValue = computed(() =>
  isBound.value
    ? String((modelValue.value as JSExpressionBinding).value ?? '')
    : '',
);

const canBind = computed(
  () =>
    props.schema.bindable !== false &&
    Boolean(props.schema.field) &&
    !props.schema.editData,
);

function handleConfirmBinding(binding: JSExpressionBinding) {
  if (!props.schema.field) {
    return;
  }
  modelValue.value = binding;
  handleSetValue(
    binding,
    props.schema.field,
    props.schema,
    props.schema.editData,
  );
}

function handleRemoveBinding() {
  if (!props.schema.field) {
    return;
  }
  const defaultSchema = selectedNode.value?.type
    ? componentConfigs[selectedNode.value.type]?.defaultSchema
    : undefined;
  const fallbackValue = defaultSchema
    ? getValueByPath(defaultSchema, props.schema.field)
    : undefined;
  const nextValue =
    fallbackValue !== null && typeof fallbackValue === 'object'
      ? deepClone(fallbackValue)
      : fallbackValue;

  modelValue.value = nextValue;
  handleSetValue(
    nextValue,
    props.schema.field,
    props.schema,
    props.schema.editData,
  );
}

function handleOutsideClick() {
  helpPopoverOpen.value = false;
}

watch(
  () => selectedNode.value?.id,
  () => {
    helpPopoverOpen.value = false;
  },
);

watch(helpPopoverOpen, (open) => {
  if (open) {
    window.addEventListener('click', handleOutsideClick);
  } else {
    window.removeEventListener('click', handleOutsideClick);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleOutsideClick);
});

watchEffect(() => {
  modelValue.value = getValueByPath(
    props.schema.editData ?? selectedNode.value!,
    props.schema.field!,
  );
});
</script>
<template>
  <div
    v-if="isShow(props.schema)"
    class="aigen-attr-item"
    :class="props.schema.layout"
  >
    <div
      v-if="props.schema.label"
      class="aigen-attr-label"
      :title="labelHelpTitle"
    >
      <span
        v-if="hasLabelHelp"
        class="aigen-attr-label-trigger"
        @click.stop="helpPopoverOpen = !helpPopoverOpen"
      >
        {{ props.schema.label }}
      </span>
      <template v-else>{{ props.schema.label }}</template>
    </div>
    <div
      v-if="hasLabelHelp && helpPopoverOpen"
      class="aigen-attr-help-popover"
      @click.stop
    >
      <div v-if="props.schema.field" class="aigen-attr-help-popover__field">
        <code>{{ props.schema.field }}</code>
      </div>
      <div
        v-if="props.schema.description"
        class="aigen-attr-help-popover__desc"
      >
        {{ props.schema.description }}
      </div>
    </div>
    <div
      class="aigen-attr-input"
      :class="{ 'block!': props.schema.layout === 'vertical' }"
    >
      <div
        v-if="isBound"
        class="aigen-attr-bound-pill"
        @click="bindModalOpen = true"
      >
        <span class="aigen-attr-bound-text">
          已绑定：{{ boundExpressionValue }}
        </span>
        <AigenIcon
          name="icon--aigen--minus-rounded"
          class="aigen-attr-bound-clear"
          title="移除绑定"
          @click.stop="handleRemoveBinding"
        />
      </div>
      <div v-else class="aigen-attr-control">
        <AigenNode
          is-property
          :component-schema="{
            ...props.schema,
            props: {
              ...props.schema.props,
              ...(props.schema.field === 'props.defaultValue'
                ? selectedNode?.props
                : {}),
              input: false,
              field: undefined,
              hidden: false,
              placeholder: props.schema.props?.placeholder,
            },
            show: true,
            noFormItem: true,
          }"
          v-model="modelValue"
          @update:model-value="
            handleSetValue(
              $event,
              props.schema.field!,
              props.schema,
              props.schema.editData,
            )
          "
        />
      </div>
      <button
        v-if="canBind"
        type="button"
        class="aigen-attr-bind-btn"
        :class="{ 'is-bound': isBound }"
        title="绑定变量 / JS表达式"
        @click="bindModalOpen = true"
      >
        &gt;_
      </button>
    </div>
    <VariableBindModal
      v-model:open="bindModalOpen"
      :model-value="modelValue"
      :field-label="props.schema.label"
      :field-name="props.schema.field"
      @confirm="handleConfirmBinding"
      @remove="handleRemoveBinding"
    />
  </div>
</template>
<style lang="less" scoped>
.aigen-attr-item {
  position: relative;
}

.aigen-attr-control {
  flex: 1;
  min-width: 0;
}

.aigen-attr-help-popover {
  position: absolute;
  top: 100%;
  left: 12px;
  z-index: 40;
  min-width: 180px;
  max-width: 260px;
  margin-top: 4px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--aigen-border);
  background: var(--aigen-designer-background, var(--aigen-background, #fff));
  color: var(--aigen-text-main);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.14);
  font-size: 12px;
  line-height: 1.5;

  &__field {
    font-weight: 600;
    color: var(--aigen-primary);
    word-break: break-all;

    code {
      font-family: monospace;
    }
  }

  &__desc {
    margin-top: 2px;
    color: var(--aigen-text-helper, #64748b);
    word-break: break-word;
  }
}
</style>
