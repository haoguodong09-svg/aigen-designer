# epic-designer 组件扩展分析报告

> 分析对象：`D:\workspace\Github\epic-designer`  
> 聚焦 UI 库：Ant Design Vue（ant-design-vue）  
> 生成日期：2026-08-26

---

## 一、项目概览

| 项目           | 说明                                                     |
| -------------- | -------------------------------------------------------- |
| **名称**       | aigen-designer（基于开源 epic-designer 二次开发）        |
| **技术栈**     | Vue 3 + TypeScript + Monorepo（pnpm workspaces + Turbo） |
| **核心能力**   | 拖拽式低代码页面/表单设计器，JSON 配置生成页面           |
| **多 UI 支持** | Element Plus / Ant Design Vue / Naive UI                 |
| **架构模式**   | 插件化组件注册系统，每个 UI 库独立实现一套组件           |

### Monorepo 包结构

```
packages/
├── aigen-designer/          # 公共入口（ barrel 导出）
├── core/                    # 设计器 & 构建器 Vue 组件
├── hooks/                   # 组合式 API hooks（useComponentManager 等）
├── manager/                 # pluginManager 单例 + pageManager
├── types/                   # 所有 TypeScript 接口定义
├── utils/                   # 工具函数
├── ui-kit/
│   ├── base-ui/             # UI 无关的基础组件（AigenNode 渲染器等）
│   └── panel-ui/            # 右侧面板 UI（属性编辑器、活动栏等）
└── ui/
    ├── elementPlus/         # Element Plus 组件实现（26个）
    ├── antd/                # Ant Design Vue 组件实现（26个）
    └── naiveUi/             # Naive UI 组件实现（25个）
```

---

## 二、当前 Ant Design Vue 已注册组件清单

### 2.1 直接注册的原生组件

通过 `pluginManager.component.add()` 直接注册（无自定义包装器）：

| 注册名称 | 来源组件 | 说明 |
| --- | --- | --- |
| `Collapse` | `ant-design-vue` Collapse | 折叠面板容器 |
| `CollapseItem` | `ant-design-vue` CollapsePanel | 折叠面板项 |
| `aigenTable` | `ant-design-vue` Table | 表格（内部组件，非标准用户可见） |

### 2.2 通过本地包装器注册的组件

| #   | 注册类型       | 源文件           | 分组     | sort | 说明           |
| --- | -------------- | ---------------- | -------- | ---- | -------------- |
| 1   | `form`         | `./form`         | 表单     | —    | 表单容器       |
| 2   | `form-item`    | `./form-item`    | 表单     | —    | 表单项         |
| 3   | `input`        | `./input`        | 表单     | —    | 输入框         |
| 4   | `textarea`     | `./textarea`     | 表单     | —    | 文本域         |
| 5   | `input-number` | `./input-number` | 表单     | —    | 数字输入       |
| 6   | `radio`        | `./radio`        | 表单     | —    | 单选框         |
| 7   | `checkbox`     | `./checkbox`     | 表单     | —    | 复选框         |
| 8   | `select`       | `./select`       | 表单     | —    | 选择器         |
| 9   | `slider`       | `./slider`       | 表单     | —    | 滑块           |
| 10  | `time-picker`  | `./time-picker`  | 表单     | —    | 时间选择       |
| 11  | `date-picker`  | `./date-picker`  | 表单     | —    | 日期选择       |
| 12  | `cascader`     | `./cascader`     | 表单     | —    | 级联选择       |
| 13  | `switch`       | `./switch`       | 表单     | —    | 开关           |
| 14  | `upload-image` | `./upload-image` | 表单     | —    | 图片上传       |
| 15  | `upload-file`  | `./upload-file`  | 表单     | —    | 文件上传       |
| 16  | `color-picker` | `./color-picker` | 表单     | —    | 颜色选择       |
| 17  | `button`       | `./button`       | 布局     | —    | 按钮（inline） |
| 18  | `card`         | `./card`         | 布局     | —    | 卡片容器       |
| 19  | `row`          | `./row`          | 布局     | —    | 行布局         |
| 20  | `col`          | `./col`          | 布局     | —    | 列布局         |
| 21  | `modal`        | `./modal`        | 反馈     | —    | 对话框         |
| 22  | `tabs`         | `./tabs`         | 布局     | —    | 标签页容器     |
| 23  | `tabs-pane`    | `./tab-pane`     | 布局     | —    | 标签页项       |
| 24  | `alert`        | `./alert`        | 反馈     | —    | 警告提示       |
| 25  | `divider`      | `./divider`      | 布局     | 820  | 分割线         |
| 26  | `link`         | `./link`         | 导航     | 1000 | 链接           |
| 27  | `tag`          | `./tag`          | 数据展示 | 1000 | 标签           |

