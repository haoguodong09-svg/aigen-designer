# AigenDesigner 优化修复开发文档（并行作业版）

> 生成日期：2026-06 · 更新：2026-08（合并 docs/performance-optimization.md 性能优化工作包，新增 W15/W16）
> 依据：4 个分析 agent 深度审查 + 主线程实测验证（vitest / vue-tsc / vite build / docs build / dev server / dist 产物审计 / git 卫生）
> 项目现状评分：**6.0 / 10**。构建链路已断（examples dev+build 崩溃、docs 构建失败）、发布产物含机器绝对路径、依赖方向混乱、多实例不可靠、三套 UI 大量复制。
> **本版已合并**：docs/performance-optimization.md（性能专项 W1–W9）全部并入对应修复工作包，或升级为新工作包（W15 Builder 性能 / W16 Schema Worker 基础设施），合并映射见「附 D」。

---

## 〇、文档使用说明（如何并行修复）

本文档将全部问题拆分为 **16 个工作包（W1–W16）**，每个工作包满足：

1. **文件零冲突**：各工作包独占一组文件（见「涉及文件」），并行 agent 可同时开工互不干扰；
2. **验收可自动化**：每个工作包附验收命令与预期结果；
3. **依赖已解耦**：批次 1 全部可并行；批次 2 仅在批次 1 的产物基础上做跨包回归。

**并行策略**

| 批次 | 工作包 | 说明 |
|---|---|---|
| 批次 1（并行启动 16 个 agent） | W1–W14 + W15（Builder 性能）+ W16（Worker 基础设施） | 文件零冲突，全部可同时进行；W15/W16 为新增性能工作包 |
| 批次 2（依赖批次 1 产物） | W8/W9/W10 手测、W14 docs 构建回归、W2 发布演练、W6/W15 的 Worker 集成联调（依赖 W16） | 需要 examples/dev 恢复与 dist 修复完成 |
| 批次 3（全局收尾） | TS strict 开启、any 收敛、changesets、发布演练、三套 UI 抽共享层 | 建议在批次 1 代码稳定后单独进行 |

**给 agent 的提示**：每个工作包内含「问题清单（含文件:行号）→ 修复方案 → 验收标准」，agent 按此执行；修改代码后必须运行本工作包的验收命令；不要修改涉及文件清单之外的文件。

---

## W1. examples 应用恢复（dev + build 崩溃）— 最高优先

**严重度**：P0（阻断开发与发布，根 package.json 的 build 第一步即失败）

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 1.1 | `VueDevTools()` 插件在 Node 环境加载配置时，`@vue/devtools-kit` 访问 `localStorage` 抛 `TypeError: localStorage.getItem is not a function`，**dev 与 build 均崩溃** | `examples/vite.config.ts:7` | 实测 |
| 1.2 | 根 `build` 脚本第一步 `turbo run build -F aigen-examples` 必失败 → 整个仓库 `pnpm build` 失败 | `package.json:6` | 实测 |

### 修复方案

1. 将 `vite-plugin-vue-devtools` 从 7.6.8 升级到与 vite 6.4.1 兼容的最新版（如 7.7.x），或在配置加载阶段保护：
```ts
// examples/vite.config.ts
plugins: [
  // 生产构建/SSR 下跳过 devtools（其初始化会访问 localStorage）
  process.env.NODE_ENV === 'production' ? null : VueDevTools(),
  ...
].filter(Boolean)
```
2. 验证 dev 启动：`pnpm --filter aigen-examples exec vite --port 9980`（应出现 Local 地址）；
3. 验证 build：`pnpm --filter aigen-examples exec vite build`（应成功产出 dist）。

### 验收标准

- `pnpm --filter aigen-examples exec vite build` 退出码 0；
- dev server 能启动并返回页面（可启动后 kill）。

### 涉及文件

- `examples/vite.config.ts`（唯一必改）
- `examples/package.json`（仅当需要升级 devtools 版本）
- 根 `package.json` 不动（W13 处理 scripts）

---

## W2. 主包构建产物修复（绝对路径 + 冗余产物 + 发布元数据）

**严重度**：P0（发布后其他机器无法解析）

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 2.1 | **54 处机器绝对路径**：dist 中出现 `dist/workspace/Github/epic-designer/node_modules/.pnpm/jsep@1.4.0/...`，jsep 未被外部化却以绝对路径镜像打进产物 | `packages/aigen-designer/vite.config.ts:41`（preserveModulesRoot）、`:69`（nodeExternals） | 实测 |
| 2.2 | **88 个 `.vue2.*` 冗余 re-export 文件**混入 dist | `dist/**/*.vue2.{js,cjs}` | 实测 |
| 2.3 | `rollupCopy` 目标 `../core/theme` 指向**不存在的目录**（dist 中无 theme） | `packages/aigen-designer/vite.config.ts:44-50` | 实测 |
| 2.4 | 发布元数据矛盾：`main`/`module` 均指向 ESM `dist/index.js`，无 `exports`、无 `files`；`typings` 指向 `dist/aigen-designer/index.d.ts`（与 dts entryRoot 产物结构需核对） | `packages/aigen-designer/package.json:44-49` | 工程化 agent |
| 2.5 | `uno.config.ts` 被构建排除但 examples 在导入它 | `packages/aigen-designer/uno.config.ts`、`examples/uno.config.ts:2` | 工程化 agent |

### 修复方案

1. 将 jsep（及所有被 alias 引用的内部包之外的第三方依赖）加入外部化：改用 `nodeExternals({ deps: true, devDeps: false, optDeps: false })` 或显式 `rollupOptions.external: ['jsep', ...]`；
2. 排查 `.vue2.*` 产物的生成源（疑似 vue 插件配置或 preserveModules 边界问题），从构建配置层面消除；
3. 删除 rollupCopy 中对不存在目录的 copy target，或确认 core/theme 是否应存在（若需要则创建）；
4. 补齐 `exports`/`files` 字段，main/module/types 与 dist 实际结构对齐；确认 `uno.config.ts` 是否应发布（examples 依赖它，建议发布或改为内联配置）。

### 验收标准

- `pnpm --filter aigen-designer exec vite build` 成功；
- `Get-ChildItem dist -Recurse -Filter *.js | Select-String "workspace/Github"` 输出为空（无绝对路径）；
- `npm pack --dry-run` 产物中无 `dist/workspace` 目录、无 `.vue2.*` 文件。

### 涉及文件

- `packages/aigen-designer/vite.config.ts`
- `packages/aigen-designer/package.json`
- `packages/core/theme/`（如需创建）
- `packages/aigen-designer/uno.config.ts`（如需调整）

---

## W3. utils 工具函数正确性与安全修复

