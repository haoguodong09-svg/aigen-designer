<script lang="ts" setup>
import type { ActionType } from '../helper';

import { ref } from 'vue';

/**
 * Step1 · 动作类型：三选一卡片。
 * - 操作组件（推荐）：调用其他元素的方法、设置值/属性/显隐；
 * - 执行函数：二级选择 自定义函数（页面脚本 defineExpose）/ 公共函数（插件注册）；
 * - 页面能力：P3 占位，disabled 标注「即将支持」。
 */
const props = defineProps<{
  type: '' | ActionType;
}>();

const emit = defineEmits<{
  (e: 'update:type', value: '' | ActionType): void;
}>();

/** 「执行函数」卡片的二级展开状态 */
const functionExpanded = ref(false);
</script>

<template>
  <div class="aigen-step-type">
    <div class="aigen-step-type-title">请选择动作类型</div>
    <div class="aigen-step-type-cards">
      <button
        type="button"
        class="aigen-step-type-card"
        :class="{ 'aigen-step-type-card--checked': props.type === 'component' }"
        @click="emit('update:type', 'component')"
      >
        <span
          class="aigen-step-type-radio"
          :class="{
            'aigen-step-type-radio--checked': props.type === 'component',
          }"
        ></span>
        <span class="aigen-step-type-card-main">
          <span class="aigen-step-type-card-name">🧩 操作组件（推荐）</span>
          <span class="aigen-step-type-card-desc">
            调用其他元素的方法、设置值/属性/显隐
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
        <button
          type="button"
          class="aigen-step-type-card-head"
          @click="functionExpanded = !functionExpanded"
        >
          <span
            class="aigen-step-type-radio"
            :class="{
              'aigen-step-type-radio--checked':
                props.type === 'custom' || props.type === 'public',
            }"
          ></span>
          <span class="aigen-step-type-card-main">
            <span class="aigen-step-type-card-name">⚙️ 执行函数</span>
            <span class="aigen-step-type-card-desc">
              调用页面脚本或插件注册的函数
            </span>
          </span>
          <span
            class="aigen-step-type-arrow"
            :class="{ 'aigen-step-type-arrow--open': functionExpanded }"
          >
            ▸
          </span>
        </button>
        <div v-show="functionExpanded" class="aigen-step-type-sub">
          <button
            type="button"
            class="aigen-step-type-sub-item"
            :class="{
              'aigen-step-type-sub-item--checked': props.type === 'custom',
            }"
            @click="emit('update:type', 'custom')"
          >
            <span class="aigen-step-type-sub-name">自定义函数</span>
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
            <span class="aigen-step-type-sub-name">公共函数</span>
            <span class="aigen-step-type-sub-desc">插件注册的公共方法</span>
          </button>
        </div>
      </div>

      <div class="aigen-step-type-card aigen-step-type-card--disabled">
        <span class="aigen-step-type-radio"></span>
        <span class="aigen-step-type-card-main">
          <span class="aigen-step-type-card-name">📄 页面能力</span>
          <span class="aigen-step-type-card-desc">
            提交/重置表单、广播事件、读写全局变量
          </span>
        </span>
        <span class="aigen-step-type-badge">即将支持</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aigen-step-type-title {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-step-type-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.aigen-step-type-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
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
  padding: 0;
}

.aigen-step-type-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  font-size: 13px;
  color: var(--aigen-text-main);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
}

.aigen-step-type-card--disabled {
  cursor: not-allowed;
  opacity: 0.55;
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
  gap: 2px;
  min-width: 0;
}

.aigen-step-type-card-name {
  font-weight: 500;
}

.aigen-step-type-card-desc {
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-step-type-arrow {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--aigen-text-helper);
  transition: transform 0.18s ease;
}

.aigen-step-type-arrow--open {
  transform: rotate(90deg);
}

.aigen-step-type-sub {
  padding: 0 14px 10px 38px;
}

.aigen-step-type-sub-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  margin-top: 6px;
  font-size: 13px;
  color: var(--aigen-text-main);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
}

.aigen-step-type-sub-item:hover {
  border-color: var(--aigen-primary);
}

.aigen-step-type-sub-item--checked {
  background: var(--aigen-primary-faded);
  border-color: var(--aigen-primary);
  color: var(--aigen-primary);
}

.aigen-step-type-sub-name {
  flex-shrink: 0;
  font-weight: 500;
}

.aigen-step-type-sub-desc {
  font-size: 12px;
  color: var(--aigen-text-helper);
}

.aigen-step-type-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  margin-left: auto;
  font-size: 11px;
  color: var(--aigen-text-helper);
  background: var(--aigen-muted);
  border-radius: 8px;
}
</style>
