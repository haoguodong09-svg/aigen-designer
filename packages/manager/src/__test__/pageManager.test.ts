// 先触发 @aigen-designer/manager 侧求值（hooks ↔ utils ↔ base-ui ↔ manager 存在
// 循环依赖，与 hooks/__test__ 下既有测试的 workaround 一致），避免 useFormSchema 等
// hooks 导出在循环中拿到未初始化绑定
import '@aigen-designer/manager';

import { describe, expect, it } from 'vitest';

import { createPageManager } from '../pageManager';

describe('pageManager.doActions 动作级启停用（enabled）', () => {
  it('enabled === false 的动作被跳过，其余动作照常执行', () => {
    const pageManager = createPageManager();
    const calls: string[] = [];
    pageManager.funcs.value = {
      record: () => {
        calls.push('record');
      },
    };

    pageManager.doActions([
      { enabled: false, methodName: 'record', type: 'custom' },
      { methodName: 'record', type: 'custom' },
      { enabled: true, methodName: 'record', type: 'custom' },
    ]);

    expect(calls).toEqual(['record', 'record']);
  });

  it('缺省 enabled（undefined）视为启用，兼容旧数据', () => {
    const pageManager = createPageManager();
    let called = 0;
    pageManager.funcs.value = {
      bump: () => {
        called += 1;
      },
    };

    pageManager.doActions([{ methodName: 'bump', type: 'custom' }]);

    expect(called).toBe(1);
  });

  it('全部停用时整条动作链不执行任何动作', () => {
    const pageManager = createPageManager();
    let called = 0;
    pageManager.funcs.value = {
      bump: () => {
        called += 1;
      },
    };

    pageManager.doActions([
      { enabled: false, methodName: 'bump', type: 'custom' },
      { enabled: false, methodName: 'bump', type: 'custom' },
    ]);

    expect(called).toBe(0);
  });
});
