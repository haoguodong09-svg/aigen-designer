import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignerState } from '@aigen-designer/types';

import { useRevoke } from '../../';

describe('防抖竞态', () => {
  const mockState: DesignerState = { disabledHover: false, hoverNode: null, matched: [], selectedNode: null };
  const mockSetSelectedNode = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('防抖未触发时立即撤销，随后防抖回调触发不应损坏历史链', () => {
    const pageSchema: any = { schemas: [] };
    const revoke = useRevoke(pageSchema, mockState, mockSetSelectedNode);

    revoke.push('初始化');
    vi.advanceTimersByTime(200);
    pageSchema.schemas.push({ id: '1', type: 'input', v: 'a' });
    revoke.push('记录1');
    vi.advanceTimersByTime(200);

    // 修改但防抖未触发（100ms < 200ms），随后立即撤销
    pageSchema.schemas[0].v = 'b';
    revoke.push('修改属性');
    vi.advanceTimersByTime(100);
    revoke.undo();
    // 未提交的修改不是记录：一步撤销回到"初始化"（空状态）
    expect(pageSchema.schemas).toHaveLength(0);

    // 防抖回调随后触发（此时 live 已是撤销后的状态）
    vi.advanceTimersByTime(200);

    // 历史链必须仍然一致：撤销/重做/新提交都正常
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(0);
    revoke.redo();
    expect(pageSchema.schemas).toHaveLength(0);
    expect(revoke.redo()).toBe(false);

    // 新提交的 diff 必须基于正确基准，且可正确撤销/重做
    pageSchema.schemas.push({ id: '9', type: 'input', v: 'c' });
    revoke.push('新修改');
    vi.advanceTimersByTime(200);
    expect(pageSchema.schemas).toHaveLength(1);
    revoke.undo();
    expect(pageSchema.schemas).toHaveLength(0);
    revoke.redo();
    expect(pageSchema.schemas).toHaveLength(1);
    expect(pageSchema.schemas[0].v).toBe('c');
  });
});