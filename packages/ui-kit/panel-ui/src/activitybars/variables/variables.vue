<script lang="ts" setup>
import type { StateAccessor } from '@aigen-designer/types';

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';
import { useDesignerContext, usePageManager } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import {
  deepClone,
  isJSExpressionVar,
  isStateAccessorVar,
  unwrapVarDefaultValue,
  validateAccessorCode,
} from '@aigen-designer/utils';
import { useClipboard } from '@vueuse/core';

type InitValueType = 'jsExpression' | 'json';
type EditorSectionKey = 'getter' | 'init' | 'setter';

interface VarEntry {
  hasGetter: boolean;
  hasSetter: boolean;
  isExpr: boolean;
  name: string;
  preview: string;
  rawDef: unknown;
  typeLabel: string;
}

const DEFAULT_GETTER = 'function getter() {\n  \n}';
const DEFAULT_SETTER = 'function setter(value) {\n  \n}';

const GETTER_EXAMPLE = `// 纯返回值模式（可用上下文: vars, formData, funcs, getVar）
function getter() {
  return (vars.price ?? 0) * (vars.count ?? 1);
}`;

const SETTER_EXAMPLE = `// 写入拦截与联动（可用上下文: value, vars, formData, funcs, setVar, getVar）
function setter(value) {
  const [firstName = '', lastName = ''] = String(value ?? '').split(' ');
  setVar('firstName', firstName);
  setVar('lastName', lastName);
}`;

const EXPR_EXAMPLES = [
  'vars.price * vars.count',
  "formData.userName || '访客'",
  'new Date().getFullYear()',
];

const IDENTIFIER_REGEX = /^[a-z_$][\w$]*$/i;
const RESERVED_KEYWORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

const designer = useDesignerContext();
const pageManager = usePageManager();
const MonacoEditor = pluginManager.component.get('monacoEditor');
const { copy } = useClipboard();

const panelRootRef = ref<HTMLElement | null>(null);
const monacoEditorRef = ref<any>(null);
const getterEditorRef = ref<any>(null);
const setterEditorRef = ref<any>(null);

const searchKeyword = ref('');
const isEditing = ref(false);
const editingOriginalName = ref<null | string>(null);
const varNameInput = ref('');
const initType = ref<InitValueType>('json');
const varValueText = ref('""');
const getterCode = ref(DEFAULT_GETTER);
const setterCode = ref(DEFAULT_SETTER);
const activeSections = ref<Set<EditorSectionKey>>(new Set(['init']));
const nameError = ref('');
const valueError = ref('');
const getterError = ref('');
const setterError = ref('');

const hasCustomGetter = computed(() => {
  const clean = getterCode.value.trim();
  return Boolean(clean) && clean !== DEFAULT_GETTER.trim();
});

const hasCustomSetter = computed(() => {
  const clean = setterCode.value.trim();
  return Boolean(clean) && clean !== DEFAULT_SETTER.trim();
});

const drawerStyle = ref<{
  height: string;
  left: string;
  top: string;
  width: string;
}>({
  height: 'calc(100vh - 48px)',
  left: '328px',
  top: '48px',
  width: '492px',
});

function detectType(val: unknown): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

function formatSummary(val: unknown): string {
  if (val === undefined) return 'undefined';
  try {
    const str = JSON.stringify(val);
    if (str === undefined) return String(val);
    return str.length > 48 ? `${str.slice(0, 45)}...` : str;
  } catch {
    return String(val);
  }
}

function resolveEntryTypeLabel(
  rawDef: unknown,
  runtimeValue: unknown,
): {
  hasGetter: boolean;
  hasSetter: boolean;
  isExpr: boolean;
  typeLabel: string;
} {
  const isAccessor = isStateAccessorVar(rawDef);
  const hasGetter = Boolean(isAccessor && rawDef.accessor.getter?.value);
  const hasSetter = Boolean(isAccessor && rawDef.accessor.setter?.value);
  const isExpr = isJSExpressionVar(unwrapVarDefaultValue(rawDef));

  let typeLabel = detectType(runtimeValue);
  if (hasGetter && hasSetter) {
    typeLabel = 'getter / setter';
  } else if (hasGetter) {
    typeLabel = 'computed';
  } else if (hasSetter) {
    typeLabel = 'setter';
  } else if (isExpr) {
    typeLabel = 'expr';
  }

  return { hasGetter, hasSetter, isExpr, typeLabel };
}

const allVars = computed<VarEntry[]>(() => {
  const varsObj = designer.pageSchema.vars ?? {};
  const runtimeVars = pageManager.vars.value ?? {};
  return Object.entries(varsObj).map(([name, rawDef]) => {
    const hasRuntime = Object.prototype.hasOwnProperty.call(runtimeVars, name);
    const runtimeValue = hasRuntime
      ? runtimeVars[name]
      : unwrapVarDefaultValue(rawDef);
    const meta = resolveEntryTypeLabel(rawDef, runtimeValue);
    return {
      ...meta,
      name,
      preview: formatSummary(runtimeValue),
      rawDef,
    };
  });
});

