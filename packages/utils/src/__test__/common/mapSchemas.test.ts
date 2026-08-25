import type { ComponentSchema } from '@aigen-designer/types';

import { describe, expect, it } from 'vitest';

import { findSchemas, mapSchemas } from '../../';

describe('mapSchemas 函数测试', () => {
  it('应遍历并映射所有节点（含 children 与 slots）', () => {
    const schemas: ComponentSchema[] = [
      {
        id: 'root',
        type: 'page',
        children: [
          {
            id: 'form',
            type: 'form',
            children: [{ id: 'input', type: 'input', input: true }],
          },
        ],
        slots: {
          footer: [{ id: 'btn', type: 'button' }],
        },
      },
    ];

    mapSchemas(schemas, (item) => ({ ...item, mapped: true }));

    const mappedNodes = findSchemas(schemas, (item) => item.mapped === true);
    expect(mappedNodes).toHaveLength(4);
  });

  it('应使用 handler 返回值更新节点（含深层节点）', () => {
    const schemas: ComponentSchema[] = [
      {
        id: 'root',
        type: 'page',
        children: [
          {
            id: 'input',
            type: 'input',
            input: true,
            props: {},
          },
        ],
      },
    ];

    mapSchemas(schemas, (item) => ({
      ...item,
      props: { placeholder: '请输入' },
    }));

    expect(schemas[0].props).toEqual({ placeholder: '请输入' });
    expect(schemas[0].children?.[0].props).toEqual({ placeholder: '请输入' });
  });

  it('filter 返回 false 时不应映射子节点', () => {
    const schemas: ComponentSchema[] = [
      {
        id: 'root',
        type: 'page',
        children: [{ id: 'child', type: 'input', input: true }],
      },
    ];

    mapSchemas(
      schemas,
      (item) => ({ ...item, mapped: true }),
      (item) => item.type !== 'page',
    );

    expect(schemas[0].mapped).toBe(true);
    expect(schemas[0].children?.[0].mapped).toBeUndefined();
  });

  it('应原地修改并返回原数组引用', () => {
    const schemas: ComponentSchema[] = [
      { id: 'a', type: 'input', input: true },
    ];

    const result = mapSchemas(schemas, (item) => ({
      ...item,
      mapped: true,
    }));

    expect(result).toBe(schemas);
    expect(schemas[0].mapped).toBe(true);
  });

  it('handler 返回原始节点时应保持结构不变', () => {
    const schemas: ComponentSchema[] = [
      {
        id: 'root',
        type: 'page',
        children: [{ id: 'input', type: 'input', input: true }],
      },
    ];

    mapSchemas(schemas, (item) => item);

    expect(findSchemas(schemas, (item) => item.type === 'input')).toHaveLength(
      1,
    );
  });
});