**严重度**：P0（含 1 个安全漏洞 + 5 个实跑确认的正确性缺陷）

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 3.1 | **原型污染（安全漏洞）**：`setValueByPath({}, '__proto__.polluted', true)` 污染 Object.prototype；同仓库 diff.ts 有 DANGEROUS_KEYS 防护，此处没有 | `utils/src/common/data.ts:512-545` | utils agent（实跑确认） |
| 3.2 | **deepEqual 混合类型误判**：`new Date(0) vs {}`、`new Map() vs {}` 均返回 true（无类型标签校验） | `utils/src/common/data.ts:270-384` | utils agent（实跑确认） |
| 3.3 | **deepClone SSR 崩溃**：`typeof window.structuredClone` 在无 window 环境抛 ReferenceError；手动回退路径把 Date/Map/Set 静默变 `{}` | `utils/src/common/data.ts:32, 53-62` | utils agent（实跑确认） |
| 3.4 | **getFormSchemas formName 优先级错误**：`props?.name ?? (name === formName)` 运算符优先级错误，formName 形同虚设 | `utils/src/common/data.ts:573-576` | utils agent（实跑确认） |
| 3.5 | **findSchemaInfoById 未找到返回垃圾数据**：叶子带 `children: []` 时不抛错，返回 `{schema: undefined}`，导致粘贴/删除静默失败 | `utils/src/common/data.ts:708-764` | utils agent（复刻确认） |
| 3.6 | **deepCompareAndModify 无循环引用保护**（栈溢出）+ Date/类实例永不更新（Object.entries(Date) 为空） | `utils/src/common/data.ts:209-261` | utils agent（实跑确认） |
| 3.7 | getValueByPath 不支持 `a[0]` 语法而 set 支持（同一 field get/set 不一致） | `data.ts:486 vs 519-522` | utils agent（实跑确认） |
| 3.8 | getUUID 数值分支边界：randomLength=1 恒返回 1..9 | `utils/src/common/string.ts:22-23` | utils agent |
| 3.9 | **vue-tsc 13 个类型错误**（实测）：测试文件 9 处 + formulaEngine 2 处 + diff.ts 2 处 | `__test__/deepClone.test.ts`、`__test__/setValueByPath.test.ts`、`formula/formulaEngine.ts:147-148`、`common/diff.ts:141-142` | 实测 |
| 3.10 | **mapSchemas.test.ts 造假**：import 的是 findSchemas，mapSchemas 零覆盖 | `utils/src/__test__/common/mapSchemas.test.ts:3` | utils agent |
| 3.11 | convertKFormData/recursionConvertedNode 输入变异（rules.shift()、key 改写） | `data.ts:772, 857, 898, 945-946` | utils agent |
| 3.12 | debounce 计时器类型强转 `as unknown as number` | `utils/src/common/common.ts:11, 19` | utils agent |
| 3.13 | **（性能·合并自性能文档 P-W6）FormulaEngine 无 AST 缓存**：每次 `calculate()` 都重新 `jsep(expression)` 解析，相同表达式重复解析浪费明显 | `utils/src/formula/formulaEngine.ts:59` | 性能文档 W6 |
| 3.14 | **（结论·合并自性能文档 P-W9）diffArrays Keyed 匹配**：前缀/后缀优化已覆盖大部分重排场景，中间区域 add+remove 虽非 move 紧凑但 applyPatch 处理正确，**结论：无需修改，保留当前实现** | `utils/src/common/diff.ts:216-218` | 性能文档 W9 |

### 修复方案

1. 新增 `DANGEROUS_KEYS` 拦截（照抄 diff.ts:15 实现），统一 get/set 路径解析（抽共享 parsePath）；
2. deepEqual 增加类型标签检查（Object.prototype.toString 标签不一致直接 false）；
3. deepClone 的 window 访问改 `typeof window !== 'undefined' && typeof structuredClone === 'function'`（用 globalThis），手动路径补 Date/Map/Set/RegExp 分支；
4. 修 getFormSchemas 条件为 `(currentNode.props?.name ?? currentNode.name) === formName`；
5. 重写 findSchemaInfoById（显式父查找 + 统一抛错）；
6. deepCompareAndModify 增加 visited 环检测 + Date/RegExp/Map/Set 特判；
7. 修复 vue-tsc 13 处类型错误（测试文件断言参数类型、diff.ts unknown 转 object、formulaEngine 可选链）；
8. 重写 mapSchemas.test.ts（真正测 mapSchemas）；补充 deepEqual（Date/Map/Set/混合类型）、deepClone（手动路径/函数/Proxy）、deepCompareAndModify（Date/环）、setValueByPath（原型污染）边界测试。
9. **（性能合并）FormulaEngine AST 缓存**：`FormulaEngine` 增加静态 `astCache = new Map<string, jsep.Expression>()`，`calculate()` 先查缓存再 `jsep()`，仅解析一次（注意与 W16 Worker 无关，纯主线程缓存）；验收：相同表达式第二次调用不再触发 jsep 解析。
10. **（性能合并）diffArrays 结论**：按性能文档 W9 结论保留现有实现，无需修改，在代码注释中记录该决策。

### 验收标准

- `pnpm vitest run packages/utils` 全部通过（原 132 测试不回归 + 新增边界用例）；
- `npx vue-tsc --noEmit -p packages/aigen-designer/tsconfig.json` 中 utils 相关错误清零；
- 新增原型污染回归用例（`setValueByPath({}, '__proto__.x', 1)` 必须抛错或拒绝）。
- （性能合并）AST 缓存：相同表达式两次 `calculate()`，第二次无 jsep 解析调用（可在缓存处断点或统计验证）；现有 formulaEngine 测试全部通过。

### 涉及文件

- `packages/utils/src/common/data.ts`
- `packages/utils/src/common/string.ts`
- `packages/utils/src/common/common.ts`
- `packages/utils/src/common/diff.ts`（仅类型修复，逻辑不动）
- `packages/utils/src/formula/formulaEngine.ts`（仅类型修复）
- `packages/utils/src/__test__/common/*`（全部测试文件）

---

## W4. hooks 修复（钩子链、缩放、事件总线、面板响应式）

**严重度**：P0（钩子链短路为核心执行器缺陷）

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 4.1 | **钩子链短路**：execute 内 `return await hook(context)` 导致只执行第一个钩子 | `hooks/src/plugin/useHookManager.ts:74-80` | utils agent（实跑确认） |
| 4.2 | **缩放上限笔误**：`newScale > 150` 应为 1.5，画布可放大到 15000% | `hooks/src/common/element.ts:124` | 核心 agent + utils agent |
| 4.3 | **createEventBus 清理逻辑失效**：`scopedBus.listeners` 恒为 undefined → 任意组件卸载 clear() 整个通道；onRoot 分支清错通道 | `hooks/src/common/createEventBus.ts:122-131, 144-151` | utils agent |
| 4.4 | **usePanel shallowRef 原地 push 不触发响应式**：运行时注册的活动栏不刷新 | `hooks/src/plugin/usePanel.ts:18-19, 78, 109` | utils agent |
| 4.5 | **useTimedQuery 无卸载清理**：setInterval 卸载后继续跑 | `hooks/src/common/element.ts:149-170` | utils agent |
| 4.6 | useKeyPress 全局 Control 键 preventDefault 不检查 e.target，干扰编辑器内快捷键 | `hooks/src/common/element.ts:39-42` | utils agent |
| 4.7 | 命名错误：useBuiderDisabled/useBuiderReadonly（Builder→Buider 拼写）+ 重复实现可抽象 | `hooks/src/designer/useBuiderDisabled.ts`、`useBuiderReadonly.ts` | utils agent |
| 4.8 | useTableMeta 首行赋值是死代码 | `hooks/src/designer/useTableMeta.ts:12-28` | utils agent |
| 4.9 | useClipboard.cut 与 useDesigner.handleDelete 逻辑重复 | `hooks/src/common/clipboard.ts:42-75` | utils agent |
| 4.10 | useComponentManager.registerComponent 原地改写调用方 config，重复注册累积重复动作 | `hooks/src/plugin/useComponentManager.ts:278-280, 376-378` | 核心 agent |
| 4.11 | **（性能·合并自性能文档 P-W4）组件注册 25+ 次全量重算分组**：`registerComponent` 每次调用无条件触发 `computedComponentSchemaGroups()`；`hideComponent`/`showComponent`/`setHideComponents`/`setSortedGroups` 同样全量重算；`pluginManager` Proxy 每次属性访问过 get trap | `useComponentManager.ts:116-189, 355, 263, 386, 395, 84`；`pluginManager.ts:211-236` | 性能文档 W4 |
| 4.12 | **（性能·合并自性能文档 P-W7）响应式深代理开销**：`pageSchema` 被 `reactive()` 深度代理（数千 Proxy 对象）；`mountMonitor` 用 `ref<string[]>` + filter 做 pop 为 O(n)；`watchEffect` 追踪整个 pageSchema.script 导致任何 schema 变化都触发脚本重编译 | `hooks/src/plugin/usePageSchema.ts:49`；`hooks/src/plugin/useMountMonitor.ts:5-29`（pageManager.ts 部分归 W6.9） | 性能文档 W7 |