const filteredVars = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return allVars.value;
  return allVars.value.filter(
    (item) =>
      item.name.toLowerCase().includes(kw) ||
      item.preview.toLowerCase().includes(kw),
  );
});

function updateDrawerRect() {
  const rect = panelRootRef.value?.getBoundingClientRect();
  if (!rect || rect.width === 0) return;
  const maxAvailable = Math.max(360, window.innerWidth - rect.right - 16);
  const width = Math.min(492, maxAvailable);
  drawerStyle.value = {
    height: `${rect.height}px`,
    left: `${rect.right}px`,
    top: `${rect.top}px`,
    width: `${width}px`,
  };
}

function syncPageManagerVars() {
  if (typeof pageManager.applyVarsSchema === 'function') {
    pageManager.applyVarsSchema(designer.pageSchema.vars);
  } else {
    pageManager.vars.value = deepClone(designer.pageSchema.vars ?? {});
  }
}

function layoutAllEditors() {
  nextTick(() => {
    monacoEditorRef.value?.getEditor?.()?.layout?.();
    getterEditorRef.value?.getEditor?.()?.layout?.();
    setterEditorRef.value?.getEditor?.()?.layout?.();
  });
}

function toggleSection(section: EditorSectionKey) {
  const next = new Set(activeSections.value);
  if (next.has(section)) {
    next.delete(section);
  } else {
    next.add(section);
  }
  activeSections.value = next;
  layoutAllEditors();
}

function expandSection(section: EditorSectionKey) {
  if (!activeSections.value.has(section)) {
    const next = new Set(activeSections.value);
    next.add(section);
    activeSections.value = next;
  }
}

function setEditorContent(nextText: string) {
  varValueText.value = nextText;
  valueError.value = '';
  nextTick(() => {
    monacoEditorRef.value?.setValue?.(nextText);
  });
}

function setAccessorEditorValues(getter: string, setter: string) {
  getterCode.value = getter;
  setterCode.value = setter;
  getterError.value = '';
  setterError.value = '';
  nextTick(() => {
    getterEditorRef.value?.setValue?.(getter);
    setterEditorRef.value?.setValue?.(setter);
  });
}

function switchInitType(nextType: InitValueType) {
  if (initType.value === nextType) return;
  initType.value = nextType;
  valueError.value = '';
  if (nextType === 'jsExpression' && varValueText.value.trim() === '""') {
    setEditorContent('');
  } else if (nextType === 'json' && !varValueText.value.trim()) {
    setEditorContent('""');
  }
}

function openCreate() {
  editingOriginalName.value = null;
  varNameInput.value = '';
  nameError.value = '';
  initType.value = 'json';
  activeSections.value = new Set(['init']);
  updateDrawerRect();
  isEditing.value = true;
  setEditorContent('""');
  setAccessorEditorValues(DEFAULT_GETTER, DEFAULT_SETTER);
}

function openEdit(entry: VarEntry) {
  editingOriginalName.value = entry.name;
  varNameInput.value = entry.name;
  nameError.value = '';

  const rawDefault = unwrapVarDefaultValue(entry.rawDef);
  const nextSections = new Set<EditorSectionKey>(['init']);

  let formatted = 'null';
  if (isJSExpressionVar(rawDefault)) {
    initType.value = 'jsExpression';
    formatted = rawDefault.value;
  } else {
    initType.value = 'json';
    try {
      formatted =
        rawDefault === undefined ? 'null' : JSON.stringify(rawDefault, null, 2);
    } catch {
      formatted = 'null';
    }
  }

  let nextGetter = DEFAULT_GETTER;
  let nextSetter = DEFAULT_SETTER;
  if (isStateAccessorVar(entry.rawDef)) {
    if (entry.rawDef.accessor.getter?.value) {
      nextGetter = entry.rawDef.accessor.getter.value;
      nextSections.add('getter');
    }
    if (entry.rawDef.accessor.setter?.value) {
      nextSetter = entry.rawDef.accessor.setter.value;
      nextSections.add('setter');
    }
  }

  activeSections.value = nextSections;
  updateDrawerRect();
  isEditing.value = true;
  setEditorContent(formatted);
  setAccessorEditorValues(nextGetter, nextSetter);
}

function closeDrawer() {
  isEditing.value = false;
  nameError.value = '';
  valueError.value = '';
  getterError.value = '';
  setterError.value = '';
}

function applyPreset(presetJson: string) {
  initType.value = 'json';
  setEditorContent(presetJson);
}

