import { resolve } from 'node:path';

import vue from '@vitejs/plugin-vue';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

import nlsPlugin, {
  esbuildPluginMonacoEditorNls,
  Languages,
} from './vite-plugins/nls.js';
import zh_hans from './vite-plugins/zh.json';

// 注意：必须作为第一个 import —— @vue/devtools-kit 在模块顶层初始化时访问 localStorage，
// 垫片需先于其求值（ESM 按 import 声明顺序求值）
import './vite-plugins/node-env.js';

const __dirname = import.meta.dirname;

// vite-plugin-vue-devtools 不能静态 import：vite 打包配置时会将裸模块依赖保留为顶层 import，
// 而 Node ESM 会先求值所有顶层 import 再执行模块体（垫片代码在模块体内），导致
// @vue/devtools-kit 在模块顶层访问 localStorage 时崩溃（dev 与 build 均受影响）。
// 改为在配置函数体内动态加载（此时垫片已生效），生产构建直接跳过。
let vueDevToolsPlugin: any = null;

export default defineConfig(async () => {
  // 生产构建/SSR 下跳过 devtools（其初始化会访问 localStorage，垫片已兜底，此处双保险）
  // eslint-disable-next-line n/prefer-global/process -- vite 配置在 Node 环境加载，process 为标准全局
  if (process.env.NODE_ENV !== 'production') {
    const mod = await import('vite-plugin-vue-devtools');
    vueDevToolsPlugin = mod.default;
  }
  return {
    base: '/',
    optimizeDeps: {
      esbuildOptions: {
        plugins: [
          // 开发环境下通过esbuild插件进行汉化
          esbuildPluginMonacoEditorNls({
            locale: Languages.zh_hans,
            localeData: zh_hans,
          }),
        ],
      },
    },
    plugins: [
      vueDevToolsPlugin ? vueDevToolsPlugin() : null,
      vue(),
      // 生产环境汉化
      nlsPlugin({
        locale: Languages.zh_hans,
        localeData: zh_hans,
      }),
      UnoCSS(),
      (monacoEditorPlugin as any).default({
        languageWorkers: ['editorWorkerService', 'json', 'typescript'],
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 9980,
    },
    // schema.worker.ts 依赖图含 base-ui 的 .vue 文件，Worker 构建需要 vue 插件（W16/W7 联调结论）
    worker: {
      format: 'es',
      plugins: () => [vue()],
    },
  };
});
