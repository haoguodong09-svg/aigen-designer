<script lang="ts" setup>
import type {
  AigenNodeInstance,
  ComponentSchema,
  FieldStateType,
} from '@aigen-designer/types';

import type { AsyncComponentLoader } from 'vue';

import {
  computed,
  defineComponent,
  getCurrentInstance,
  markRaw,
  onBeforeUnmount,
  provide,
  reactive,
  ref,
  renderSlot,
  shallowRef,
  useAttrs,
  VNode,
  watch,
  watchEffect,
} from 'vue';

import {
  injectBuilderDisabled,
  injectBuilderReadonly,
  NODE_ATTRS_KEY,
  useBuilderContext,
  useFieldPathPrefix,
  useFormItem,
  usePageManager,
} from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import {
  capitalizeFirstLetter,
  deepClone,
  deepCompareAndModify,
  deepEqual,
  getValueByPath,
  setValueByPath,
} from '@aigen-designer/utils';

import dynamicFormItem from './dynamicFormItem.vue';

interface AigenNodeProps {
  componentSchema: ComponentSchema;
  isProperty?: boolean;
  modelValue?: any;
  ruleField?: string[];
  showHiddenItems?: boolean;
}
defineOptions({
  name: 'AigenNode',
});

const props = withDefaults(defineProps<AigenNodeProps>(), {
  isProperty: false,
  modelValue: undefined,
  ruleField: () => [],
  showHiddenItems: false,
});

// 定义组件的事件
const emit = defineEmits(['update:modelValue', 'change']);

const nodeInstance = getCurrentInstance();

// 表单formData数据
const { formData } = useFormItem();

const { fieldStateMap, slots } = useBuilderContext();
const disabled = injectBuilderDisabled();
const readonly = injectBuilderReadonly();
// 接收页面管理对象
const pageManager = usePageManager();
// 校验前缀字段
const fieldPathPrefix = useFieldPathPrefix();
const scopeName = computed(() => {
  if (fieldPathPrefix) {
    return fieldPathPrefix.join('.');
  }
  return 'default';
});

// 内部schema数据
const innerSchema = reactive<ComponentSchema>(
  deepClone(props.componentSchema, !props.isProperty),
);

// 双向绑定Value
const innerValue = computed({
  get: getBindValue,
  set: handleUpdate,
});
// 设计模式模式下，添加字段后缀
addDesignModeSuffix();

// 记录上一次触发组件重建的关键字段，用于判断是否需要重新初始化组件
let prevInitKey = '';

/**
 * 生成组件重建关键字段标识。
 * type/field/slotName 变化需要重建组件实例，defaultValue 变化需要重新应用默认值。
 * @returns 重建标识字符串
 */
function getInitKey() {
  const schema = props.componentSchema;
  let defaultValueKey = '';
  const defaultValue = schema?.props?.defaultValue;
  if (typeof defaultValue === 'object' && defaultValue !== null) {
    defaultValueKey = JSON.stringify(defaultValue);
  } else if (defaultValue !== undefined) {
    defaultValueKey = String(defaultValue);
  }
  return `${schema?.type ?? ''}|${schema?.field ?? ''}|${schema?.slotName ?? ''}|${defaultValueKey}`;
}

/**
 * 关键字段变化时重新初始化组件。
 * 普通 props 变化由 getProps 计算属性驱动重新渲染，无需重建组件实例。
 */
function maybeReinitComponent() {
  const key = getInitKey();
  if (key === prevInitKey) return;
  prevInitKey = key;
  initComponent();
}

// 监听 props.componentSchema 自身字段的变化，并同步更新内部schema数据。
// 采用 targeted watch（仅监听当前节点自身字段），避免任意子节点变化时
// 所有 AigenNode 实例同时触发 deepEqual + deepClone + deepCompareAndModify（O(n²×m)）；
// children 的变化由递归模板（edit-node 插槽）自然处理，无需在此监听。
watch(
  () => [
    props.componentSchema?.type,
    props.componentSchema?.field,
    props.componentSchema?.label,
    props.componentSchema?.props,
    props.componentSchema?.rules,
    props.componentSchema?.show,
    props.componentSchema?.on,
    props.componentSchema?.noFormItem,
    props.componentSchema?.slotName,
    props.componentSchema?.input,
  ],
  () => {
    const componentSchema = props.componentSchema;
    // 深度比较对象属性值是否变更, 忽略 children 节点
    if (deepEqual(innerSchema, componentSchema, ['children'])) {
      maybeReinitComponent();
      return;
    }
    deepCompareAndModify(innerSchema, deepClone(componentSchema, false));
    addDesignModeSuffix();
    maybeReinitComponent();
  },
  {
    // 深度遍历限定在当前节点自身字段（props 对象等），而非整个 schema 子树
    deep: true,
  },
);

