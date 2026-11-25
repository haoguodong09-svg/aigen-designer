import type { ComponentSchema } from '@aigen-designer/types';

import { describe, expect, it } from 'vitest';

import {
  calculatePosLine,
  insertSchema,
  isAncestor,
  isPointerOutsideElement,
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

  it('内联组件左右边缘判定与中线平分', () => {
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

    const midLeftRes = calculatePosLine(
      mockRect,
      { x: 50, y: 50 },
      { isContainer: false, isInline: true },
    );
    expect(midLeftRes.type).toBe(POSITION.LEFT);

    const midRightRes = calculatePosLine(
      mockRect,
      { x: 70, y: 50 },
      { isContainer: false, isInline: true },
    );
    expect(midRightRes.type).toBe(POSITION.RIGHT);
  });

  it('小尺寸元素采用 1/3 阈值收敛而非固定 20px，且块级非容器中心按 50% 上下平分', () => {
    const smallRect = {
      bottom: 30,
      height: 30,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
    };
    // yAbs = min(20, 30 / 3) = 10; y=12 (>10 且 <15 中心上半部) -> 块级非容器按中线判定 TOP
    expect(
      calculatePosLine(smallRect, { x: 50, y: 12 }, { isContainer: false })
        .type,
    ).toBe(POSITION.TOP);
    // y=18 (>15 中心下半部 且 <20) -> 块级非容器按中线判定 BOTTOM
    expect(
      calculatePosLine(smallRect, { x: 50, y: 18 }, { isContainer: false })
        .type,
    ).toBe(POSITION.BOTTOM);
  });

  it('onlyIn 模式在空容器边缘位置也严格返回 POSITION.IN 防止逃逸', () => {
    const emptyColRect = {
      bottom: 54,
      height: 54,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
    };
    expect(
      calculatePosLine(
        emptyColRect,
        { x: 100, y: 5 },
        { isContainer: true, onlyIn: true },
      ).type,
    ).toBe(POSITION.IN);
    expect(
      calculatePosLine(
        emptyColRect,
        { x: 100, y: 50 },
        { isContainer: true, onlyIn: true },
      ).type,
    ).toBe(POSITION.IN);
  });

  it('isPointerOutsideElement 正确区分内部子元素冒泡与真正离开边界', () => {
    const child = document.createElement('div');
    const container = document.createElement('div');
    const outside = document.createElement('div');
    container.appendChild(child);
    container.getBoundingClientRect = () =>
      ({
        bottom: 200,
        height: 200,
        left: 0,
        right: 200,
        top: 0,
        width: 200,
      }) as DOMRect;

    expect(
      isPointerOutsideElement(container, {
        clientX: 50,
        clientY: 50,
        relatedTarget: child,
      }),
    ).toBe(false);
    expect(
      isPointerOutsideElement(container, {
        clientX: 250,
        clientY: 50,
        relatedTarget: outside,
      }),
    ).toBe(true);
    expect(
      isPointerOutsideElement(container, {
        clientX: 100,
        clientY: 100,
        relatedTarget: null,
      }),
    ).toBe(false);
    expect(
      isPointerOutsideElement(container, {
        clientX: -5,
        clientY: 100,
        relatedTarget: null,
      }),
    ).toBe(true);
  });

  it('isAncestor 支持 slots 分支防环检测', () => {
    const tree = [
      {
        id: 'modal-1',
        type: 'modal',
        slots: {
          footer: [{ id: 'btn-slot', type: 'button' }],
        },
      },
    ];
    expect(isAncestor(tree, 'modal-1', 'btn-slot')).toBe(true);
    expect(isAncestor(tree, 'btn-slot', 'modal-1')).toBe(false);
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
    const tree: ComponentSchema[] = [
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
    const tree: ComponentSchema[] = [
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

  it('不存在的节点 ID 安全返回 null/false 且不抛异常', () => {
    const tree = [{ id: 'card-1', type: 'card', children: [] }];
    expect(removeSchemaById(tree, 'non-existent')).toBeNull();
    expect(
      insertSchema(
        tree,
        'non-existent',
        { id: 'x', type: 'input' },
        POSITION.TOP,
      ),
    ).toBe(false);
  });

  it('禁止在 root/page 根节点同级执行非 IN 插入', () => {
    const tree = [
      {
        id: 'root',
        type: 'page',
        children: [{ id: 'input-1', type: 'input' }],
      },
    ];
    expect(
      insertSchema(tree, 'root', { id: 'bad', type: 'input' }, POSITION.TOP),
    ).toBe(false);
    expect(
      insertSchema(tree, 'root', { id: 'bad', type: 'input' }, POSITION.BOTTOM),
    ).toBe(false);
    expect(tree.length).toBe(1);
    expect(
      insertSchema(tree, 'root', { id: 'good', type: 'input' }, POSITION.IN),
    ).toBe(true);
    expect(tree[0].children?.map((c) => c.id)).toEqual(['input-1', 'good']);
  });

  it('moveSchema 同级移动及目标不存在时原地精确回滚', () => {
    const tree = [
      {
        id: 'root',
        type: 'page',
        children: [
          {
            id: 'card-1',
            type: 'card',
            children: [
              { id: 'a', type: 'input' },
              { id: 'b', type: 'input' },
              { id: 'c', type: 'input' },
            ],
          },
        ],
      },
    ];

    // 同级向后挪动：a 移到 c 之后
    expect(moveSchema(tree, 'a', 'c', POSITION.BOTTOM)).toBe(true);
    expect(tree[0].children?.[0].children?.map((n) => n.id)).toEqual([
      'b',
      'c',
      'a',
    ]);

    // 目标无效或禁止 root 同级插入时，b 必须精准还原回 card-1 的原索引 0，绝不污染 root 数组
    expect(moveSchema(tree, 'b', 'root', POSITION.TOP)).toBe(false);
    expect(tree.length).toBe(1);
    expect(tree[0].children?.[0].children?.map((n) => n.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });
});
