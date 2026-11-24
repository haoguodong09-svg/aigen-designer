import { describe, expect, it } from 'vitest';

import {
  calculatePosLine,
  insertSchema,
  isAncestor,
  moveSchema,
  POSITION,
  removeSchemaById,
} from '../../common';

describe('dragCollision 几何碰撞与防环算法', () => {
  const mockRect = {
    bottom: 100,
    height: 100,
    left: 10,
    right: 110,
    top: 0,
    width: 100,
  };

  it('顶部区域判定 (< 20px 或 1/3)', () => {
    const res = calculatePosLine(
      mockRect,
      { x: 50, y: 15 },
      { isContainer: false },
    );
    expect(res.type).toBe(POSITION.TOP);
  });

  it('底部区域判定 (> 80px)', () => {
    const res = calculatePosLine(
      mockRect,
      { x: 50, y: 85 },
      { isContainer: false },
    );
    expect(res.type).toBe(POSITION.BOTTOM);
  });

  it('容器中心区域判定为 POSITION.IN', () => {
    const res = calculatePosLine(
      mockRect,
      { x: 50, y: 50 },
      { isContainer: true },
    );
    expect(res.type).toBe(POSITION.IN);
  });

  it('内联组件左右边缘判定', () => {
    const leftRes = calculatePosLine(
      mockRect,
      { x: 20, y: 50 },
      { isContainer: false, isInline: true },
    );
    expect(leftRes.type).toBe(POSITION.LEFT);

    const rightRes = calculatePosLine(
      mockRect,
      { x: 100, y: 50 },
      { isContainer: false, isInline: true },
    );
    expect(rightRes.type).toBe(POSITION.RIGHT);
  });

  it('isAncestor 防环死锁检测', () => {
    const tree = [
      {
        id: 'card-1',
        type: 'card',
        children: [
          {
            id: 'row-1',
            type: 'row',
            children: [
              {
                id: 'btn-1',
                type: 'button',
              },
            ],
          },
        ],
      },
      {
        id: 'input-1',
        type: 'input',
      },
    ];

    // card-1 是 row-1 和 btn-1 的祖先
    expect(isAncestor(tree, 'card-1', 'row-1')).toBe(true);
    expect(isAncestor(tree, 'card-1', 'btn-1')).toBe(true);

    // 自身是自身的祖先（禁止拖入自身）
    expect(isAncestor(tree, 'card-1', 'card-1')).toBe(true);

    // btn-1 不是 card-1 的祖先
    expect(isAncestor(tree, 'btn-1', 'card-1')).toBe(false);

    // input-1 不是 card-1 的祖先
    expect(isAncestor(tree, 'input-1', 'card-1')).toBe(false);
  });
});

describe('schemaOperations 原子化 Schema 操作', () => {
  it('removeSchemaById 正常移除节点', () => {
    const tree = [
      {
        id: 'card-1',
        type: 'card',
        children: [
          { id: 'btn-1', type: 'button' },
          { id: 'btn-2', type: 'button' },
        ],
      },
    ];

    const removed = removeSchemaById(tree, 'btn-1');
    expect(removed?.id).toBe('btn-1');
    expect(tree[0].children?.length).toBe(1);
    expect(tree[0].children?.[0].id).toBe('btn-2');
  });

  it('insertSchema 插入 POSITION.IN', () => {
    const tree = [
      {
        id: 'card-1',
        type: 'card',
        children: [],
      },
    ];

    const success = insertSchema(
      tree,
      'card-1',
      { id: 'new-input', type: 'input' },
      POSITION.IN,
    );
    expect(success).toBe(true);
    expect(tree[0].children?.length).toBe(1);
    expect(tree[0].children?.[0].id).toBe('new-input');
  });

  it('insertSchema 插入 POSITION.TOP 与 POSITION.BOTTOM', () => {
    const tree = [
      { id: 'item-1', type: 'input' },
      { id: 'item-2', type: 'input' },
    ];

    insertSchema(
      tree,
      'item-2',
      { id: 'item-before', type: 'input' },
      POSITION.TOP,
    );
    expect(tree.map((t) => t.id)).toEqual(['item-1', 'item-before', 'item-2']);

    insertSchema(
      tree,
      'item-1',
      { id: 'item-after', type: 'input' },
      POSITION.BOTTOM,
    );
    expect(tree.map((t) => t.id)).toEqual([
      'item-1',
      'item-after',
      'item-before',
      'item-2',
    ]);
  });

  it('moveSchema 跨层级移动与防环死锁拦截', () => {
    const tree = [
      {
        id: 'card-1',
        type: 'card',
        children: [{ id: 'row-1', type: 'row', children: [] }],
      },
      { id: 'btn-outer', type: 'button' },
    ];

    // 正常移动：外部按钮移入 row-1
    const moveRes = moveSchema(tree, 'btn-outer', 'row-1', POSITION.IN);
    expect(moveRes).toBe(true);
    expect(tree.length).toBe(1);
    expect(tree[0].children?.[0].children?.length).toBe(1);
    expect(tree[0].children?.[0].children?.[0].id).toBe('btn-outer');

    // 非法移动：试图把外层 card-1 移入其子级 row-1
    const illegalMove = moveSchema(tree, 'card-1', 'row-1', POSITION.IN);
    expect(illegalMove).toBe(false);
    // tree 保持不变
    expect(tree[0].id).toBe('card-1');
  });
});
