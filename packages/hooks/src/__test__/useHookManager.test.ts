import { describe, expect, it, vi } from 'vitest';

import { useHookManager } from '../plugin/useHookManager';

describe('useHookManager', () => {
  it('execute 应按注册顺序执行所有钩子（修复 4.1 钩子链短路）', async () => {
    const { execute, register } = useHookManager();
    const calls: string[] = [];

    register('formChange', async () => {
      calls.push('1');
    });
    register('formChange', () => {
      calls.push('2');
    });
    register('formChange', async () => {
      calls.push('3');
    });

    await execute('formChange', {});

    // 原实现 return await hook(context) 导致只执行第一个钩子
    expect(calls).toEqual(['1', '2', '3']);
  });

  it('单个钩子抛错不影响后续钩子继续执行', async () => {
    const { execute, register } = useHookManager();
    const calls: string[] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    register('formChange', () => {
      calls.push('1');
      throw new Error('hook error');
    });
    register('formChange', () => {
      calls.push('2');
    });

    await execute('formChange', {});

    expect(calls).toEqual(['1', '2']);
    errorSpy.mockRestore();
  });

  it('注册返回的取消函数可移除对应钩子', async () => {
    const { execute, register } = useHookManager();
    const calls: string[] = [];

    const unregister = register('formChange', () => {
      calls.push('x');
    });
    register('formChange', () => {
      calls.push('y');
    });

    unregister();
    await execute('formChange', {});

    expect(calls).toEqual(['y']);
  });

  it('clear 可清空指定或全部钩子', () => {
    const { clear, getCount, register } = useHookManager();

    register('formChange', () => {});
    register('formChange', () => {});
    register('nodeRender', () => {});
    expect(getCount('formChange')).toBe(2);
    expect(getCount('nodeRender')).toBe(1);

    clear('formChange');
    expect(getCount('formChange')).toBe(0);
    expect(getCount('nodeRender')).toBe(1);

    clear();
    expect(getCount('nodeRender')).toBe(0);
  });
});
