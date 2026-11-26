import type {
  ComponentSchema,
  Designer,
  PageSchema,
} from '@aigen-designer/types';

import type { ComputedRef, InjectionKey, Ref } from 'vue';

import { computed, inject, provide, ref, watch } from 'vue';

import {
  extractClassNamesFromCss,
  formatRootCssPreview,
  generateNodeClassName,
  PseudoState,
  readSelectorStyleFromCss,
  rootCssToStyleObject,
  styleObjectToRootCss,
  writeSelectorStyleToCss,
} from '../utils/cssCodec';

export interface StyleStateContext {
  activeClassName: Ref<string>;
  activeStyleObj: ComputedRef<Record<string, string>>;
  addClassName: (name?: string) => string;
  allCssClasses: ComputedRef<string[]>;
  applyInlineCssText: (cssText: string) => void;
  batchSetStyle: (
    patch: Record<string, string | undefined>,
    label?: string,
  ) => void;
  classList: ComputedRef<string[]>;
  getStyle: (prop: string) => string;
  globalCss: ComputedRef<string>;
  inlineCssPreview: ComputedRef<string>;
  inlineCssText: ComputedRef<string>;
  isStyleExpressionBound: ComputedRef<boolean>;
  pseudoState: Ref<PseudoState>;
  removeClassName: (name: string) => void;
  selectedNode: ComputedRef<ComponentSchema | null>;
  setActiveClassName: (name: string) => void;
  setGlobalCss: (cssText: string) => void;
  setPseudoState: (state: PseudoState) => void;
  setStyle: (prop: string, value: string | undefined, label?: string) => void;
}

export const STYLE_STATE_KEY: InjectionKey<StyleStateContext> =
  Symbol('STYLE_STATE_KEY');

function isJSExpressionObj(val: unknown): boolean {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    (val as Record<string, unknown>).__isExpression__ === true
  );
}

