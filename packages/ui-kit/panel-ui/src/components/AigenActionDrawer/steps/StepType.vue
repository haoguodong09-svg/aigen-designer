<script lang="ts" setup>
import type { ActionType } from '../helper';

import { AigenIcon } from '@aigen-designer/base-ui';

/**
 * Step1 · 动作类型：操作组件 / 执行函数 / 事件广播 / 调用接口 / 页面跳转。
 * 所有类型均为一等公民，不再用「即将支持」占位。
 */
const props = defineProps<{
  type: '' | ActionType;
}>();

const emit = defineEmits<{
  (e: 'update:type', value: '' | ActionType): void;
}>();

const TYPE_CARDS: Array<{
  description: string;
  icon: string;
  name: string;
  value: ActionType;
}> = [
  {
    description: '调用组件方法，或设置值 / 属性 / 显隐',
    icon: 'icon--behavior--container',
    name: '操作组件',
    value: 'component',
  },
  {
    description: '广播页面事件，供其他动作或脚本订阅',
    icon: 'icon--behavior--thunderbolt',
    name: '事件广播',
    value: 'event',
  },
  {
    description: '发起 HTTP 请求，返回值可传给下一步',
    icon: 'icon--behavior--database',
    name: '调用接口',
    value: 'api',
  },
  {
    description: '打开链接或跳转页面',
    icon: 'icon--behavior--arrowright',
    name: '页面跳转',
    value: 'navigate',
  },
];
</script>

<template>
  <div class="aigen-step-type">
    <div class="aigen-step-type-cards">
      <button
        v-for="card in TYPE_CARDS"
        :key="card.value"
        type="button"
        class="aigen-step-type-card"
        :class="{ 'aigen-step-type-card--checked': props.type === card.value }"
        @click="emit('update:type', card.value)"
      >
        <span
          class="aigen-step-type-radio"
          :class="{
            'aigen-step-type-radio--checked': props.type === card.value,
          }"
        ></span>
        <span class="aigen-step-type-card-main">
          <span class="aigen-step-type-card-name">
            <AigenIcon class="aigen-step-type-icon" :name="card.icon" />
            {{ card.name }}
          </span>
          <span class="aigen-step-type-card-desc">
            {{ card.description }}
          </span>
        </span>
      </button>

      <div
        class="aigen-step-type-card aigen-step-type-card--expand"
        :class="{
          'aigen-step-type-card--checked':
            props.type === 'custom' || props.type === 'public',
        }"
      >
        <div class="aigen-step-type-card-head">
          <span
            class="aigen-step-type-radio"
            :class="{
              'aigen-step-type-radio--checked':
                props.type === 'custom' || props.type === 'public',
            }"
          ></span>
          <span class="aigen-step-type-card-main">
            <span class="aigen-step-type-card-name">
              <AigenIcon
                class="aigen-step-type-icon"
                name="icon--behavior--experiment"
              />
              执行函数
            </span>
            <span class="aigen-step-type-card-desc">
              调用页面脚本或插件注册的函数，支持自由传参
            </span>
          </span>
        </div>
        <div class="aigen-step-type-sub">
          <button
            type="button"
            class="aigen-step-type-sub-item"
            :class="{
              'aigen-step-type-sub-item--checked': props.type === 'custom',
            }"
            @click="emit('update:type', 'custom')"
          >
            <span class="aigen-step-type-sub-name">
              <AigenIcon name="icon--behavior--edit" />
              自定义函数
            </span>
            <span class="aigen-step-type-sub-desc">
              页面脚本 defineExpose 暴露的函数
            </span>
          </button>
          <button
            type="button"
            class="aigen-step-type-sub-item"
            :class="{
              'aigen-step-type-sub-item--checked': props.type === 'public',
            }"
            @click="emit('update:type', 'public')"
          >
            <span class="aigen-step-type-sub-name">
              <AigenIcon name="icon--behavior--database" />
              公共函数
            </span>
            <span class="aigen-step-type-sub-desc">插件注册的公共方法</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aigen-step-type-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.aigen-step-type-card {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--aigen-text-main);
  text-align: left;
  cursor: pointer;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 6px);
}

.aigen-step-type-card:hover {
  border-color: var(--aigen-primary);
}

.aigen-step-type-card--checked {
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
}

.aigen-step-type-card--expand {
  display: block;
  grid-column: 1 / -1;
  padding: 0;
}

.aigen-step-type-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--aigen-text-main);
  text-align: left;
  background: transparent;
  border: none;
}

.aigen-step-type-radio {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border: 1px solid var(--aigen-text-helper);
  border-radius: 50%;
}

.aigen-step-type-radio--checked {
  border: 4px solid var(--aigen-primary);
}

.aigen-step-type-card-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.aigen-step-type-card-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--aigen-text-sm);
  font-weight: 500;
}

.aigen-step-type-icon {
  flex-shrink: 0;
  color: var(--aigen-text-secondary);
  font-size: 14px;
}

.aigen-step-type-card--checked .aigen-step-type-icon {
  color: var(--aigen-primary);
}

.aigen-step-type-card-desc {
  font-size: 11px;
  line-height: 1.3;
  color: var(--aigen-text-helper);
}

.aigen-step-type-sub {
  display: flex;
  gap: 6px;
  padding: 0 10px 10px 32px;
}

.aigen-step-type-sub-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  padding: 6px 8px;
  font-size: var(--aigen-text-sm);
  color: var(--aigen-text-main);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius);
}

.aigen-step-type-sub-item:hover {
  border-color: var(--aigen-primary);
}

.aigen-step-type-sub-item--checked {
  color: var(--aigen-primary);
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
}

.aigen-step-type-sub-name {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-weight: 500;
}

.aigen-step-type-sub-name .iconfont {
  color: var(--aigen-text-secondary);
  font-size: 12px;
}

.aigen-step-type-sub-item--checked .aigen-step-type-sub-name .iconfont {
  color: var(--aigen-primary);
}

.aigen-step-type-sub-desc {
  font-size: 11px;
  color: var(--aigen-text-helper);
}
</style>
