<h3 align="center" style="background-image:-webkit-linear-gradient(left,#44c0fa,#c26cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">AigenDesigner</h3>


<h4 align="center">一个开箱即用的拖拽式的可视化低代码设计器</h4>

<p align="center">
  <a href="https://github.com/vuejs/core">
    <img src="https://img.shields.io/badge/vue-3.3.4-brightgreen.svg" alt="vue">
  </a>
  <a href="https://github.com/microsoft/TypeScript">
    <img src="https://img.shields.io/badge/typescript-5.1.6-blue" alt="ant-design-vue">
  </a>
  <a href="#">
    <img src="https://img.shields.io/github/license/mashape/apistatus.svg" alt="license">
  </a>
</p>


📦github仓库：[https://github.com/haoguodong09-svg/aigen-designer](https://github.com/haoguodong09-svg/aigen-designer)

> 使用必须遵守国家法律法规，⛔不允许非法项目使用，后果自负❗

## 简介

可以简称`aigen设计器`，是一个功能强大、开箱即用的拖拽式低代码设计器。它基于 Vue3 开发，兼容多套 UI 组件库，除了基础的页面设计功能，AigenDesigner 还提供了强大的扩展功能，可以让开发者根据自己的需求自由扩展和定制组件。此外，AigenDesigner使用 JSON 配置来生成页面，可帮助开发者快速生成页面，提高开发效率。它提供了两个重要组件：`EDesigner` 设计器和 `EBuilder` 生成器。


## 最新版本

[![](https://img.shields.io/npm/v/aigen-designer.svg?style=flat-square)](https://www.npmjs.com/package/aigen-designer)

[查看更新日志](./docs/updateLog.md)

#### 功能

- [x] 拖拽设计
- [x] 自定义动作栏扩展
- [x] 自定义组件扩展
- [x] 布局组件扩展
- [x] 事件扩展
- [x] 组件懒加载
- [x] 右侧栏扩展
- [x] 组件属性自定义
- [x] 支持不同 UI
- [x] 插件扩展



## 核心组件介绍

#### EDesigner 设计器

`EDesigner ` 是一个可视化设计器组件，用户可以通过拖拽组件的方式快速生成 JSON 配置。它提供了丰富的组件库和配置项，用户可以根据需要选择合适的组件并配置相应的属性、事件和动作。设计器还提供了实时预览功能，用户可以随时查看所设计页面的效果。最终，用户可以将 JSON 配置导出，用于页面的生成和修改。

#### EBuilder 生成器

`EBuilder` 是一个页面构建组件，它可以将设计器生成的 JSON 配置构建成页面，完成组件的渲染、事件绑定和数据回显等操作。

## 安装 aigen-designer

```bash
npm i aigen-designer
```

aigen-designer 目标是支持多 UI 兼容,目前支持以下 UI

- element-plus
- ant-design-vue
- naive-ui

## 选择 UI 组件库

### 选择 element-plus

安装ui框架依赖

```bash
npm i element-plus @aigen-designer/element-plus
```

main.ts 或者 main.js 引入注册组件

```javascript
// 引入aigen-designer样式
import "aigen-designer/dist/style.css";

// 引入Element plus样式
import "element-plus/dist/index.css";

import { setupElementPlus } from "@aigen-designer/element-plus";
// 注册Element UI
setupElementPlus();
```

### 选择 ant-design-vue v4.x版本（antd推荐使用v4.x版本）

安装ui框架依赖

```bash
npm i ant-design-vue @aigen-designer/antd
```

main.ts 或者 main.js 引入注册组件

```javascript
// 引入aigen-designer样式
import "aigen-designer/dist/style.css";

// 引入antd UI 重置样式
import "ant-design-vue/dist/reset.css";

import { setupAntd } from "@aigen-designer/antd";
// 使用Antd UI
setupAntd();
```

### ant-design-vue v3.x版本需要改成下面方式

  为了减少维护精力，后续开发测试主要以 v4.x版本，不再对v3.x版本进行测试，建议升级ant-design-vue到v4.x最新版本

```javascript
// 引入aigen-designer样式
import "aigen-designer/dist/style.css";

// 引入antd UI样式
import "ant-design-vue/dist/antd.css";

import { setupAntd } from "@aigen-designer/antd";
// 使用Antd UI
setupAntd();
```

### 选择 naive-ui

安装ui框架依赖

```bash
npm i -D naive-ui @aigen-designer/naive-ui
```

main.ts 或者 main.js 引入注册组件

```javascript
// 引入aigen-designer样式
import "aigen-designer/dist/style.css";

import { setupNaiveUi } from "@aigen-designer/naive-ui";
// 注册Naive Ui
setupNaiveUi();
```

## EDesigner(设计器) 基础用法

```vue
<template>
  <div class="h-full">
    <EDesigner />
  </div>
</template>
<script setup lang="ts">
import { EDesigner } from "aigen-designer";
</script>
<style>
.h-full {
  height: 100vh;
}
</style>
```
## EBuilder(生成器) 基础用法

```vue
<template>
  <div>
    <EBuilder :pageSchema="pageSchema" />
  </div>
</template>
<script setup>
import { EBuilder } from "aigen-designer";

const pageSchema = {
  schemas: [
    {
      type: "page",
      id: "root",
      children: [
        {
          label: "输入框",
          type: "input",
          field: "input",
          icon: "aigen-icon-write",
          input: true,
          props: {
            defaultValue: "",
            placeholder: "请输入",
            size: "default",
            type: "text",
          },
          id: "gbm1xhrrj5s00",
        },
      ],
    },
  ],
};
</script>
```

