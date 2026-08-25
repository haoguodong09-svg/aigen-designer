/**
 * Node 环境垫片（副作用模块，无导出）。
 *
 * 必须在 vite.config.ts 中作为第一个 import 引入：@vue/devtools-kit 在模块顶层初始化时
 * 就会访问 localStorage（getTimelineLayersStateFromStorage → initStateFactory），而 Node
 * 环境（vite dev/build 加载配置）没有 localStorage，导致
 * `TypeError: localStorage.getItem is not a function` 崩溃。
 * 这里仅在全局不存在可用的 localStorage 时安装一个最小实现（Map 作为存储后端，
 * 不依赖任何外部 API）；浏览器环境中真实 localStorage 已存在，不会被覆盖。
 *
 * 另外，Node ≥ v22 起 fs.rmdirSync 不再支持 options.recursive（Node 25 直接抛
 * ERR_INVALID_ARG_VALUE），而 vite-plugin-monaco-editor@1.1.0 仍以
 * `rmdirSync(cacheDir, { recursive: true, force: true })` 清理缓存目录，导致
 * dev server 启动即崩溃。这里对 rmdirSync 做兼容垫片：仅在仍带 recursive 选项
 * 时改走 fs.rmSync（语义完全等价）。
 */

import fs from 'node:fs';

const globalObject = globalThis as { localStorage?: Storage };

const hasUsableLocalStorage =
  globalObject.localStorage !== undefined &&
  typeof globalObject.localStorage.getItem === 'function';

if (!hasUsableLocalStorage) {
  // 最小可用的 Storage 形状实现
  const store = new Map<string, string>();

  const localStorageShim: Storage = {
    clear(): void {
      store.clear();
    },
    getItem(key: string): null | string {
      return store.get(key) ?? null;
    },
    key(index: number): null | string {
      return Array.from(store.keys())[index] ?? null;
    },
    get length(): number {
      return store.size;
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorageShim,
    writable: true,
  });
}

// fs.rmdirSync 兼容垫片（见文件头注释）
const originalRmdirSync = fs.rmdirSync;
fs.rmdirSync = function rmdirSyncCompat(
  path: fs.PathLike,
  options?: fs.RmDirOptions,
): void {
  if (options && (options as { recursive?: boolean }).recursive) {
    // 新版 Node 已移除 recursive 选项，改走 rmSync（force 兼容不存在的目录）
    fs.rmSync(path, options as fs.RmOptions);
    return;
  }
  originalRmdirSync(path, options);
} as typeof fs.rmdirSync;
