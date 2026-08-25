# 组件扩展

:::tip 组件扩展 `pluginManager` 提供了register方法添加组件，使您可以轻松扩展设计器的组件库。:::

参考demo仓库： [https://github.com/haoguodong09-svg/aigen-designer/tree/develop/examples](https://github.com/haoguodong09-svg/aigen-designer/tree/develop/examples)

## 组件注册示例

在src目录下新建designer-extensions 文件目录，下面是一个简单扩展示例

### 1. 新建组件文件

#### 新建 designer-extensions/test/index.vue（组件）

```vue
<template>
  <div class="test-component">
    <h3>{{ label }}</h3>
    <p>我是扩展的组件</p>
    <button @click="handleClick">点击我</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();

const handleClick = () => {
  emit('click');
};
</script>

<style scoped>
.test-component {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #f9f9f9;
}

h3 {
  margin-top: 0;
  color: #333;
}

button {
  margin-top: 12px;
  padding: 8px 16px;
  background-color: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #66b1ff;
}
</style>
```

### 2. 新建组件配置文件

#### 新建designer-extensions/test/index.ts(组件配置文件)

[ComponentConfigModel 配置字段类型](#componentconfigmodel-类型及字段注释)

```ts
import { type ComponentConfigModel } from 'aigen-designer';

export default {
  component: async () => await import('./index.vue'),
  groupName: '自定义组件',
  icon: 'aigen-icon-write',
  defaultSchema: {
    label: '测试扩展组件',
    type: 'test',
    props: {
      label: '测试组件',
    },
  },
  config: {
    attribute: [
      {
        label: '组件标题',
        type: 'input',
        field: 'label',
        value: '测试组件',
      },
    ],
    event: [
      {
        type: 'click',
        description: '点击按钮时触发',
      },
    ],
    style: [
      {
        label: '背景颜色',
        type: 'color',
        field: 'backgroundColor',
        value: '#f9f9f9',
      },
      {
        label: '边框颜色',
        type: 'color',
        field: 'borderColor',
        value: '#e0e0e0',
      },
    ],
  },
} as ComponentConfigModel;
```

### 3. 新建扩展入口文件

#### 新建designer-extensions/index.ts(扩展函数)

```ts
import { pluginManager } from 'aigen-designer';
import Test from './test';

// 安装扩展
export function setupDesignerExtensions(): void {
  // 注册组件
  pluginManager.component.register(Test);
}
```

### 4. 在应用入口文件中执行扩展函数

#### main.ts 添加执行扩展函数

```ts
import { setupDesignerExtensions } from './designer-extensions';

// 执行扩展函数
setupDesignerExtensions();
```

## 注册函数说明

类型：`(componentConfig: ComponentConfigModel) => void`

说明：注册组件到插件管理器中

### 参数详情

- `componentConfig`: 组件配置对象，包含以下属性：
  - `component`: 组件本身，可以是Vue组件、异步组件加载函数或字符串组件名
  - `bindModel`: 输入表单组件v-model绑定变量名称，默认 `modelValue`
  - `groupName`: 分组名称（组件分组），不设置分组时仅注册，但不会显示在组件列表中，可选
  - `icon`: 组件图标，可选
  - `sort`: 用于组件排序，可选 默认值1000, 值越小，组件越靠前
  - `defaultSchema`: 默认组件结构数据，用于拖入画布时的初始数据
  - `editConstraints`: 设计编辑约束，用于限制组件在设计器中的操作
  - `config`: 组件配置，包含属性编辑、事件、样式和可执行函数等
    - `attribute`: 属性编辑列表，用于在属性面板中配置组件属性
    - `event`: 可触发事件列表，用于在行为（事件）面板中配置组件事件，每项包含：
      - `type`: 事件技术名（如 `change`、`click`）
      - `description`: 事件人话描述（如「值改变时触发」），用于面板展示
      - `businessName`: 业务化命名（人话），可选，用于行为面板中事件分组的人话展示，缺省时回退使用 `description`
    - `style`: 样式编辑组件列表，用于在样式面板中配置组件样式
    - `action`: 可执行函数列表，用于在动作面板中配置组件的可执行函数，每项包含：
      - `type`: 方法技术名（如 `setValue`）
      - `description` / `describe`: 方法人话说明，用于动作配置向导中方法列表的展示（`describe` 为旧字段，仅用于兼容旧版，请优先使用 `description`）
      - `args`: 参数默认值列表，可选
      - `argsConfigs`: 参数表单配置（`ComponentSchema[]`），可选，按参数顺序与 `args` 对应，用于动作配置向导的参数表单渲染

:::tip 关于 businessName 组件事件（`config.event`）支持可选字段 `businessName`（业务化命名），用于行为面板中事件分组的人话展示，缺省时回退使用 `description`：

```ts
{
  description: '输入值时',
  type: 'input',
  businessName: '输入时'
}
```

:::

### 示例

```ts
import { pluginManager, type ComponentConfigModel } from 'aigen-designer';

const Test = {
  // 组件，可以是异步加载函数
  component: () => import('./cmp.vue'),
  // v-model绑定变量名称，默认modelValue
  bindModel: 'value',
  // 分组名称，组件会显示在该分组下
  groupName: '自定义组件',
  // 组件图标
  icon: 'aigen-icon-write',
  // 组件排序，值越小越靠前
  sort: 900,
  // 默认组件结构数据
  defaultSchema: {
    label: '测试扩展组件',
    type: 'test',
    props: {
      // 组件默认属性
      label: '测试组件',
      value: '',
    },
  },
  // 设计编辑约束
  editConstraints: {
    // 当前组件是否固定不可拖动
    immovable: false,
    // 子节点是否固定不可拖动
    childImmovable: false,
    // 表单字段是否固定 不添加随机UUID
    fixedField: false,
    // 组件锁定，不可编辑，不可选中，不可复制删除
    locked: false,
  },
  // 组件配置
  config: {
    // 属性编辑列表
    attribute: [
      {
        label: '属性1',
        type: 'input',
        field: 'name',
        // 属性默认值
        value: '默认值',
      },
      {
        label: '属性2',
        type: 'select',
        field: 'type',
        options: [
          { label: '选项1', value: 'option1' },
          { label: '选项2', value: 'option2' },
        ],
      },
    ],
    // 事件列表
    event: [
      {
        type: 'change',
        description: '值改变时触发',
        // 业务化命名（可选），行为面板中人话展示，缺省回退 description
        businessName: '值变化时',
      },
      {
        type: 'click',
        description: '点击时触发',
        businessName: '点击时',
      },
    ],
    // 样式编辑列表
    style: [
      {
        label: '宽度',
        type: 'input',
        field: 'width',
        value: '100%',
      },
      {
        label: '高度',
        type: 'input',
        field: 'height',
        value: '40px',
      },
    ],
    // 可执行函数列表
    action: [
      {
        type: 'reset',
        // 方法人话说明，用于动作配置向导中方法列表展示（describe 为旧字段，请优先使用 description）
        description: '重置组件',
        // 参数默认值列表（可选）
        args: ['参数1', '参数2'],
        // 参数表单配置（可选），按参数顺序与 args 对应，渲染在动作配置向导的参数步骤
        argsConfigs: [
          {
            label: '参数1',
            type: 'input',
            field: 'arg1',
          },
          {
            label: '参数2',
            type: 'input',
            field: 'arg2',
          },
        ],
      },
    ],
  },
};

// 注册组件
pluginManager.component.register(Test);
```

## ComponentConfigModel 类型及字段注释

```typescript
export interface EditConstraintsModel {
  // 当前组件是否固定不可拖动，可选
  immovable?: boolean;
  // 子节点是否固定不可拖动,只控制下一级，可选
  childImmovable?: boolean;
  // 表单字段是否固定 不添加随机UUID
  fixedField?: boolean;
  // 组件锁定，不可编辑，不可选中，不可复制删除
  locked?: boolean;
}

export interface EventModel {
  // 业务化命名（人话，行为面板事件分组展示用），可选；缺省时回退使用 description
  businessName?: string;
  // 事件人话描述，用于行为面板展示
  description: string;
  // 事件技术名，如 change / click
  type: string;
}

export interface ActionModel extends EventModel {
  // 参数默认值列表，可选
  args?: unknown[];
  // 参数表单配置（可选），按参数顺序与 args 对应，用于动作配置向导的参数表单渲染
  argsConfigs?: ComponentSchema[];
}

export interface ComponentConfigModel {
  // 组件
  component: any;
  // 分组名称（组件分组），不设置分组时仅注册，但不会显示在组件列表中，可选
  groupName?: string;
  // 组件图标
  icon?: string;
  // 默认组件结构数据
  defaultSchema: ComponentSchema;
  // 设计编辑约束
  editConstraints?: EditConstraintsModel;
  // 配置
  config: {
    // 属性编辑列表
    attribute?: ComponentSchema[];
    // 样式编辑组件列表
    style?: ComponentSchema[];
    // 可触发事件
    event?: EventModel[];
    // 可执行函数
    action?: ActionModel[];
  };
  // 输入表单组件v-model绑定变量名称 默认 modelValue
  bindModel?: string;
  // 用于组件排序，可选 默认值1000, 值越小，组件越靠前
  sort?: number;
}
```

## 生命周期事件

:::tip 生命周期事件除组件自身注册的 `config.event` 外，所有组件还内置了一组**生命周期事件**（技术名直接取自 Vue 组件生命周期）。行为面板中它们被**业务化命名**（人话）展示并分组：**页面级生命周期**（1 个）与**组件级生命周期**（7 个，按 挂载/更新/卸载/错误 子分组）；技术名仅在「高级/源码」模式展示，且始终伴随人话解释。:::

| 技术名（旧事件名） | 业务化命名（人话） | 触发时机 | 典型用途 |
| --- | --- | --- | --- |
| `aigenReady` | 页面加载完成 | 首屏全部组件挂载后触发一次 | 初始化默认值、拉取首屏数据、初始跳转 |
| `vnodeMounted` | 组件挂载完成 | 当前组件完成首次渲染后触发 | 组件自身初始化、加载选项数据 |
| `vnodeBeforeMount` | 组件挂载前 | 组件即将渲染到页面之前 | 预置初始属性/状态 |
| `vnodeUpdated` | 组件更新完成 | 当前组件的属性或数据更新之后触发 | 值变化的后续处理（简单场景建议优先用对应业务事件，如 `change`） |
| `vnodeBeforeUpdate` | 组件更新前 | 更新发生之前 | 记录旧值、拦截更新 |
| `vnodeUnmounted` | 组件卸载完成 | 组件从页面移除后触发 | 清理定时器、解绑订阅 |
| `vnodeBeforeUnmount` | 组件卸载前 | 组件即将被移除之前 | 释放资源、确认离开 |
| `vnodeErrorCaptured` | 组件错误捕获 | 组件内部渲染或运行出错时 | 错误提示、降级显示 |

> 以上 8 个生命周期事件对所有组件均可用，无需在 `config.event` 中重复声明；行为面板会自动按上述分组与命名展示。

## 组件扩展最佳实践

### 组件设计原则

- **单一职责**：每个组件应专注于一个特定功能
- **可配置性**：通过属性面板提供足够的配置选项
- **响应式**：确保组件在不同尺寸和状态下都能正常显示

### 配置文件最佳实践

- **合理分组**：使用 `groupName` 将组件归类到合适的分组中
- **图标选择**：为组件选择合适的图标，提高用户体验
- **默认值设置**：为组件属性设置合理的默认值，减少用户配置成本
- **排序优化**：使用 `sort` 属性调整组件在列表中的位置，将常用组件放在前面

### 高级扩展技巧

- **组件嵌套**：支持子组件的组件可以在 `defaultSchema` 中定义子节点
- **动态属性**：根据其他属性的值动态调整属性面板的显示内容
- **自定义编辑约束**：使用 `editConstraints` 限制组件的操作权限，提高设计器的易用性

### 常见问题及解决方案

#### Q: 组件不显示在组件列表中

**A:** 检查是否设置了 `groupName` 属性，只有设置了分组名称的组件才会显示在组件列表中。

#### Q: 组件属性面板不显示

**A:** 检查 `config.attribute` 是否正确配置，确保每个属性都有 `label`、`type` 和 `field` 字段。

#### Q: 组件事件不触发

**A:** 确保在组件中正确定义了事件，并在 `config.event` 中注册了相应的事件类型。

---

组件扩展是 aigen-designer 的强大特性，它允许您根据业务需求自定义组件库。通过遵循本文档的最佳实践，您可以创建高质量、易用的扩展组件，丰富设计器的功能，满足各种复杂的业务场景需求。

如果您在组件扩展过程中遇到问题，可以参考 demo 仓库或提交 issue 寻求帮助。