### 修复方案

1. useHookManager.execute：去掉 try 内 return，改为 `await hook(context)` 后 continue（保持第一个错误可中断或全部执行的语义，与注释一致）；
2. element.ts 缩放上限改 `> 1.5`，与 editScreenContainer.vue 的 0.5~1.4 统一为单一常量；
3. createEventBus：listeners/eventCache 挂到 channel 对象上，onRoot 清理改清 root 通道；
4. usePanel 改 `ref([])` 深响应或整体赋值 `.value = [...newArr]`；
5. useTimedQuery 补 onUnmounted 清理；
6. registerComponent 加幂等（同 type 先 remove 再注册）、removeComponent 清理 priorities 并重算分组。
7. **（性能合并·P-W4）注册批量化**：dirty-flag + microtask flush——mutator 只置 `_dirty = true` 并 `scheduleFlush()`（`Promise.resolve().then` 内统一重算一次），启动时 `computedComponentSchemaGroups` 从 25+ 次降至 1 次；验收：`setupAntd + setupPanel` 耗时减少 20-50ms。
8. **（性能合并·P-W7 hooks 部分）**：a) `usePageSchema` 的 `pageSchema` 改 `shallowRef` + `setPageSchema` 内 `triggerRef`；b) `useMountMonitor` 的数组改 `ref(new Set<string>())`，push/pop 为 O(1)；c) `pageManager.ts:417-422` 的 `watchEffect` 改 targeted `watch(() => pageSchema.script)`（此文件在 W6 范围，本包实现时与 W6.9 协调，避免双改同一文件——**建议此子项归 W6 执行，本包只做 usePageSchema/useMountMonitor**）。

### 验收标准

- 新增/修改单测：hook 链多钩子全部执行、eventBus 单通道卸载不清他人、usePanel 运行时注册刷新；
- `pnpm vitest run` 全绿。

### 涉及文件

- `packages/hooks/src/plugin/useHookManager.ts`
- `packages/hooks/src/common/element.ts`
- `packages/hooks/src/common/createEventBus.ts`
- `packages/hooks/src/plugin/usePanel.ts`
- `packages/hooks/src/plugin/useComponentManager.ts`
- `packages/hooks/src/designer/*`（命名修正与死代码，注意与 W5 无交集——useDesignerContext.ts 在 core，不在此）
- `packages/hooks/src/plugin/usePageSchema.ts`（性能合并·P-W7：shallowRef 化）
- `packages/hooks/src/plugin/useMountMonitor.ts`（性能合并·P-W7：Set 化）

---

## W5. core 设计器模块修复

**严重度**：P0（撤销缺失 + 监听器泄漏）

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 5.1 | **组件库拖入不可撤销**：handleDragAdd 注释声称"直接记录"但未调 revoke.push；@add/@end 标志位残留导致误记空记录 | `core/.../editContainer/nodes.vue:82-85, 118-125` | 核心 agent |
| 5.2 | **选中高亮监听器泄漏**：每次选中 addEventListener 从不移除、MutationObserver 不 disconnect、无 onUnmounted | `core/.../editContainer/previewWidgets.vue:111-121, 343-346` | 核心 agent |
| 5.3 | **工具栏导入数据不记录历史**（与 designer.setData 的 push 行为不一致） | `core/.../editContainer/toolbar.vue:231-261` | 核心 agent |
| 5.4 | **canvasConfigs 共享引用**：selectedKey setter 把模块级常量直接赋给 pageSchema.canvas，多实例互相污染 | `toolbar.vue:94-112, 134-143`；`useDesigner.ts:66-76` 重复定义一份 | 核心 agent |
| 5.5 | **热键 50ms 防抖吞键** + 无 e.repeat 守卫（长按 Delete 连删） | `core/.../useHotkeys.ts:52-59, 70-75` | 核心 agent |
| 5.6 | **Ctrl+S 传原始响应式 pageSchema**（按钮路径传 deepClone，热键不传） | `useHotkeys.ts:106-109` vs `designer.vue:149-157` | 核心 agent |
| 5.7 | **activityBar 空列表崩溃**：`activityBars.value[0].component` 无空值保护（rightSidebar 有 ?.） | `core/.../activityBar/index.vue:23` | 核心 agent |
| 5.8 | **innerDefaultSchema 模块级可变状态**：watchEffect 跨实例改写，formMode 与普通模式实例互相踩数据 | `core/.../useDesigner.ts:26-46, 85` | 核心 agent |
| 5.9 | previewJson `setTimeout(handleOpen, 300)` 无重试上限，编辑器加载失败无限循环 | `previewJson.vue:41-43` | 核心 agent |
| 5.10 | 预览把设计器响应式 pageSchema 直接传给 builder → 编辑即触发预览全量重建 | `core/.../preview/index.vue:119` | 核心 agent |

### 修复方案

1. nodes.vue：handleDragAdd 内补 `revoke.push('插入组件', true)` 并重置 isDragChange；确认 SortableJS end 事件在 clone 组下的触发行为，保证标志位正确；
2. previewWidgets：onUnmounted 统一 removeEventListener + observer.disconnect；setTimeout 记录句柄并在卸载清除；
3. toolbar：handleImportData 复用 designer.setData 的历史记录路径（revoke.push('导入数据')）；canvasConfigs 每次展开新对象（`{ ...canvasConfigs[type] }`）或移入实例作用域；
4. useHotkeys：去掉 50ms 防抖改 e.repeat 守卫；Ctrl+S 与按钮统一 deepClone 后 emit；
5. activityBar 补空值保护（`activityBars.value[0]?.component`）；
6. innerDefaultSchema 移入 useDesigner 实例作用域（props.defaultSchema 兜底逻辑改为函数生成）；
7. preview 传入 builder 前 `deepClone(pageSchema)`（注意与 W6 的 revoke 性能优化协同，避免双重深拷贝）。

### 验收标准

- 手工用例（examples dev 恢复后）：侧边栏拖入组件 → Ctrl+Z 可撤销；连续切换选中节点 10 次 → 无监听器堆积（Performance/调试断点）；导入 JSON 后 undo 可回退导入；长按 Delete 只删一次；
- `pnpm vitest run` 全绿。

### 涉及文件

