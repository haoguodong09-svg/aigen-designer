// lint-staged 配置：仅对暂存文件执行 eslint（--fix）与 prettier 格式化
export default {
  // __test__ 目录已被 eslint 配置忽略，单独列出跳过，避免 eslint 对忽略文件报错
  '!**/__test__/**': [],
  '*.{js,jsx,ts,tsx,vue}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,less,css,scss,html,yml,yaml}': ['prettier --write'],
};
