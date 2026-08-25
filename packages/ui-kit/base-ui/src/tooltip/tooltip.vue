<script lang="ts" setup>
import type { CSSProperties } from 'vue';

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

type TriggerType = 'click' | 'focus' | 'hover' | 'manual';
type PlacementType = 'bottom' | 'left' | 'right' | 'top';
type ColorType = 'default' | 'error' | 'primary' | 'success' | 'warning';

interface Props {
  arrow?: boolean;
  color?: ColorType;
  content?: string;
  mouseEnterDelay?: number;
  mouseLeaveDelay?: number;
  open?: boolean;
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
  placement?: PlacementType;
  trigger?: TriggerType;
}

const props = withDefaults(defineProps<Props>(), {
  arrow: true,
  color: 'default',
  content: '',
  mouseEnterDelay: 600,
  mouseLeaveDelay: 100,
  open: undefined,
  overlayClassName: '',
  overlayStyle: () => ({}),
  placement: 'top',
  trigger: 'hover',
});

const emit = defineEmits<{
  openChange: [value: boolean];
  'update:open': [value: boolean];
  visibleChange: [value: boolean];
}>();

// 状态
const visible = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const wrapperRef = ref<HTMLElement | null>(null);
const hasClicked = ref(false); // 新增：记录是否点击过

// 定时器
let enterTimer: null | number = null;
let leaveTimer: null | number = null;
let leaveDelayTimer: null | number = null;
// 清除定时器
const clearTimers = () => {
  if (enterTimer) {
    clearTimeout(enterTimer);
    enterTimer = null;
  }
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }
  if (leaveDelayTimer) {
    clearTimeout(leaveDelayTimer);
    leaveDelayTimer = null;
  }
};

// 统一同步显示状态到外部
const syncVisible = (value: boolean) => {
  emit('update:open', value);
  emit('openChange', value);
  emit('visibleChange', value);
};

// 立即显示（click 触发场景，不走 hover 延迟）
const showImmediately = () => {
  if (visible.value) return;
  clearTimers();
  visible.value = true;
  syncVisible(true);
  updatePosition();
};

// 立即隐藏（click 触发 / 点击外部场景，不走 leave 延迟）
const hideImmediately = () => {
  if (!visible.value) return;
  clearTimers();
  visible.value = false;
  syncVisible(false);
};

// 显示（hover 触发，支持 mouseEnterDelay 延迟）
const show = () => {
  if (visible.value) return;
  if (hasClicked.value) return; // 如果已经点击过，不显示
  clearTimers();

  const doShow = () => {
    visible.value = true;
    syncVisible(true);
    updatePosition();
  };
  if (props.mouseEnterDelay > 0) {
    enterTimer = window.setTimeout(doShow, props.mouseEnterDelay);
  } else {
    doShow();
  }
};

// 隐藏（hover 触发，支持 mouseLeaveDelay 延迟）
const hide = () => {
  if (!visible.value) return;
  clearTimers();

  const doHide = () => {
    visible.value = false;
    syncVisible(false);
  };
  if (props.mouseLeaveDelay > 0) {
    leaveTimer = window.setTimeout(doHide, props.mouseLeaveDelay);
  } else {
    doHide();
  }
};

// 智能隐藏：检查鼠标位置
const smartHide = () => {
  if (props.trigger !== 'hover') return;

  clearTimers();

  leaveDelayTimer = window.setTimeout(() => {
    hide();
  }, 100); // 短暂延迟检查
};

// 事件处理
const handleMouseEnter = () => {
  if (props.trigger === 'hover') {
    // 鼠标重新进入时重置点击状态，这样下次悬停时可以重新显示
    hasClicked.value = false;
    show();
  }
};

const handleMouseLeave = () => {
  if (props.trigger === 'hover') {
    smartHide();
  }
};

const handleClick = () => {
  if (props.trigger === 'click') {
    // click 触发：直接切换显示状态，不依赖 hover 延迟与 hasClicked 标记
    if (visible.value) {
      hideImmediately();
    } else {
      showImmediately();
    }
    return;
  }
  // 其他触发方式（hover/focus）：点击后标记为已点击并关闭，避免误触
  hasClicked.value = true;
  clearTimers(); // 清除所有定时器，包括正在进行的延迟显示
  hide(); // 点击后立即隐藏tooltip
};

