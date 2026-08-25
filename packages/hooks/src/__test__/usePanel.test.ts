import { describe, expect, it } from 'vitest';

// 先触发 @aigen-designer/manager 侧求值（hooks ↔ utils ↔ base-ui ↔ manager 存在
// 循环依赖，先导入 manager 可让循环按应用内的求值顺序完整走完，避免 usePanel 未定义）
import '@aigen-designer/manager';

import { usePanel } from '../plugin/usePanel';

const createActivitybar = (id: string, title: string) => ({
  component: {},
  icon: 'icon',
  id,
  title,
});

const createRightSidebar = (id: string, title: string) => ({
  component: {},
  id,
  title,
});

describe('usePanel', () => {
  it('运行时注册活动栏应触发 computed 刷新（修复 4.4 shallowRef 原地 push 不响应）', () => {
    const panel = usePanel();

    expect(panel.activityBars.value).toHaveLength(0);

    panel.registerActivitybar(createActivitybar('a1', '组件'));
    // 原实现 shallowRef 原地 push 不会触发响应式，computed 保持空列表
    expect(panel.activityBars.value).toHaveLength(1);
    expect(panel.activityBars.value[0].id).toBe('a1');

    panel.registerActivitybar(createActivitybar('a2', '大纲'));
    expect(panel.activityBars.value).toHaveLength(2);
  });

  it('运行时注册右侧栏应触发 computed 刷新', () => {
    const panel = usePanel();

    panel.registerRightSidebar(createRightSidebar('r1', '属性'));
    expect(panel.rightSidebars.value).toHaveLength(1);
    expect(panel.rightSidebars.value[0].id).toBe('r1');
  });

  it('同 id 重复注册为更新而非追加', () => {
    const panel = usePanel();

    panel.registerActivitybar(createActivitybar('a1', '旧标题'));
    panel.registerActivitybar(createActivitybar('a1', '新标题'));

    expect(panel.activityBars.value).toHaveLength(1);
    expect(panel.activityBars.value[0].title).toBe('新标题');
  });

  it('隐藏/显示活动栏过滤 computed 结果', () => {
    const panel = usePanel();

    panel.registerActivitybar(createActivitybar('a1', '组件'));
    panel.registerActivitybar(createActivitybar('a2', '大纲'));
    expect(panel.activityBars.value).toHaveLength(2);

    panel.hideActivitybar('a1');
    expect(panel.activityBars.value).toHaveLength(1);
    expect(panel.activityBars.value[0].id).toBe('a2');

    panel.showActivitybar('a1');
    expect(panel.activityBars.value).toHaveLength(2);
  });
});
