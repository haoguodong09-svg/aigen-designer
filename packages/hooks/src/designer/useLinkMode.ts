import type { ComponentSchema } from '@aigen-designer/types';

import type { ComputedRef, InjectionKey, Ref } from 'vue';

import {
  computed,
  getCurrentInstance,
  inject,
  onUnmounted,
  provide,
  ref,
} from 'vue';

/** 关联模式阶段：idle 未激活 → select-source 等待点选源 → select-target 等待点选目标 */
export type LinkModePhase = 'idle' | 'select-source' | 'select-target';

/** 源元素高亮描边颜色（蓝） */
export const LINK_SOURCE_COLOR = '#2563eb';
/** 目标元素高亮描边颜色（绿） */
export const LINK_TARGET_COLOR = '#16a34a';

/** 关联模式实例接口（画布/工具栏/气泡共享同一实例，由 designer.vue 顶层 provide） */
export interface LinkMode {
  /** 清除全部临时高亮 */
  clearHighlights: () => void;
  /** 取消当前选择（回到 select-source，不退出模式） */
  clearSelection: () => void;
  /** 进入关联模式（重置选择，进入 select-source） */
  enter: () => void;
  /** 退出关联模式（清空选择与高亮） */
  exit: () => void;
  /** 点击画布空白：有选择则取消选择，无选择则退出模式 */
  handleBlankClick: () => void;
  /** 是否处于关联模式 */
  isActive: ComputedRef<boolean>;
  /** 按阶段路由点选：select-source 时设源，select-target 时设目标 */
  pick: (schema: ComponentSchema) => void;
  /** 临时高亮画布元素（inline style outline，不清除画布元素自身状态），color 传 null 清除该元素高亮 */
  setHighlight: (id: string, color: null | string) => void;
  /** 设置源元素（进入 select-target，源高亮为蓝） */
  setSource: (schema: ComponentSchema) => void;
  /** 设置目标元素（目标高亮为绿；源=目标忽略） */
  setTarget: (schema: ComponentSchema) => void;
  /** 已选源元素（页面 schema 引用，可直接写回） */
  source: Ref<ComponentSchema | null>;
  /** 当前阶段（idle 表示未激活） */
  state: Ref<LinkModePhase>;
  /** 已选目标元素（页面 schema 引用） */
  target: Ref<ComponentSchema | null>;
  /** 切换关联模式开关（工具栏按钮 / 快捷键 L） */
  toggle: () => void;
}

export const LINK_MODE_KEY: InjectionKey<LinkMode> = Symbol('linkMode');

/**
 * 判断当前焦点是否在输入框/可编辑区域（含 Monaco 编辑器），
 * 关联快捷键（L）需跳过，避免与编辑冲突（与 useHotkeys 的规避逻辑一致）。
 */
function isInInput(): boolean {
  const activeElement = document.activeElement;
  const isStandardInput =
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    (activeElement instanceof HTMLElement && activeElement.isContentEditable);
  if (isStandardInput) {
    return true;
  }
  if (activeElement?.closest('.monaco-editor')) {
    return true;
  }
  return false;
}

/**
 * 创建关联模式实例（提供方：designer.vue 顶层调用 provideLinkMode）。
 * - 退出时机：Esc / 再点工具栏按钮 / 点击画布空白（由调用方 handleBlankClick 驱动）；
 * - 快捷键 L 切换模式，Esc 退出；
 * - 高亮只注入 inline outline，不修改画布元素自身状态。
 */