function formatJsonContent() {
  try {
    const parsed = JSON.parse(varValueText.value);
    setEditorContent(JSON.stringify(parsed, null, 2));
  } catch (error) {
    valueError.value = `JSON 格式错误：${error instanceof Error ? error.message : String(error)}`;
  }
}

function validateName(rawName: string): null | string {
  const clean = rawName.trim();
  if (!clean) {
    return '请输入变量名称';
  }
  if (!IDENTIFIER_REGEX.test(clean)) {
    return '变量名需以字母、_ 或 $ 开头，仅包含字母、数字、_、$';
  }
  if (RESERVED_KEYWORDS.has(clean)) {
    return `"${clean}" 为 JS 保留关键字，请更换名称`;
  }
  const existing = designer.pageSchema.vars ?? {};
  if (
    clean !== editingOriginalName.value &&
    Object.prototype.hasOwnProperty.call(existing, clean)
  ) {
    return `变量 "${clean}" 已存在`;
  }
  return null;
}

function saveVariable() {
  const cleanName = varNameInput.value.trim();
  const nErr = validateName(cleanName);
  nameError.value = nErr ?? '';

  let defaultValue: unknown;
  if (initType.value === 'jsExpression') {
    const expr = varValueText.value.trim();
    if (expr) {
      valueError.value = '';
      defaultValue = { type: 'JSExpression', value: expr };
    } else {
      valueError.value = 'JS 表达式初值不能为空';
      expandSection('init');
    }
  } else {
    try {
      defaultValue = JSON.parse(varValueText.value);
      valueError.value = '';
    } catch (error) {
      valueError.value = `JSON 格式错误：${error instanceof Error ? error.message : String(error)}`;
      expandSection('init');
    }
  }

  getterError.value = '';
  setterError.value = '';
  const accessor: StateAccessor = {};

  if (hasCustomGetter.value) {
    const gErr = validateAccessorCode(getterCode.value);
    if (gErr) {
      getterError.value = `getter 语法错误：${gErr}`;
      expandSection('getter');
    } else {
      accessor.getter = { type: 'JSFunction', value: getterCode.value.trim() };
    }
  }

  if (hasCustomSetter.value) {
    const sErr = validateAccessorCode(setterCode.value);
    if (sErr) {
      setterError.value = `setter 语法错误：${sErr}`;
      expandSection('setter');
    } else {
      accessor.setter = { type: 'JSFunction', value: setterCode.value.trim() };
    }
  }

  if (
    nameError.value ||
    valueError.value ||
    getterError.value ||
    setterError.value
  ) {
    return;
  }

  designer.pageSchema.vars ??= {};
  if (
    editingOriginalName.value &&
    editingOriginalName.value !== cleanName &&
    Object.prototype.hasOwnProperty.call(
      designer.pageSchema.vars,
      editingOriginalName.value,
    )
  ) {
    delete designer.pageSchema.vars[editingOriginalName.value];
  }

  const hasAccessor = Boolean(accessor.getter || accessor.setter);
  designer.pageSchema.vars[cleanName] = hasAccessor
    ? { accessor, defaultValue }
    : defaultValue;
  syncPageManagerVars();
  designer.revoke.push('修改变量', true);
  isEditing.value = false;
  pluginManager.global.$message?.success?.(`已保存变量 ${cleanName}`);
}

function deleteVariable(name: string) {
  if (!designer.pageSchema.vars) return;
  delete designer.pageSchema.vars[name];
  syncPageManagerVars();
  designer.revoke.push('修改变量', true);
  if (editingOriginalName.value === name) {
    closeDrawer();
  }
  pluginManager.global.$message?.success?.(`已删除变量 ${name}`);
}

function copyVarExpr(name: string) {
  copy(`vars.${name}`);
  pluginManager.global.$message?.success?.(`已复制 vars.${name}`);
}

function handleAfterDrawerEnter() {
  layoutAllEditors();
}

onMounted(() => {
  window.addEventListener('resize', updateDrawerRect);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateDrawerRect);
  isEditing.value = false;
});
</script>

