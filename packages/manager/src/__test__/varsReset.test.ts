import '@aigen-designer/manager';

import { nextTick } from 'vue';

import { describe, expect, it } from 'vitest';

import { createPageManager } from '../pageManager';

describe('pageManager.vars 生命周期与重置', () => {
  it('setPageSchema 切换页面时重置 vars 为新 schema.vars，避免旧页面变量残留', () => {
    const pageManager = createPageManager();
    pageManager.setVar('staleVar', 'old');
    expect(pageManager.getVar('staleVar')).toBe('old');

    pageManager.setPageSchema({
      schemas: [{ id: 'root', type: 'page' }],
      vars: { greeting: 'hello' },
    });

    expect(pageManager.getVar('staleVar')).toBeUndefined();
    expect(pageManager.getVar('greeting')).toBe('hello');

    pageManager.setPageSchema({
      schemas: [{ id: 'root', type: 'page' }],
    });
    expect(pageManager.vars.value).toEqual({});
  });

  it('设计态下 pageSchema.vars 变更（变量面板/撤销重做）同步刷新 pageManager.vars', async () => {
    const pageManager = createPageManager();
    pageManager.setDesignMode(true);
    pageManager.setPageSchema({
      schemas: [{ id: 'root', type: 'page' }],
      vars: { count: 1 },
    });
    expect(pageManager.getVar('count')).toBe(1);

    pageManager.pageSchema.vars = { count: 42, title: 'updated' };
    await nextTick();

    expect(pageManager.getVar('count')).toBe(42);
    expect(pageManager.getVar('title')).toBe('updated');
  });
});
