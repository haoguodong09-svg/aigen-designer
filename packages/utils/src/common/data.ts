import type {
  ComponentConfigModel,
  ComponentSchema,
  PageSchema,
} from '@aigen-designer/types';

import { isProxy, isRef, toRaw } from 'vue';

import { getUUID } from './string';

/**
 * 组件配置查询器：由 manager 包在导入时注册（见 pluginManager.ts）。
 * 采用注入式而不是模块级 import @aigen-designer/manager，是为了切断
 * utils → manager → revoke → schemaWorkerBridge → schema.worker 的循环依赖链：
 * Worker 构建（W16）只需 utils 的纯函数，若 utils 模块级引用 manager，
 * worker 依赖图会把整个 manager/base-ui（含 .vue 与 monaco）打包进来。
 * Worker 内无注册表时 provider 为 null，行为与 getConfigByType 返回 undefined 一致。
 */
type ComponentConfigProvider = (
  type: string,
) => ComponentConfigModel | undefined;

let componentConfigProvider: ComponentConfigProvider | null = null;

/**
 * 注册/注销全局组件配置查询器（由 @aigen-designer/manager 在模块初始化时调用）
 */
export function setComponentConfigProvider(
  provider: ComponentConfigProvider | null,
): void {
  componentConfigProvider = provider;
}

/** 获取组件配置（无注册表时返回 undefined） */
function getComponentConfig(type: string): ComponentConfigModel | undefined {
  return componentConfigProvider?.(type);
}

/** 危险键名：直接赋值会触发原型链写入（原型污染向量），与 diff.ts 保持一致 */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * 解析路径字符串为片段数组，支持点语法与数组索引语法
 * 例如 "a.b[0].c" → ["a", "b", "0", "c"]
 * @param path 点分隔的路径字符串
 */