- `packages/core/src/components/designer/src/modules/editContainer/nodes.vue`
- `packages/core/src/components/designer/src/modules/editContainer/previewWidgets.vue`
- `packages/core/src/components/designer/src/modules/editContainer/toolbar.vue`
- `packages/core/src/components/designer/src/modules/activityBar/index.vue`
- `packages/core/src/components/designer/src/modules/preview/index.vue`
- `packages/core/src/components/designer/src/modules/editContainer/previewJson.vue`
- `packages/core/src/components/designer/hooks/useDesigner.ts`
- `packages/core/src/components/designer/hooks/useHotkeys.ts`

---

## W6. manager 修复（pageManager / revoke / pluginManager）

**严重度**：P0（撤销链健壮性 + 动作链中断）

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 6.1 | **doActions JSON.parse 无异常保护**：单个动作 args 非法 JSON 抛错中断整条动作链 | `manager/src/pageManager.ts:257` | 核心 agent |
| 6.2 | **revoke 防抖竞态产生幽灵空记录**：push 后 100ms 内 undo，防抖回调基于已撤销状态提交 `diff: []` 空记录 | `manager/src/revoke.ts:192-221` | 核心 agent（revokeRace.test.ts 演示） |
| 6.3 | **revoke JSON.stringify 在 push 之后执行**：ops 含循环引用时抛错，链已 push 而状态未更新 → 链损坏 | `manager/src/revoke.ts:158, 266` | 核心 agent |
| 6.4 | **debounceCommit 无 dispose/onUnmounted**：设计器卸载后定时器仍对已卸载 pageSchema 执行 | `manager/src/revoke.ts:192` | 核心 agent |
| 6.5 | **undo/redo 每次全链回放 + 全量深比较 + 全量深克隆**（500 节点页面每次撤销 ≈ 3 次全量遍历） | `revoke.ts:94-119, 175, 306, 339` | 核心 agent |
| 6.6 | **pluginManager 模块级单例**：所有组件注册与 designer.initialized 全局共享，同页两个设计器互相干扰 | `manager/src/pluginManager.ts:258` | 核心 agent |
| 6.7 | **new Function 编译用户脚本**（CSP 风险）+ isDesignMode 切换全量重建函数 | `manager/src/pageManager.ts:184-224` | 核心 agent |
| 6.8 | `useDesignerContext.ts:1` 深路径导入 `@aigen-designer/manager/src/revoke` 破坏包边界（修复点在 core，本包配合导出类型） | `hooks/src/designer/useDesignerContext.ts:1`（跨包） | 核心 agent |
| 6.9 | **（性能·合并自性能文档 P-W3）History 系统主线程阻塞**：`commitCurrentState` 中 `createPatch` 递归 diff（3-15ms）+ `JSON.stringify` 全量序列化（1-8ms）+ `cloneCurrentState` 内 deepClone→deepToRaw 双重遍历（1-3ms）；`materializeState` 最多 60 次 JSON.parse+applyPatch 顺序执行（5-30ms）；`importHistory` 120+ 次顺序 JSON.parse 校验（120-360ms） | `revoke.ts:106-110, 131-134, 155-158, 264, 427-438` | 性能文档 W3 |
| 6.10 | **（性能·合并自性能文档 P-W4 部分）pluginManager Proxy get trap 开销** | `manager/src/pluginManager.ts:211-236` | 性能文档 W4 |
| 6.11 | **（性能·合并自性能文档 P-W7 部分）forms 被 reactive() 深度代理**；watchEffect 追踪整个 pageSchema.script（见 W4.12，文件归属本包） | `manager/src/pageManager.ts:38, 417-422` | 性能文档 W7 |

### 修复方案

1. JSON.parse 包 try/catch，坏 action 跳过并 console.warn（不中断链）；
2. 防抖提交前校验当前链状态：若链已被 undo/redo 改变则放弃本次提交（对齐 revokeRace 语义）；空 diff 跳过入链；
3. JSON.stringify 移到 push 之前（先序列化成功再入链）；
4. useRevoke 返回 dispose，设计器 onUnmounted 调用；
5. 性能：materializeState 改为增量回放（缓存每条记录回放后的状态），deepCompareAndModify 增加相等短路（与 W3 协同）；
6. pluginManager 支持实例化（createPluginManager() 已存在，确认 designer 使用实例而非全局单例的可行性——大改动，可与 W5 协调分期：先文档化单例限制，后做隔离）；
7. setMethods 的 new Function 增加输入校验/白名单或文档化 CSP 要求。
8. **（性能合并·P-W3）revoke 主线程卸载**：a) `cloneCurrentState` 消除冗余 deepToRaw（`alreadyRaw` 参数直接深克隆）；b) `commitCurrentState` 的 diff 计算与序列化移入 W16 Worker（`postToWorker('computeDiff', ...)`），主线程仅做响应式合并——**Worker 部分依赖 W16，可在 W16 完成后以批次 2 联调**；c) `materializeState` 全链回放移入 Worker（`postToWorker('materialize', ...)`）；d) `importHistory` 校验移入 Worker。注意：`push()` 200ms debounce 与 async Worker 存在竞态，需在响应回调中校验是否仍为最新编辑；`deepCompareAndModify` 必须留主线程。验收：commit 主线程耗时 6-31ms→<3ms、materialize 11-58ms→<5ms。
9. **（性能合并·P-W4 部分）pluginManager Proxy 绕过**：为高频热路径（component.get / getConfigByType）暴露直接函数引用 `_component` 供内部模块导入（可选，收益中等）。
10. **（性能合并·P-W7 部分）pageManager 响应式收窄**：a) `forms` 容器改 `shallowRef`（内部数据仍 reactive）；b) `watchEffect(pageSchema.script)` 改 targeted `watch(() => pageSchema.script)`，仅在 script 字段变化时重编译。

### 验收标准

- `pnpm vitest run packages/manager` 全绿（revoke 系列 31 用例 + 新增：坏 JSON action、防抖后 undo 无空记录、卸载后无提交）；
- 手工用例：配置一个 args 为非法 JSON 的动作，动作链其余动作仍执行。
- （性能合并）100 节点页面：编辑时主线程 commit 耗时 < 3ms、undo/redo < 5ms（Performance tab 测量）；importHistory 校验不阻塞 UI。

### 涉及文件

- `packages/manager/src/pageManager.ts`
- `packages/manager/src/revoke.ts`
- `packages/manager/src/pluginManager.ts`
- `packages/manager/src/__test__/manager/*`（新增测试）
- ⚠️ Worker 化部分依赖 W16 新建的 `packages/manager/src/schemaWorkerBridge.ts`（本包不新建该文件，仅 import 使用）

---

## W7. ui-kit 修复（设计器自身 UI + 跨 UI 适配层）

