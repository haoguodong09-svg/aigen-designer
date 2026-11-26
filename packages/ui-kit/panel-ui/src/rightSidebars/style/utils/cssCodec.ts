/**
 * TinyEngine 风格样式编解码与 CSS 规则工具集
 * - 行内样式对象 <-> `:root { ... }` CSS 文本双向转换
 * - 页面级 `pageSchema.css` 类名/伪类规则读写
 * - 尺寸单位解析与四边简写展开
 */

export type PseudoState = 'active' | 'disabled' | 'focus' | 'hover' | 'none';

export const PSEUDO_STATE_OPTIONS: Array<{
  label: string;
  pseudo: string;
  value: PseudoState;
}> = [
  { label: 'None', pseudo: '', value: 'none' },
  { label: 'hover', pseudo: ':hover', value: 'hover' },
  { label: 'pressed', pseudo: ':active', value: 'active' },
  { label: 'focused', pseudo: ':focus', value: 'focus' },
  { label: 'disabled', pseudo: ':disabled', value: 'disabled' },
];

/** camelCase -> kebab-case (兼容 --css-var) */
export function toKebabCase(prop: string): string {
  if (prop.startsWith('--')) return prop;
  return prop.replaceAll(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** kebab-case -> camelCase (兼容 --css-var) */
export function toCamelCase(prop: string): string {
  if (prop.startsWith('--')) return prop;
  return prop.replaceAll(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

/** 将样式对象序列化为 `:root {\n  ...\n}` 文本 */
export function styleObjectToRootCss(
  style: null | Record<string, unknown> | undefined,
): string {
  if (!style || typeof style !== 'object') {
    return ':root {\n}';
  }
  const lines = Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `  ${toKebabCase(k)}: ${String(v).trim()};`);
  return lines.length > 0 ? `:root {\n${lines.join('\n')}\n}` : ':root {\n}';
}

/** 从 CSS 声明块内部文本解析出 camelCase 样式对象 */
export function parseCssDeclarations(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  // 去掉注释
  const cleaned = body.replaceAll(/\/\*[\s\S]*?\*\//g, '');
  let current = '';
  let parenDepth = 0;
  let quote: "'" | '"' | '' = '';

  const flush = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx <= 0) return;
    const key = toCamelCase(trimmed.slice(0, colonIdx).trim());
    const val = trimmed.slice(colonIdx + 1).trim();
    if (key && val) {
      result[key] = val;
    }
  };

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (quote) {
      current += ch;
      if (ch === quote && cleaned[i - 1] !== '\\') quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') parenDepth++;
    if (ch === ')' && parenDepth > 0) parenDepth--;
    if (ch === ';' && parenDepth === 0) {
      flush(current);
      current = '';
    } else {
      current += ch;
    }
  }
  flush(current);
  return result;
}

/** 将 `:root { ... }` 或纯声明文本解析为样式对象 */
export function rootCssToStyleObject(cssText: string): Record<string, string> {
  const trimmed = cssText.trim();
  if (!trimmed) return {};
  const rootMatch = trimmed.match(/:root\s*\{([\s\S]*)\}/);
  const body = rootMatch ? rootMatch[1] : trimmed.replaceAll(/^\{|\}$/g, '');
  return parseCssDeclarations(body);
}

/** 生成紧凑的一行预览文本 `:root { width: 100px; ... }` */
export function formatRootCssPreview(
  style: null | Record<string, unknown> | undefined,
): string {
  if (!style || typeof style !== 'object') return ':root { }';
  const entries = Object.entries(style).filter(
    ([, v]) => v !== undefined && v !== null && String(v).trim() !== '',
  );
  if (entries.length === 0) return ':root { }';
  const joined = entries
    .map(([k, v]) => `${toKebabCase(k)}: ${String(v).trim()};`)
    .join(' ');
  return `:root { ${joined} }`;
}

/** 构造完整选择器（如 `.btn-a1b2` 或 `.btn-a1b2:hover`） */
export function buildClassSelector(
  className: string,
  state: PseudoState = 'none',
): string {
  const clean = className.trim().replace(/^\.+/, '');
  const stateDef = PSEUDO_STATE_OPTIONS.find((item) => item.value === state);
  return `.${clean}${stateDef?.pseudo ?? ''}`;
}

function escapeRegExp(str: string): string {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** 从全局 CSS 中读取指定选择器（类名 + 伪类）的声明对象 */
export function readSelectorStyleFromCss(
  globalCss: string | undefined,
  className: string,
  state: PseudoState = 'none',
): Record<string, string> {
  if (!globalCss || !className.trim()) return {};
  const selector = buildClassSelector(className, state);
  const regex = new RegExp(
    `(?:^|\\n)\\s*${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`,
  );
  const match = globalCss.match(regex);
  if (!match) return {};
  return parseCssDeclarations(match[1]);
}

/** 更新全局 CSS 中指定选择器（类名 + 伪类）的声明对象 */
export function writeSelectorStyleToCss(
  globalCss: string | undefined,
  className: string,
  state: PseudoState,
  styleObj: Record<string, unknown>,
): string {
  const baseCss = globalCss ?? '';
  if (!className.trim()) return baseCss;
  const selector = buildClassSelector(className, state);
  const entries = Object.entries(styleObj).filter(
    ([, v]) => v !== undefined && v !== null && String(v).trim() !== '',
  );
  const blockBody = entries
    .map(([k, v]) => `  ${toKebabCase(k)}: ${String(v).trim()};`)
    .join('\n');
  const nextRule = entries.length > 0 ? `${selector} {\n${blockBody}\n}` : '';

  const regex = new RegExp(
    `(^|\\n)(\\s*${escapeRegExp(selector)}\\s*\\{[\\s\\S]*?\\})`,
  );
  if (regex.test(baseCss)) {
    const replaced = baseCss.replace(regex, (_, prefix: string) =>
      nextRule ? `${prefix}${nextRule}` : '',
    );
    return replaced.replaceAll(/\n{3,}/g, '\n\n').trim();
  }
  if (!nextRule) return baseCss;
  return baseCss.trim() ? `${baseCss.trim()}\n\n${nextRule}` : nextRule;
}

/** 从全局 CSS 提取所有已定义类名（去重、不含前导点与伪类） */
export function extractClassNamesFromCss(
  globalCss: string | undefined,
): string[] {
  if (!globalCss) return [];
  const names = new Set<string>();
  const regex = /\.([a-z_-][\w-]*)(?::[a-z-]+)?\s*\{/gi;
  let match: null | RegExpExecArray = regex.exec(globalCss);
  while (match) {
    names.add(match[1]);
    match = regex.exec(globalCss);
  }
  return [...names];
}

/** 为组件节点生成默认可读类名（如 `button-x8k2m`） */
export function generateNodeClassName(nodeType: string): string {
  const slug =
    nodeType
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-|-$/g, '') || 'node';
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${slug}-${suffix}`;
}

/** 解析尺寸值为 `{ num, unit }` */
export function parseSizeValue(
  raw: unknown,
  defaultUnit = 'px',
): { num: string; unit: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { num: '', unit: defaultUnit };
  }
  const str = String(raw).trim();
  if (str === 'auto') {
    return { num: 'auto', unit: 'auto' };
  }
  const match = str.match(
    /^(-?\d+(?:\.\d+)?)\s*(px|%|em|rem|vw|vh|pt|fr|deg)?$/i,
  );
  if (match) {
    return {
      num: match[1],
      unit: match[2]?.toLowerCase() || defaultUnit,
    };
  }
  return { num: str, unit: defaultUnit };
}