<template>
  <div ref="panelRootRef" class="aigen-variables-panel">
    <!-- 顶部标题栏（40px，对齐组件/大纲栏） -->
    <div class="aigen-var-header">
      <div class="aigen-var-header__left">
        <span class="aigen-var-header__title">状态变量</span>
        <span class="aigen-var-header__count">{{ allVars.length }}</span>
      </div>
    </div>

    <!-- 搜索与通栏添加按钮（对标 TinyEngine 状态管理面板） -->
    <div class="aigen-var-toolbar">
      <div class="aigen-var-search-wrap">
        <AigenIcon
          name="icon--aigen--search-rounded"
          class="aigen-var-search-icon"
        />
        <input
          v-model="searchKeyword"
          type="text"
          class="aigen-var-search"
          placeholder="请输入搜索条件"
        />
        <button
          v-if="searchKeyword"
          type="button"
          class="aigen-var-search-clear"
          title="清空"
          @click="searchKeyword = ''"
        >
          <AigenIcon name="icon--aigen--close" />
        </button>
      </div>

      <button type="button" class="aigen-var-create-btn" @click="openCreate">
        <AigenIcon name="icon--aigen--add-rounded" />
        <span>添加变量</span>
      </button>
    </div>

    <!-- 紧凑变量列表 -->
    <div class="aigen-var-list">
      <div
        v-for="item in filteredVars"
        :key="item.name"
        class="aigen-var-item"
        :class="{
          'is-active': isEditing && editingOriginalName === item.name,
        }"
        @click="openEdit(item)"
      >
        <div class="aigen-var-item__top">
          <div class="aigen-var-item__name-wrap">
            <span class="aigen-var-item__tag-icon">VAR</span>
            <span class="aigen-var-item__prefix">vars.</span>
            <code class="aigen-var-item__name">{{ item.name }}</code>
          </div>
          <div class="aigen-var-item__actions" @click.stop>
            <button
              type="button"
              class="aigen-var-icon-btn"
              title="编辑变量"
              aria-label="编辑变量"
              @click="openEdit(item)"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <button
              type="button"
              class="aigen-var-icon-btn"
              :title="`复制 vars.${item.name}`"
              :aria-label="`复制 vars.${item.name}`"
              @click="copyVarExpr(item.name)"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                />
              </svg>
            </button>
            <button
              type="button"
              class="aigen-var-icon-btn is-danger"
              title="删除变量"
              aria-label="删除变量"
              @click="deleteVariable(item.name)"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
        <div class="aigen-var-item__meta">
          <span
            class="aigen-var-item__type"
            :class="{
              'is-computed': item.hasGetter || item.hasSetter,
              'is-expr': item.isExpr,
            }"
          >
            {{ item.typeLabel }}
          </span>
          <span class="aigen-var-item__val" :title="item.preview">
            = {{ item.preview }}
          </span>
        </div>
      </div>

      <div v-if="!filteredVars.length" class="aigen-var-empty">
        <div class="aigen-var-empty__icon">
          <AigenIcon name="icon--aigen--code-blocks-outline-rounded" />
        </div>
        <p class="aigen-var-empty__title">
          {{ searchKeyword ? '未找到匹配的变量' : '暂无页面变量' }}
        </p>
        <p class="aigen-var-empty__desc">
          可在属性绑定中通过 <code>vars.变量名</code> 读取，或在公式/动作中通过
          <code>$vars.变量名</code> 使用。
        </p>
      </div>
    </div>

    <!-- 紧邻左侧栏展开的宽幅二级编辑抽屉（复刻 TinyEngine 492px .data-source-right-panel） -->
    <Teleport to="body">
      <Transition
        name="aigen-var-drawer-slide"
        appear
        @after-enter="handleAfterDrawerEnter"
      >
        <div
          v-if="isEditing"
          class="aigen-var-drawer"
          :style="drawerStyle"
          role="dialog"
          aria-label="编辑页面变量"
        >
          <!-- 顶部标题 + 右上角保存/关闭（复刻 TinyEngine .header） -->
          <div class="aigen-var-drawer__header">
            <span class="aigen-var-drawer__title">
              {{ editingOriginalName ? '修改变量' : '添加变量' }}
            </span>
            <div class="aigen-var-drawer__actions">
              <button
                type="button"
                class="aigen-var-drawer__save-btn"
                @click="saveVariable"
              >
                保存
              </button>
              <button
                type="button"
                class="aigen-var-drawer__close-btn"
                title="关闭"
                aria-label="关闭"
                @click="closeDrawer"
              >
                <AigenIcon name="icon--aigen--close" />
              </button>
            </div>
          </div>

          <!-- 顶部标签垂直表单区（对标 TinyEngine CreateVariable.vue：变量名 + 初始值类型 + 三段式折叠编辑区） -->
          <div class="aigen-var-drawer__body">
            <div class="aigen-var-form-item">
              <label class="aigen-var-form-item__label is-required">
                变量名
              </label>
              <input
                v-model="varNameInput"
                type="text"
                class="aigen-var-form-item__input"
                placeholder="只能包含字母、数字及下划线，例如：greeting"
                @input="nameError = ''"
              />
              <p v-if="nameError" class="aigen-var-form-item__error">
                {{ nameError }}
              </p>
              <p v-else class="aigen-var-form-item__hint">
                绑定路径：<code>vars.{{ varNameInput.trim() || 'xxx' }}</code>
              </p>
            </div>

            <div class="aigen-var-form-item">
              <label class="aigen-var-form-item__label">初始值类型</label>
              <div class="aigen-var-radio-group" role="radiogroup">
                <button
                  type="button"
                  role="radio"
                  :aria-checked="initType === 'json'"
                  class="aigen-var-radio-btn"
                  :class="{ 'is-active': initType === 'json' }"
                  @click="switchInitType('json')"
                >
                  JSON 类型
                </button>
                <button
                  type="button"
                  role="radio"
                  :aria-checked="initType === 'jsExpression'"
                  class="aigen-var-radio-btn"
                  :class="{ 'is-active': initType === 'jsExpression' }"
                  @click="switchInitType('jsExpression')"
                >
                  JS 表达式类型
                </button>
              </div>
            </div>

            <!-- 1. 初始值折叠区 -->
            <div class="aigen-var-collapse">
              <div class="aigen-var-collapse-item">
                <button
                  type="button"
                  class="aigen-var-collapse-item__header"
                  :aria-expanded="activeSections.has('init')"
                  @click="toggleSection('init')"
                >
                  <span class="aigen-var-collapse-item__title">
                    <span
                      class="aigen-var-collapse-item__arrow"
                      :class="{ 'is-open': activeSections.has('init') }"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                    </span>
                    <span>初始值</span>
                  </span>
                  <span class="aigen-var-collapse-item__tag">
                    {{ initType === 'json' ? 'JSON' : 'JSExpression' }}
                  </span>
                </button>

                <div
                  v-show="activeSections.has('init')"
                  class="aigen-var-collapse-item__body"
                >
                  <div
                    v-if="initType === 'json'"
                    class="aigen-var-presets aigen-var-presets--inline"
                  >
                    <button
                      type="button"
                      class="aigen-var-preset-btn"
                      @click="applyPreset('&quot;hello&quot;')"
                    >
                      文本
                    </button>
                    <button
                      type="button"
                      class="aigen-var-preset-btn"
                      @click="applyPreset('0')"
                    >
                      数字
                    </button>
                    <button
                      type="button"
                      class="aigen-var-preset-btn"
                      @click="applyPreset('true')"
                    >
                      布尔
                    </button>
                    <button
                      type="button"
                      class="aigen-var-preset-btn"
                      @click="applyPreset('{\n  \n}')"
                    >
                      对象
                    </button>
                    <button
                      type="button"
                      class="aigen-var-preset-btn"
                      @click="applyPreset('[]')"
                    >
                      数组
                    </button>
                    <button
                      type="button"
                      class="aigen-var-preset-btn is-format"
                      title="格式化 JSON"
                      @click="formatJsonContent"
                    >
                      { } 格式化
                    </button>
                  </div>

                  <div class="aigen-var-drawer__editor-wrap">
                    <MonacoEditor
                      v-if="MonacoEditor"
                      ref="monacoEditorRef"
                      v-model="varValueText"
                      auto-toggle-theme
                      bordered
                      :language="initType === 'json' ? 'json' : 'javascript'"
                      line-numbers="on"
                      :allow-fullscreen="true"
                      class="aigen-var-drawer__monaco"
                      @update:model-value="valueError = ''"
                    >
                      <template #fullscreenFooter>
                        <div class="aigen-var-drawer__tips">
                          <template v-if="initType === 'json'">
                            <div class="aigen-var-drawer__tips-title">
                              JSON 初值写法示例
                            </div>
                            <div class="aigen-var-drawer__tips-grid">
                              <span>字符串：<code>"string"</code></span>
                              <span>数字：<code>123</code></span>
                              <span>布尔值：<code>true / false</code></span>
                              <span>数组：<code>["a", "b"]</code></span>
                              <span>对象：<code>{"name": "aigen"}</code></span>
                              <span>空值：<code>null</code></span>
                            </div>
                          </template>
                          <template v-else>
                            <div class="aigen-var-drawer__tips-title">
                              JS 表达式初值示例
                            </div>
                            <pre class="aigen-var-drawer__tips-code">{{
                              EXPR_EXAMPLES.join('\n')
                            }}</pre>
                          </template>
                        </div>
                      </template>
                    </MonacoEditor>
                    <textarea
                      v-else
                      v-model="varValueText"
                      class="aigen-var-drawer__textarea"
                      spellcheck="false"
                      @input="valueError = ''"
                    ></textarea>
                  </div>

                  <p v-if="valueError" class="aigen-var-form-item__error">
                    {{ valueError }}
                  </p>

                  <!-- 下方示例提示卡片（对标 TinyEngine .tips） -->
                  <div class="aigen-var-drawer__tips">
                    <template v-if="initType === 'json'">
                      <div class="aigen-var-drawer__tips-title">
                        JSON 初值写法示例
                      </div>
                      <div class="aigen-var-drawer__tips-grid">
                        <span>字符串：<code>"string"</code></span>
                        <span>数字：<code>123</code></span>
                        <span>布尔值：<code>true / false</code></span>
                        <span>数组：<code>["a", "b"]</code></span>
                        <span>对象：<code>{"name": "aigen"}</code></span>
                        <span>空值：<code>null</code></span>
                      </div>
                    </template>
                    <template v-else>
                      <div class="aigen-var-drawer__tips-title">
                        JS 表达式初值示例（可用：vars, formData, funcs）
                      </div>
                      <pre class="aigen-var-drawer__tips-code">{{
                        EXPR_EXAMPLES.join('\n')
                      }}</pre>
                    </template>
                  </div>
                </div>
              </div>

              <!-- 2. getter 折叠区 -->
              <div class="aigen-var-collapse-item">
                <button
                  type="button"
                  class="aigen-var-collapse-item__header"
                  :aria-expanded="activeSections.has('getter')"
                  @click="toggleSection('getter')"
                >
                  <span class="aigen-var-collapse-item__title">
                    <span
                      class="aigen-var-collapse-item__arrow"
                      :class="{ 'is-open': activeSections.has('getter') }"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                    </span>
                    <span>getter</span>
                    <span class="aigen-var-collapse-item__sub"> 派生计算 </span>
                  </span>
                  <span
                    v-if="hasCustomGetter"
                    class="aigen-var-collapse-item__badge"
                  >
                    已配置
                  </span>
                </button>

                <div
                  v-show="activeSections.has('getter')"
                  class="aigen-var-collapse-item__body"
                >
                  <div
                    class="aigen-var-drawer__editor-wrap aigen-var-drawer__editor-wrap--accessor"
                  >
                    <MonacoEditor
                      v-if="MonacoEditor"
                      ref="getterEditorRef"
                      v-model="getterCode"
                      auto-toggle-theme
                      bordered
                      language="javascript"
                      line-numbers="on"
                      :allow-fullscreen="true"
                      class="aigen-var-drawer__monaco aigen-var-drawer__monaco--accessor"
                      @update:model-value="getterError = ''"
                    >
                      <template #fullscreenFooter>
                        <div class="aigen-var-drawer__tips">
                          <div class="aigen-var-drawer__tips-title">
                            getter 写法示例
                          </div>
                          <pre class="aigen-var-drawer__tips-code">{{
                            GETTER_EXAMPLE
                          }}</pre>
                        </div>
                      </template>
                    </MonacoEditor>
                    <textarea
                      v-else
                      v-model="getterCode"
                      class="aigen-var-drawer__textarea aigen-var-drawer__textarea--accessor"
                      spellcheck="false"
                      @input="getterError = ''"
                    ></textarea>
                  </div>

                  <p v-if="getterError" class="aigen-var-form-item__error">
                    {{ getterError }}
                  </p>

                  <div class="aigen-var-drawer__tips">
                    <div class="aigen-var-drawer__tips-title">
                      getter 写法示例
                    </div>
                    <pre class="aigen-var-drawer__tips-code">{{
                      GETTER_EXAMPLE
                    }}</pre>
                  </div>
                </div>
              </div>

              <!-- 3. setter 折叠区 -->
              <div class="aigen-var-collapse-item">
                <button
                  type="button"
                  class="aigen-var-collapse-item__header"
                  :aria-expanded="activeSections.has('setter')"
                  @click="toggleSection('setter')"
                >
                  <span class="aigen-var-collapse-item__title">
                    <span
                      class="aigen-var-collapse-item__arrow"
                      :class="{ 'is-open': activeSections.has('setter') }"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                    </span>
                    <span>setter</span>
                    <span class="aigen-var-collapse-item__sub"> 写入拦截 </span>
                  </span>
                  <span
                    v-if="hasCustomSetter"
                    class="aigen-var-collapse-item__badge"
                  >
                    已配置
                  </span>
                </button>

                <div
                  v-show="activeSections.has('setter')"
                  class="aigen-var-collapse-item__body"
                >
                  <div
                    class="aigen-var-drawer__editor-wrap aigen-var-drawer__editor-wrap--accessor"
                  >
                    <MonacoEditor
                      v-if="MonacoEditor"
                      ref="setterEditorRef"
                      v-model="setterCode"
                      auto-toggle-theme
                      bordered
                      language="javascript"
                      line-numbers="on"
                      :allow-fullscreen="true"
                      class="aigen-var-drawer__monaco aigen-var-drawer__monaco--accessor"
                      @update:model-value="setterError = ''"
                    >
                      <template #fullscreenFooter>
                        <div class="aigen-var-drawer__tips">
                          <div class="aigen-var-drawer__tips-title">
                            setter 写法示例
                          </div>
                          <pre class="aigen-var-drawer__tips-code">{{
                            SETTER_EXAMPLE
                          }}</pre>
                        </div>
                      </template>
                    </MonacoEditor>
                    <textarea
                      v-else
                      v-model="setterCode"
                      class="aigen-var-drawer__textarea aigen-var-drawer__textarea--accessor"
                      spellcheck="false"
                      @input="setterError = ''"
                    ></textarea>
                  </div>

                  <p v-if="setterError" class="aigen-var-form-item__error">
                    {{ setterError }}
                  </p>

                  <div class="aigen-var-drawer__tips">
                    <div class="aigen-var-drawer__tips-title">
                      setter 写法示例
                    </div>
                    <pre class="aigen-var-drawer__tips-code">{{
                      SETTER_EXAMPLE
                    }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="less" scoped>
.aigen-variables-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--aigen-designer-background);
  color: var(--aigen-text-main);
}

