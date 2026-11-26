import { reactive } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { createStyleState } from './useStyleState';

describe('useStyleState', () => {
  function setupMockDesigner() {
    const node = {
      id: 'btn_1',
      props: {
        style: { width: '100px' },
      },
      type: 'button',
    };
    const designer = {
      pageSchema: reactive({
        css: '',
        schemas: [node],
      }),
      revoke: {
        push: vi.fn(),
      },
      state: reactive({
        selectedNode: node,
      }) as any,
    };
    const ctx = createStyleState(designer);
    return { ctx, designer, node };
  }

  it('reads and updates inline props.style and records undo', () => {
    const { ctx, designer, node } = setupMockDesigner();
    expect(ctx.getStyle('width')).toBe('100px');
    ctx.setStyle('backgroundColor', '#1677ff');
    expect((node.props.style as Record<string, string>).backgroundColor).toBe(
      '#1677ff',
    );
    expect(designer.revoke.push).toHaveBeenCalled();
  });

  it('applies inline :root CSS text edits back into props.style', () => {
    const { ctx, node } = setupMockDesigner();
    ctx.applyInlineCssText(':root {\n  display: flex;\n  gap: 8px;\n}');
    expect(node.props.style).toEqual({
      display: 'flex',
      gap: '8px',
    });
  });

  it('auto-generates className and writes pseudo-state rules to pageSchema.css', () => {
    const { ctx, designer, node } = setupMockDesigner();
    ctx.setPseudoState('hover');
    expect(ctx.activeClassName.value).toMatch(/^button-/);
    expect((node.props as Record<string, unknown>).className).toBe(
      ctx.activeClassName.value,
    );

    ctx.setStyle('color', '#ff4d4f');
    expect(designer.pageSchema.css).toContain(
      `.${ctx.activeClassName.value}:hover`,
    );
    expect(designer.pageSchema.css).toContain('color: #ff4d4f;');
  });
});