// 更新位置
function updatePosition() {
  if (!triggerRef.value || !tooltipRef.value) return;
  const nodes = Array.from(triggerRef.value.childNodes);
  const target = nodes.find((node) => node.nodeType === Node.ELEMENT_NODE);
  const triggerRect = target
    ? (target as Element).getBoundingClientRect()
    : { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 };
  const tooltipRect = tooltipRef.value!.getBoundingClientRect();

  let top = 0;
  let left = 0;
  const offset = 8;

  // position: fixed 使用视口坐标系，getBoundingClientRect 已相对视口返回，
  // 这里不再叠加 scrollX/scrollY，避免滚动时 tooltip 出现偏移
  switch (props.placement) {
    case 'bottom': {
      top = triggerRect.bottom + offset;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      break;
    }

    case 'left': {
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.left - tooltipRect.width - offset;
      break;
    }
    case 'right': {
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.right + offset;
      break;
    }
    case 'top': {
      top = triggerRect.top - tooltipRect.height - offset;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      break;
    }
  }

  // 边界检查
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (left < 8) left = 8;
  if (left + tooltipRect.width > viewportWidth - 8) {
    left = viewportWidth - tooltipRect.width - 8;
  }
  if (top < 8) top = 8;
  if (top + tooltipRect.height > viewportHeight - 8) {
    top = viewportHeight - tooltipRect.height - 8;
  }

  tooltipRef.value.style.top = `${top}px`;
  tooltipRef.value.style.left = `${left}px`;
}

// 点击外部关闭
const handleClickOutside = (event: MouseEvent) => {
  if (!visible.value || !triggerRef.value) return;
  // 点击触发元素或 tooltip 自身时不关闭
  if (triggerRef.value.contains(event.target as Node)) return;
  if (tooltipRef.value && tooltipRef.value.contains(event.target as Node)) {
    return;
  }
  if (props.trigger === 'click') {
    // click 触发：点击外部直接关闭
    hideImmediately();
  } else if (props.trigger === 'hover') {
    smartHide();
  }
};

// 计算样式
const tooltipStyle = computed<CSSProperties>(() => ({
  position: 'fixed',
  zIndex: 9999,
  ...props.overlayStyle,
}));

// 滚动或窗口尺寸变化时重新定位 tooltip
const handleViewportChange = () => {
  if (visible.value) {
    updatePosition();
  }
};

// 生命周期
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  // fixed 定位的 tooltip 需跟随元素：监听滚动（捕获阶段覆盖内部滚动容器）与窗口尺寸变化
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('scroll', handleViewportChange, true);

  // 初始化open属性
  if (props.open !== undefined) {
    visible.value = props.open;
    if (props.open) {
      updatePosition();
    }
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', handleViewportChange);
  window.removeEventListener('scroll', handleViewportChange, true);
  clearTimers();
});

// 监听显示状态
watch(visible, (newVal) => {
  if (newVal) {
    nextTick(updatePosition);
  }
});

// 监听open属性变化
watch(
  () => props.open,
  (newVal) => {
    if (newVal !== undefined) {
      visible.value = newVal;
      if (newVal) {
        updatePosition();
      }
    }
  },
);
</script>
<template>
  <!-- 使用 span 作为行内包装器 -->
  <span ref="wrapperRef" class="aigen-tooltip-wrapper">
    <!-- 使用内联样式包裹用户内容 -->
    <span
      ref="triggerRef"
      class="aigen-tooltip-trigger"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @click="handleClick"
      :tabindex="trigger === 'focus' ? 0 : undefined"
    >
      <slot></slot>
    </span>
    <!-- Tooltip 内容 -->
    <teleport to="body">
      <transition name="aigen-tooltip-fade">
        <div
          v-if="visible"
          ref="tooltipRef"
          class="aigen-tooltip"
          :class="[
            `aigen-tooltip-placement-${placement}`,
            `aigen-tooltip-${color}`,
          ]"
          :style="tooltipStyle"
          role="tooltip"
        >
          <div class="aigen-tooltip-content">
            <div class="aigen-tooltip-arrow" v-if="arrow">
              <span class="aigen-tooltip-arrow-content"></span>
            </div>
            <div
              class="aigen-tooltip-inner"
              :class="overlayClassName"
              :style="overlayStyle"
            >
              <slot name="content">{{ content }}</slot>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </span>
</template>
<style lang="less" scoped>
@import './index.less';
</style>