.aigen-var-header {
  height: 40px;
  padding: 0 12px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--aigen-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.aigen-var-header__left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.aigen-var-header__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-var-header__count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.05));
  color: var(--aigen-text-secondary);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.aigen-var-toolbar {
  padding: 10px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.aigen-var-search-wrap {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.02));
  display: flex;
  align-items: center;
  gap: 6px;
  transition: border-color 0.15s ease;

  &:focus-within {
    border-color: var(--aigen-primary);
  }
}

.aigen-var-search-icon {
  font-size: 13px;
  color: var(--aigen-text-helper, #94a3b8);
}

.aigen-var-search {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 12px;
  color: var(--aigen-text-main);
}

.aigen-var-search-clear {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--aigen-text-helper);
  cursor: pointer;
  font-size: 11px;
}

.aigen-var-create-btn {
  width: 100%;
  height: 28px;
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius, 4px);
  background: var(--aigen-designer-background);
  color: var(--aigen-text-main);
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--aigen-primary);
    color: var(--aigen-primary);
    background: var(--aigen-primary-faded, rgba(22, 119, 255, 0.04));
  }
}

.aigen-var-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aigen-var-item {
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;

  &:hover,
  &.is-active {
    background: var(--aigen-secondary, rgba(0, 0, 0, 0.035));

    .aigen-var-item__actions {
      opacity: 1;
    }
  }

  &.is-active {
    border-color: rgba(22, 119, 255, 0.35);
    background: var(--aigen-primary-faded, rgba(22, 119, 255, 0.06));
  }
}