### 2.3 组件覆盖情况

| 分组     | 已注册             | AntD 可用总量 | 覆盖率   |
| -------- | ------------------ | ------------- | -------- |
| 表单输入 | 16 个              | ~25 个        | ~64%     |
| 布局容器 | 8 个（含 Divider） | ~15 个        | ~53%     |
| 反馈     | 2 个（含 Alert）   | ~15 个        | ~13%     |
| 导航     | 1 个（Link）       | ~15 个        | ~7%      |
| 数据展示 | 1 个（Tag）        | ~20 个        | ~5%      |
| **合计** | **~30 个**         | **~90 个**    | **~33%** |

---

## 三、Ant Design Vue 可用但未注册的关键组件

### 3.1 分类总览

| 分类                      | 可用组件数 | 已注册     | 缺失 | 缺失率 |
| ------------------------- | ---------- | ---------- | ---- | ------ |
| 数据展示（Data Display）  | ~20        | 0          | 20   | 100%   |
| 反馈（Feedback）          | ~15        | 1          | 14   | 93%    |
| 导航（Navigation）        | ~15        | 0          | 15   | 100%   |
| 布局（Layout）            | ~10        | 7          | 3    | 30%    |
| 表单增强（Advanced Form） | ~12        | 16（基础） | ~8   | 40%    |
| 其他                      | ~18        | 2          | 16   | 89%    |

### 3.2 按优先级排列的可新增组件

#### 🔴 P0 — 核心缺失（业务必备）

| 组件 | AntD 组件名 | 复杂度 | 业务价值 | 说明 |
| --- | --- | --- | --- | --- |
| **Table（表格）** | `Table` | ⭐⭐⭐⭐⭐ | ★★★★★ | 数据展示之王，支持列配置、排序、筛选、分页、行选择 |
| **TreeSelect（树形选择）** | `TreeSelect` | ⭐⭐⭐⭐ | ★★★★ | 层级数据选择（组织架构、分类选择） |
| **Tree（树形控件）** | `Tree` | ⭐⭐⭐⭐⭐ | ★★★★ | 组织架构、权限展示、分类选择 |
| **Pagination（分页）** | `Pagination` | ⭐⭐⭐ | ★★★★ | 表格/列表分页必备 |
| **Tag（标签）** | `Tag` / `CheckableTag` | ⭐⭐ | ★★★★ | 状态标记、筛选标签、分类展示 |

#### 🟠 P1 — 高频使用

| 组件 | AntD 组件名 | 复杂度 | 业务价值 | 说明 |
| --- | --- | --- | --- | --- |
| **Rate（评分）** | `Rate` | ⭐⭐ | ★★★★ | 评价打分，实现简单 |
| **Steps（步骤条）** | `Steps` / `Step` | ⭐⭐⭐ | ★★★★ | 向导、流程进度展示 |
| **Breadcrumb（面包屑）** | `Breadcrumb` / `BreadcrumbItem` | ⭐⭐⭐ | ★★★☆ | 页面导航、路径展示 |
| **Alert（警告提示）** | `Alert` | ⭐⭐ | ★★★☆ | 表单验证提示、操作反馈 |
| **Badge（徽标）** | `Badge` | ⭐⭐ | ★★★☆ | 消息数量、状态标记 |
| **Avatar（头像）** | `Avatar` / `AvatarGroup` | ⭐⭐ | ★★★☆ | 用户/实体展示 |
| **Divider（分割线）** | `Divider` | ⭐ | ★★★ | 表单分组、内容分隔 |
| **Link（链接）** | `Typography.Link` | ⭐ | ★★★ | 跳转链接、操作入口 |
| **Popover（弹出框）** | `Popover` | ⭐⭐⭐ | ★★★ | 详细信息悬浮展示 |
| **Popconfirm（气泡确认）** | `Popconfirm` | ⭐⭐⭐ | ★★★ | 删除/危险操作确认 |
| **Tooltip（文字提示）** | `Tooltip` | ⭐⭐ | ★★★ | 图标/文字说明 |
| **Progress（进度条）** | `Progress` | ⭐⭐ | ★★★ | 操作进度、完成度展示 |
| **Descriptions（描述列表）** | `Descriptions` / `DescriptionsItem` | ⭐⭐⭐ | ★★★ | 键值对详情展示 |

#### 🟡 P2 — 场景增强

