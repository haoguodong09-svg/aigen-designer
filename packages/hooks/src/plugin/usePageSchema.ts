import type { ComponentSchema } from '@aigen-designer/types';

import { reactive, shallowRef, triggerRef } from 'vue';

import { PageSchema } from '@aigen-designer/types';
import { deepClone, deepCompareAndModify } from '@aigen-designer/utils';

// 兼容旧数据的映射关系
const legacyModeMap = {
  mobile: 'mobile',
  pad: 'tablet',
  pc: 'desktop',
} as const;

/**
 * 迁移旧的 canvas mode 数据
 * @param schema 页面数据
 * @returns 迁移后的页面数据
 */
function migrateCanvasMode(schema: PageSchema): PageSchema {
  if (schema.canvas?.mode && schema.canvas.mode in legacyModeMap) {
    const newMode =
      legacyModeMap[schema.canvas.mode as keyof typeof legacyModeMap];
    return {
      ...schema,
      canvas: {
        ...schema.canvas,
        mode: newMode,
      },
    };
  }
  return schema;
}

// 内部默认页面数据
const innerDefaultSchema: PageSchema = {
  schemas: [],
  script: `const { defineExpose, find } = aigen;
  
  function test (){
      console.log('test')
  }
  
  // 通过defineExpose暴露的函数或者属性
  defineExpose({
   test
  })`,
};

export function usePageSchema() {
  // 性能优化（性能文档 P-W7）：使用 shallowRef 存储整份页面数据，避免对整棵 schema 树
  // 做深度代理产生大量 Proxy 对象。
  // 对外暴露的 pageSchema 保持原有的对象形态（pageSchema.schemas / pageSchema.script /
  // pageSchema.canvas 等访问方式不变），通过响应式访问器把读写委托给内部的 shallowRef：
  // - 读取对象/数组字段时由 Vue 的 reactive 包装返回深度响应式值，消费方的就地修改
  //   （如 list.splice / deepCompareAndModify）仍然可追踪；
  // - 写入字段时先就地同步到既有响应式包装，再通过 triggerRef 手动触发更新，
  //   保证已订阅的模板/监听/撤销重做能收到更新。
  // 说明：若需彻底消除 schema 树的深层 Proxy，需各消费方整体迁移为「整份替换 + 手动
  // trigger」模式（涉及 core/manager 多处文件，需与 W6/W5 协调，见性能文档 P-W7）。
  const schemaRef = shallowRef<PageSchema>({
    schemas: [],
    script: innerDefaultSchema.script,
  });

  /**
   * 同步 schema 字段。
   * 对象/数组字段复用既有响应式包装并就地同步（避免替换引用导致已订阅的模板/监听
   * 收不到更新），标量字段直接替换；最后手动触发 shallowRef 更新。
   */
  function syncSchemaField(
    key: 'canvas' | 'schemas' | 'script',
    value: unknown,
  ) {
    const raw = schemaRef.value;
    const prev = raw[key];
    if (
      prev !== null &&
      typeof prev === 'object' &&
      value !== null &&
      typeof value === 'object'
    ) {
      deepCompareAndModify(reactive(prev), value as object);
    } else {
      (raw as unknown as Record<string, unknown>)[key] = value;
    }
    triggerRef(schemaRef);
  }

  // 对外暴露的 pageSchema：保持 pageSchema.schemas / pageSchema.script / pageSchema.canvas
  // 访问方式与行为不变（详见上方说明）
  const pageSchema = reactive<PageSchema>({
    get canvas() {
      return schemaRef.value.canvas;
    },
    set canvas(value) {
      syncSchemaField('canvas', value);
    },
    get schemas(): ComponentSchema[] {
      return schemaRef.value.schemas;
    },
    set schemas(value: ComponentSchema[]) {
      syncSchemaField('schemas', value);
    },
    get script(): string | undefined {
      return schemaRef.value.script;
    },
    set script(value: string | undefined) {
      syncSchemaField('script', value);
    },
  });

  function setPageSchema(schema: PageSchema) {
    // 先迁移旧的 canvas mode 数据
    const migratedSchema = migrateCanvasMode(schema);
    // 通过深度响应式包装就地同步整份数据（复用既有响应式包装，保证已订阅的消费方
    // 能收到更新），再手动触发 shallowRef 更新
    deepCompareAndModify(reactive(schemaRef.value), deepClone(migratedSchema));
    triggerRef(schemaRef);
  }

  return {
    pageSchema,
    setPageSchema,
  };
}
