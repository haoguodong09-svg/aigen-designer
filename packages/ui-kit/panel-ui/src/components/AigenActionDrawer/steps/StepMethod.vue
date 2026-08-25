<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import type { ActionType } from '../helper';

import { computed, ref } from 'vue';

import { usePageManager } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';

/**
 * Step3 · 动作方法：按类型列出可执行方法（带搜索与说明）。
 * - component：config.action（说明取 describe ?? description）；输入组件额外具备
 *   setValue（设置值）/ getValue（获取值）/ setAttr（设置属性）——由 useComponentManager 注入；
 * - custom：pageManager.funcs 中的函数名；
 * - public：pluginManager.publicMethods.methodsMap（说明取 description）。
 */
const props = defineProps<{
  componentSchema: ComponentSchema | null;
  methodName: string;
  type: '' | ActionType;
}>();

const emit = defineEmits<{
  (e: 'update:methodName', value: string): void;
}>();

const pageManager = usePageManager();
const searchKeyword = ref('');

interface MethodOption {
  description: string;
  label: string;
  value: string;
}

/** 方法列表（来源按类型区分） */
const methodOptions = computed<MethodOption[]>(() => {
  if (props.type === 'component' && props.componentSchema) {
    const componentConfig = pluginManager.component.getConfigByType(
      props.componentSchema.type,
    );
    const actions = componentConfig?.config.action ?? [];
    return actions.map((item) => {
      const value = item.type;
      let description = item.describe ?? item.description ?? '';
      if (value === 'setAttr') description = '修改目标元素的某个属性';
      if (value === 'setValue') description = '设置目标元素的值';
      if (value === 'getValue') description = '获取目标元素的值';
      return {
        description,
        label: item.describe ?? item.description ?? item.type,
        value,
      };
    });
  }

  if (props.type === 'custom') {
    return Object.entries(pageManager.funcs.value)
      .filter(([, value]) => typeof value === 'function')
      .map(([label]) => ({
        description: '页面脚本中通过 defineExpose 暴露的函数',
        label,
        value: label,
      }));
  }

  if (props.type === 'public') {
    return Object.entries(pluginManager.publicMethods.methodsMap).map(
      ([label, method]) => ({
        description: method.description ?? '插件注册的公共方法',
        label: method.description ?? label,
        value: label,
      }),
    );
  }

  return [];
});

/** 搜索过滤（label / value / description） */
const filteredMethods = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return methodOptions.value;
  return methodOptions.value.filter(
    (item) =>
      item.label.toLowerCase().includes(kw) ||
      item.value.toLowerCase().includes(kw) ||
      item.description.toLowerCase().includes(kw),
  );
});

/** 步骤标题中的目标描述 */
const targetLabel = computed(() => {
  if (props.type === 'component' && props.componentSchema) {
    return (
      props.componentSchema.label ??
      pluginManager.component.getConfigByType(props.componentSchema.type)
        ?.defaultSchema.label ??
      '未命名组件'
    );
  }
  if (props.type === 'custom') return '页面自定义函数';
  if (props.type === 'public') return '插件公共函数';
  return '';
});

const emptyText = computed(() => {
  if (props.type === 'component') return '当前组件暂无动作';
  if (props.type === 'custom') return '页面脚本未定义自定义函数';
  return '暂无公共函数';
});

const emptyHint = computed(() => {
  if (props.type === 'component') {
    return '该组件未注册可调用的动作，建议选择输入类组件（可设置值/属性），或检查组件扩展配置';
  }
  if (props.type === 'custom') {
    return '请到「参数配置」步骤点击「编辑页面脚本」，通过 defineExpose 暴露函数';
  }
  return '公共函数由插件注册，请检查插件是否已安装';
});
</script>

<template>
  <div class="aigen-step-method">
    <div class="aigen-step-method-header">
      <span class="aigen-step-method-target">
        目标：{{ targetLabel }}
        <template v-if="props.type === 'component' && props.componentSchema">
          （{{ props.componentSchema.type }}）
        </template>
      </span>
    </div>
    <input
      v-model="searchKeyword"
      type="text"
      class="aigen-step-method-search"
      placeholder="搜索动作方法"
    />
    <div class="aigen-step-method-list">
      <button
        v-for="item in filteredMethods"
        :key="item.value"
        type="button"
        class="aigen-step-method-item"
        :class="{
          'aigen-step-method-item--checked': item.value === props.methodName,
        }"
        @click="emit('update:methodName', item.value)"
      >
        <span
          class="aigen-step-method-item-radio"
          :class="{
            'aigen-step-method-item-radio--checked':
              item.value === props.methodName,
          }"
        ></span>
        <span class="aigen-step-method-item-main">
          <span class="aigen-step-method-item-name">{{ item.label }}</span>
          <span class="aigen-step-method-item-method">{{ item.value }}</span>
          <span class="aigen-step-method-item-desc">{{
            item.description
          }}</span>
        </span>
      </button>
      <div v-if="filteredMethods.length === 0" class="aigen-step-method-empty">
        <div class="aigen-step-method-empty-title">{{ emptyText }}</div>
        <div class="aigen-step-method-empty-hint">{{ emptyHint }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aigen-step-method-header {
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--aigen-text-main);
}

.aigen-step-method-target {
  font-weight: 500;
}

.aigen-step-method-search {
  width: 100%;
  padding: 6px 10px;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--aigen-text-main);
  outline: none;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
  box-sizing: border-box;
}

.aigen-step-method-search:focus {
  border-color: var(--aigen-primary);
}

.aigen-step-method-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 400px;
  overflow: auto;
}

.aigen-step-method-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--aigen-text-main);
  text-align: left;
  cursor: pointer;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-step-method-item:hover {
  border-color: var(--aigen-primary);
}

.aigen-step-method-item--checked {
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
}

.aigen-step-method-item-radio {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin-top: 2px;
  border: 1px solid var(--aigen-text-helper);
  border-radius: 50%;
}

.aigen-step-method-item-radio--checked {
  border: 4px solid var(--aigen-primary);
}

.aigen-step-method-item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.aigen-step-method-item-name {
  font-weight: 500;
}

.aigen-step-method-item-method {
  font-size: 11px;
  color: var(--aigen-text-helper);
  font-family: monospace;
}

.aigen-step-method-item-desc {
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-step-method-empty {
  padding: 24px 12px;
  text-align: center;
}

.aigen-step-method-empty-title {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--aigen-text-main);
}

.aigen-step-method-empty-hint {
  font-size: 12px;
  color: var(--aigen-text-helper);
}
</style>