**严重度**：P1（element-plus 模式下多个编辑器失效）

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 7.1 | **硬编码 10 处 `v-model:value`**：element-plus 模式下搜索框、AigenField、尺寸/列/选项/页签编辑器全部失效（EP 用 modelValue） | `tree.vue:93`、`AigenField:9`、`AigenInputSize:64/72`、`AigenColEditor:97/120`、`optionItem:76/80`、`AigenTabPaneEditor:71`、`componentView:68` | UI agent |
| 7.2 | **tooltip click 触发永远打不开** + fixed 定位叠加 scroll 偏移 | `base-ui/src/tooltip/tooltip.vue` | UI agent |
| 7.3 | **MonacoEditor JSON 非法输入抛异常**（无错误边界） | `panel-ui/src/components/MonacoEditor/index.vue` | UI agent |
| 7.4 | **AigenColEditor gorup 拼写错误** + collapse 折叠项编辑器误用 AigenColEditor 添加 col 子节点并硬编码子 id | `AigenColEditor/index.vue`、`base-ui/src/collapse/collapsePanel.vue` | UI agent |
| 7.5 | **样式污染**：ui-kit 硬编码 `el-collapse` 类 | `panel-ui/src/rightSidebars/index.less:36` | UI agent |
| 7.6 | AigenIcon 图标类名/iconfont 前缀一致性（aigen 前缀已迁移，抽查遗漏） | `base-ui/src/icon/*` | 工程化 agent |
| 7.7 | node.vue 中 getValueByPath/setValueByPath 混用（依赖 W3.7 修复后统一） | `base-ui/src/node/node.vue:120, 457` 等 | utils agent |
| 7.8 | **（性能·合并自性能文档 P-W1）node.vue 深层 Watch O(n²×m)**：a) `watch(..., { deep: true })` 任意子节点变化时 N 个 AigenNode 实例同时触发 deepEqual+deepClone+deepCompareAndModify（10-50ms）；b) `innerSchema` 的 `JSON.stringify` 序列化检测（O(n×m)）；c) watchEffect 订阅 fieldStateMap 级联执行 condition；d) 每个实例化时 deepClone 一次 | `base-ui/src/node/node.vue:88-90, 101-114, 159-177, 473-488` | 性能文档 W1 |
| 7.9 | **（性能·合并自性能文档 P-W8）组件搜索无 debounce**：keyword 直接绑定 Input，每次按键递归过滤整棵树 | `base-ui/src/tree/tree.vue:30`；`panel-ui/src/activitybars/componentView/index.vue:18` | 性能文档 W8 |

### 修复方案

1. **v-model 适配**：建立统一 v-model 属性解析（从组件 config 读取 bindModel 或按 UI 上下文映射），禁止硬编码 `v-model:value`；优先级：读组件注册的 bindModel 声明；
2. tooltip：修复 click 触发的 visible 状态机（hasClicked 与 trigger 交互），fixed 定位改为跟随元素计算或叠加滚动监听；
3. MonacoEditor：JSON.parse 包 try/catch，非法输入显示错误态而非抛异常；
4. 修正 gorup 拼写；collapse 折叠项编辑器注册正确子组件类型；
5. 删除 el-collapse 硬编码，改 scoped 样式 + 通用类名。
6. **（性能合并·P-W1）node.vue watch 收窄**：a) `deep: true` 改为 targeted watch（`() => [props.componentSchema.type, props.componentSchema.props, ...]` 列表），children 变化由递归模板自然处理；b) 用父组件版本计数器 `schemaVersion` 替代 innerSchema 的 JSON.stringify 检测；c) watchEffect 改按 `innerSchema?.field` 字段 watch；d) 不可变字段（type/icon）`markRaw`。验收：属性面板修改单个字段时 Performance tab 中 deepEqual 调用次数从 N 次降至 1 次，100 节点表单帧耗时 < 16ms。
7. **（性能合并·P-W8）搜索 debounce**：keyword 经 `debounce(150ms)` 后进入过滤计算（`debounce` 从 `@aigen-designer/utils` 导入，注意该工具在 W3 范围内——**只 import 不修改**）。

### 验收标准

- examples dev 恢复后，**element-plus 模式**：搜索框可输入、AigenField 可编辑、尺寸/列/选项/页签编辑器可操作（与 antd 模式行为一致）；
- tooltip click 触发可打开/关闭；
- MonacoEditor 输入非法 JSON 显示错误不崩溃。
- （性能合并）100 节点表单属性编辑帧耗时 < 16ms；搜索输入停止后 150ms 内完成过滤。

### 涉及文件

- `packages/ui-kit/base-ui/src/**`（tooltip、tree、collapse、node、icon、asyncLoader）
- `packages/ui-kit/panel-ui/src/**`（MonacoEditor、AigenField、AigenInputSize、AigenColEditor、AigenOptionsEditor、AigenTabPaneEditor、rightSidebars、activitybars）

---

## W8. antd 适配修复

**严重度**：P1

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 8.1 | **date-picker**：渲染函数不展开 attrs、`'"yearrange"'` 带引号永不匹配（实测确认）、日期值格式三套不兼容 | `ui/antd/src/date-picker/index.ts` | UI agent + 实测 |
| 8.2 | modal 标题属性编辑失效（title vs label 字段不匹配） | `ui/antd/src/modal/index.ts` | UI agent |
| 8.3 | **样式污染**：setup 时 `document.head.append(style)` 全局注入 | `ui/antd/src/index.ts:50-60` | UI agent |
| 8.4 | EP switch 复制了 antd 的 unCheckedValue 错误属性名（antd 侧核对） | `ui/antd/src/switch/index.ts` | UI agent |
| 8.5 | 3 处 type-only 值导入（类型当值用） | `ui/antd/src/**` | UI agent |

### 修复方案

1. date-picker：`onChange` 的 `'"yearrange"'` 改为 `'yearrange'`；渲染函数展开 `...attrs`；统一日期值格式为字符串（`valueFormat`）；
2. modal：config 中 title 字段与组件 props 对齐；
3. 样式改为 scoped/按需注入（组件内联样式或按类名 scoped），移除 document.head 全局 append；
4. 核对 switch 的 checkedValue/unCheckedValue 属性名与 antd v4 对齐。

### 验收标准

- antd 模式手测：日期选择（含 yearrange）、弹窗标题编辑、switch 开关正常；
- 页面无全局样式泄漏（宿主页面 button 样式未被覆盖）。

### 涉及文件

- `packages/ui/antd/src/date-picker/**`
- `packages/ui/antd/src/modal/**`
- `packages/ui/antd/src/switch/**`
- `packages/ui/antd/src/index.ts`
- `packages/ui/antd/src/index.less`

---

## W9. elementPlus 适配修复

**严重度**：P1

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 9.1 | switch 复制了 antd 的 unCheckedValue 错误属性名（EP 应为 active-value/inactive-value 语义或按 EP 文档核对） | `ui/elementPlus/src/switch/index.ts` | UI agent |
| 9.2 | date-picker 值格式与 antd/naive 不兼容 | `ui/elementPlus/src/date-picker/index.ts` | UI agent |
| 9.3 | 缺 time-picker（antd 有） | `ui/elementPlus/src/` | UI agent |
| 9.4 | 组件数量与配置一致性核对（EP 24 个 vs antd 23+3 raw） | 全目录 | UI agent |

### 修复方案

1. 核对 EP switch 的 `active-value`/`inactive-value` 属性名并修正 config；
2. 统一 date-picker 值格式（字符串），与 antd 对齐；
3. （可选）补充 time-picker 适配，保持三套组件覆盖一致。

### 验收标准

- EP 模式手测：switch/date-picker 正常，值格式与 antd 一致；
- 与 antd/naive 的组件清单 diff 记录在案。

### 涉及文件

- `packages/ui/elementPlus/src/switch/**`
- `packages/ui/elementPlus/src/date-picker/**`
- `packages/ui/elementPlus/src/index.ts`（如需注册 time-picker）

---

## W10. naiveUi 适配修复