/**
 * 获取表单项 数据
 */
function getBindValue() {
  return props.modelValue ?? getValueByPath(formData, innerSchema.field ?? '');
}

/**
 * 在设计模式下为innerSchema.field添加特殊后缀。
 * 此函数用于标识在设计模式下使用的字段，通过添加'-design-mode'后缀，
 * 可以区分运行时和设计时的数据字段，以便在设计工具中进行特殊处理。
 *
 * @remarks
 * 此函数仅在pageManager的isDesignMode为true时执行，确保只在设计模式下影响字段命名。
 * 如果innerSchema.field已经是字符串类型，则直接追加后缀，否则不进行处理。
 */
function addDesignModeSuffix() {
  // 检查当前是否处于设计模式
  // 检查是否是设计模式
  if (
    pageManager.isDesignMode.value && // 判断innerSchema.field的类型，仅在是字符串类型时追加后缀
    // 检查 innerSchema.field 是否为字符串类型
    typeof innerSchema.field === 'string'
  ) {
    // 给字段名添加设计模式后缀
    // 给 innerSchema.field 添加后缀 '-design-mode'
    innerSchema.field += '-design-mode';
  }
}

// 传递额外的attrs
const attrs = useAttrs();
if (Object.keys(attrs).length > 0) {
  provide(NODE_ATTRS_KEY, attrs);
}

// 定义组件及组件props字段
const componentRef = shallowRef<any>(null);
const checkPayload = ref<null | { message?: string; result?: boolean }>(null);

const fieldStateType = ref<FieldStateType | null>(null);
const fieldRequired = ref<boolean | null | undefined>(null);

// 字段状态变化时更新 fieldStateType/fieldRequired。
// 仅按当前节点自身字段 watch，fieldStateMap 重建但本节点状态对象未变时不触发，
// 避免所有节点级联执行 condition（性能优化）。
watch(
  () => {
    // 仅监听当前节点自身字段的状态对象；field 名变化时 getter 重新求值
    const fieldName = innerSchema?.field;
    return fieldName ? fieldStateMap.value?.[fieldName] : undefined;
  },
  (currentFieldState) => {
    if (!currentFieldState) {
      fieldStateType.value = null;
      fieldRequired.value = null;
      return;
    }

    const { condition, required, state } = currentFieldState;
    if (typeof condition === 'function') {
      // 条件型字段状态：值随表单数据变化，由下方 watchEffect 实时求值
      const matched = condition(formData);
      fieldStateType.value = matched ? state : null;
      fieldRequired.value = matched ? required : null;
    } else {
      fieldStateType.value = state;
      fieldRequired.value = required;
    }
  },
  {
    immediate: true,
  },
);

// 条件型字段状态依赖表单数据：仅存在 condition 的节点订阅 formData 变化，
// 无规则节点不订阅数据变化，避免级联执行 condition（性能优化）。
watchEffect(() => {
  const fieldName = innerSchema?.field;
  const currentFieldState = fieldName && fieldStateMap.value?.[fieldName];
  if (!currentFieldState || typeof currentFieldState.condition !== 'function') {
    return;
  }

  const matched = currentFieldState.condition(formData);
  fieldStateType.value = matched ? currentFieldState.state : null;
  fieldRequired.value = matched ? currentFieldState.required : null;
});

const show = computed(() => {
  // 设计模式且showHiddenItems为true时 显示隐藏组件，提供查看隐藏元素的能力
  if (props.showHiddenItems && pageManager.isDesignMode.value) return true;

  // fieldStateType 属性优先级最高
  if (fieldStateType.value === 'WRITE') {
    return true;
  } else if (innerSchema.props?.hidden || fieldStateType.value === 'HIDE') {
    return false;
  }

  // show属性为boolean类型则直接返回
  if (typeof innerSchema.show === 'boolean') {
    return innerSchema.show;
  }

  return innerSchema.show?.({ values: formData }) ?? true;
});

