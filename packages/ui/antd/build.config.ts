import alias from '@rollup/plugin-alias';
import vue from '@vitejs/plugin-vue';
import postcss from 'rollup-plugin-postcss';
import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  clean: true,
  // 让 unbuild 处理类型生成
  declaration: true,
  entries: ['./src/index'],
  // 外部依赖 - 移除 @aigen-designer/manager，改用 aigen-designer
  externals: ['vue', 'ant-design-vue', 'aigen-designer'],
  // 确保 .vue 文件被正确处理
  failOnWarn: false,
  hooks: {
    'rollup:options': function (ctx, options) {
      if (!options.plugins) options.plugins = [];

      options.plugins.push(
        vue({
          include: [/\.vue$/],
          script: {
            // 脚本处理选项
            defineModel: true, // 支持 defineModel
          },
          // Vue 插件配置
          template: {
            compilerOptions: {
              // 模板编译选项
            },
          },
        }),
        postcss({
          extensions: ['.css', '.less'],
          inject: true,
          use: ['less'],
        }),
        alias({
          entries: [
            {
              find: '@aigen-designer/manager',
              replacement: 'aigen-designer',
            },
            {
              find: '@aigen-designer/types',
              replacement: 'aigen-designer',
            },
            {
              find: '@aigen-designer/utils',
              replacement: 'aigen-designer',
            },
            {
              find: '@aigen-designer/hooks',
              replacement: 'aigen-designer',
            },
          ],
        }),
      );
    },
  },
  rollup: {
    emitCJS: true,
    esbuild: {
      loaders: {
        '.ts': 'ts',
        '.vue': 'ts',
      },
      target: 'es2018',
    },
  },
});