function parsePath(path: string): string[] {
  return path
    .replaceAll(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
}

/**
 * 深拷贝数据
 * @param obj 要拷贝的对象
 * @param useStructuredClone 是否使用 structuredClone 方法（Worker/无 window 环境需传 false）
 * @param cache 缓存对象，用于处理循环引用
 * @returns 拷贝后的对象
 */
export function deepClone<T>(
  obj: T,
  useStructuredClone = true,
  cache = new WeakMap(),
): T {
  // 如果不是对象或数组，则直接返回（基础类型/函数原样返回）
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  // 如果已经处理过这个对象，则直接返回缓存中的对象
  if (cache.has(obj)) {
    return cache.get(obj);
  }

  // 优先使用全局 structuredClone（浏览器/现代 Node 均可用）。
  // 用 typeof 判断避免 SSR/无 window 环境下直接访问 window 抛 ReferenceError（W3-3.3）
  if (useStructuredClone && typeof structuredClone === 'function') {
    const rawObj = deepToRaw(obj);
    try {
      const cloned = structuredClone(rawObj);
      return cloned;
    } catch {
      // structuredClone 对函数等不可克隆值抛 DataCloneError（如 schema 的 show 函数属性），
      // 回退到下方手动克隆路径（手动克隆对函数安全，按引用保留）
    }
  }

  // 处理数组
  if (Array.isArray(obj)) {
    const clonedArray = obj.map((item) =>
      deepClone(item as T, useStructuredClone, cache),
    ) as T;
    cache.set(obj, clonedArray);
    return clonedArray;
  }

  // 手动路径的特殊类型分支（W3-3.3）：Date/RegExp/Map/Set 不再静默变成 {}
  if (obj instanceof Date) {
    const cloned = new Date(obj) as T;
    cache.set(obj, cloned);
    return cloned;
  }
  if (obj instanceof RegExp) {
    const cloned = new RegExp(obj.source, obj.flags) as T;
    cache.set(obj, cloned);
    return cloned;
  }
  if (obj instanceof Map) {
    const cloned = new Map() as T;
    cache.set(obj, cloned);
    for (const [key, value] of obj) {
      (cloned as Map<unknown, unknown>).set(
        key,
        deepClone(value, useStructuredClone, cache),
      );
    }
    return cloned;
  }
  if (obj instanceof Set) {
    const cloned = new Set() as T;
    cache.set(obj, cloned);
    for (const value of obj) {
      (cloned as Set<unknown>).add(deepClone(value, useStructuredClone, cache));
    }
    return cloned;
  }

  // 处理普通对象
  const clonedObj = {} as Record<string, unknown>;
  cache.set(obj, clonedObj);
  Object.keys(obj).forEach((key) => {
    clonedObj[key] = deepClone(
      (obj as Record<string, unknown>)[key] as T,
      useStructuredClone,
      cache,
    );
  });
  return clonedObj as T;
}

/**
 * 递归遍历对象，将所有Proxy对象转换为原始对象
 * @param value 需要处理的值
 * @param cache 缓存已处理的对象，用于处理循环引用
 * @returns 处理后的结果，所有Proxy都被转换为原始对象
 */
export function deepToRaw<T>(value: T, cache = new WeakMap()): T {
  // 基本类型直接返回
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // 检查是否已处理过该对象
  if (cache.has(value as object)) {
    return cache.get(value as object) as T;
  }

  // 处理当前Proxy对象
  const currentValue = isProxy(value) ? toRaw(value) : value;

  // 将当前值存入缓存，防止循环引用导致的无限递归
  cache.set(value as object, currentValue);

  // 处理数组
  if (Array.isArray(currentValue)) {
    let processedItem: any;
    // 遍历数组查找需要处理的元素
    for (let i = 0; i < currentValue.length; i++) {
      const item = currentValue[i];
      if (item !== null && typeof item === 'object') {
        processedItem = deepToRaw(item, cache);
        // 发现需要修改的元素，才创建新数组
        if (processedItem !== item) {
          const newArray = currentValue.slice(0, i);
          newArray.push(processedItem);

          // 处理剩余元素
          for (let j = i + 1; j < currentValue.length; j++) {
            const remainingItem = currentValue[j];
            newArray.push(
              remainingItem !== null && typeof remainingItem === 'object'
                ? deepToRaw(remainingItem, cache)
                : remainingItem,
            );
          }
          return newArray as unknown as T;
        }
      }
    }
    // 无修改，返回原数组
    return currentValue;
  }

  // 处理普通对象
  let result: null | Record<string, any> = null;
  const keys = Object.keys(currentValue as object);

  for (const key of keys) {
    const propValue = (currentValue as Record<string, unknown>)[key];
    if (propValue !== null && typeof propValue === 'object') {
      const processedValue = isRef(propValue)
        ? deepToRaw(propValue.value, cache)
        : deepToRaw(propValue, cache);
      // 发现需要修改的属性，才创建新对象
      if (processedValue !== propValue) {
        // 延迟创建新对象，直到确定需要修改时
        if (!result) {
          result = { ...(currentValue as Record<string, any>) };
        }
        result[key] = processedValue;
      }
    }
  }

  // 有修改则返回新对象，否则返回原对象
  return result ? (result as T) : currentValue;
}

/**
 * 生成新的schema数据
 * 深拷贝数据,防止重复引用
 * 生成uuid
 * 生成field
 * @param schema 原始数据
 * @param schemas 页面schemas数据,用于检查是否生成重复uuid
 */
export function generateNewSchema(
  schema: ComponentSchema,
  schemas: ComponentSchema[] = [],
) {
  const [newSchema] = mapSchemas([deepClone(schema)], (item) => {
    let attemptCount = 0; // 初始化尝试次数
    let newId = `${item.type}_${getUUID(4, 'number')}`;

    // 循环检查是否冲突，直到没有冲突为止
    while (
      findSchemas(
        schemas,
        (currentNode) => {
          if (currentNode.id === newId) {
            return true; // 如果发现冲突，返回true
          }
          return false;
        },
        true,
      )
    ) {
      attemptCount++; // 每次循环尝试次数增加
      // 如果超过50次尝试，抛出错误
      if (attemptCount >= 50) {
        throw new Error(`ID冲突，已尝试 ${attemptCount} 次，无法生成唯一ID`);
      }
      // 如果冲突，重新生成ID并继续检查
      newId = `${item.type}_${getUUID(4, 'number')}`;
    }

    // 补充id字段
    const newVal = {
      ...item,
      id: newId,
    };

    // 存在字段名，则自动在字段名后补充id
    if (
      (newVal.field || newVal.input) &&
      !getComponentConfig(newVal.type)?.editConstraints?.fixedField
    ) {
      newVal.field = newVal.id;
    }
    return newVal;
  });

  return newSchema;
}

/**
 * 不改变obj1引用，将obj2所有属性遍历复制给obj1。
 * 递归比较两个对象，将obj2的属性复制给obj1。
 * 如果obj1中有obj2没有的属性，根据shouldDelete参数决定是否删除该属性。
 * @param obj1 - 要修改的对象。
 * @param obj2 - 要比较的对象。
 * @param shouldDelete - 如果为true，则删除obj2中不存在的obj1的属性。
 * @param visited - 内部参数：已处理的 (obj1, obj2) 配对，用于循环引用检测（W3-3.6）
 */
export function deepCompareAndModify(
  obj1: object,
  obj2: object,
  shouldDelete: boolean = true,
  visited = new WeakMap<object, object>(),
): void {
  // 环检测（W3-3.6）：同一对 (obj1, obj2) 已处理过则跳过，避免循环引用栈溢出
  if (visited.has(obj1) && visited.get(obj1) === obj2) {
    return;
  }
  visited.set(obj1, obj2);

  const typedObj1 = obj1 as Record<string, unknown>;

  // 循环遍历obj2的所有属性
  for (const [key, val2] of Object.entries(obj2)) {
    // 如果obj1的属性值是对象或数组，则递归调用该函数
    if (
      typedObj1[key] &&
      val2 &&
      typeof typedObj1[key] === 'object' &&
      typeof val2 === 'object'
    ) {
      // 如果typedObj1[key]是数组，val2为非数组
      if (Array.isArray(typedObj1[key]) && !Array.isArray(val2)) {
        typedObj1[key] = {};
      } else if (!Array.isArray(typedObj1[key]) && Array.isArray(val2)) {
        typedObj1[key] = [];
      }
      // Date/RegExp/Map/Set 等特殊对象整体替换（W3-3.6）：
      // Object.entries 对它们返回空数组，递归会静默忽略导致永不更新
      if (
        typedObj1[key] instanceof Date ||
        typedObj1[key] instanceof RegExp ||
        typedObj1[key] instanceof Map ||
        typedObj1[key] instanceof Set ||
        val2 instanceof Date ||
        val2 instanceof RegExp ||
        val2 instanceof Map ||
        val2 instanceof Set
      ) {
        typedObj1[key] = val2;
        continue;
      }
      // 递归比较
      deepCompareAndModify(
        typedObj1[key] as Record<string, unknown>,
        val2 as Record<string, unknown>,
        shouldDelete,
        visited,
      );
    } else {
      // 如果属性值不相等，则将obj2的属性值复制给typedObj1
      typedObj1[key] = val2;
    }
  }

  if (shouldDelete) {
    Object.keys(typedObj1)
      .reverse()
      .forEach((key) => {
        // 如果obj2中存在typedObj1的属性跳过
        if (Object.prototype.hasOwnProperty.call(obj2, key)) {
          return;
        }
        // 如果obj2中没有typedObj1的属性，则从typedObj1中删除该属性
        if (Array.isArray(typedObj1)) {
          // typedObj1 是数组，key 是字符串，需要转成数字索引
          typedObj1.splice(Number(key), 1);
        } else {
          // typedObj1 是对象
          delete typedObj1[key];
        }
      });
  }
}

/**
 * 深度比较两个对象是否相等
 * @param obj1
 * @param obj2
 * @param ignoreKeys 可选参数，指定要忽略比较的属性名数组
 * @param visitedObjs 内部参数，用于检测循环引用
 */
export function deepEqual(
  obj1: unknown,
  obj2: unknown,
  ignoreKeys: string[] = [],
  visitedObjs = new WeakMap<object, object>(),
): boolean {
  // 循环引用检测：必须放在严格相等判断之前。
  // 当同一引用在两侧同时出现、且该引用已与其他对象配对时
  // （例如 obj1.b = obj1 与 obj2.b = obj1），Object.is 会提前返回 true，
  // 绕过配对检查导致结果错误；先查配对才能保证引用映射唯一。
  if (typeof obj1 === 'object' && obj1 !== null && visitedObjs.has(obj1)) {
    // obj1 已经访问过，检查是否和之前配对的是同一个 obj2
    return visitedObjs.get(obj1) === obj2;
  }
  if (typeof obj2 === 'object' && obj2 !== null && visitedObjs.has(obj2)) {
    // obj2 已经访问过，检查是否和之前配对的是同一个 obj1
    return visitedObjs.get(obj2) === obj1;
  }

  // 严格相等直接返回 true
  if (Object.is(obj1, obj2)) {
    return true;
  }

  // 只要有一个不是对象，或者为 null，直接返回 false
  if (
    typeof obj1 !== 'object' ||
    obj1 === null ||
    typeof obj2 !== 'object' ||
    obj2 === null
  ) {
    return false;
  }

  // 类型标签检查（W3-3.2）：Date/Map/Set 等与普通对象/数组互相比较时直接判定不等
  if (
    Object.prototype.toString.call(obj1) !==
    Object.prototype.toString.call(obj2)
  ) {
    return false;
  }

  visitedObjs.set(obj1, obj2);
  visitedObjs.set(obj2, obj1);

  let result = false;

  try {
    // 处理特殊类型：Date
    if (obj1 instanceof Date && obj2 instanceof Date) {
      result = obj1.getTime() === obj2.getTime();
      return result;
    }

    // 处理特殊类型：RegExp
    if (obj1 instanceof RegExp && obj2 instanceof RegExp) {
      result = obj1.source === obj2.source && obj1.flags === obj2.flags;
      return result;
    }

    // 处理特殊类型：Map
    if (obj1 instanceof Map && obj2 instanceof Map) {
      if (obj1.size !== obj2.size) {
        result = false;
        return result;
      }
      for (const [key, val] of obj1) {
        if (
          !obj2.has(key) ||
          !deepEqual(val, obj2.get(key), ignoreKeys, visitedObjs)
        ) {
          result = false;
          return result;
        }
      }
      result = true;
      return result;
    }

    // 处理特殊类型：Set
    if (obj1 instanceof Set && obj2 instanceof Set) {
      if (obj1.size !== obj2.size) {
        result = false;
        return result;
      }
      const arr2 = Array.from(obj2);
      for (const item1 of obj1) {
        const foundIndex = arr2.findIndex((item2) =>
          deepEqual(item1, item2, ignoreKeys, visitedObjs),
        );
        if (foundIndex === -1) {
          result = false;
          return result;
        }
        arr2.splice(foundIndex, 1);
      }
      result = true;
      return result;
    }

    // 处理普通对象和数组
    const isArray1 = Array.isArray(obj1);
    const isArray2 = Array.isArray(obj2);

    if (isArray1 !== isArray2) {
      result = false;
      return result;
    }

    if (isArray1 && isArray2) {
      if (obj1.length !== obj2.length) {
        result = false;
        return result;
      }
      for (const [i, element] of obj1.entries()) {
        if (!deepEqual(element, obj2[i], ignoreKeys, visitedObjs)) {
          result = false;
          return result;
        }
      }
      result = true;
      return result;
    }

    // 纯对象比较
    const objA = obj1 as Record<string, unknown>;
    const objB = obj2 as Record<string, unknown>;

    const filterKeys = (obj: Record<string, unknown>) =>
      Object.keys(obj).filter((key) => !ignoreKeys.includes(key));

    const keys1 = filterKeys(objA);
    const keys2 = filterKeys(objB);

    if (keys1.length !== keys2.length) {
      result = false;
      return result;
    }

    for (const key of keys1) {
      if (!Object.prototype.hasOwnProperty.call(objB, key)) {
        result = false;
        return result;
      }
      if (!deepEqual(objA[key], objB[key], ignoreKeys, visitedObjs)) {
        result = false;
        return result;
      }
    }

    result = true;
    return result;
  } finally {
    // 比较完成后清理映射，避免内存泄漏和状态污染
    visitedObjs.delete(obj1);
    visitedObjs.delete(obj2);
  }
}

/**
 * 通过id获取节点路径
 * @param schemas
 * @param id
 */
export function getMatchedById(
  schemas: ComponentSchema[],
  id: string,
): ComponentSchema[] {
  const matched: ComponentSchema[] = [];
  let found = false;

  function getNodePath(node: ComponentSchema): void {
    matched.push(node);
    if (node.id === id) {
      found = true;
    }
    // 遍历默认子节点
    if (!found && node.children && node.children.length > 0) {
      for (let i = 0; i < node.children.length; i++) {
        getNodePath(node.children[i]);
        if (found) break;
      }
    }

    // 遍历插槽
    if (!found && node.slots) {
      for (const key in node.slots) {
        for (let i = 0; i < node.slots[key].length; i++) {
          getNodePath(node.slots[key][i]);
          if (found) break;
        }
      }
    }

    if (!found) {
      matched.pop();
    }
  }

  schemas.forEach(getNodePath);

  if (!found) {
    console.error(`没有查询到id为${id}的节点`);
  }

  return matched;
}

/**
 * 从嵌套对象中提取值
 * @param object - 要访问的对象
 * @param path - 点分隔的路径字符串（支持 a.b[0] 数组索引语法，W3-3.7 与 setValueByPath 一致）
 * @param defaultValue - 如果路径不存在，返回的默认值
 * @returns 通过路径获取的值
 */
export function getValueByPath(
  object: object,
  path: string,
  defaultValue?: unknown,
) {
  if (!path) {
    return defaultValue;
  }
  // 统一路径解析（点语法 + 数组索引语法）
  const pathArray = parsePath(path);

  // 逐步从对象中提取值
  let result: any = object;
  for (const element of pathArray) {
    // eslint-disable-next-line eqeqeq
    if (result == null) {
      // 如果中间的值为 null 或 undefined，返回默认值
      return defaultValue;
    }

    result = result[element];
  }

  // 如果最终的值为 undefined，返回默认值
  return result === undefined ? defaultValue : result;
}

/**
 * 在嵌套对象中设置值
 * @param object - 要修改的对象
 * @param path - 点分隔的路径字符串（支持 a.b[0] 数组索引语法）
 * @param value - 要设置的值
 * @returns 修改后的对象
 */
export function setValueByPath<T>(object: T, path: string, value: unknown): T {
  // 如果路径为空，直接返回对象
  if (!path) {
    return object;
  }

  // 统一路径解析（点语法 + 数组索引语法）
  const pathArray = parsePath(path);

  // 原型污染防护（W3-3.1）：危险键名直接抛错拒绝（与 diff.ts 的 DANGEROUS_KEYS 一致）
  for (const key of pathArray) {
    if (DANGEROUS_KEYS.has(key)) {
      throw new Error(`路径包含危险键名: ${key}`);
    }
  }

  // 逐步设置对象中的值
  let current: any = object;

  for (let i = 0; i < pathArray.length - 1; i++) {
    const key = pathArray[i];

    // 如果当前对象的属性不存在，则创建一个新对象或数组
    // eslint-disable-next-line eqeqeq
    if (current[key] == null) {
      // 如果路径部分是数字，创建数组；否则，创建对象
      current[key] = Number.isNaN(Number(pathArray[i + 1])) ? {} : [];
    }

    current = current[key];
  }

  // 在路径的最后一层设置值
  current[pathArray[pathArray.length - 1]] = value;

  return object;
}

/**
 *  获取表单字段
 * @param schemas 页面结构数据
 * @param formName 表单name
 */
export function getFormFields(
  schemas: ComponentSchema[],
  formName = 'default',
) {
  const inputSchemaList = getFormSchemas(schemas, formName);
  return inputSchemaList.map((item) => item.field);
}

/**
 * 从给定的组件schema数组中获取特定表单的输入字段schema数组。
 * @param {ComponentSchema[]} schemas - 包含整个表单结构信息的组件schema数组。
 * @param {string} formName - 要获取输入字段schema的表单名称，默认为 "default"。
 * @returns {ComponentSchema[]} 包含表单输入字段schema的数组。
 */
export function getFormSchemas(
  schemas: ComponentSchema[],
  formName = 'default',
) {
  const formSchema = findSchemas(
    schemas,
    (currentNode) => {
      return (
        currentNode.type === 'form' &&
        (currentNode.props?.name ?? currentNode.name) === formName
      );
    },
    true,
  ) as ComponentSchema;
  // console.log(schema);
  const inputSchemaList = findSchemas(
    formSchema?.children ?? [],
    (currentNode) => {
      return Boolean(currentNode.input);
    },
    false,
    (currentNode: ComponentSchema) => {
      // 过滤子表单子节点
      return currentNode.type !== 'subform';
    },
  ) as ComponentSchema[];

  return inputSchemaList;
}

/**
 * 查询Schema 返回所有符合添加的数据
 * @param schemas
 * @param handler
 * @param once  当once为true，表示只需要查询一条符合添加的数据之后结束函数
 * @param filter  节点过滤，函数返回 false,则不查询该节点的子节点 children
 */
export function findSchemas(
  schemas: ComponentSchema[],
  handler: (item: ComponentSchema) => boolean,
  once = false,
  filter?: (item: ComponentSchema) => boolean,
) {
  const matchedNodes: ComponentSchema[] = [];

  const nodesToVisit: ComponentSchema[] = [...schemas];

  while (nodesToVisit.length > 0) {
    const currentNode = nodesToVisit.pop() as ComponentSchema;

    // 检查默认子节点
    if (currentNode?.children && (!filter || filter(currentNode))) {
      nodesToVisit.push(...currentNode.children);
    }

    // 检查插槽
    if (currentNode?.slots && (!filter || filter(currentNode))) {
      for (const key in currentNode.slots) {
        nodesToVisit.push(...currentNode.slots[key]);
      }
    }

    if (handler(currentNode)) {
      matchedNodes.push(currentNode);
      if (once) {
        return currentNode;
      }
    }
  }

  // 当只查询一条数据时，执行到这里说明没有查询到数据，所以返回false
  if (once) {
    return false;
  }

  return matchedNodes;
}

/**
 * 遍历Schema 返回映射的数据
 * @param schemas
 * @param handler 映射处理
 * @param filter  节点过滤，函数返回 false,则不映射该节点得所有子节点 children
 */
export function mapSchemas(
  schemas: ComponentSchema[],
  handler: (item: ComponentSchema) => ComponentSchema,
  filter?: (item: ComponentSchema) => boolean,
) {
  const nodesToVisit: ComponentSchema[] = [...schemas];

  while (nodesToVisit.length > 0) {
    const currentNode = nodesToVisit.pop() as ComponentSchema;

    // 检查默认子节点
    if (currentNode?.children && (!filter || filter(currentNode))) {
      nodesToVisit.push(...currentNode.children);
    }
    // 检查插槽
    if (currentNode?.slots && (!filter || filter(currentNode))) {
      for (const key in currentNode.slots) {
        nodesToVisit.push(...currentNode.slots[key]);
      }
    }

    deepCompareAndModify(currentNode, handler(currentNode));
  }

  return schemas;
}

/**
 * 通过id查询schema
 * @param schemas
 * @param id
 */
export function findSchemaById(
  schemas: ComponentSchema[],
  id: string,
): ComponentSchema | null {
  // 查询节点
  const schema = findSchemas(
    schemas,
    (currentNode) => {
      return currentNode?.id === id;
    },
    true,
  ) as ComponentSchema & { children: ComponentSchema };

  // 判断节点是否存在，不存在则返回null
  if (!schema) {
    return null;
  }

  return schema;
}

/**
 * 通过id查询schema及节点children index 信息
 * @param schemas
 * @param id
 * @description 重写（W3-3.5）：显式遍历 children/slots 容器查找目标节点；
 * 未找到统一抛错，不再返回 { schema: undefined } 垃圾数据（原实现对
 * 叶子节点 children 为 [] 时静默失败，导致粘贴/删除等操作失效）
 */
export function findSchemaInfoById(
  schemas: ComponentSchema[],
  id: string,
): {
  index: number;
  list: ComponentSchema[];
  parentSchema: ComponentSchema;
  schema: ComponentSchema;
} {
  // 根容器：children 为传入的 schemas
  const root: ComponentSchema = { type: '', children: schemas };
  const stack: ComponentSchema[] = [root];

  while (stack.length > 0) {
    const currentNode = stack.pop() as ComponentSchema;

    // 收集所有子节点容器（children + 各 slots）
    const containers: ComponentSchema[][] = [];
    if (currentNode.children) {
      containers.push(currentNode.children);
    }
    if (currentNode.slots) {
      for (const key in currentNode.slots) {
        containers.push(currentNode.slots[key]);
      }
    }

    for (const list of containers) {
      const index = list.findIndex((child) => child.id === id);
      if (index !== -1) {
        return {
          index,
          parentSchema: currentNode,
          schema: list[index],
          list,
        };
      }
      // 继续向下查找
      stack.push(...list);
    }
  }

  throw new Error(`没有查询到id为${id}的节点`);
}

/**
 * 将k-form-design数据转换为aigen-designer数据
 * @param data
 * @returns
 */

export function convertKFormData(data: any) {
  // 本地读取配置，不再向输入数据写入 data.config（W3-3.11 输入不变异）
  const config = data.config ?? {};
  const convertedData: PageSchema = {
    schemas: [
      {
        id: 'root',
        label: '页面',
        type: 'page',
        children: [
          {
            label: '表单',
            type: 'form',
            icon: 'aigen-icon-daibanshixiang',
            labelWidth: config.labelWidth || 100,
            name: 'default',
            props: {
              colon: config.colon || true,
              hideRequiredMark: config.hideRequiredMark || false,
              labelAlign: config.labelAlign || 'right',
              labelCol: config.labelCol || { span: 5 },
              labelLayout: config.labelLayout === 'flex' ? 'fixed' : 'flex',
              labelWidth: config.labelWidth || 100,
              layout: config.layout || 'horizontal',
              size: config.size || 'middle',
              wrapperCol: config.wrapperCol || { span: 19 },
            },
            children: [],
            id: `form_${getUUID()}`,
          },
        ],
      },
    ],
    script: data.script || '',
  };

  if (convertedData.schemas && convertedData.schemas.length > 0) {
    const firstSchema = convertedData.schemas[0];
    // 检查 firstSchema 的 children 是否存在且长度大于 0
    if (firstSchema.children && firstSchema.children.length > 0) {
      const firstChild = firstSchema.children[0];
      // 检查 data.list 是否存在
      if (data.list) {
        firstChild.children = recursionConvertedNode(data.list);
      }
    }
  }

  return convertedData;
}

// 定义节点的类型
interface OriginalNode {
  columns?: OriginalNode[];
  icon?: string;
  key?: string;
  label?: string;
  list?: OriginalNode[];
  model?: string;
  options?: Record<string, unknown>;
  rules?: { required: boolean }[];
  span?: number;
  tds?: OriginalNode[];
  trs?: OriginalNode[];
  type?: string;
}

/**
 * 递归转换子节点
 * @param children
 */
export function recursionConvertedNode(
  children: OriginalNode[],
  parent?: OriginalNode,
): ComponentSchema[] {
  return children.map((item) => {
    let type = item.type ?? '';
    // 浅拷贝 options：后续 delete/改写不污染输入数据（W3-3.11）
    const props: Record<string, any> = item.options ? { ...item.options } : {};

    const handleUploadComponent = (uploadType: string, replacement: string) => {
      if (type === uploadType) {
        type = replacement;
        if (typeof props.defaultValue === 'string') {
          props.defaultValue = JSON.parse(props.defaultValue);
        }
      }
    };

    handleUploadComponent('uploadImg', 'upload-image');
    handleUploadComponent('uploadFile', 'upload-file');

    if (type === 'date' && props.range) {
      props.type = 'daterange';
      delete props.range;
    }

    if (type === 'date' || type === 'time') {
      props.valueFormat = props.format;
    }

    if (type === 'textarea') {
      const { maxRows, minRows } = props;
      props.autoSize = { maxRows, minRows };
      delete props.minRows;
      delete props.maxRows;
    }

    if (type === 'number' && !props.precision) {
      delete props.precision;
    }

    if (props.width) {
      props.style = { width: props.width };
      delete props.width;
    }

    if (type === 'grid') {
      type = 'row';
      // 待修改
    }

    // 本地生成 key：不再改写输入 item.key（W3-3.11）
    let key = item.key;
    if (parent && parent.type === 'grid') {
      type = 'col';
      props.span = item.span;
      key = getUUID();
    }

    // 创建新的节点数据
    const newItem: ComponentSchema = {
      field: item.model,
      icon: item.icon || '',
      id: key,
      label: item.label,
      props,
      type,
    };

    // 隐藏label 和 无FormItem 数据
    if (props.noFormItem || !props.showLabel) {
      newItem.noFormItem = true;
      delete props.noFormItem;
      delete props.showLabel;
    }

    // 清空属性字段
    if (props.clearable) {
      props.allowClear = true;
      delete props.clearable;
    }

    // 输入组件
    const inputTypes = [
      'input',
      'textarea',
      'number',
      'password',
      'select',
      'cascader',
      'checkbox',
      'radio',
      'date',
      'time',
      'slider',
      'switch',
      'color-picker',
      'upload-file',
      'upload-image',
    ];
    if (inputTypes.includes(type)) {
      newItem.input = true;
      // 复制规则数组后剔除首条非必填规则：不修改输入（W3-3.11）
      const rules = item.rules ? [...item.rules] : undefined;
      if (rules?.[0]?.required === false) {
        rules.shift();
      }
      if (rules && rules.length > 0) {
        newItem.rules = rules;
      }
    }

    // 递归子节点转换
    if (item.list) {
      newItem.children = recursionConvertedNode(item.list, item);
    }
    if (item.columns) {
      newItem.children = recursionConvertedNode(item.columns, item);
    }
    if (item.trs) {
      newItem.children = recursionConvertedNode(item.trs, item);
    }
    if (item.tds) {
      newItem.children = recursionConvertedNode(item.tds, item);
    }

    return newItem;
  });
}

/**
 * 迁移 componentProps 到 props
 * @param pageSchema 页面Schema
 * @param shouldWarn 是否打印警告
 */
export function migrateComponentProps(
  pageSchema: PageSchema,
  shouldWarn = false,
) {
  // 判断是否存在旧的属性警告提示
  let hasWarned = false;
  findSchemas(pageSchema.schemas, (schema) => {
    // 兼容旧版本的 componentProps
    if (schema.componentProps) {
      schema.props = schema.componentProps;
      delete schema.componentProps;
      hasWarned = true;
    }
    return false;
  });
  if (hasWarned && shouldWarn) {
    console.warn(
      '[Aigen] PageSchema中的componentProps属性已迁移到props，请使用新版本设计器更新数据',
    );
  }

  // 当 padding 属性 === 16px 时，删除该属性，适配新的画布边距模式
  const style = pageSchema.schemas[0]?.props?.style;
  if (style?.padding === '16px') {
    delete style.padding;
  }

  return pageSchema;
}

/**
 * 重新组织页面 schema 结构以适配 tableView 模式
 * @param pageSchema 页面Schema
 * @param fullWidthTypes - 需要添加全宽样式的组件类型数组
 */
export function reorganizeSchemasForTableView(
  pageSchema: PageSchema,
  fullWidthTypes: string[] = [],
) {
  const formSchemas = findSchemas(
    pageSchema.schemas,
    (item) => item.type === 'form',
  ) as ComponentSchema[];

  formSchemas.forEach((form) => {
    if (!form.children?.length) return;
    const subTables: ComponentSchema[] = [];

    const inputSchemas = findSchemas(
      form.children,
      (child) => {
        const config = getComponentConfig(child.type);
        const isInput = Boolean(child.input && config && !config.isSubTable);
        if (isInput && fullWidthTypes.includes(child.type)) {
          child.class = 'aigen-full-width';
        }
        return isInput;
      },
      false,
      (item) => {
        const config = getComponentConfig(item.type);
        if (config?.isSubTable) {
          item.class = 'aigen-sub-table aigen-full-width';
          subTables.push(item);
          return false;
        }
        return true;
      },
    ) as ComponentSchema[];
    form.children = inputSchemas.reverse();
    form.children.push(...subTables);
  });

  return pageSchema;
}
