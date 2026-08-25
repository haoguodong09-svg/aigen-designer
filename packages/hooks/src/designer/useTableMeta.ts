import type { PluginManager } from '@aigen-designer/manager';

import { computed } from 'vue';

import { ComponentSchema, TableMeta } from '@aigen-designer/types';

import { useDesignerContext } from './useDesignerContext';

export function useTableMeta(pluginManager: PluginManager) {
  const { props, state } = useDesignerContext();
  const tableMeta = computed<TableMeta | undefined>(() => {
    // 倒序遍历 designer.state.matched，找到第一个 isSubTable = true 数据
    const subTableNode = [...state.matched]
      .slice(0, -1) // 移除最后一个节点
      .reverse()
      .find((node: ComponentSchema) => {
        const config = pluginManager.component.getConfigByType(node.type);
        return config.isSubTable;
      });

    // 根据是否存在子表单节点来查找对应的数据表
    // （首行对 parent 表的赋值原为死代码，会被此处结果覆盖，已移除）
    return subTableNode
      ? props.tableJson?.find((item) => item?.tableName === subTableNode.field)
      : props.tableJson?.find((item) => item.tableType === 'parent');
  });
  return tableMeta;
}