**严重度**：P1

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 10.1 | form 无 labelLayout 处理，resetData 语义与其他 UI 不同 | `ui/naiveUi/src/form/index.ts`、`form/form.vue` | UI agent |
| 10.2 | **样式污染**：index.less 全局 `n-collapse` 选择器 | `ui/naiveUi/src/index.less` | UI agent |
| 10.3 | textarea 默认文案为"请选择"（应为"请输入"） | `ui/naiveUi/src/textarea/index.ts` | UI agent |
| 10.4 | 缺 time-picker | `ui/naiveUi/src/` | UI agent |
| 10.5 | date-picker 值格式一致性 | `ui/naiveUi/src/date-picker/index.ts` | UI agent |

### 修复方案

1. form 组件支持 labelLayout（与 antd 的 fixed/flex 语义对齐），resetData 语义对齐；
2. index.less 的 n-collapse 选择器加 scoped 前缀（`.aigen-designer-main .n-collapse`）；
3. textarea 默认占位文案修正；
4. 统一 date-picker 值格式。

### 验收标准

- naive 模式手测：表单布局/重置/文本域正常；
- 宿主页面无全局样式污染。

### 涉及文件

- `packages/ui/naiveUi/src/form/**`
- `packages/ui/naiveUi/src/textarea/**`
- `packages/ui/naiveUi/src/date-picker/**`
- `packages/ui/naiveUi/src/index.less`
- `packages/ui/naiveUi/src/index.ts`

---

## W11. types 类型体系修复

**严重度**：P1（209 处 any 的总根源）

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 11.1 | **ComponentSchema 的 `[fieldName: string]: any` 索引签名** + `props?: any` 让核心数据模型整体 any 化 | `types/src/aigen-designer.ts:13, 35` | 核心 agent + utils agent |
| 11.2 | types 包**自引用**：`import { PageSchema } from '@aigen-designer/types'`（值导入引类型） | `types/src/designer.ts:1` | 核心 agent |
| 11.3 | types → manager 反向依赖（type-only，但破坏分层） | `types/src/aigen-designer.ts:1` | 核心 agent |
| 11.4 | hooks/types 的 tsconfig 缺 `strict: true` | `packages/hooks/tsconfig.json`、`packages/types/tsconfig.json` | utils agent |
| 11.5 | eslint 显式关闭 `no-explicit-any` | `internal/eslint-config/src/configs/typescript.ts:55` | utils agent |
| 11.6 | rules.ts `validator?: Function`、FormItemRule `[model: string]: any`、FormConfig labelCol/wrapperCol: any | `types/src/rules.ts:11`、`types/src/**` | utils agent |
| 11.7 | types 包自身 14 处 any | `types/src/**` | utils agent |

### 修复方案

1. 索引签名收紧：`ComponentSchema` 改为精确字段 + `[key: string]: unknown`（或彻底移除，用泛型 `ComponentSchema<TProps>`）——**注意这是大改动，涉及 W3/W5/W6 的调用方，建议分期**：第一期先 `unknown` + 关键字段精确化，第二期再泛型化；
2. 修复 types 自引用与反向依赖（ActionsModel 等类型内联或下沉）；
3. hooks/types 补 `strict: true` 并修复暴露的类型错误（建议放在批次 3 全局收尾，避免与 W3/W4/W5 并行时冲突——本工作包只改 types 包内部，strict 开启产生的调用方错误由批次 3 处理）；
4. no-explicit-any 从 off 改 warn（存量先 `eslint-disable` 或分批清理）。

### 验收标准

- `npx vue-tsc --noEmit -p packages/aigen-designer/tsconfig.json` 错误数**不增加**（本包改动不破坏现有编译）；
- types 包内部 any 数量从 14 降至 0（本包范围）。

### 涉及文件

- `packages/types/src/**`
- `packages/types/tsconfig.json`
- `internal/eslint-config/src/configs/typescript.ts`

---

## W12. 发布元数据与依赖声明修复

