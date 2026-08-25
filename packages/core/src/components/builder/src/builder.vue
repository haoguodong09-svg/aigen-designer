<script lang="ts" setup>
import type { PageManager } from '@aigen-designer/manager';
import type {
  AigenNodeInstance,
  ComputedField,
  FieldStateMap,
  FieldStates,
  FormDataModel,
  PageSchema,
} from '@aigen-designer/types';

import {
  computed,
  getCurrentInstance,
  onUnmounted,
  provide,
  useSlots,
  watch,
} from 'vue';

import { AigenBaseLoader, AigenNode } from '@aigen-designer/base-ui';
import {
  BUILDER_KEY,
  createEventBus,
  FORM_INSTANCES_KEY,
  provideBuilderDisabled,
  provideBuilderReadonly,
  providePageManager,
} from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { setupPage } from '@aigen-designer/panel-ui';
import {
  deepClone,
  deepCompareAndModify,
  findSchemas,
  FormulaEngine,
  getValueByPath,
  migrateComponentProps,
  reorganizeSchemasForTableView,
  setValueByPath,
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

    deepCompareAndModify(pageManager.pageSchema, newSchema);
    // 依赖 Vue 响应式系统按变更局部更新，不再强制全量 Suspense 重挂载；
    // 确需重置挂载状态时仅重置挂载监视器即可
    pageManager.mountMonitor.reset();
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

// ─────────────────────────────────────────────────────────────
// P3 计算字段求值器（B4.3）：页面级 computed 定义，运行时按依赖字段订阅，
// 任一依赖字段变化即重算并写回目标字段。设计态（isDesignMode）不触发任何计算。
// 性能：按依赖字段做 targeted watch（参照 node.vue 字段级订阅思路），
// 不做整树 deep watch；定义变更 / 卸载时统一停止 watchers。
// ─────────────────────────────────────────────────────────────

/** 计算字段依赖 watcher 的停止函数集合（定义变更 / 卸载时统一清理） */
const computedStopFns: (() => void)[] = [];

/** 从计算表达式中提取 $formData.* 依赖字段路径（去重保序） */
function extractComputedDeps(expression: string): string[] {
  const deps: string[] = [];
  const matches = expression.matchAll(/\$formData\.([\w.]+)/g);
  for (const match of matches) {
    const dep = match[1] as string;
    if (!deps.includes(dep)) {
      deps.push(dep);
    }
  }
  return deps;
}

/** 获取当前运行时表单数据（与 doActions 的单表单/多表单语义一致） */
function getCurrentFormData(): Record<string, any> {
  const formNames = Object.keys(pageManager.forms.value);
  return formNames.length === 1
    ? (pageManager.forms.value[formNames[0]] as Record<string, any>)
    : (pageManager.forms.value as Record<string, any>);
}

/** 计算单个计算字段并写回目标字段（设计态 / 停用不触发） */
function recomputeComputedField(computedField: ComputedField): void {
  // 设计态安全：设计模式不得触发任何运行时事件（仅求值展示）
  if (pageManager.isDesignMode.value) return;
  if (computedField.enabled === false) return;
  const formData = getCurrentFormData();
  // 复用 FormulaEngine：$formData / $vars 上下文天然可用（AST 静态缓存，重复计算开销低）
  const result = new FormulaEngine().calculate(computedField.expression, {
    formData,
    vars: pageManager.vars?.value,
  });
  setValueByPath(formData, computedField.targetField, result);
}

/** 建立计算字段求值器：先初始化计算一次（表单数据有值时），再按依赖字段订阅变化 */
function setupComputedEvaluator(defs: ComputedField[]): void {
  stopComputedWatches();
  // 设计态不建立 watcher，避免设计模式触发运行时求值
  if (pageManager.isDesignMode.value) return;

  for (const computedField of defs) {
    if (computedField.enabled === false) continue;
    // 初始化时计算一次（仅当表单数据已有值，避免空表单写入脏数据）
    const formData = getCurrentFormData();
    if (formData && Object.keys(formData).length > 0) {
      recomputeComputedField(computedField);
    }
    // 按依赖字段订阅：任一依赖变化即重算（不做整树 deep watch）
    for (const dep of extractComputedDeps(computedField.expression)) {
      const stop = watch(
        () => getValueByPath(getCurrentFormData(), dep),
        () => recomputeComputedField(computedField),
      );
      computedStopFns.push(stop);
    }
  }
}

/** 停止全部计算字段 watcher */
function stopComputedWatches(): void {
  computedStopFns.forEach((stop) => stop());
  computedStopFns.length = 0;
}

// 监听计算字段定义变化：定义就位/变更时重建订阅
watch(
  () => pageManager.pageSchema.computed,
  (defs) => {
    setupComputedEvaluator(defs ?? []);
  },
  { immediate: true },
);

// 设计/运行态切换：进入设计态立即停止求值，回到运行态重建订阅
watch(
  () => pageManager.isDesignMode.value,
  (isDesign) => {
    stopComputedWatches();
    if (!isDesign) {
      setupComputedEvaluator(pageManager.pageSchema.computed ?? []);
    }
  },
);

// builder 卸载时清理全部计算字段 watcher
onUnmounted(stopComputedWatches);

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

pageManager.hook.register('formChange', (context) => {
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