.aigen-var-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.aigen-var-item__name-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.aigen-var-item__tag-icon {
  flex-shrink: 0;
  height: 15px;
  padding: 0 3px;
  border: 1px solid var(--aigen-border);
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
  line-height: 13px;
  color: var(--aigen-text-secondary);
}

.aigen-var-item__prefix {
  flex-shrink: 0;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  color: var(--aigen-text-helper, #94a3b8);
}

.aigen-var-item__name {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--aigen-text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-var-item__actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}

.aigen-var-icon-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  cursor: pointer;

  svg {
    width: 14px;
    height: 14px;
    display: block;
    flex-shrink: 0;
  }

  &:hover {
    background: var(--aigen-muted, rgba(0, 0, 0, 0.06));
    color: var(--aigen-primary);
  }

  &.is-danger:hover {
    color: var(--aigen-destructive, #ef4444);
  }
}

.aigen-var-item__meta {
  margin-top: 3px;
  padding-left: 26px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.aigen-var-item__type {
  flex-shrink: 0;
  height: 15px;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.05));
  color: var(--aigen-text-secondary);
  font-size: 10px;
  line-height: 15px;
  font-family: 'SFMono-Regular', Consolas, monospace;

  &.is-computed {
    background: var(--aigen-primary-faded, rgba(22, 119, 255, 0.1));
    color: var(--aigen-primary, #1677ff);
  }

  &.is-expr {
    background: rgba(245, 158, 11, 0.12);
    color: #b45309;
  }
}

.aigen-var-item__val {
  flex: 1;
  min-width: 0;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  color: var(--aigen-text-helper, #94a3b8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aigen-var-empty {
  padding: 36px 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.aigen-var-empty__icon {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.04));
  color: var(--aigen-text-helper, #94a3b8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-bottom: 10px;
}

.aigen-var-empty__title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--aigen-text-main);
}

