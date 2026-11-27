<script lang="ts" setup>
import type { PageManager } from '@aigen-designer/manager';
import type {
  AigenNodeInstance,
  ComponentSchema,
  FieldStateMap,
  FieldStates,
  FormDataModel,
  PageSchema,
} from '@aigen-designer/types';

import { computed, getCurrentInstance, provide, useSlots, watch } from 'vue';

import { AigenBaseLoader, AigenNode } from '@aigen-designer/base-ui';
import {
  BUILDER_KEY,
  createEventBus,
  FORM_CONTEXT_KEY,
  FORM_INSTANCES_KEY,
  provideBuilderDisabled,
  provideBuilderReadonly,
  providePageManager,
} from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { setupPage } from '@aigen-designer/panel-ui';
import {
  adaptLegacySchema,
  deepClone,
  deepCompareAndModify,
  findSchemas,
  migrateComponentProps,
  reorganizeSchemasForTableView,
} from '@aigen-designer/utils';

import { useBuilder } from '../hooks/useBuilder';

// 定义组件的 props 类型
const props = defineProps<{
  /** 禁用表单 */
  disabled?: boolean;
  /** 字段状态规则 */
  fieldStates?: FieldStates;
  /** 表单数据 */
  formData?: FormDataModel;
  /** 页面 schema */
  pageSchema: null | PageSchema;
  /** 只读表单 */
  readonly?: boolean;
  tableView?: boolean;
}>();
// 定义事件
const emit = defineEmits<{
  change: [
    context: {
      field: string;
      formData: FormDataModel;
      value: any;
    },
  ];
  ready: [pageManager: PageManager];
}>();

setupPage(pluginManager);

const AigenBuilderSlot = pluginManager.component.get('aigenBuilderSlot');
// 使用 hooks 获取表单相关方法和状态
const {
  formInstances,
  getData,
  getFormInstance,
  getForms,
  pageManager,
  ready,
  resetData,
  setData,
  setForms,
  validate,
  validateAll,
} = useBuilder();

// 监听 pageSchema 的变化，并更新 pageManager.pageSchema
// 注：采用浅层 watch + 显式依赖列表，pageSchema 需按引用整体替换，
// 避免深层次变化触发 4 次全树遍历（deepClone + migrate + reorganize + diff）；
// Worker 化（postToWorker('processSchema', ...)）为批次 2 联调项，依赖
// packages/manager/src/schemaWorkerBridge.ts（W16），当前保持同步流水线。
watch(
  [() => props.pageSchema, () => props.tableView],
  () => {
    if (!props.pageSchema?.schemas?.length) return;
    const newSchema = deepClone(props.pageSchema);

    migrateComponentProps(newSchema, true);

    if (props.tableView) {
      reorganizeSchemasForTableView(newSchema);
    }

    // 存量 FieldLink 零中断升轨为声明式 ReactiveRule，并剥离旧编译器产物（linkId 动作），
    // 避免「响应式规则 + 旧编译动作」双重执行。升轨发生在运行时 schema 副本上，
    // 不污染设计器中的原始数据。
    adaptLegacySchema(newSchema);

    deepCompareAndModify(pageManager.pageSchema, newSchema);
    // 预览/运行态加载或切换 pageSchema 时同步重置页面变量初值
    pageManager.vars.value = deepClone(newSchema.vars ?? {});
    // schema 应用完成后立即求值一次：首屏联动（数据回填）无需等待用户交互即可生效
    pageManager.reactiveEngine?.evaluateAllRules();
    // 依赖 Vue 响应式系统按变更局部更新，不再强制全量 Suspense 重挂载；
    // 确需重置挂载状态时仅重置挂载监视器即可
    pageManager.mountMonitor.reset();
    // 重新注册新 schema 中所有组件的 pendingIds，防止 isAllMounted 提前为 true
    const registerPendingIds = (schemas: ComponentSchema[]) => {
      for (const schema of schemas) {
        if (schema.id) {
          pageManager.mountMonitor.push(schema.id);
        }
        if (schema.children && schema.children.length > 0) {
          registerPendingIds(schema.children);
        }
      }
    };
    registerPendingIds(pageManager.pageSchema.schemas || []);
  },
  {
    immediate: true,
  },
);