| 组件 | AntD 组件名 | 复杂度 | 业务价值 | 说明 |
| --- | --- | --- | --- | --- |
| **Transfer（穿梭框）** | `Transfer` | ⭐⭐⭐⭐ | ★★★ | 批量选择、权限分配 |
| **Dropdown（下拉菜单）** | `Dropdown` | ⭐⭐⭐ | ★★★ | 操作菜单、快捷操作 |
| **Skeleton（骨架屏）** | `Skeleton` | ⭐⭐ | ★★★ | 数据加载占位 |
| **Result（结果页）** | `Result` | ⭐⭐ | ★★☆ | 成功/失败结果展示 |
| **Image（图片）** | `Image` / `Image.PreviewGroup` | ⭐⭐⭐ | ★★☆ | 图片展示与预览 |
| **Space（间距）** | `Space` / `Space.Compact` | ⭐ | ★★☆ | 组件间距控制 |
| **Statistic（统计数值）** | `Statistic` | ⭐⭐ | ★★☆ | 数值展示、格式化 |
| **AutoComplete（自动完成）** | `AutoComplete` | ⭐⭐ | ★★☆ | 搜索/联想输入 |
| **InputSearch（搜索输入）** | `Input.Search` | ⭐ | ★★☆ | 带按钮的搜索输入 |
| **Mentions（提及）** | `Mentions` | ⭐⭐⭐ | ★★☆ | @提及输入 |
| **QRCode（二维码）** | `QRCode` | ⭐⭐ | ★★ | 二维码展示 |
| **PageHeader（页头）** | `PageHeader` | ⭐⭐ | ★★ | 页面标题、返回导航 |
| **Menu（导航菜单）** | `Menu` | ⭐⭐⭐ | ★★ | 侧边导航菜单 |
| **Anchor（锚点）** | `Anchor` / `AnchorLink` | ⭐⭐⭐ | ★★ | 页面内导航 |
| **Typography（排版）** | `Typography` | ⭐ | ★★ | 标题、段落、文本样式 |

#### 🟢 P3 — 锦上添花

| 组件 | AntD 组件名 | 复杂度 | 业务价值 | 说明 |
| --- | --- | --- | --- | --- |
| **Calendar（日历）** | `Calendar` | ⭐⭐⭐⭐ | ★★ | 日程展示、日期选择 |
| **Carousel（走马灯）** | `Carousel` / `CarouselItem` | ⭐⭐⭐ | ★★ | 图片轮播 |
| **Comment（评论）** | `Comment` | ⭐⭐⭐ | ★★ | 评论展示 |
| **Watermark（水印）** | `Watermark` | ⭐ | ★ | 背景水印 |
| **BackTop（返回顶部）** | `BackTop` | ⭐ | ★ | 页面返回顶部 |
| **Tour（漫游）** | `Tour` | ⭐⭐⭐ | ★ | 功能引导 |
| **FloatButton（悬浮按钮）** | `FloatButton` | ⭐⭐ | ★ | 快捷操作 |
| **Segmented（分段控制器）** | `Segmented` | ⭐ | ★ | 分段选择 |
| **Flex（弹性布局）** | `Flex` | ⭐ | ★ | 弹性布局工具 |
| **Affix（固钉）** | `Affix` | ⭐⭐ | ★ | 固定定位 |

---

## 四、推荐新增分组方案

当前仅有两个分组：`表单` 和 `布局`。建议扩展为 6 个分组，便于用户快速定位组件：

```typescript
// 在 antd/src/index.ts 的 setupAntd() 末尾添加：
pluginManager.component.setSortedGroups([
  '表单', // 已有：Input, Select, DatePicker 等
  '布局', // 已有：Card, Row, Col, Tabs, Collapse 等
  '数据展示', // 新增：Table, Tree, TreeSelect, Pagination, Tag, Badge, Avatar, Descriptions, Image
  '反馈', // 新增：Alert, Popover, Popconfirm, Tooltip, Progress, Result, Drawer
  '导航', // 新增：Breadcrumb, Steps, Menu, Anchor, Pagination, Link
  '其他', // 新增：Rate, Divider, Space, Skeleton, Transfer, Dropdown, Calendar
]);
```

分组映射关系：

