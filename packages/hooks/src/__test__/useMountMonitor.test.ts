import { describe, expect, it } from 'vitest';

import { useMountMonitor } from '../plugin/useMountMonitor';

describe('useMountMonitor', () => {
  it('初始状态为全部挂载完成', () => {
    const monitor = useMountMonitor();
    expect(monitor.isAllMounted.value).toBe(true);
  });

  it('push/pop 维护挂载状态（Set 语义，重复 push 幂等）', () => {
    const monitor = useMountMonitor();

    monitor.push('a');
    monitor.push('b');
    expect(monitor.isAllMounted.value).toBe(false);
    // 重复注册同一 id 不重复计数
    monitor.push('a');
    expect(monitor.pendingIds.value.size).toBe(2);

    monitor.pop('a');
    expect(monitor.isAllMounted.value).toBe(false);
    monitor.pop('b');
    expect(monitor.isAllMounted.value).toBe(true);
  });

  it('reset 清空所有待加载项', () => {
    const monitor = useMountMonitor();

    monitor.push('a');
    monitor.push('b');
    monitor.reset();

    expect(monitor.pendingIds.value.size).toBe(0);
    expect(monitor.isAllMounted.value).toBe(true);
  });
});
