<script lang="ts" setup>
import { computed, PropType, ref, toRaw, watch } from 'vue';

import {
  AigenCollapse,
  AigenCollapsePanel,
  AigenIcon,
} from '@aigen-designer/base-ui';
import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';

import { getActionSummaryText } from '../ActionSummary/actionSummary';
import AigenActionEditorItem from './src/AigenActionEditorItem.vue';

const props = defineProps({
  eventList: {
    default: () => [],
    type: Array as PropType<any>,
  },
  modelValue: {
    default: () => ({}),
    type: Object as PropType<any>,
  },
});

const emit = defineEmits(['update:modelValue']);

const { pageSchema } = useDesignerContext();

// WP2 提供的动作配置向导抽屉（注册名 aigenActionDrawer，API 与旧 aigenActionModal 一致：
// expose handleOpen/handleOpenEdit，emit add/edit，payload 为动作对象）
const aigenActionDrawer = pluginManager.component.get('aigenActionDrawer');

const aigenActionDrawerRef = ref<any>(null);
let editIndex = 0;
const modelValueComputed = computed({
  get() {
    return props.modelValue;
  },
  set(value) {
    emit('update:modelValue', value);
  },
});
const activeNames = ref<string[]>([]);

// 顶部搜索关键字：按事件名（businessName/description）、动作摘要、目标组件 label 过滤动作行
const keyword = ref('');

/**
 * 事件名是否命中关键字（业务化命名 / 描述 / 兼容旧字段 describe）
 */
function isEventMatched(event: any, normalizedKeyword: string): boolean {
  const name = [event.businessName, event.describe, event.description]
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    .join(' ');
  return name.toLowerCase().includes(normalizedKeyword);
}

/**
 * 动作是否命中关键字（动作摘要文本，含目标组件 label 与表达式内容）
 */
function isActionMatched(action: any, normalizedKeyword: string): boolean {
  return getActionSummaryText(action, pageSchema)
    .toLowerCase()
    .includes(normalizedKeyword);
}

// 过滤无事件 + 关键字过滤（搜索状态仅保留命中事件；事件内动作行由 AigenActionEditorItem 过滤）
const filterEventList = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();
  return props.eventList
    .filter((item: any) => item.events.length)
    .map((item: any) => {
      if (!normalizedKeyword) return item;
      const events = item.events.filter((event: any) => {
        if (isEventMatched(event, normalizedKeyword)) return true;
        const actions = modelValueComputed.value?.[event.type] ?? [];
        return actions.some((action: any) =>
          isActionMatched(action, normalizedKeyword),
        );
      });
      return { ...item, events };
    })
    .filter((item: any) => item.events.length > 0);
});

const allEvents = computed(() => {
  return props.eventList.flatMap((item: { events: any }) => item.events);
});

const events = ref<any>({});

allEvents.value.forEach((item: any) => {
  events.value[item.type] = computed({
    get() {
      return modelValueComputed.value?.[item.type] ?? [];
    },
    set(e) {
      if (e && e.length > 0) {
        modelValueComputed.value[item.type] = e.map((item: any) => toRaw(item));
      } else {
        // 事件动作为空时，则清除该事件列表
        delete modelValueComputed.value[item.type];
      }
    },
  });
});

// 有动作的事件组自动展开；「组件事件」「页面级生命周期」默认展开（B2.1）
watch(
  () => filterEventList.value,
  (e) => {
    if (e.length > 0) {
      const normalizedKeyword = keyword.value.trim().toLowerCase();
      // 搜索状态下展开所有命中的分组，便于查看结果
      if (normalizedKeyword) {
        activeNames.value = e.map((item: any) => item.title);
        return;
      }
      activeNames.value = e
        .filter((item: any) => {
          // 默认展开的分组
          if (item.defaultExpanded) return true;
          // 有动作的事件组自动展开
          for (let i = 0; i < item.events.length; i++) {
            const type = item.events[i].type;
            if ((events.value[type]?.length ?? 0) > 0) {
              return true;
            }
          }
          return false;
        })
        .map((item: any) => item.title);
    }
  },
  {
    immediate: true,
  },
);

let currentType: string = '';
/**
 * 打开动作配置抽屉（新增）
 * @param type 事件类型
 */
function handleOpen(type: string) {
  aigenActionDrawerRef.value?.handleOpen();
  currentType = type;
}

