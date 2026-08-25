import type { PluginOption } from 'vite';

import fs from 'node:fs';
import path from 'node:path';

import vue from '@vitejs/plugin-vue';
import rollupCopy from 'rollup-plugin-copy';
import nodeExternals from 'rollup-plugin-node-externals';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const __dirname = import.meta.dirname;

// 需要随产物一起打包的内部包（与下方 resolve.alias 一一对应）
const INTERNAL_ALIAS_PACKAGES = [
  '@aigen-designer/base-ui',
  '@aigen-designer/core',
  '@aigen-designer/hooks',
  '@aigen-designer/manager',
  '@aigen-designer/panel-ui',
  '@aigen-designer/types',
  '@aigen-designer/utils',
];

/**
 * 库模式 Worker URL 修正（vite 库模式已知局限）：
 * vite 库构建把 new URL('./schema.worker.ts', import.meta.url) 输出为根绝对路径
 * "/assets/schema.worker-<hash>.js"，消费方（examples/docs 二次构建）无法解析。
 * 构建完成后把 dist 内 schemaWorkerBridge 的 URL 重写为相对路径
 * "../../assets/schema.worker-<hash>.js"（相对 dist/manager/src 下的桥接文件），
 * 使包内 worker 产物可被消费方打包器正确解析。
 */
function fixWorkerUrlInDist(): PluginOption {
  return {
    apply: 'build',
    closeBundle() {
      fs.writeFileSync(
        path.resolve(__dirname, 'dist', '.worker-fix-ran.txt'),
        String(Date.now()),
      );
      const outDir = path.resolve(__dirname, 'dist');
      const assetsDir = path.join(outDir, 'assets');
      if (!fs.existsSync(assetsDir)) return;
      const workerFile = fs
        .readdirSync(assetsDir)
        .find((f) => f.startsWith('schema.worker-'));
      if (!workerFile) return;
      const relativeUrl = `../../assets/${workerFile}`;
      for (const rel of [
        'manager/src/schemaWorkerBridge.js',
        'manager/src/schemaWorkerBridge.cjs',
      ]) {
        const file = path.join(outDir, rel);
        if (!fs.existsSync(file)) continue;
        const code = fs.readFileSync(file, 'utf8');
        const fixed = code.replace(
          /new URL\(\s*(?:\/\*\s*@vite-ignore\s*\*\/\s*)?["']\/assets\/schema\.worker-[^"']+\.js["']/,
          `new URL("${relativeUrl}"`,
        );
        if (fixed !== code) fs.writeFileSync(file, fixed);
      }
    },
    name: 'aigen-designer:fix-worker-url',
  };
}

export default defineConfig({
  build: {
    commonjsOptions: {
      esmExternals: true,
    },
    lib: {
      entry: {
        index: path.resolve(__dirname, './index.ts'),
      },
      fileName: (ModuleFormat, entryName) => {
        const extension = ModuleFormat === 'es' ? 'js' : ModuleFormat;
        return `${entryName}.${extension}`;
      },
      formats: ['es', 'cjs'],
      // 指定组件编译入口文件
      name: 'aigen-designer',
    },
    outDir: 'dist',
    // 库编译模式配置
    rollupOptions: {
      // 外部化规则：除内部别名包与虚拟模块外，所有第三方裸导入（含 jsep 等传递依赖）一律外部化。
      // nodeExternals 只覆盖 package.json 中声明的依赖；传递依赖（如 jsep）此前未被外部化，
      // 被以机器绝对路径镜像进产物（dist/workspace/Github/...），导致产物在其他机器上无法解析。
      external: (id) => {
        // 虚拟模块（unocss 的 virtual:uno.css、插件注入的 \0 前缀模块）不能外部化
        if (id.startsWith('virtual:') || id.startsWith('\0')) return false;
        // 内部别名包（被上方 resolve.alias 解析到源码）保留打包
        if (
          INTERNAL_ALIAS_PACKAGES.some(
            (name) => id === name || id.startsWith(`${name}/`),
          )
        ) {
          return false;
        }
        // 其余裸导入（第三方依赖）一律外部化；相对路径与绝对路径不在此列
        return !id.startsWith('.') && !path.isAbsolute(id);
      },
      output: {
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: {
          vue: 'Vue',
        },
        // 保留模块的原始目录结构
        // 注意：产物中的 .vue2.js / .vue3.js 等文件是 rollup preserveModules 模式下
        // @vitejs/plugin-vue SFC 子模块（x.vue?vue&type=script&setup 等）命名冲突的产物：
        // 查询字符串被清理后与主模块同名，rollup 自动追加数字后缀（x.vue2、x.vue3……）。
        // 它们与主模块成对互相引用（一个是完整编译组件、一个是 re-export 桩），
        // 属于正常构建产物，不可删除，也不应从构建配置中“消除”。
        preserveModules: true,
        preserveModulesRoot: '../',
      },
      plugins: [
        rollupCopy({
          // 钩子，插件运行在rollup完成打包并将文件写入磁盘之前
          hook: 'writeBundle',
          targets: [
            // 将打包产物中的样式文件复制为 style.css（供外部按 aigen-designer/style.css 引用）
            {
              dest: './dist/',
              rename: 'style.css',
              src: './dist/aigen-designer.css',
            },
          ],
          verbose: true, // 在终端进行console.log
        }) as PluginOption,
      ],
    },
  },
  plugins: [
    vue(),
    UnoCSS() as PluginOption,
    fixWorkerUrlInDist(),
    dts({
      entryRoot: '../',
      exclude: ['../**/__test__/**', '../ui/**'],
      outDir: 'dist',
    }),
    nodeExternals(),
  ],
  resolve: {
    alias: {
      '@aigen-designer/base-ui': path.resolve(
        __dirname,
        '../ui-kit/base-ui/src/index',
      ),
      '@aigen-designer/core': path.resolve(__dirname, '../core/src/index'),
      '@aigen-designer/hooks': path.resolve(__dirname, '../hooks/src/index'),
      '@aigen-designer/manager': path.resolve(
        __dirname,
        '../manager/src/index',
      ),
      '@aigen-designer/panel-ui': path.resolve(
        __dirname,
        '../ui-kit/panel-ui/src/index',
      ),
      '@aigen-designer/types': path.resolve(__dirname, '../types/src/index'),
      // '@aigen-designer/ui': path.resolve(__dirname, '../ui/'),
      '@aigen-designer/utils': path.resolve(__dirname, '../utils/src/index'),
    },
  },
  // Worker 构建配置：schema.worker.ts 的依赖图经 utils barrel 传递引入 base-ui 的 .vue 文件，
  // 需要 vue 插件才能完成 Worker 打包（W16/W7 联调结论）
  worker: {
    format: 'es',
    plugins: () => [vue()],
  },
});