| 分组 | 包含组件 |
| --- | --- |
| **表单** | Form, FormItem, Input, Textarea, InputNumber, Radio, Checkbox, Select, Slider, TimePicker, DatePicker, Cascader, Switch, UploadFile, UploadImage, ColorPicker, Rate, AutoComplete, InputSearch, Mentions |
| **布局** | Card, Row, Col, Tabs, TabsPane, Collapse, CollapseItem, Button, Divider, Space, Flex |
| **数据展示** | Table, Tree, TreeSelect, Pagination, Tag, Badge, Avatar, Descriptions, Image, QRCode, Statistic, Skeleton |
| **反馈** | Alert, Popover, Popconfirm, Tooltip, Progress, Result, Modal, Drawer, Tour |
| **导航** | Breadcrumb, Steps, Menu, Anchor, Link, PageHeader |
| **其他** | Transfer, Dropdown, Calendar, Carousel, Comment, Watermark, BackTop, FloatButton, Segmented, Affix, Typography |

---

## 五、组件注册模式详解

### 5.1 注册流程

```
packages/ui/antd/src/index.ts
  │
  ├── import Button from './button'          // 导入组件定义
  ├── import Card from './card'
  │   ...
  │
  ├── pluginManager.component.add('Collapse', async () => ...)   // 原生组件
  ├── pluginManager.component.add('CollapseItem', async () => ...) // 原生组件
  ├── pluginManager.component.add('aigenTable', async () => ...)  // 原生组件
  │
  └── componentArray.forEach((item) => {
        pluginManager.component.register(item);              // 注册配置
        pluginManager.component.addBaseComponentType(type);  // 标记为可删除
      });
```

### 5.2 ComponentConfigModel 必填字段

```typescript
{
  // 组件加载器（必须懒加载）
  component: () => import('./button'),

  // 配置项
  config: {
    // 可用动作方法（自动注入 setValue/getValue/setAttr，无需手动添加）
    action: [
      { description: '点击按钮时', type: 'click' },
      { description: '双击按钮时', type: 'dblclick' },
    ],
    // 属性编辑器（右侧面板配置项）
    attribute: [
      { field: 'label', label: '标题', type: 'input' },
      { field: 'props.type', label: '类型', type: 'select', props: { options: [...] } },
      { field: 'props.disabled', label: '禁用', type: 'switch' },
      { field: 'props.hidden', label: '隐藏', type: 'switch' },
    ],
    // 可用事件
    event: [
      { description: '值变化时', type: 'change' },
    ],
    // 样式编辑器（可选）
    style: [...],
  },

  // 默认 Schema（拖入画布时的初始数据）
  defaultSchema: {
    type: 'button',          // 唯一标识符
    label: '按钮',            // 侧边栏显示名
    field: 'button',          // 数据字段名
    input: false,             // 是否为表单输入组件（true=自动包装FormItem）
    props: { type: 'primary' }, // 默认属性
    children: [],             // 子组件列表（容器组件）
  },

  // 分组（可选，不设置则不显示在侧边栏）
  groupName: '表单',

  // 图标（iconify 格式）
  icon: 'icon--aigen--fit-screen-rounded',

  // 组内排序（越小越靠前，默认 1000）
  sort: 1200,

  // 设计时约束（可选）
  editConstraints: {
    immovable: false,    // 组件自身不可拖动
    childImmovable: false, // 子组件不可拖动
    fixedField: false,   // 不生成随机 UUID（保留用户定义的 field）
    inline: true,        // 内联组件（display: inline-block）
    locked: false,       // 完全锁定（不可编辑/选中/复制/删除）
  },
}
```

### 5.3 自动注入的动作

| 条件          | 自动注入动作                               |
| ------------- | ------------------------------------------ |
| `input: true` | `setValue`（设置值）、`getValue`（获取值） |
| 所有组件      | `setAttr`（修改任意 props 属性）           |

> 注意：不要手动添加 `setValue`/`getValue`/`setAttr`，系统会自动处理。

### 5.4 属性编辑器类型

| 类型                 | 说明                                   |
| -------------------- | -------------------------------------- |
| `input`              | 文本输入框                             |
| `number`             | 数字输入                               |
| `select`             | 下拉选择（需配置 `props.options`）     |
| `switch`             | 开关                                   |
| `radio`              | 单选框                                 |
| `checkbox`           | 复选框                                 |
| `color-picker`       | 颜色选择器                             |
| `AigenField`         | 数据字段选择器                         |
| `AigenOptionsEditor` | 选项配置编辑器（如 Select 的 options） |
| `AigenRuleEditor`    | 表单校验规则编辑器                     |
| `AigenInputSize`     | 尺寸输入（如 Form 的 labelWidth）      |
| `AigenColEditor`     | 列配置编辑器                           |
| `AigenTabPaneEditor` | 标签页配置编辑器                       |

### 5.5 editConstraints 详解