// 获取FormItemProps
const getFormItemProps = computed<ComponentSchema>(() => {
  let rules =
    show.value &&
    innerSchema.rules?.map((rule) => {
      const processedRule = { ...rule };

      if (processedRule.required !== undefined) {
        // 必填项优先级：fieldState.required > props.required > rules.required
        processedRule.required =
          fieldRequired.value ??
          innerSchema.props?.required ??
          processedRule.required;
      }

      // 处理自定义验证器
      if (rule.validator) {
        processedRule.validator =
          pageManager.funcs.value[rule.validator as string];
      }

      return processedRule;
    });

  const needsRequired =
    fieldRequired.value === true || innerSchema.props?.required;
  const hasRequiredRule =
    Array.isArray(rules) && rules.some((rule) => rule.required !== undefined);

  if (needsRequired && !hasRequiredRule) {
    const rule = {
      message: '必填项',
      required: true,
      trigger: ['change', 'blur'],
      type: 'string',
    };
    if (rules) {
      rules.push(rule);
    } else {
      rules = [rule];
    }
  }

  // 获取校验字段
  let model: string | string[] | undefined = innerSchema.field;

  if (props.ruleField && props.ruleField.length > 0) {
    // 设置为父级传入的校验字段
    model = props.ruleField;
  } else if (fieldPathPrefix && innerSchema.field) {
    // 添加校验字段前缀
    model = deepClone(fieldPathPrefix) as [];
    model.push(innerSchema.field);
  }

  const style = innerSchema.props?.style ?? {};
  const formItemProps = {
    ...innerSchema,
    ...attrs,
    field: model,
    rule: rules,
    rules,
    style: {
      ...style,
      width: undefined,
    },
  } as ComponentSchema;

  // 移除元素只读属性 children
  if (formItemProps.children) {
    delete formItemProps.children;
  }
  return formItemProps;
});

// 获取组件原配置
const getComponentConfig = computed(() => {
  const config = pluginManager.component.getComponentConfigByType(
    innerSchema.type,
  );
  // 组件配置为静态元数据（type/icon 等不可变字段），标记为 raw 避免不必要的响应式追踪
  return config ? markRaw(config) : null;
});

const hasFormItem = computed(() => {
  return (
    innerSchema.noFormItem !== true &&
    getComponentConfig.value?.defaultSchema.input
  );
});

// 获取组件props数据
const getProps = computed(() => {
  const bindModel = getComponentConfig.value?.bindModel ?? 'modelValue';
  const onEvent: { [type: string]: Function } = {};
  if (!pageManager.isDesignMode.value) {
    // 设计模式下，不添加事件 防止误触发事件
    innerSchema.on &&
      Object.keys(innerSchema.on).forEach((item) => {
        onEvent[`on${capitalizeFirstLetter(item)}`] = (...args) =>
          pageManager.doActions(
            innerSchema.on![item],
            scopeName.value,
            ...args,
          );
      });
  }

  const style = innerSchema.props?.style ?? {};
  const finalStyle = hasFormItem.value
    ? Object.fromEntries(
        (['height', 'width'] as const)
          .filter((k) => style[k] !== undefined && style[k] !== null)
          .map((k) => [k, style[k]]),
      )
    : style;
  return {
    ...props,
    ...attrs,
    ...innerSchema.props,
    bindModel,
    disabled:
      fieldStateType.value !== 'WRITE' &&
      (fieldStateType.value === 'DISABLED' ||
        disabled.value ||
        innerSchema.props?.disabled),
    hidden: !show.value,
    readonly:
      fieldStateType.value !== 'WRITE' &&
      (fieldStateType.value === 'READ' ||
        readonly.value ||
        innerSchema.props?.readonly),
    style: finalStyle,
    ...onEvent,
  };
});

function handleCheck(payload: { message?: string; result?: boolean }) {
  checkPayload.value = payload;
}

// 添加组件实例
function handleAddComponentInstance(vNode?: VNode) {
  if (show.value) {
    // 组件实例不存在时，标记成待加载项，存在时，移除待加载项
    (vNode ? pageManager.mountMonitor.pop : pageManager.mountMonitor.push)(
      innerSchema.id as string,
    );
  }

  const instance = (vNode?.component ?? nodeInstance) as AigenNodeInstance;
  if (!innerSchema.id || !instance) {
    return;
  }

  // 确保 instance.exposed 对象存在
  instance.exposed ??= {};

  // 输入组件则添加setValue方法
  if (innerSchema.input) {
    instance.exposed.setValue = handleUpdate;
    instance.exposed.getValue = getBindValue;
  }

  instance.exposed.schema = innerSchema;

  // 添加属性设置方法
  instance.exposed.setAttr = (key: string, value: any) => {
    // 确保 props 属性对象存在
    innerSchema.props ??= {};
    return (innerSchema.props[key] = value);
  };

  // 添加获取设置方法
  instance.exposed.getAttr = (key: string) => {
    return innerSchema.props?.[key];
  };

  pageManager.addComponentInstance(innerSchema.id, instance, scopeName.value);
}