.aigen-var-empty__desc {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--aigen-text-helper, #94a3b8);

  code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    color: var(--aigen-primary);
  }
}
</style>

<style lang="less">
.aigen-var-drawer {
  position: fixed;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  background: var(--aigen-designer-background, var(--aigen-background, #fff));
  color: var(--aigen-text-main);
  border-right: 1px solid var(--aigen-border);
  box-shadow: 6px 0 24px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.aigen-var-drawer-slide-enter-active,
.aigen-var-drawer-slide-leave-active {
  transition:
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
}

.aigen-var-drawer-slide-enter-from,
.aigen-var-drawer-slide-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}

.aigen-var-drawer__header {
  height: 40px;
  padding: 0 16px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--aigen-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.aigen-var-drawer__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--aigen-text-main);
}

.aigen-var-drawer__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.aigen-var-drawer__save-btn {
  height: 28px;
  padding: 0 14px;
  border: 1px solid var(--aigen-primary, #1677ff);
  border-radius: var(--aigen-radius, 4px);
  background: var(--aigen-primary, #1677ff);
  color: var(--aigen-primary-foreground, #fff);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.9;
  }
}

.aigen-var-drawer__close-btn {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;

  &:hover {
    background: var(--aigen-muted, rgba(0, 0, 0, 0.05));
    color: var(--aigen-text-main);
  }
}

.aigen-var-drawer__body {
  flex: 1;
  min-height: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.aigen-var-form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &--grow {
    flex: 1;
    min-height: 0;
  }
}

.aigen-var-form-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.aigen-var-form-item__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--aigen-text-main);

  &.is-required::before {
    content: '* ';
    color: var(--aigen-destructive, #ef4444);
  }
}

.aigen-var-form-item__input {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-main);
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  outline: none;
  transition: border-color 0.15s ease;

  &:focus {
    border-color: var(--aigen-primary, #1677ff);
  }
}

.aigen-var-form-item__error {
  margin: 0;
  font-size: 11px;
  color: var(--aigen-destructive, #ef4444);
}

.aigen-var-form-item__hint {
  margin: 0;
  font-size: 11px;
  color: var(--aigen-text-helper, #94a3b8);

  code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    color: var(--aigen-primary, #1677ff);
  }
}

.aigen-var-radio-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.aigen-var-radio-btn {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;

  &:hover {
    border-color: var(--aigen-primary, #1677ff);
    color: var(--aigen-primary, #1677ff);
  }

  &.is-active {
    border-color: var(--aigen-primary, #1677ff);
    background: var(--aigen-primary-faded, rgba(22, 119, 255, 0.08));
    color: var(--aigen-primary, #1677ff);
    font-weight: 500;
  }
}

.aigen-var-collapse {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.aigen-var-collapse-item {
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  overflow: hidden;
  background: transparent;
}

.aigen-var-collapse-item__header {
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 0;
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.02));
  color: var(--aigen-text-main);
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--aigen-muted, rgba(0, 0, 0, 0.04));
  }
}

.aigen-var-collapse-item__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
}

.aigen-var-collapse-item__arrow {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--aigen-text-helper, #94a3b8);
  transition: transform 0.16s ease;

  svg {
    width: 14px;
    height: 14px;
    display: block;
  }

  &.is-open {
    transform: rotate(90deg);
  }
}

.aigen-var-collapse-item__sub {
  font-size: 11px;
  font-weight: 400;
  color: var(--aigen-text-helper, #94a3b8);
}

.aigen-var-collapse-item__tag {
  font-size: 10px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--aigen-background, #fff);
  border: 1px solid var(--aigen-border);
  color: var(--aigen-text-secondary);
}

.aigen-var-collapse-item__badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--aigen-primary-faded, rgba(22, 119, 255, 0.12));
  color: var(--aigen-primary, #1677ff);
}

.aigen-var-collapse-item__body {
  padding: 10px 12px 12px;
  border-top: 1px solid var(--aigen-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aigen-var-presets {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.aigen-var-preset-btn {
  height: 22px;
  padding: 0 7px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-secondary);
  font-size: 11px;
  cursor: pointer;

  &:hover {
    border-color: var(--aigen-primary, #1677ff);
    color: var(--aigen-primary, #1677ff);
  }

  &.is-format {
    background: var(--aigen-secondary, rgba(0, 0, 0, 0.03));
  }
}

.aigen-var-drawer__editor-wrap {
  height: 220px;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  overflow: hidden;

  &--accessor {
    height: 190px;
  }
}

.aigen-var-drawer__monaco {
  flex: 1;
  min-height: 220px;
  height: 100%;

  &--accessor {
    min-height: 190px;
  }
}

.aigen-var-drawer__textarea {
  flex: 1;
  min-height: 220px;
  padding: 10px 12px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: transparent;
  color: var(--aigen-text-main);
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;

  &--accessor {
    min-height: 190px;
  }
}

.aigen-var-drawer__tips {
  padding: 8px 12px;
  border-radius: 4px;
  background: var(--aigen-secondary, rgba(0, 0, 0, 0.025));
  border: 1px solid var(--aigen-border);
  flex-shrink: 0;
}

.aigen-var-drawer__tips-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--aigen-text-secondary);
  margin-bottom: 6px;
}

.aigen-var-drawer__tips-code {
  margin: 0;
  font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.55;
  color: var(--aigen-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.aigen-var-drawer__tips-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 10px;
  font-size: 11px;
  color: var(--aigen-text-helper, #94a3b8);

  code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    color: var(--aigen-text-main);
  }
}
</style>