| 约束             | 类型    | 效果                                       |
| ---------------- | ------- | ------------------------------------------ |
| `immovable`      | boolean | 组件自身不能拖动/重定位                    |
| `childImmovable` | boolean | 子组件之间不能拖动重排                     |
| `fixedField`     | boolean | 不自动生成 UUID 作为 field，保留用户定义值 |
| `inline`         | boolean | 内联显示（`display: inline-block`）        |
| `locked`         | boolean | 完全锁定：不可编辑、不可选中、不可复制删除 |

**使用示例**：

```typescript
// Button：内联显示，不独占一行
editConstraints: {
  inline: true;
}

// Tabs：子组件不可重排
editConstraints: {
  childImmovable: true;
}

// TabPane：完全锁定，不可删除/复制/重排
editConstraints: {
  locked: true;
}

// Col：不自动生成 field
editConstraints: {
  fixedField: true;
}
```

---

## 六、新增组件步骤清单

### 步骤 1：创建组件目录和文件

```
packages/ui/antd/src/<component-name>/
  ├── index.ts          # ComponentConfigModel 定义
  └── <component>.vue   # Vue 包装组件
```

### 步骤 2：编写包装组件

**简单组件（无子组件）**：

```vue
<!-- packages/ui/antd/src/rate/rate.vue -->
<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';
import { useBindModel } from '@aigen-designer/base-ui';
import { ARate } from 'ant-design-vue';

defineOptions({ name: 'AigenRate' });

const props = defineProps<{
  componentSchema?: ComponentSchema;
}>();

const { bindModel } = useBindModel('rate');
const innerSchema = props.componentSchema ?? {};
</script>
<template>
  <ARate
    v-model:[bindModel]="innerSchema.props?.modelValue"
    v-bind="innerSchema.props"
  />
</template>
```

**容器组件（含子组件）**：

```vue
<!-- packages/ui/antd/src/tabs/tabs.vue -->
<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';
import { h, renderSlot, useSlots } from 'vue';
import { ATabs, ATabPane } from 'ant-design-vue';

defineOptions({ name: 'AigenTabs' });

const props = defineProps<{
  componentSchema: ComponentSchema;
}>();

const slots = useSlots();
const componentSchema = { ...props.componentSchema };
const children = componentSchema.children ?? [];
delete componentSchema.children;
</script>
<template>
  <ATabs v-bind="componentSchema">
    <template #default>
      <ATabPane
        v-for="(child, index) in children"
        :key="child.id ?? index"
        :tab="child.label"
      >
        <slot name="node" :component-schema="child" />
      </ATabPane>
    </template>
  </ATabs>
</template>
```

### 步骤 3：编写 index.ts

```typescript
// packages/ui/antd/src/rate/index.ts
import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./rate.vue'),
  config: {
    action: [{ description: '使评分获取焦点', type: 'focus' }],
    attribute: [
      { field: 'field', label: '数据字段', type: 'AigenField' },
      { field: 'label', label: '标题', type: 'input' },
      { field: 'props.max', label: '最大分值', type: 'number' },
      { field: 'props.allowHalf', label: '允许半选', type: 'switch' },
      { field: 'props.showScore', label: '显示分值', type: 'switch' },
      { field: 'props.disabled', label: '禁用', type: 'switch' },
      { field: 'props.hidden', label: '隐藏', type: 'switch' },
    ],
    event: [{ description: '分值改变时', type: 'change' }],
  },
  defaultSchema: {
    field: 'rate',
    input: true,
    label: '评分',
    props: { max: 5, allowHalf: false, showScore: false },
    type: 'rate',
  },
  groupName: '表单',
  icon: 'icon--aigen--star-outline-rounded',
  sort: 950,
} as ComponentConfigModel;
```

### 步骤 4：在 index.ts 中注册

```typescript
// packages/ui/antd/src/index.ts

// 1. 导入
import Rate from './rate';

// 2. 添加到 componentArray
const componentArray = [
  // ... 现有组件
  Rate, // 新增
];

// 3. 组件数组注册（已有代码自动处理）
componentArray.forEach((item) => {
  pluginManager.component.register(item);
  pluginManager.component.addBaseComponentType(item.defaultSchema.type);
});
```

### 步骤 5（可选）：添加新分组

在 `setupAntd()` 末尾添加：

```typescript
pluginManager.component.setSortedGroups([
  '表单',
  '布局',
  '数据展示',
  '反馈',
  '导航',
  '其他',
]);
```

---

## 七、Ant Design Vue 组件速查表

以下列出 Ant Design Vue（v4.x）中**所有可用但未注册**的组件，按分类整理：

### 数据展示