// 监听 formData 的变化，并设置表单数据
// 注：去掉 deep watch，formData 按引用整体替换即可——setData 内部已有合并逻辑，
// 深层次 watch 会在每次嵌套字段变化时触发，造成无谓开销
watch(
  () => props.formData,
  (data) => {
    if (data) {
      setData(data);
    }
  },
  {
    immediate: true,
  },
);

createEventBus();
// 提供依赖注入的上下文
provideBuilderDisabled(computed(() => props.disabled));
provideBuilderReadonly(computed(() => props.readonly));
provide(BUILDER_KEY, {
  fieldStateMap: computed(() => {
    //  将fieldStates转换对象类型
    const fieldStateMap: FieldStateMap = {};
    props.fieldStates?.forEach((fieldState) => {
      fieldStateMap[fieldState.field] = fieldState;
    });
    return fieldStateMap;
  }),
  slots: useSlots(),
});
providePageManager(pageManager);

// 页面级共享表单数据：不在 <form> 内的元素共享同一份数据，
// 使字段联动条件、$formData 公式与首屏数据回填在全页面范围内可用。
// <form> 内部的节点会由 useForm 提供更近的表单上下文，自动覆盖此回退。
provide(FORM_CONTEXT_KEY, pageManager.pageFormData);

provide(FORM_INSTANCES_KEY, formInstances);

/**
 * 组件加载完成后的处理函数（Suspense 首次 resolve 时执行）
 * 注: pageSchema 更新不再触发全量重挂载，依赖 Vue 响应式系统按变更局部更新
 * @returns {void}
 */
function handleReady() {
  const unwatch = watch(
    () => pageManager.mountMonitor.isAllMounted.value,
    (finished) => {
      if (finished) {
        if (unwatch) unwatch();
        triggerAigenReady();
      }
    },
  );
}

function triggerAigenReady() {
  ready.value = true;
  emit('ready', pageManager);

  // 执行绑定的ready事件
  findSchemas(pageManager.pageSchema.schemas, (schema) => {
    if (schema.on?.aigenReady) {
      pageManager.doActions(schema.on.aigenReady);
    }
    return false;
  });
}

// 获取当前实例，并提取 proxy
const instance = getCurrentInstance() as AigenNodeInstance;
// 注入组件实例到 pageManager
pageManager.addComponentInstance('builder', instance);

pageManager.hook.register('formChange', (context: any) => {
  emit('change', context);
});

// 暴露组件的方法和状态
defineExpose({
  getData,
  getFormInstance,
  getForms,
  pageManager,
  ready,
  resetData,
  setData,
  setForms,
  validate,
  validateAll,
});
</script>

<template>
  <div
    v-if="
      !pluginManager.designer.initialized.value ||
      pageManager.pageSchema.schemas.length === 0
    "
    class="aigen-loading-box"
  >
    <AigenBaseLoader />
  </div>
  <Suspense v-else @resolve="handleReady">
    <template #default>
      <div
        class="aigen-builder-main aigen-scoped"
        :class="{
          'aigen-readonly': props.readonly,
          'aigen-table-view': props.tableView,
        }"
      >
        <AigenNode
          v-for="(item, index) in pageManager.pageSchema.schemas"
          :key="index"
          :component-schema="item"
        />
        <component v-if="AigenBuilderSlot" :is="AigenBuilderSlot" />
      </div>
    </template>
    <template #fallback>
      <div class="aigen-loading-box">
        <AigenBaseLoader />
      </div>
    </template>
  </Suspense>
</template>
