# 表达式插入器重设计（三栏编号引导式）+ 公式引擎补齐

## Context

用户反馈：表达式插入器「看不出如何使用、不够清晰」。现状是一个三栏模态（变量/函数列表 | 公式编辑 | 实时预览），所有用法说明只有编辑区底部一行 10px 小字和 hover title，空荡荡的编辑区和预览区没有任何引导。另外探索时发现公式引擎缺口：**`$prev`、`$steps`、裸 `$formData`（Identifier 节点）在预览和运行时都返回 0**——`FormulaEngine.calculate()` 只合并 `event/formData/vars` 三个键，运行时 `actionExecutionEngine.ts:139-150` 传的 `$prev/$steps` 被丢弃，而 UI 却向用户承诺了这些变量。

用户已确认：采用**三栏编号引导式**布局（同动作抽屉的编号分区风格），并**一并修复引擎**。

## 改动文件

### 1. `packages/utils/src/formula/formulaEngine.ts` — 引擎补齐

- `FormulaContext` 增加 `prev?: unknown; steps?: Record<string, unknown>`
- `calculate()` 合并上下文时透传 `prev/steps`
- `MemberExpression` 分支的 `sourceMap` 增加 `$prev: ctx.prev ?? null`、`$steps: ctx.steps || {}`
- 提取私有方法 `_resolveRoot(name, ctx)` 返回根对象；新增 `Identifier` 分支：裸 `$event/$formData/$vars/$prev/$steps` 返回根值本身，未知标识符维持 default 警告 + 0

### 2. `packages/utils/src/__test__/common/formulaEngine.test.ts` — 补用例

`$prev + 10`（prev=10 → 20）、`$steps.a`（steps={a:1} → 1）、裸 `$formData` 返回对象、`$formData.a.b` 路径取值、未知标识符仍返回 0。

### 3. `packages/ui-kit/panel-ui/src/components/ExpressionInsert/index.vue` — UI 重设计

**props/emits 接口不变**（`fields/initialContent/visible/confirm/update:visible`），两个使用方（StepArgs.vue、FieldLinkEditor.vue）零改动。保留 Teleport、z-index 3100、Esc/遮罩关闭、CSS 变量主题。

#### Header

- 标题旁加副标题：「把参数写成公式：点击左侧变量与函数组合，运行时实时计算」
- 复用 `AigenTooltip` + `icon--aigen--help-outline-rounded` 问号（同 StepArgs.vue 刚加的模式），tooltip 详述：产出 `{__isExpression__: true, content}` 表达式对象、动作执行时求值、预览为模拟数据

#### 左栏 ①「选择变量与函数」（修复信息层级）

- `fieldItems` 拆成两组 computed：**事件与上下文**（`$` 前缀：`$event[0]/$event[1]/$prev/$formData`）与**表单字段**（非 `$`），各组带分组小标题和一句来源说明
- 内置函数列表改**两行布局**（函数名 + 完整描述独立一行），解决 `MU_TO_SQM` 描述被截断问题

#### 中栏 ②「编写公式」（核心引导）

- **示例 chips**：「试试示例」行，3 个固定示例（全部基于上下文变量，预览必出结果）：`$event[0]`（事件值引用）、`$prev + 10`（管道运算）、`IF($event[0], "开启", "关闭")`（条件判断）；页面有表单字段时追加 1 个动态字段运算示例（取第一个真实字段构造）
- **运算符快捷条**：`+ − * / > < == ( )` 小按钮，复用 `insertText` 在光标处插入
- **空态引导卡**：`content` 为空时显示三步说明（① 点左侧变量/函数插入 → ② 用运算符组合公式 → ③ 看右侧预览，点「插入表达式」写回参数），输入后自动隐藏；原一行 tip 文案并入引导卡

#### 右栏 ③「预览结果」

- `preview` computed 的模拟上下文增加 `prev: 10, steps: {}`（与示例呼应）
- 结果框下方小字说明模拟规则：「预览用模拟数据：$event[0]=true、$prev=10，表单字段按组件类型取示例值」
- 错误态文案保留（已含修正建议）

#### Footer

- 「插入表达式」按钮在 content 为空时 `disabled`（替代现在的点击报错），parseError 展示保留

### 4. 验证

1. `npx vitest run packages/utils` — 公式引擎新旧用例全过
2. `npx vue-tsc --noEmit -p packages/ui-kit/panel-ui/tsconfig.json` 与 `-p packages/utils/tsconfig.json` — 类型检查
3. 修改文件过 `eslint` + `prettier --check`
4. 浏览器端到端（dev server 已在跑，HMR 生效）：
   - 动作抽屉 ƒx 入口：验证新布局三步引导、示例点击填入并出预览、运算符插入、hover 问号 tooltip、空内容时插入按钮禁用、非法表达式错误提示
   - `$prev + 10` 示例预览应显示 20（验证引擎修复在设计态生效）
   - FieldLinkEditor 入口回归一次（联动规则 ƒx），确认接口不变无回归

## 不做的事

- 不抽 `BUILTIN_FUNCTIONS` 到 utils 共享（组件内单处维护 UI 文案，非本次痛点）
- 不改 props/emits 接口，不动两个使用方
- 不引入 `$steps` 到插入器选择列表（管道进阶场景，避免 UI 过载；引擎支持后脚本可直接使用）