| 组件 | 说明 | 是否有子组件 |
| --- | --- | --- |
| `Table` | 表格（列配置、排序、筛选、分页、行选择） | — |
| `Table.Column` | 表格列 | 是（Table 子组件） |
| `Table.ColumnGroup` | 表格列分组 | 是 |
| `Tree` | 树形控件 | — |
| `Tree.TreeNode` | 树节点 | 是 |
| `Tree.DirectoryTree` | 目录树 | 是 |
| `TreeSelect` | 树形选择器 | — |
| `Pagination` | 分页器 | — |
| `Tag` | 标签 | — |
| `Tag.CheckableTag` | 可勾选标签 | — |
| `Badge` | 徽标数字 | — |
| `Badge.Ribbon` | 丝带徽标 | — |
| `Avatar` | 头像 | — |
| `Avatar.Group` | 头像组 | — |
| `Descriptions` | 描述列表 | — |
| `Descriptions.Item` | 描述项 | 是 |
| `Image` | 图片 | — |
| `Image.PreviewGroup` | 图片预览组 | — |
| `QRCode` | 二维码 | — |
| `Statistic` | 统计数值 | — |
| `Statistic.Countdown` | 倒计时统计 | — |
| `Skeleton` | 骨架屏 | — |
| `Skeleton.Button` | 按钮骨架屏 | — |
| `Skeleton.Input` | 输入框骨架屏 | — |
| `Skeleton.Avatar` | 头像骨架屏 | — |
| `Skeleton.Image` | 图片骨架屏 | — |
| `Empty` | 空状态 | — |
| `Typography` | 排版 | — |
| `Typography.Title` | 标题 | — |
| `Typography.Paragraph` | 段落 | — |
| `Typography.Text` | 文本 | — |

### 反馈

| 组件                | 说明       | 是否有子组件 |
| ------------------- | ---------- | ------------ |
| `Alert`             | 警告提示   | —            |
| `Popconfirm`        | 气泡确认框 | —            |
| `Popover`           | 弹出框     | —            |
| `Tooltip`           | 文字提示   | —            |
| `Progress`          | 进度条     | —            |
| `Result`            | 结果页     | —            |
| `Drawer`            | 抽屉       | —            |
| `Tour`              | 漫游       | —            |
| `FloatButton`       | 悬浮按钮   | —            |
| `FloatButton.Group` | 悬浮按钮组 | —            |
| `BackTop`           | 返回顶部   | —            |
| `Notification`      | 通知提醒框 | —            |

### 导航

| 组件              | 说明       | 是否有子组件 |
| ----------------- | ---------- | ------------ |
| `Breadcrumb`      | 面包屑     | —            |
| `Breadcrumb.Item` | 面包屑项   | 是           |
| `Steps`           | 步骤条     | —            |
| `Steps.Step`      | 步骤       | 是           |
| `Menu`            | 导航菜单   | —            |
| `Menu.Item`       | 菜单项     | 是           |
| `Menu.SubMenu`    | 子菜单     | 是           |
| `Menu.ItemGroup`  | 菜单项组   | 是           |
| `Menu.Divider`    | 菜单分割线 | 是           |
| `Anchor`          | 锚点       | —            |
| `Anchor.Link`     | 锚点链接   | 是           |
| `PageHeader`      | 页头       | —            |

### 布局

| 组件             | 说明     | 是否有子组件 |
| ---------------- | -------- | ------------ |
| `Layout`         | 布局容器 | —            |
| `Layout.Header`  | 头部     | 是           |
| `Layout.Sider`   | 侧边栏   | 是           |
| `Layout.Content` | 内容区   | 是           |
| `Layout.Footer`  | 底部     | 是           |
| `Space`          | 间距     | —            |
| `Space.Compact`  | 紧凑间距 | —            |
| `Divider`        | 分割线   | —            |
| `Flex`           | 弹性布局 | —            |
| `Affix`          | 固钉     | —            |

### 表单增强

| 组件             | 说明       | 是否有子组件 |
| ---------------- | ---------- | ------------ |
| `Rate`           | 评分       | —            |
| `Transfer`       | 穿梭框     | —            |
| `TreeSelect`     | 树形选择   | —            |
| `AutoComplete`   | 自动完成   | —            |
| `Input.Search`   | 搜索框     | —            |
| `Input.Password` | 密码框     | —            |
| `Input.OTP`      | 验证码输入 | —            |
| `Mentions`       | 提及       | —            |
| `Segmented`      | 分段控制器 | —            |

### 其他

