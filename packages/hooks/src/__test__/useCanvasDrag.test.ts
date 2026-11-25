import type { ComponentSchema } from '@aigen-designer/types';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { POSITION } from '@aigen-designer/utils';

import { createCanvasDrag } from '../designer/useCanvasDrag';

describe('useCanvasDrag 状态机与平滑滚动', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleSchemas: ComponentSchema[] = [
    {
      id: 'root',
      type: 'page',
      children: [
        {
          id: 'card-1',
          type: 'card',
          children: [{ id: 'input-1', type: 'input' }],
        },
        {
          id: 'col-empty',
          type: 'col',
          children: [],
        },
      ],
    },
  ];

  const baseRect = {
    bottom: 100,
    height: 100,
    left: 0,
    right: 200,
    top: 0,
    width: 200,
  };

  it('startDrag / updateDragOver / clearDragOver / endDrag 完整生命周期', () => {
    const canvasDrag = createCanvasDrag();

    // 未开始拖拽前忽略 updateDragOver
    canvasDrag.updateDragOver(
      'input-1',
      baseRect,
      { x: 50, y: 10 },
      { isContainer: false, schemas: sampleSchemas },
    );
    expect(canvasDrag.lineState.id).toBe('');

    // 新组件拖入
    canvasDrag.startDrag({ id: 'tpl', type: 'button' }, 'new');
    expect(canvasDrag.isDragging.value).toBe(true);

    // onlyIn 空容器边缘强制 IN
    canvasDrag.updateDragOver(
      'col-empty',
      baseRect,
      { x: 50, y: 5 },
      {
        componentName: '栅格列',
        isContainer: true,
        onlyIn: true,
        schemas: sampleSchemas,
      },
    );
    expect(canvasDrag.lineState.id).toBe('col-empty');
    expect(canvasDrag.lineState.position).toBe(POSITION.IN);
    expect(canvasDrag.lineState.forbidden).toBe(false);
    expect(canvasDrag.lineState.componentName).toBe('栅格列');

    // 清理指示线
    canvasDrag.clearDragOver();
    expect(canvasDrag.lineState.id).toBe('');
    expect(canvasDrag.lineState.position).toBe('');

    // 重新计算并结束拖拽
    canvasDrag.updateDragOver(
      'input-1',
      baseRect,
      { x: 50, y: 90 },
      { isContainer: false, schemas: sampleSchemas },
    );
    const ended = canvasDrag.endDrag();
    expect(ended.dragType).toBe('new');
    expect(ended.lineState.id).toBe('input-1');
    expect(ended.lineState.position).toBe(POSITION.BOTTOM);
    expect(canvasDrag.isDragging.value).toBe(false);
    expect(canvasDrag.lineState.id).toBe('');
  });

  it('move 拖拽触发防环检测并将 forbidden 置为 true', () => {
    const canvasDrag = createCanvasDrag();
    canvasDrag.startDrag({ id: 'card-1', type: 'card', children: [] }, 'move');

    canvasDrag.updateDragOver(
      'input-1',
      baseRect,
      { x: 50, y: 50 },
      { isContainer: false, schemas: sampleSchemas },
    );
    expect(canvasDrag.lineState.forbidden).toBe(true);

    canvasDrag.updateDragOver(
      'col-empty',
      baseRect,
      { x: 50, y: 50 },
      { isContainer: true, onlyIn: true, schemas: sampleSchemas },
    );
    expect(canvasDrag.lineState.forbidden).toBe(false);
  });

  it('startSmoothScroll 支持运行中切换滚动方向且 stopSmoothScroll 彻底停止', () => {
    vi.useFakeTimers();
    const canvasDrag = createCanvasDrag();
    const el = { scrollTop: 100 } as HTMLElement;

    canvasDrag.startSmoothScroll(el, 'down', 20);
    vi.advanceTimersByTime(80);
    expect(el.scrollTop).toBe(140);

    // 直接切换为向上滚动（无需先手动 stop）
    canvasDrag.startSmoothScroll(el, 'up', 15);
    vi.advanceTimersByTime(80);
    expect(el.scrollTop).toBe(110);

    canvasDrag.stopSmoothScroll();
    vi.advanceTimersByTime(120);
    expect(el.scrollTop).toBe(110);
  });
});
