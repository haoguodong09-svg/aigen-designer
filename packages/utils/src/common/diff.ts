import { deepEqual } from './data';

/**
 * 差异操作类型
 * - add: 新增属性/数组元素
 * - remove: 删除属性/数组元素（保留 oldValue 以便需要时反向恢复）
 * - replace: 替换值（也用于类型变化，如数组与对象互变）
 */
export type DiffOp =
  | { oldValue: unknown; op: 'remove'; path: string }
  | { oldValue: unknown; op: 'replace'; path: string; value: unknown }
  | { op: 'add'; path: string; value: unknown };

/** 危险键名：直接赋值会触发原型链写入（原型污染向量） */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isObjectLike = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;

/** 转义路径片段（JSON Pointer 风格） */
const escapeSegment = (segment: string): string =>
  segment.replaceAll('~', '~0').replaceAll('/', '~1');

const unescapeSegment = (segment: string): string =>
  segment.replaceAll('~1', '/').replaceAll('~0', '~');

/** 拆分路径 "/a/b/0" → ["a", "b", "0"] */
const parsePath = (path: string): string[] =>
  path === '' ? [] : path.slice(1).split('/').map(unescapeSegment);

/**
 * 深度对比两个 JSON 兼容值，生成差异操作列表
 * @param before 变化前的值
 * @param after 变化后的值
 * @returns 按序应用即可将 before 结构变为 after 的操作列表
 */
export function createPatch(before: unknown, after: unknown): DiffOp[] {
  const ops: DiffOp[] = [];
  diffValue(before, after, '', ops, new Set<object>());
  return ops;
}

function diffValue(
  before: unknown,
  after: unknown,
  path: string,
  ops: DiffOp[],
  visited: Set<object>,
): void {
  // 原始值相等或引用相同，无需记录
  if (Object.is(before, after)) {
    return;
  }

  // 循环引用检测：递归栈上重复出现同一对象即为环。
  // 历史记录最终以 JSON 存储，环无法序列化，因此抛出明确错误而非栈溢出
  if (isObjectLike(before)) {
    if (visited.has(before)) {
      throw new Error(`无法生成差异：路径 "${path}" 存在循环引用`);
    }
    visited.add(before);
  }
  if (isObjectLike(after)) {
    if (visited.has(after)) {
      throw new Error(`无法生成差异：路径 "${path}" 存在循环引用`);
    }
    visited.add(after);
  }

  try {
    // 任意一侧不是对象（或为 null），记录替换
    if (!isObjectLike(before) || !isObjectLike(after)) {
      ops.push({ oldValue: before, op: 'replace', path, value: after });
      return;
    }

    // 处理特殊类型：Date
    if (before instanceof Date || after instanceof Date) {
      if (before instanceof Date && after instanceof Date) {
        if (before.getTime() !== after.getTime()) {
          ops.push({ oldValue: before, op: 'replace', path, value: after });
        }
        return;
      }
      ops.push({ oldValue: before, op: 'replace', path, value: after });
      return;
    }

    // 处理特殊类型：RegExp
    if (before instanceof RegExp || after instanceof RegExp) {
      if (
        before instanceof RegExp &&
        after instanceof RegExp &&
        before.source === after.source &&
        before.flags === after.flags
      ) {
        return;
      }
      ops.push({ oldValue: before, op: 'replace', path, value: after });
      return;
    }

    // Map/Set：与 deepEqual 的逐项比较语义保持一致——
    // 相等则不产生操作，不等则整体替换（避免静默丢失差异）
    if (
      before instanceof Map ||
      after instanceof Map ||
      before instanceof Set ||
      after instanceof Set
    ) {
      if (!deepEqual(before, after)) {
        ops.push({ oldValue: before, op: 'replace', path, value: after });
      }
      return;
    }

    // 数组与数组对比
    if (Array.isArray(before) && Array.isArray(after)) {
      diffArrays(before, after, path, ops, visited);
      return;
    }

    // 数组与对象互变
    if (Array.isArray(before) !== Array.isArray(after)) {
      ops.push({ oldValue: before, op: 'replace', path, value: after });
      return;
    }

    // 普通对象对比
    diffObjects(
      before as Record<string, unknown>,
      after as Record<string, unknown>,
      path,
      ops,
      visited,
    );
  } finally {
    visited.delete(before);
    visited.delete(after);
  }
}

