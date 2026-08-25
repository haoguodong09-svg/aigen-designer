import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom', // 确保设置了 jsdom 作为测试环境
    // 显式声明测试文件范围，避免依赖默认的全局扫描（默认只排除 node_modules）
    include: ['packages/**/src/**/*.test.ts'],
  },
});