| 组件                | 说明        | 是否有子组件 |
| ------------------- | ----------- | ------------ |
| `Calendar`          | 日历        | —            |
| `Carousel`          | 走马灯/轮播 | —            |
| `Carousel.Item`     | 走马灯项    | 是           |
| `Comment`           | 评论        | —            |
| `Comment.Author`    | 评论作者    | 是           |
| `Comment.Content`   | 评论内容    | 是           |
| `Comment.Timestamp` | 评论时间    | 是           |
| `Comment.Actions`   | 评论操作    | 是           |
| `Watermark`         | 水印        | —            |
| `Tour`              | 漫游        | —            |
| `Tour.Step`         | 漫游步骤    | 是           |

---

## 八、实施建议

### 8.1 快速 Wins ✅（已完成）

| 组件 | 实际工作量 | 实现文件 | 要点 |
| --- | --- | --- | --- |
| **Divider** | 30 分钟 | `packages/ui/antd/src/divider/` | 无表单值（`input: false`），属性：direction、orientation、dashed、plain |
| **Link** | 30 分钟 | `packages/ui/antd/src/link/` | 无表单值（`input: false`），属性：href、target、type(default/primary/secondary) |
| **Tag** | 1 小时 | `packages/ui/antd/src/tag/` | 无表单值（`input: false`），属性：color、bordered、closable、round |
| **Alert** | 1 小时 | `packages/ui/antd/src/alert/` | 无表单值（`input: false`），属性：type、message、showIcon、closable、banner |

**代码审计结果**：

- 发现并修复 3 个问题：Link type 选项值修正（移除了不支持的 success/warning/danger）、Alert message 默认值修正（与 label 统一为「警告提示」）、Link 导入简化（直接使用 `TypographyLink`）
- TypeScript 类型检查通过

### 8.2 核心增强（待实施）

| 组件 | 预计工作量 | 要点 |
| --- | --- | --- |
| **Rate** | 2 小时 | 属性：max、allowHalf、autoFocus、character、count、disabled、tooltips |
| **Badge** | 2 小时 | 支持包裹子组件，属性：count、overflowCount、dot、status、text、color、offset |
| **Avatar** | 2 小时 | 属性：src、alt、shape、size、icon、gap |
| **Progress** | 2 小时 | 属性：type、percent、status、strokeWidth、showInfo、format |
| **Skeleton** | 2 小时 | 属性：active、avatar、paragraph、round、title |
| **Space** | 1 小时 | 容器组件，支持 children，属性：direction、align、size、wrap |

### 8.3 数据展示（1-2 周）

| 组件 | 预计工作量 | 要点 |
| --- | --- | --- |
| **Pagination** | 1 天 | 属性：current、pageSize、total、pageSizes、showSizeChanger、showQuickJumper |
| **Steps** | 2 天 | 容器组件，子组件 Step，属性：current、direction、status、type、size |
| **Breadcrumb** | 1 天 | 容器组件，子组件 BreadcrumbItem |
| **Dropdown** | 2 天 | 容器组件，子组件 Dropdown 菜单项 |
| **Descriptions** | 1 天 | 容器组件，子组件 DescriptionsItem，属性：column、border、size、title |
| **Image** | 2 天 | 属性：src、alt、width、height、previewSrcList、fallback |

### 8.4 复杂组件（2-4 周）

| 组件 | 预计工作量 | 要点 |
| --- | --- | --- |
| **TreeSelect** | 3-5 天 | 复杂属性编辑器（树形数据配置），属性：treeData、placeholder、multiple、treeCheckable |
| **Table** | 1-2 周 | 最复杂，需要列配置编辑器，支持选择、排序、筛选、分页 |
| **Transfer** | 3-5 天 | 属性：dataSource、targetKeys、render、showSearch、filterOption |
| **Tree** | 3-5 天 | 属性：treeData、checkable、defaultExpandAll、showLine |

---

## 九、技术注意事项

### 9.1 关键约定

1. **type 唯一性**：`defaultSchema.type` 必须在全局唯一
2. **懒加载**：组件必须使用 `() => import('./xxx.vue')` 懒加载
3. **v-model 处理**：Ant Design Vue 默认使用 `modelValue` / `update:modelValue`
4. **FormItem 包装**：`input: true` 的组件会被自动包装在 `FormItem` 中
5. **自动动作注入**：`input: true` 自动注入 `setValue`/`getValue`，所有组件自动注入 `setAttr`

### 9.2 容器组件约定

容器组件（如 Tabs、Card、Collapse）需要：