function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  path: string,
  ops: DiffOp[],
  visited: Set<object>,
): void {
  const afterKeys = new Set(Object.keys(after));

  // 先记录删除（对象属性的应用顺序不影响结果）
  for (const key of Object.keys(before)) {
    if (!afterKeys.has(key)) {
      ops.push({
        oldValue: before[key],
        op: 'remove',
        path: `${path}/${escapeSegment(key)}`,
      });
    }
  }

  // 再记录新增、替换和递归
  for (const key of Object.keys(after)) {
    const childPath = `${path}/${escapeSegment(key)}`;
    if (!Object.prototype.hasOwnProperty.call(before, key)) {
      ops.push({ op: 'add', path: childPath, value: after[key] });
      continue;
    }
    diffValue(before[key], after[key], childPath, ops, visited);
  }
}

function diffArrays(
  before: unknown[],
  after: unknown[],
  path: string,
  ops: DiffOp[],
  visited: Set<object>,
): void {
  const beforeLen = before.length;
  const afterLen = after.length;
  const minLen = Math.min(beforeLen, afterLen);

  // 找出公共前缀与公共后缀，只处理中间变化的部分
  let prefix = 0;
  while (prefix < minLen && deepEqual(before[prefix], after[prefix])) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    deepEqual(before[beforeLen - 1 - suffix], after[afterLen - 1 - suffix])
  ) {
    suffix++;
  }

  const beforeMidEnd = beforeLen - suffix;
  const afterMidEnd = afterLen - suffix;
  const overlap = Math.min(beforeMidEnd - prefix, afterMidEnd - prefix);

  // 1. 删除多余元素（逆序，保证后续路径在应用时仍然有效）
  for (let i = beforeMidEnd - 1; i >= prefix + overlap; i--) {
    ops.push({ oldValue: before[i], op: 'remove', path: `${path}/${i}` });
  }

  // 2. 新增元素（正序）
  for (let i = prefix + overlap; i < afterMidEnd; i++) {
    ops.push({ op: 'add', path: `${path}/${i}`, value: after[i] });
  }

  // 3. 递归对比重叠部分
  for (let i = prefix; i < prefix + overlap; i++) {
    diffValue(before[i], after[i], `${path}/${i}`, ops, visited);
  }
}

/**
 * 按序应用差异操作，将 target 原地修改为补丁描述的结构
 * @param target 目标对象（保持引用不变）
 * @param ops 差异操作列表
 */
export function applyPatch(
  target: Record<string, unknown>,
  ops: DiffOp[],
): void {
  for (const op of ops) {
    const segments = parsePath(op.path);
    // 根节点（空路径）的替换/删除意味着整体值类型变化，无法原地应用（需保持引用），明确报错
    if (segments.length === 0) {
      throw new Error(
        '无法应用差异操作：根节点整体替换不支持原地应用（path=""）',
      );
    }
    const parent = navigate(target, segments.slice(0, -1));
    const last = segments[segments.length - 1];

    // 危险键名：直接赋值会走原型 setter（原型污染/数据丢失），明确拒绝
    if (DANGEROUS_KEYS.has(last)) {
      throw new Error(
        `无法应用差异操作：路径 "${op.path}" 包含危险键名 "${last}"`,
      );
    }

    if (Array.isArray(parent) && /^\d+$/.test(last)) {
      const index = Number(last);
      if (op.op === 'add') {
        if (index < 0 || index > parent.length) {
          throw new Error(`无法应用差异操作：路径 "${op.path}" 的数组索引越界`);
        }
        parent.splice(index, 0, op.value);
      } else if (op.op === 'remove') {
        if (index < 0 || index >= parent.length) {
          throw new Error(`无法应用差异操作：路径 "${op.path}" 的数组索引越界`);
        }
        parent.splice(index, 1);
      } else {
        if (index < 0 || index >= parent.length) {
          throw new Error(`无法应用差异操作：路径 "${op.path}" 的数组索引越界`);
        }
        parent[index] = op.value;
      }
    } else if (isObject(parent)) {
      if (op.op === 'remove') {
        delete parent[last];
      } else {
        parent[last] = op.value;
      }
    } else {
      throw new Error(`无法应用差异操作：路径 "${op.path}" 的父节点不存在`);
    }
  }
}

/** 沿路径导航到父节点 */
function navigate(root: Record<string, unknown>, segments: string[]): unknown {
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      throw new Error(`无法应用差异操作：路径 "${segment}" 不是对象`);
    }
    current =
      Array.isArray(current) && /^\d+$/.test(segment)
        ? current[Number(segment)]
        : (current as Record<string, unknown>)[segment];
    if (current === undefined) {
      throw new Error(`无法应用差异操作：路径 "${segment}" 不存在`);
    }
  }
  return current;
}