/**
 * 打开动作配置抽屉（编辑）
 * @param index 要编辑动作的索引
 * @param type 事件类型
 * @param action 要编辑的动作
 */
function handleOpenEdit(index: number, type: string, action: any) {
  aigenActionDrawerRef.value?.handleOpenEdit(action);
  editIndex = index;
  currentType = type;
}

/**
 * 编辑动作
 * @param action 编辑后的动作数据
 */
function handleEdit(action: any) {
  events.value[currentType][editIndex] = action;
  modelValueComputed.value[currentType] = [
    ...(events.value[currentType] ?? []),
  ];
}

/**
 * 添加动作
 * @param action 新增的动作数据
 */
function handleAdd(action: any) {
  modelValueComputed.value = {
    ...modelValueComputed.value,
    [currentType]: [...(events.value[currentType] || []), action],
  };
}

/**
 * 分组动作总数（徽标展示）
 * @param group 事件分组
 */
function getGroupActionCount(group: any): number {
  let count = 0;
  for (const event of group.events) {
    const list = modelValueComputed.value?.[event.type];
    if (Array.isArray(list)) {
      count += list.length;
    }
  }
  return count;
}

/**
 * 暴露给外部（event.vue 空状态引导）的添加入口
 * @param type 事件类型
 */
function openAdd(type: string) {
  handleOpen(type);
}

defineExpose({
  openAdd,
});
</script>

<template>
  <div class="aigen-action-editor">
    <!-- 顶部搜索框 -->
    <div class="aigen-action-editor__search">
      <AigenIcon
        class="aigen-action-editor__search-icon"
        name="icon--aigen--search-rounded"
      />
      <input
        v-model="keyword"
        class="aigen-action-editor__search-input"
        type="text"
        placeholder="搜索事件名 / 动作摘要 / 目标组件"
      />
    </div>

    <AigenCollapse v-model="activeNames">
      <AigenCollapsePanel
        v-for="item in filterEventList"
        :key="item.title"
        :name="item.title"
        :title="item.title"
      >
        <template #header>
          <div class="aigen-group-header">
            <div class="aigen-group-header__title">
              <span>{{ item.title }}</span>
              <span
                v-if="getGroupActionCount(item) > 0"
                class="aigen-group-badge"
              >
                {{ getGroupActionCount(item) }}
              </span>
            </div>
            <div v-if="item.description" class="aigen-group-header__desc">
              {{ item.description }}
            </div>
          </div>
        </template>
        <div class="p-2 pt-0">
          <AigenActionEditorItem
            v-model="modelValueComputed"
            :all-events="allEvents"
            :events="events"
            :item-events="item.events"
            :keyword="keyword"
            @add="handleOpen"
            @edit="handleOpenEdit"
          />
        </div>
      </AigenCollapsePanel>
    </AigenCollapse>
    <aigenActionDrawer
      ref="aigenActionDrawerRef"
      @add="handleAdd"
      @edit="handleEdit"
    />
  </div>
</template>

<style scoped>
.aigen-action-editor__search {
  display: flex;
  align-items: center;
  margin: 0 12px 8px;
  padding: 0 8px;
  border: 1px solid var(--aigen-border);
  border-radius: var(--aigen-radius);
  background-color: var(--aigen-background);

  &:focus-within {
    border-color: var(--aigen-primary);
  }
}

.aigen-action-editor__search-icon {
  display: flex;
  align-items: center;
  margin-right: 6px;
  color: var(--aigen-text-helper);
  font-size: 14px;
}

.aigen-action-editor__search-input {
  width: 100%;
  height: 28px;
  border: none;
  outline: none;
  color: var(--aigen-text-main);
  background-color: transparent;
  font-size: var(--aigen-text-sm);

  &::placeholder {
    color: var(--aigen-text-helper);
  }
}

/* 分组头部：标题 + 动作数徽标 + 解释文案 */
.aigen-group-header {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.aigen-group-header__title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--aigen-text-main);
  font-size: var(--aigen-text-md);
  font-weight: 500;
}

.aigen-group-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  border-radius: 8px;
  color: var(--aigen-primary);
  background-color: var(--aigen-primary-faded);
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
}

.aigen-group-header__desc {
  overflow: hidden;
  color: var(--aigen-text-helper);
  font-size: 11px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