- 声明 `componentSchema` prop
- 提取 `children`，渲染前从 props 中删除
- 使用 `renderSlot(slots, 'edit-node')` 渲染子组件列表
- 使用 `renderSlot(slots, 'node', { componentSchema })` 传递子组件

### 9.3 属性编辑器自定义

| 编辑器类型 | 用于配置 | 示例 |
| --- | --- | --- |
| `AigenOptionsEditor` | 选项列表 | Select 的 options |
| `AigenRuleEditor` | 表单校验规则 | Input 的 rules |
| `AigenField` | 数据字段选择 | 所有表单项的 field |
| `show` 回调 | 条件显示 | `show: ({ values }) => values.props.multiple` |
| `onChange` 回调 | 联动修改 | `onChange: ({ value, values }) => { ... }` |

---

## 十、总结

### 当前状态

- Ant Design Vue 已注册 **~30 个组件**，覆盖约 **33%**
- 严重缺失：**数据展示类（Table、Tree、TreeSelect）**、**导航类（Breadcrumb、Steps、Menu）**、**反馈类（Alert、Popover、Popconfirm、Tooltip）**

### 建议优先级

1. **Phase 1（快速 wins）**：Divider、Link、Tag、Alert — 低复杂度，立竿见影
2. **Phase 2（核心增强）**：Rate、Badge、Avatar、Progress、Skeleton、Space — 中低复杂度，常用场景
3. **Phase 3（数据展示）**：Pagination、Steps、Breadcrumb、Dropdown、Descriptions — 中等复杂度
4. **Phase 4（复杂组件）**：TreeSelect、Table、Transfer、Tree — 高复杂度，但最核心

## 十、实施状态

### ✅ Phase 1 — 快速 wins（已完成）

| 组件 | 实现文件 | 分组 | 状态 |
| --- | --- | --- | --- |
| **Divider（分割线）** | `packages/ui/antd/src/divider/divider.vue` + `index.ts` | 布局 | ✅ 已完成 |
| **Link（链接）** | `packages/ui/antd/src/link/link.vue` + `index.ts` | 导航 | ✅ 已完成 |
| **Tag（标签）** | `packages/ui/antd/src/tag/tag.vue` + `index.ts` | 数据展示 | ✅ 已完成 |
| **Alert（警告提示）** | `packages/ui/antd/src/alert/alert.vue` + `index.ts` | 反馈 | ✅ 已完成 |

**实施内容**：

- 新增 4 个组件（共 8 个文件：4 个 `.vue` 包装组件 + 4 个 `index.ts` 注册配置）
- 在 `packages/ui/antd/src/index.ts` 中注册并扩展分组：
  ```typescript
  pluginManager.component.setSortedGroups([
    '表单',
    '布局',
    '数据展示',
    '反馈',
    '导航',
    '其他',
  ]);
  ```
- 代码审计：发现并修复 3 个问题（Link type 选项值修正、Alert message 默认值修正、Link 导入简化）
- TypeScript 类型检查通过

### ⏳ Phase 2 — 核心增强（待实施）

| 组件               | 预估工作量 | 说明     |
| ------------------ | ---------- | -------- |
| Rate（评分）       | 2 小时     | 表单增强 |
| Badge（徽标）      | 2 小时     | 状态展示 |
| Avatar（头像）     | 2 小时     | 用户展示 |
| Progress（进度条） | 2 小时     | 操作进度 |
| Skeleton（骨架屏） | 2 小时     | 加载状态 |
| Space（间距）      | 1 小时     | 布局辅助 |

### ⏳ Phase 3 — 数据展示（待实施）

| 组件                     | 预估工作量 | 说明           |
| ------------------------ | ---------- | -------------- |
| Pagination（分页）       | 1 天       | 表格/列表分页  |
| Steps（步骤条）          | 2 天       | 向导、流程展示 |
| Breadcrumb（面包屑）     | 1 天       | 页面导航       |
| Dropdown（下拉菜单）     | 2 天       | 操作菜单       |
| Descriptions（描述列表） | 1 天       | 键值对详情     |

### ⏳ Phase 4 — 复杂组件（待实施）

| 组件                   | 预估工作量 | 说明         |
| ---------------------- | ---------- | ------------ |
| TreeSelect（树形选择） | 3-5 天     | 层级数据选择 |
| Table（表格）          | 1-2 周     | 数据展示之王 |
| Transfer（穿梭框）     | 3-5 天     | 双向选择     |
| Tree（树形控件）       | 3-5 天     | 树形数据展示 |

---

_本文档基于 epic-designer 项目代码分析生成，分析路径：`D:\workspace\Github\epic-designer`_ _最后更新：2026-08-26（Phase 1 完成）_