**严重度**：P0（发布即损坏）

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 12.1 | core/hooks/types/base-ui/panel-ui：无 build 脚本 + main 指向 src/index.ts + private:false + publishConfig.access:public → **发布即发 TS 源码** | 各包 package.json | 工程化 agent |
| 12.2 | manager/utils：`files: ["dist"]` 但 main 指向 src → 发布空壳 | `manager/package.json:20-23`、`utils/package.json:20-23` | 工程化 agent |
| 12.3 | **幻影依赖成片**：examples/src 大量 import @aigen-designer/* 与 @vueuse/core 未声明；core/hooks/panel-ui 用 @vueuse/core 未声明；eslint-config 运行时插件全在 devDependencies | 各 package.json | 工程化 agent + 实测 |
| 12.4 | utils/package.json:19 `jsep@^1.4.0` 散落版本（未走 catalog）；manager/package.json:18 peerDeps 用 `catalog:` 协议（发布后无法解析） | `utils/package.json`、`manager/package.json` | 工程化 agent |
| 12.5 | eslint-config 的 dist/index.mjs 是 unbuild stub（硬编码本机绝对路径）且会被发布 | `internal/eslint-config/dist/index.mjs` | 实测 |
| 12.6 | 版本脱节：全部包 1.0.0 vs docs/updateLog 已 1.1.13；无 changesets、无 engines | 各 package.json、`docs/updateLog.md:1` | 工程化 agent + 实测 |
| 12.7 | .npmrc `package-lock=true`（pnpm 项目多余）、npm 警告 strict-peer-dependencies/auto-install-peers | `.npmrc` | 实测 |

### 修复方案

1. 发布治理决策（与项目负责人确认）：a) 内部包（core/hooks/types/utils/manager/base-ui/panel-ui）改 `private: true` 只作为源码依赖（推荐，aigen-designer 打包时已内联）；或 b) 为每个包补 unbuild 构建 + 统一 exports；
2. 若选择 b)：为每个包补 build.config.ts + 统一 `main/module/types/exports/files`；eslint-config 的 dist 排除 stub 或发布前重新构建；
3. 补齐幻影依赖声明（@vueuse/core、@aigen-designer/* 等），eslint-config 插件移入 dependencies；
4. jsep 加入 catalog；manager peerDeps 的 catalog: 改具体版本范围；
5. 版本统一（1.0.0 → 与 updateLog 对齐或重置 changelog），引入 changesets；补 engines 字段；
6. .npmrc 清理（移除 package-lock、保留 pnpm 配置但消除 npm 警告——如改为只在 .npmrc 中用 pnpm 识别的键）。

### 验收标准

- `pnpm install` 无警告；
- 每个可发布包 `npm pack --dry-run` 内容符合预期（无 stub 绝对路径、无 TS 源码裸发、files 与实际产物一致）；
- `pnpm -r ls --depth -1` 无 missing peer/dep 警告。

### 涉及文件

- 全部 `packages/*/package.json`、`packages/ui/*/package.json`、`packages/ui-kit/*/package.json`
- `internal/eslint-config/package.json`
- `pnpm-workspace.yaml`、`.npmrc`
- 如需补构建：各包 `build.config.ts`（新建）

---

## W13. CI 与工程规范

**严重度**：P0（无任何自动化保障）

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 13.1 | **完全没有 CI**（.github 不存在） | `.github/` | 工程化 agent + 实测 |
| 13.2 | 根 `test` 脚本是 vitest **watch 模式**，CI 里永不退出 | `package.json:10` | 工程化 agent |
| 13.3 | `lint` 脚本带 `--fix` 自动改代码 | `package.json:16` | utils agent |
| 13.4 | **turbo.json 模板残留**：build 任务 `outputs: [".next/**"]` + `cache: false`（缓存全失效）；aigen-examples#build cache:true 但无 outputs | `turbo.json:5-12` | 工程化 agent |
| 13.5 | vitest.config.ts `plugins: [vue() as any]`（类型问题） | `vitest.config.ts:4` | 实测 |
| 13.6 | 无 husky/lint-staged/commitlint（git 提交无规范约束） | — | 工程化 agent |
| 13.7 | vitest include 范围未显式配置（依赖默认排除 node_modules，建议显式） | `vitest.config.ts` | 工程化 agent |

### 修复方案

1. 新建 GitHub Actions 工作流：`pnpm install → eslint → vue-tsc → vitest run → turbo build`（分 job 并行，缓存 pnpm store）；
2. 根 test 脚本改 `vitest run`，新增 `test:watch`；
3. lint 脚本去掉 --fix（`eslint packages/`）；
4. 重写 turbo.json：build `outputs: ["dist/**"]`、cache: true；dev persistent；确认任务图（aigen-designer 构建 → UI 包 stub → examples）；
5. 补 husky + lint-staged（eslint+prettier 仅暂存文件）+ commitlint（如需要）；
6. vitest.config.ts 补 `include: ['packages/**/src/**/*.test.ts']` 显式范围，修 `vue() as any`。

### 验收标准

- 本机模拟 CI：`pnpm install && pnpm lint && pnpm test && pnpm --filter aigen-designer exec vite build` 全过（W1/W2 修复后）；
- turbo run build 有缓存命中日志（非 `cache: false`）。

### 涉及文件

- `.github/workflows/ci.yml`（新建）
- `package.json`（scripts）
- `turbo.json`
- `vitest.config.ts`
- `.husky/**`、`.lintstagedrc.mjs`、`commitlint.config.*`（新建，如采用）

---

## W14. 文档、品牌与卫生清理

**严重度**：P1（二开品牌未切换干净 + 文档断链）

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 14.1 | **docs 品牌残留**：title `EpicDesigner文档`、algolia `epicjs`、socialLinks/editLink `Kchengz/epic-designer`、sitemap `docs.epicjs.cn`、footer 桂ICP备案 + "EpicDesigner 作者所有"、logo `examples.epicjs.cn`、favicon `rel: 'epic-icon'`（拼错） | `docs/.vitepress/config.ts` | 实测 |
| 14.2 | **侧边栏 404**：sidebar 指向 `AigenDesigner.md`/`AigenBuilder.md`，实际文件是 `EDesigner.md`/`EBuilder.md` | `docs/.vitepress/config.ts` + `docs/guide/components/` | 实测 |
| 14.3 | docs 根目录中文名 jpg 残留（未被引用，实际引用 /layout.jpg） | `docs/初始化布局.jpg`、`docs/设计器布局.jpg` | 实测 |
| 14.4 | **git 误提交带空格副本目录** | `examples/src/views/builder/disableDisplay copy/index.vue`（git ls-files 确认） | 实测 |
| 14.5 | .vscode/settings.json 引用 6 个不存在的目录（tailwind-config、locales、playground、apps、core/base/design） | `.vscode/settings.json` | 实测 |
| 14.6 | `docs/vite.config.ts` 是 vitepress 用不到的残留 | `docs/vite.config.ts` | 实测 |
| 14.7 | LICENSE 版权仍是上游 kchengz（MIT 保留原作者合法，但可补充二开声明） | `LICENSE` | 实测 |
| 14.8 | docs 构建依赖 monaco-editor 解析失败（与 W2 的 dist 修复联动；docs/package.json 需显式声明 aigen-designer 依赖） | `docs/package.json` | 实测 |
| 14.9 | updateLog 顶部版本号与 package.json 不一致（归属 W12 版本统一，此处仅核对） | `docs/updateLog.md:1` | 实测 |

### 修复方案

1. 全部品牌替换为 aigen-designer：title/algolia 索引（如未部署 algolia 则移除）/socialLinks/editLink/sitemap（如无域名则移除）/footer（移除备案号或换自有）/logo/favicon rel；
2. 侧边栏链接与文件名对齐：重命名 `EDesigner.md → AigenDesigner.md`、`EBuilder.md → AigenBuilder.md`（或侧边栏改回 E*——以品牌统一为准，推荐重命名），同步修复 md 内部交叉引用；
3. 删除未引用的中文 jpg；删除 `disableDisplay copy` 目录（git rm）；清理 .vscode/settings.json 失效路径；删除 docs/vite.config.ts；
4. docs/package.json 显式声明 `aigen-designer: workspace:*`（依赖 W2 的 dist 修复后 docs build 才可通过）；
5. LICENSE 补充二开版权行（保留原 MIT 声明）。

### 验收标准

- `pnpm docs:build` 成功（需 W2 先完成 dist 修复；批次 2 回归）；
- `grep -r "Kchengz" docs/.vitepress docs/guide README.md` 无残留（updateLog 历史记录除外）；
- `git status` 干净（死文件已删）。

### 涉及文件

- `docs/.vitepress/config.ts`
- `docs/guide/components/EDesigner.md`、`docs/guide/components/EBuilder.md`（重命名）
- `docs/package.json`
- `docs/vite.config.ts`（删除）
- `docs/初始化布局.jpg`、`docs/设计器布局.jpg`（删除）
- `examples/src/views/builder/disableDisplay copy/`（删除）
- `.vscode/settings.json`
- `LICENSE`、`README.md`（品牌核对）

---

## W15. Builder 渲染性能优化（合并自性能文档 P-W2）— 新增

**严重度**：P1（100+ 节点页面加载 50-200ms 主线程阻塞）

> 来源：docs/performance-optimization.md W2。文件 `packages/core/src/components/builder/src/builder.vue` 此前无任何工作包覆盖，故升级为独立工作包（与 W5 的 designer 模块互补，文件不冲突）。

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 15.1 | `watch([() => props.pageSchema, () => props.tableView], ..., { deep: true })` 触发时依次执行 deepClone + migrateComponentProps + reorganizeSchemasForTableView + deepCompareAndModify（4 次全树遍历，5-30ms） | `builder.vue:92-100` | 性能文档 W2 |
| 15.2 | `suspenseKey.value++` + `ready.value = false` 强制 100+ AigenNode 全量 Suspense 重挂载（50-200ms DOM 重建） | `builder.vue:101-103` | 性能文档 W2 |
| 15.3 | `watch(() => props.formData, ..., { deep: true })` 整个 formData 深层 watch | `builder.vue:112-123` | 性能文档 W2 |

### 修复方案

1. **15.1 — Schema 处理移入 Worker（依赖 W16）或先做同步收窄**：a) 立即项：`watch` 的 `deep: true` 改浅层 watch + 显式依赖列表；b) Worker 项（批次 2 联调）：通过 `postToWorker('processSchema', { pageSchema, tableView })` 将 deepClone + migrate + reorganize 移出主线程，主线程只做 `deepCompareAndModify(pageManager.pageSchema, processed)`；
2. **15.2 — 移除全量重挂载**：删除 `suspenseKey.value++` 和 `ready.value = false`，依赖 Vue 响应式系统按变更局部更新（如确需重置用 `pageManager.mountMonitor.reset()`）；
3. **15.3 — formData watch 去 deep**：`setData` 内部已有合并逻辑，`{ immediate: true }` 即可。

### 验收标准

- 页面加载帧耗时从 50-200ms 降至 < 30ms（Performance tab）；
- `builder.vue` 的 watch 回调中不再有同步全量 deepClone + deepCompareAndModify；
- Worker 通信开销 < 2ms（批次 2 联调项）。

### 涉及文件

- `packages/core/src/components/builder/src/builder.vue`
- ⚠️ Worker 化部分依赖 W16 的 `packages/manager/src/schemaWorkerBridge.ts`（只 import 不新建）

---
## W16. Schema Worker 基础设施（合并自性能文档 P-W5）— 新增

**严重度**：P1（为 W6 的 revoke Worker 化与 W15 的 Builder Worker 化提供运行环境）

> 来源：docs/performance-optimization.md W5。全新文件，不与任何现有工作包冲突，批次 1 即可启动。

### 问题清单

| # | 问题 | 位置 | 来源 |
|---|---|---|---|
| 16.1 | 项目当前**零 Web Worker 基础设施**（grep 确认无 `new Worker` 调用），W6.8/W15.1 的 Worker 化方案无运行环境 | — | 性能文档 W5 |

### 修复方案

1. 新建 `packages/manager/src/schema.worker.ts`：处理 4 种消息——`computeDiff`（createPatch + JSON.stringify）、`processSchema`（deepClone + migrate + reorganize）、`materialize`（applyPatch 链回放）、`validateImport`（批量 JSON.parse 校验）；
2. 新建 `packages/manager/src/schemaWorkerBridge.ts`：单例 Worker + 请求 id 映射 + `postToWorker(type, payload): Promise` 桥接，`new URL('./schema.worker.ts', import.meta.url)` 确保 Vite 打包；
3. Worker 内使用 `@aigen-designer/utils` 的纯函数（无 DOM/响应式依赖——createPatch/applyPatch 已确认纯函数，deepCompareAndModify 留主线程）；
4. 与 W6/W15 协调消息协议（性能文档 W5 中已给出完整接口定义可直接采用）。

### 验收标准

- `new Worker()` 创建成功，4 种消息类型均可正常往返（可写最小单测或在 examples 中 console 验证）；
- `pnpm --filter aigen-designer exec vite build` 产物中包含 Worker 文件；
- W6/W15 可通过 `postToWorker()` 调用（批次 2 联调确认）。

### 涉及文件

- 新建 `packages/manager/src/schema.worker.ts`
- 新建 `packages/manager/src/schemaWorkerBridge.ts`
- ⚠️ 注意：新建文件与 W6 同目录（manager/src），但 W6 只改既有文件，不冲突；若担心 git 竞争，W6 的 Worker 化部分延后到 W16 提交后再做（已在 W6.8 注明）。

---
## 附 A：批次 2 跨包回归清单（依赖批次 1）

| 回归项 | 前置 | 操作 | 预期 |
|---|---|---|---|
| 三套 UI 手测 | W1（examples dev 恢复） | 分别以 element-plus/antd/naive-ui 启动 examples，操作全部 designer/builder 示例页 | 无崩溃、拖入可撤销、编辑器可用、值格式一致 |
| docs 构建 | W2（dist 修复）+ W14 | `pnpm docs:build` | 成功 |
| 全量构建 | W1 + W2 + W13 | `pnpm build` | 成功且产物无绝对路径 |
| 发布演练 | W12 | 对每个可发布包 `npm pack --dry-run` | 内容正确 |

## 附 B：批次 3 全局收尾（建议单独串行）

1. TS strict 全面开启（hooks/types 先行，core/ui 随后）并修复暴露的类型错误；
2. any 存量收敛（209 处 → 目标 < 50 处，优先 types/formulaEngine/useDesignerContext）；
3. ComponentSchema 泛型化（`ComponentSchema<TProps>`）与 props 精确类型；
4. 引入 changesets 版本管理 + 首个 1.1.14 发布流程演练；
5. 三套 UI 抽共享适配抽象（大重构，建议单独立项：先抽取公共 config 生成器，再收敛 formItem/switch/upload 等重复实现）；
6. 多实例隔离（pluginManager 实例化、useStore 实例化、canvasConfigs 冻结）——涉及 core/hooks/manager 三包，需在 W5/W6 完成后单独立项；
7. ~~builder 增量更新~~ —— 已升级为 **W15**（Builder 渲染性能优化），见对应章节。

## 附 C：问题来源与可信度

- **实测**：主线程直接运行验证（vitest 132 用例、vue-tsc 13 错误、vite build、docs build、dev 启动、dist 审计、git ls-files）；
- **实跑确认**：agent 在 Node 中复刻逻辑验证；
- **复刻确认**：agent 按真实算法复刻验证；
- **行号说明**：以审查时文件为准，修复时请以实际代码为准（可能因其他工作包修改产生偏移）。

---

## 附 D：与 docs/performance-optimization.md 的合并映射表

> 性能专项文档（P-W1~P-W9）全部并入本计划，映射如下：

| 性能文档工作包 | 内容 | 合并去向 | 说明 |
|---|---|---|---|
| P-W1 | node.vue 深层 Watch 优化（node.vue:88-114, 159-177, 473-488） | **W7**（新增条目 7.8） | node.vue 已在 W7 文件范围 |
| P-W2 | Builder Schema 更新优化（builder.vue:92-123） | **W15**（新增章节） | builder.vue 无既有工作包覆盖，独立成包 |
| P-W3 | History Diff 计算 Worker 化（revoke.ts） | **W6**（新增条目 6.9 + 修复方案 8） | revoke.ts 已在 W6 范围，6.5 性能条目扩展 |
| P-W4 | Component Manager 注册批量化（useComponentManager.ts + pluginManager.ts） | **W4**（新增 4.11）+ **W6**（新增 6.10） | useComponentManager 属 hooks，pluginManager 属 manager |
| P-W5 | Schema Worker 基础设施（新建 schema.worker.ts + schemaWorkerBridge.ts） | **W16**（新增章节） | 全新文件，供 W6/W15 依赖 |
| P-W6 | FormulaEngine AST 缓存（formulaEngine.ts:59） | **W3**（新增 3.13 + 修复方案 9） | formulaEngine.ts 已在 W3 范围 |
| P-W7 | 响应式 shallowRef/markRaw（usePageSchema + pageManager + useMountMonitor） | **W4**（新增 4.12）+ **W6**（新增 6.11） | 按文件归属拆分：hooks 部分入 W4，pageManager 部分入 W6 |
| P-W8 | 组件搜索 Debounce（tree.vue + componentView） | **W7**（新增 7.9 + 修复方案 7） | tree.vue/componentView 已在 W7 范围 |
| P-W9 | diffArrays Keyed 匹配 | **W3**（新增 3.14 结论） | 性能文档结论为无需修改，记录决策 |

**性能文档中的排除项**（保持排除，不入本计划）：FormulaEngine Worker、Tree Search Worker、Virtual Scrolling（架构重构，单独立项）、`show` 函数 eval、previewWidgets DOM rAF、computedComponentSchemaGroups Worker。

**批次联动**：W16（Worker 基础设施）→ W6.8/W15.1 的 Worker 化部分在批次 2 联调；W4.12 的 pageManager 子项归 W6 执行避免双改。


