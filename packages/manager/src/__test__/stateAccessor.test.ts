import '@aigen-designer/manager';

import { describe, expect, it, vi } from 'vitest';

import { createPageManager } from '../pageManager';

describe('pageManager 状态变量 getter / setter 访问器', () => {
  it('支持 JSExpression 初值解析与 getter 响应式派生计算', () => {
    const pageManager = createPageManager();
    pageManager.setPageSchema({
      schemas: [{ id: 'root', type: 'page' }],
      vars: {
        count: 2,
        initialBanner: {
          type: 'JSExpression',
          value: '`共${vars.count}件`',
        },
        price: 100,
        total: {
          accessor: {
            getter: {
              type: 'JSFunction',
              value: 'function getter() { return vars.price * vars.count; }',
            },
          },
          defaultValue: 0,
        },
      },
    });

    expect(pageManager.getVar('initialBanner')).toBe('共2件');
    expect(pageManager.getVar('total')).toBe(200);

    // 修改依赖变量，getter 同步响应式重算
    pageManager.setVar('count', 5);
    expect(pageManager.getVar('total')).toBe(500);

    pageManager.setVar('price', 80);
    expect(pageManager.getVar('total')).toBe(400);
  });

  it('支持 getter 响应表单数据 formData 与自定义函数 funcs 变化', () => {
    const pageManager = createPageManager();
    pageManager.setFormData({ quantity: 3 }, 'order');
    pageManager.setMethods(
      'aigen.defineExpose({ calcTax: (v) => Math.round(v * 0.1) });',
    );

    pageManager.setPageSchema({
      schemas: [{ id: 'root', type: 'page' }],
      vars: {
        tax: {
          accessor: {
            getter: {
              type: 'JSFunction',
              value:
                '() => (funcs.calcTax ? funcs.calcTax((formData.quantity || 0) * vars.unitPrice) : 0)',
            },
          },
          defaultValue: 0,
        },
        unitPrice: 100,
      },
    });

    expect(pageManager.getVar('tax')).toBe(30);

    pageManager.setFormData({ quantity: 6 }, 'order');
    expect(pageManager.getVar('tax')).toBe(60);
  });

  it('支持 setter 拦截 setVar 并联动拆解更新底层变量', () => {
    const pageManager = createPageManager();
    pageManager.setPageSchema({
      schemas: [{ id: 'root', type: 'page' }],
      vars: {
        firstName: 'Ada',
        fullName: {
          accessor: {
            getter: {
              type: 'JSFunction',
              value:
                'function getter() { return `${vars.firstName} ${vars.lastName}`.trim(); }',
            },
            setter: {
              type: 'JSFunction',
              value: `function setter(value) {
                const [first = '', last = ''] = String(value ?? '').split(' ');
                setVar('firstName', first);
                setVar('lastName', last);
              }`,
            },
          },
          defaultValue: '',
        },
        lastName: 'Lovelace',
      },
    });

    expect(pageManager.getVar('fullName')).toBe('Ada Lovelace');

    pageManager.setVar('fullName', 'Grace Hopper');
    expect(pageManager.getVar('firstName')).toBe('Grace');
    expect(pageManager.getVar('lastName')).toBe('Hopper');
    expect(pageManager.getVar('fullName')).toBe('Grace Hopper');
  });

  it('切换页面或重置 Schema 时停止旧 getter 的 watchEffect，不重复触发', () => {
    const pageManager = createPageManager();
    const spy = vi.fn();
    (globalThis as Record<string, unknown>).__testGetterSpy = spy;

    try {
      pageManager.setPageSchema({
        schemas: [{ id: 'root', type: 'page' }],
        vars: {
          base: 1,
          derived: {
            accessor: {
              getter: {
                type: 'JSFunction',
                value:
                  'function getter() { globalThis.__testGetterSpy?.(); return vars.base + 1; }',
              },
            },
            defaultValue: 0,
          },
        },
      });

      expect(spy).toHaveBeenCalledTimes(1);

      // 切换到一个不再包含 derived 的页面
      pageManager.setPageSchema({
        schemas: [{ id: 'root', type: 'page' }],
        vars: { base: 10 },
      });

      spy.mockClear();
      pageManager.setVar('base', 99);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      delete (globalThis as Record<string, unknown>).__testGetterSpy;
    }
  });
});
