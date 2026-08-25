<script lang="ts" setup>
import type { ComponentSchema } from '@aigen-designer/types';

import { computed } from 'vue';

import { AigenIcon, AigenTree } from '@aigen-designer/base-ui';
import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';
import { findSchemaInfoById, generateNewSchema } from '@aigen-designer/utils';

const designer = useDesignerContext();
const pageSchema = designer.pageSchema;

// 计算选中节点值
const selectedKeys = computed(() => {
  const id = designer.state.selectedNode?.id;
  return id ? [id] : [];
});

// 判断组件是否有绑定事件
function hasBoundEvents(schema: any): boolean {
  if (!schema.on) return false;
  const eventKeys = Object.keys(schema.on);
  return eventKeys.some((key) => {
    const events = schema.on[key];
    return Array.isArray(events) && events.length > 0;
  });
}

// 设置选中节点
function handleNodeClick(e: any) {
  designer.setSelectedNode(e.componentSchema);
}

function handleShow(schema: ComponentSchema) {
  schema.props || (schema.props = {});
  schema.props.hidden = !schema.props.hidden;
}

function handleLock(schema: ComponentSchema) {
  schema.status || (schema.status = { lock: false });
  schema.status.lock = !schema.status.lock;
}

/**
 * 复制选中节点元素
 */
function handleCopy(schema: ComponentSchema) {
  if (!schema) return;
  const data = findSchemaInfoById(pageSchema.schemas, schema.id!);
  if (!data) {
    return false;
  }
  const { index, schema: newSchema, list } = data;
  const node = generateNewSchema(newSchema, pageSchema.schemas);
  list.splice(index + 1, 0, node);
  designer.setSelectedNode(node);

  designer.revoke.push('复制组件');
}

/**
 * 删除元素
 */
function handleDelete(schema: ComponentSchema) {
  if (!schema) return;
  const data = findSchemaInfoById(pageSchema.schemas, schema.id!);
  if (!data) {
    return false;
  }
  let { index, list } = data;
  list.splice(index, 1);
  if (index === list.length) {
    index--;
  }
  designer.setSelectedNode(list[index]);
  designer.revoke.push('删除组件');
}
</script>
<template>
  <div class="aigen-outline">
    <AigenTree
      :options="pageSchema.schemas"
      draggable
      :selected-keys="selectedKeys"
      :hover-key="designer.state.hoverNode?.id ?? ''"
      @node-click="handleNodeClick"
    >
      <template #tree-node="{ schema }">
        <div
          class="aigen-outline-item aigen-text-padding flex"
          :class="{ hidden: schema.props?.hidden }"
          @mouseenter.stop="designer.setHoverNode(schema)"
          @mouseleave.stop="designer.setHoverNode(null)"
        >
          <span class="max-w-full truncate">
            <AigenIcon
              class="aigen-component-icon translate-y-2px"
              :name="pluginManager.component.getIcon(schema.type)"
            />
            <span
              v-if="hasBoundEvents(schema)"
              class="aigen-event-badge ml-0.5"
              title="已绑定事件"
            >
              事件
            </span>
            {{ schema.label ?? pluginManager.component.getLabel(schema.type) }}
          </span>
          <span class="aigen-node-type-text w-0 flex-1 truncate">
            {{ schema.id }}
          </span>

          <!-- 组件操作 start -->
          <div
            v-if="
              !pluginManager.component.getLocked(schema) &&
              schema.id !== designer.pageSchema.schemas[0].id
            "
            class="aigen-tree-action"
            :class="{
              active: schema.props?.hidden || schema.status?.lock,
            }"
          >
            <AigenIcon
              v-if="!schema.props?.hidden"
              class="mr-2"
              :class="{ active: schema.status?.lock }"
              :name="
                schema.status?.lock
                  ? 'icon--aigen--lock-outline'
                  : 'icon--aigen--lock-open-outline'
              "
              @click="handleLock(schema)"
            />
            <AigenIcon
              v-if="!schema.status?.lock"
              class="mr-2"
              :class="{ active: schema.props?.hidden }"
              :name="
                schema.props?.hidden
                  ? 'icon--aigen--visibility-off-outline-rounded'
                  : 'icon--aigen--visibility-outline-rounded'
              "
              @click="handleShow(schema)"
            />
            <AigenIcon
              v-if="!schema.status?.lock && !schema.props?.hidden"
              class="mr-2"
              name="icon--aigen--copy-all-outline-rounded"
              @click="handleCopy(schema)"
            />
            <AigenIcon
              v-if="!schema.status?.lock && !schema.props?.hidden"
              class="mr-2"
              name="icon--aigen--delete-outline-rounded"
              @click="handleDelete(schema)"
            />
          </div>
          <!-- 组件操作 end -->
        </div>
      </template>
    </AigenTree>
  </div>
</template>