/**
 * 移除组件实例
 */
function handleVnodeUnmounted() {
  if (innerSchema.id) {
    // 移除实例 及 formItem实例
    pageManager.removeComponentInstance(innerSchema.id, scopeName.value);
    if (
      getComponentConfig.value?.defaultSchema.input &&
      innerSchema.noFormItem !== true
    ) {
      pageManager.removeComponentInstance(`${innerSchema.id}_formItem`);
    }
  }
}

/**
 * 初始化组件
 */
async function initComponent() {
  // 如果存在默认值，则会在初始化之后赋值
  if (innerSchema.props?.defaultValue !== undefined) {
    const defaultValue = pageManager.isDesignMode.value
      ? innerSchema.props?.defaultValue
      : (getValueByPath(formData, innerSchema.field!) ??
        innerSchema.props?.defaultValue);

    handleUpdate(deepClone(defaultValue), true);
  }

  await pluginManager.hook.execute('nodeRender', innerSchema);

  // 组件为slot类型时
  if (innerSchema.type === 'slot') {
    const slotName = innerSchema.slotName;
    if (!slotName) return;

    componentRef.value = defineComponent({
      setup() {
        return () =>
          renderSlot(slots, slotName, {
            componentSchema: innerSchema,
            model: formData,
          });
      },
    });

    return;
  }

  // 内置组件
  const cmp = pluginManager.component.get(innerSchema.type);
  // 内部不存在组件
  if (!cmp) {
    console.error(`组件${innerSchema.type}未注册`);
    pageManager.mountMonitor.pop(innerSchema.id as string);
    return;
  }

  // 如果数据项为函数，则判定为懒加载组件
  if (typeof cmp === 'function') {
    const res = await (cmp as AsyncComponentLoader)();
    componentRef.value = res.default ?? res;
  } else {
    // 否则为预加载组件
    componentRef.value = cmp;
  }
}

/**
 * 通过函数更新值
 * @param value value值
 * @param isInit 是否初始化
 */
function handleUpdate(value: any, isInit?: boolean) {
  const oldValue = getBindValue();
  // 值相同时,无需重复更新数据
  if (value === oldValue) {
    return;
  }
  if (innerSchema.field) {
    setValueByPath(formData, innerSchema.field, value);
    // 触发formChange钩子
    if (!isInit) {
      pageManager.hook.execute('formChange', {
        field: innerSchema.field,
        formData,
        value,
      });
    }
  }
  emit('update:modelValue', value);
  emit('change', value);
}

// 组件实例重建由上面 targeted watch 内的 maybeReinitComponent 驱动：
// 以关键字段（type/field/slotName/defaultValue）替代 innerSchema 的 JSON.stringify
// 序列化检测，避免每次变化都对整棵 schema 做 O(n×m) 的序列化比较。

// 初始化组件（type/field/slotName/defaultValue 变化时由 maybeReinitComponent 驱动重建）
maybeReinitComponent();

// 添加组件实例
handleAddComponentInstance();

// 组件卸载时移除组件实例
onBeforeUnmount(handleVnodeUnmounted);
</script>
<template>
  <dynamicFormItem
    v-if="componentRef && show"
    :check-payload="checkPayload"
    :has-form-item="hasFormItem"
    :form-item-props="getFormItemProps"
  >
    <component
      :is="componentRef"
      v-bind="getProps"
      v-model:[getProps.bindModel]="innerValue"
      :model="formData"
      @check="handleCheck"
      :class="{
        'aigen-hidden': innerSchema.props?.hidden,
        'aigen-readonly': getProps.readonly,
      }"
      @vue:mounted="handleAddComponentInstance"
    >
      <!-- 嵌套组件递归 start -->
      <!-- 渲染子组件 start -->
      <template #node="data">
        <AigenNode v-bind="data" />
      </template>
      <!-- 渲染子组件 end -->
      <!-- 渲染布局设计子组件列表 start -->
      <template #edit-node>
        <slot name="edit-node"></slot>
      </template>
      <!-- 渲染布局设计子组件列表 end -->
    </component>
  </dynamicFormItem>
</template>
