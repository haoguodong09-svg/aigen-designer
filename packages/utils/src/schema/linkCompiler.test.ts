import type { ComponentSchema, PageSchema } from '@aigen-designer/types';

import { describe, expect, it } from 'vitest';

import { compileLink, compileLinks, stringifyArgs } from './linkCompiler';

const TARGET_ID = 'target_input';

/** 页面 schema：含联动目标元素与源元素 */
const pageSchema: PageSchema = {
  schemas: [
    {
      field: 'amount',
      id: TARGET_ID,
      input: true,
      type: 'input',
    },
    {
      field: 'qty',
      id: 'source_input',
      input: true,
      type: 'input',
    },
  ],
};

describe('compileLink 字段联动编译', () => {
  const base = {
    id: 'link_1',
    sourceField: 'qty',
    targetId: TARGET_ID,
  };

  it('行为 SHOW → 目标组件 setAttr hidden=false', () => {
    const action = compileLink({ ...base, behavior: 'SHOW' }, pageSchema);

    expect(action).toEqual({
      args: '["hidden",false]',
      componentId: TARGET_ID,
      enabled: true,
      linkId: 'link_1',
      methodName: 'setAttr',
      type: 'component',
    });
  });

  it('行为 HIDE → 目标组件 setAttr hidden=true', () => {
    const action = compileLink({ ...base, behavior: 'HIDE' }, pageSchema);

    expect(action?.methodName).toBe('setAttr');
    expect(action?.args).toBe('["hidden",true]');
    expect(action?.componentId).toBe(TARGET_ID);
  });

  it('行为 DISABLE → 目标组件 setAttr disabled=true', () => {
    const action = compileLink({ ...base, behavior: 'DISABLE' }, pageSchema);

    expect(action?.methodName).toBe('setAttr');
    expect(action?.args).toBe('["disabled",true]');
  });

  it('行为 READ → 目标组件 setAttr readonly=true', () => {
    const action = compileLink({ ...base, behavior: 'READ' }, pageSchema);

    expect(action?.methodName).toBe('setAttr');
    expect(action?.args).toBe('["readonly",true]');
  });

  it('行为 SET_VALUE 常量值 → setValue(常量)', () => {
    const action = compileLink(
      { ...base, behavior: 'SET_VALUE', value: 100 },
      pageSchema,
    );

    expect(action?.methodName).toBe('setValue');
    expect(action?.args).toBe('[100]');
  });

  it('行为 SET_VALUE 表达式对象 → 原样传递（运行时识别 __isExpression__ 求值）', () => {
    const expr = { __isExpression__: true, content: '$formData.qty * 2' };
    const action = compileLink(
      { ...base, behavior: 'SET_VALUE', value: expr },
      pageSchema,
    );

    expect(action?.methodName).toBe('setValue');
    expect(action?.args).toBe(JSON.stringify([expr]));
  });

  it('行为 CLEAR → setValue("")', () => {
    const action = compileLink({ ...base, behavior: 'CLEAR' }, pageSchema);

    expect(action?.methodName).toBe('setValue');
    expect(action?.args).toBe('[""]');
  });

  it('enabled 缺省视为 true（undefined 视为启用，兼容旧数据）', () => {
    const action = compileLink({ ...base, behavior: 'SHOW' }, pageSchema);

    expect(action?.enabled).toBe(true);
  });

  it('when 可选条件编译到动作 condition（运行时满足条件才触发）', () => {
    const when = {
      logic: 'AND' as const,
      items: [{ field: 'qty', operator: '>' as const, value: 0 }],
    };
    const action = compileLink({ ...base, behavior: 'SHOW', when }, pageSchema);

    expect(action?.condition).toEqual(when);
  });

  it('目标元素不存在 → 返回 null（编译侧过滤无效 target）', () => {
    const action = compileLink(
      { ...base, behavior: 'SHOW', targetId: 'missing_element' },
      pageSchema,
    );

    expect(action).toBeNull();
  });

  it('结构非法（缺 behavior）→ 返回 null，不抛异常', () => {
    const action = compileLink(
      { ...base, behavior: 'FOO' as never },
      pageSchema,
    );

    expect(action).toBeNull();
  });
});

describe('compileLinks 批量编译', () => {
  it('编译全部启用规则；enabled false 与无效 target 被过滤', () => {
    const schema: ComponentSchema = {
      field: 'qty',
      id: 'source_input',
      input: true,
      links: [
        { behavior: 'HIDE', id: 'l1', sourceField: 'qty', targetId: TARGET_ID },
        {
          behavior: 'SHOW',
          enabled: false,
          id: 'l2',
          sourceField: 'qty',
          targetId: TARGET_ID,
        },
        {
          behavior: 'SHOW',
          id: 'l3',
          sourceField: 'qty',
          targetId: 'missing_element',
        },
      ],
      type: 'input',
    };

    const actions = compileLinks(schema, pageSchema);

    expect(actions).toHaveLength(1);
    expect(actions[0]?.linkId).toBe('l1');
    expect(actions[0]?.methodName).toBe('setAttr');
  });

  it('无 links 或非数组 → 返回空数组', () => {
    const schema: ComponentSchema = {
      field: 'qty',
      id: 'source_input',
      input: true,
      type: 'input',
    };

    expect(compileLinks(schema, pageSchema)).toEqual([]);
    expect(compileLinks({ ...schema, links: undefined }, pageSchema)).toEqual(
      [],
    );
  });
});

describe('stringifyArgs 参数序列化', () => {
  it('序列化为 JSON 数组字符串', () => {
    expect(stringifyArgs(['hidden', false])).toBe('["hidden",false]');
    expect(stringifyArgs([''])).toBe('[""]');
    expect(stringifyArgs([{ __isExpression__: true, content: 'a' }])).toBe(
      '[{"__isExpression__":true,"content":"a"}]',
    );
  });
});