export function createStyleState(designer: {
  pageSchema: PageSchema;
  revoke: { push: (label: string) => void };
  state: Designer['state'];
}): StyleStateContext {
  const selectedNode = computed(() => designer.state.selectedNode);
  const activeClassName = ref('');
  const pseudoState = ref<PseudoState>('none');

  const classList = computed<string[]>(() => {
    const raw = selectedNode.value?.props?.className;
    if (typeof raw !== 'string' || !raw.trim()) return [];
    return raw.trim().split(/\s+/).filter(Boolean);
  });

  // 切换选中节点时自动同步类名与重置伪类
  watch(
    () => selectedNode.value?.id,
    () => {
      pseudoState.value = 'none';
      activeClassName.value = classList.value[0] ?? '';
    },
    { immediate: true },
  );

  const isStyleExpressionBound = computed(() =>
    isJSExpressionObj(selectedNode.value?.props?.style),
  );

  const inlineStyleObj = computed<Record<string, string>>(() => {
    const raw = selectedNode.value?.props?.style;
    if (!raw || typeof raw !== 'object' || isJSExpressionObj(raw)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        out[k] = String(v);
      }
    }
    return out;
  });

  const globalCss = computed(() => designer.pageSchema.css ?? '');
  const allCssClasses = computed(() =>
    extractClassNamesFromCss(designer.pageSchema.css),
  );

  const isGlobalTarget = computed(
    () => Boolean(activeClassName.value) && pseudoState.value !== 'none',
  );

  const activeStyleObj = computed<Record<string, string>>(() => {
    if (isGlobalTarget.value) {
      return readSelectorStyleFromCss(
        designer.pageSchema.css,
        activeClassName.value,
        pseudoState.value,
      );
    }
    return inlineStyleObj.value;
  });

  const inlineCssPreview = computed(() =>
    isStyleExpressionBound.value
      ? ':root { /* 已绑定动态表达式 */ }'
      : formatRootCssPreview(inlineStyleObj.value),
  );

  const inlineCssText = computed(() =>
    styleObjectToRootCss(inlineStyleObj.value),
  );

  function ensureNodeProps(): null | Record<string, any> {
    const node = selectedNode.value;
    if (!node) return null;
    if (!node.props) {
      node.props = {};
    }
    return node.props;
  }

  function ensureAutoClassName(): string {
    if (activeClassName.value) return activeClassName.value;
    const node = selectedNode.value;
    if (!node) return '';
    return addClassName(generateNodeClassName(node.type || 'node'));
  }

  function batchSetStyle(
    patch: Record<string, string | undefined>,
    label = '修改样式',
  ) {
    const node = selectedNode.value;
    if (!node) return;

    if (pseudoState.value !== 'none') {
      const cls = ensureAutoClassName();
      if (!cls) return;
      const current = {
        ...readSelectorStyleFromCss(
          designer.pageSchema.css,
          cls,
          pseudoState.value,
        ),
      };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || String(v).trim() === '') {
          delete current[k];
        } else {
          current[k] = String(v).trim();
        }
      }
      designer.pageSchema.css = writeSelectorStyleToCss(
        designer.pageSchema.css,
        cls,
        pseudoState.value,
        current,
      );
      designer.revoke.push(label);
      return;
    }

    const props = ensureNodeProps();
    if (!props) return;
    const current: Record<string, string> = isStyleExpressionBound.value
      ? {}
      : { ...inlineStyleObj.value };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || String(v).trim() === '') {
        delete current[k];
      } else {
        current[k] = String(v).trim();
      }
    }
    props.style = current;
    designer.revoke.push(label);
  }

  function setStyle(
    prop: string,
    value: string | undefined,
    label = '修改样式',
  ) {
    batchSetStyle({ [prop]: value }, label);
  }

  function getStyle(prop: string): string {
    return activeStyleObj.value[prop] ?? '';
  }

  function applyInlineCssText(cssText: string) {
    const props = ensureNodeProps();
    if (!props) return;
    props.style = rootCssToStyleObject(cssText);
    designer.revoke.push('编辑行内样式');
  }

  function setGlobalCss(cssText: string) {
    designer.pageSchema.css = cssText;
    designer.revoke.push('编辑全局样式');
  }

  function addClassName(rawName?: string): string {
    const props = ensureNodeProps();
    const node = selectedNode.value;
    if (!props || !node) return '';
    const candidate = (
      rawName?.trim() || generateNodeClassName(node.type || 'node')
    ).replace(/^\.+/, '');
    if (!candidate) return '';
    const nextList = classList.value.includes(candidate)
      ? classList.value
      : [...classList.value, candidate];
    props.className = nextList.join(' ');
    activeClassName.value = candidate;
    designer.revoke.push('添加样式类名');
    return candidate;
  }

  function removeClassName(name: string) {
    const props = ensureNodeProps();
    if (!props) return;
    const nextList = classList.value.filter((c) => c !== name);
    props.className = nextList.length > 0 ? nextList.join(' ') : undefined;
    if (activeClassName.value === name) {
      activeClassName.value = nextList[0] ?? '';
    }
    designer.revoke.push('移除样式类名');
  }

  function setActiveClassName(name: string) {
    activeClassName.value = name.trim().replace(/^\.+/, '');
  }

  function setPseudoState(state: PseudoState) {
    pseudoState.value = state;
    if (state !== 'none' && !activeClassName.value && selectedNode.value) {
      ensureAutoClassName();
    }
  }

  return {
    activeClassName,
    activeStyleObj,
    addClassName,
    allCssClasses,
    applyInlineCssText,
    batchSetStyle,
    classList,
    getStyle,
    globalCss,
    inlineCssPreview,
    inlineCssText,
    isStyleExpressionBound,
    pseudoState,
    removeClassName,
    selectedNode,
    setActiveClassName,
    setGlobalCss,
    setPseudoState,
    setStyle,
  };
}

export function provideStyleState(
  designer: Parameters<typeof createStyleState>[0],
): StyleStateContext {
  const ctx = createStyleState(designer);
  provide(STYLE_STATE_KEY, ctx);
  return ctx;
}

export function useStyleState(): StyleStateContext {
  const ctx = inject(STYLE_STATE_KEY);
  if (!ctx) {
    throw new Error('useStyleState must be used inside style.vue');
  }
  return ctx;
}