export function createLinkMode(): LinkMode {
  const state = ref<LinkModePhase>('idle');
  const source = ref<ComponentSchema | null>(null);
  const target = ref<ComponentSchema | null>(null);

  const isActive = computed(() => state.value !== 'idle');

  // 临时高亮记录：schema id → outline 颜色
  const highlights = new Map<string, string>();

  function applyHighlight(id: string, color: null | string) {
    const element = document.querySelector(
      `[data-aigen-id="${id}"]`,
    ) as HTMLElement | null;
    if (!element) return;
    if (color) {
      element.style.outline = `2px solid ${color}`;
      element.style.outlineOffset = '2px';
    } else {
      element.style.outline = '';
      element.style.outlineOffset = '';
    }
  }

  function setHighlight(id: string, color: null | string) {
    if (color) {
      highlights.set(id, color);
    } else {
      highlights.delete(id);
    }
    applyHighlight(id, color);
  }

  function clearHighlights() {
    for (const id of highlights.keys()) {
      applyHighlight(id, null);
    }
    highlights.clear();
  }

  /** 取消当前选择（不退出模式） */
  function clearSelection() {
    clearHighlights();
    source.value = null;
    target.value = null;
    state.value = 'select-source';
  }

  /** 进入关联模式：总是重置为干净的 select-source */
  function enter() {
    clearHighlights();
    source.value = null;
    target.value = null;
    state.value = 'select-source';
  }

  /** 退出关联模式 */
  function exit() {
    if (state.value === 'idle') return;
    clearHighlights();
    source.value = null;
    target.value = null;
    state.value = 'idle';
  }

  function toggle() {
    if (state.value === 'idle') {
      enter();
    } else {
      exit();
    }
  }

  function setSource(schema: ComponentSchema) {
    if (state.value === 'idle') return;
    if (!schema?.id) return;
    if (source.value?.id === schema.id) return;
    // 重新选源时清空旧源/目标的高亮与选择
    clearHighlights();
    source.value = schema;
    target.value = null;
    state.value = 'select-target';
    setHighlight(schema.id, LINK_SOURCE_COLOR);
  }

  function setTarget(schema: ComponentSchema) {
    if (state.value === 'idle') return;
    if (!schema?.id) return;
    if (schema.id === source.value?.id) return;
    target.value = schema;
    setHighlight(schema.id, LINK_TARGET_COLOR);
  }

  function pick(schema: ComponentSchema) {
    if (state.value === 'idle') return;
    if (state.value === 'select-source') {
      setSource(schema);
    } else {
      setTarget(schema);
    }
  }

  function handleBlankClick() {
    if (state.value === 'idle') return;
    if (source.value) {
      // 已有选择：取消当前选择（不退出模式）
      clearSelection();
    } else {
      // 无选择：再点一次空白退出模式
      exit();
    }
  }

  // 全局快捷键：Esc 退出 / L 切换（输入框与 Monaco 内跳过，见 isInInput）
  function handleKeydown(event: KeyboardEvent) {
    // 长按按键持续触发 keydown（e.repeat=true）时忽略，避免 L 键连发导致模式反复进出
    if (event.repeat) return;
    if (event.key === 'Escape') {
      if (state.value !== 'idle') {
        exit();
      }
      return;
    }
    const key = event.key.toLowerCase();
    if (
      key === 'l' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !isInInput()
    ) {
      toggle();
    }
  }

  document.addEventListener('keydown', handleKeydown, true);
  // 非组件上下文（如单元测试）无活动组件实例时不注册卸载清理，避免 Vue 告警
  if (getCurrentInstance()) {
    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeydown, true);
    });
  }

  return {
    clearHighlights,
    clearSelection,
    enter,
    exit,
    handleBlankClick,
    isActive,
    pick,
    setHighlight,
    setSource,
    setTarget,
    source,
    state,
    target,
    toggle,
  };
}

/** 未提供实例时的空实现（防御性兜底：设计器外部使用不报错） */
const emptyLinkMode: LinkMode = (() => {
  const state = ref<LinkModePhase>('idle');
  const source = ref<ComponentSchema | null>(null);
  const target = ref<ComponentSchema | null>(null);
  const isActive = computed(() => false);
  const noop = () => undefined;
  return {
    clearHighlights: noop,
    clearSelection: noop,
    enter: noop,
    exit: noop,
    handleBlankClick: noop,
    isActive,
    pick: noop,
    setHighlight: noop,
    setSource: noop,
    setTarget: noop,
    source,
    state,
    target,
    toggle: noop,
  };
})();

/**
 * 在 designer.vue 顶层 provide 关联模式实例（画布/工具栏/气泡共享同一状态）
 */
export function provideLinkMode(): LinkMode {
  const linkMode = createLinkMode();
  provide(LINK_MODE_KEY, linkMode);
  return linkMode;
}

/**
 * 注入关联模式实例；未提供时返回空实现（避免设计器外部使用报错）
 */
export function useLinkMode(): LinkMode {
  return inject(LINK_MODE_KEY) ?? emptyLinkMode;
}
