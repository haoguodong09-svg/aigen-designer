import type {
  ComponentSchema,
  FieldLink,
  PageSchema,
} from '@aigen-designer/types';

import { describe, expect, it } from 'vitest';

import {
  collectLinkEntries,
  getSchemaLabel,
  parseComputedDependencies,
  scanEventBusActions,
} from './linkHelper';

/** 构造页面 schema：form > 数量(number) + 单价(number) + 按钮(button) */
function buildPageSchema(links?: FieldLink[]): PageSchema {
  return {
    schemas: [
      {
        id: 'form_1',
        label: '表单',
        type: 'form',
        children: [
          {
            field: 'qty',
            id: 'input_qty',
            input: true,
            label: '数量',
            links,
            type: 'number',
          },
          {
            field: 'price',
            id: 'input_price',
            input: true,
            label: '单价',
            type: 'number',
          },
          { id: 'btn_submit', label: '提交按钮', type: 'button' },
        ],
      },
    ],
  };
}

describe('collectLinkEntries', () => {
  it('聚合各元素上的 links，携带源元素 ownerId', () => {
    const pageSchema = buildPageSchema([
      {
        behavior: 'SHOW',
        id: 'link_1',
        sourceField: 'qty',
        targetId: 'btn_submit',
      },
      {
        behavior: 'SET_VALUE',
        id: 'link_2',
        sourceField: 'qty',
        targetId: 'input_price',
      },
    ]);
    const entries = collectLinkEntries(pageSchema);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.ownerId).toBe('input_qty');
    expect(entries[0]?.link.id).toBe('link_1');
    expect(entries[1]?.ownerId).toBe('input_qty');
    expect(entries[1]?.link.id).toBe('link_2');
  });

  it('无 links 或 links 为空时返回空数组', () => {
    expect(collectLinkEntries(buildPageSchema())).toEqual([]);
    expect(collectLinkEntries(buildPageSchema([]))).toEqual([]);
  });
});

describe('getSchemaLabel', () => {
  it('依次回退 label / type / id / 兜底文案', () => {
    expect(getSchemaLabel({ id: 'a', label: '数量', type: 'number' })).toBe(
      '数量',
    );
    expect(getSchemaLabel({ id: 'a', type: 'number' })).toBe('number');
    // 测试纯函数回退逻辑：label / type 均缺省时回退 id（缺 type 用断言，ComponentSchema 必填约束由入参承担）
    expect(getSchemaLabel({ id: 'a' } as ComponentSchema)).toBe('a');
    expect(getSchemaLabel({ type: 'x' })).toBe('x');
  });
});

describe('parseComputedDependencies', () => {
  it('解析 $formData.* 依赖，支持多级路径与去重', () => {
    expect(
      parseComputedDependencies(
        '$formData.qty * $formData.price + $formData.user.score',
      ),
    ).toEqual(['qty', 'price', 'user.score']);
    expect(parseComputedDependencies('$formData.qty + $formData.qty')).toEqual([
      'qty',
    ]);
  });

  it('无依赖时返回空数组', () => {
    expect(parseComputedDependencies('SUM(1, 2)')).toEqual([]);
    expect(parseComputedDependencies('')).toEqual([]);
  });
});

describe('scanEventBusActions', () => {
  it('识别广播（emitEvent）与监听（onEvent）动作，提取事件名', () => {
    const pageSchema: PageSchema = {
      schemas: [
        {
          id: 'btn_a',
          label: '按钮A',
          on: {
            click: [
              {
                args: '["orderChanged", 42]',
                methodName: 'emitEvent',
                type: 'custom',
              },
            ],
          },
          type: 'button',
        },
        {
          id: 'input_b',
          input: true,
          label: '输入框B',
          on: {
            aigenReady: [
              {
                args: '["orderChanged"]',
                methodName: 'onEvent',
                type: 'public',
              },
            ],
          },
          type: 'input',
        },
      ],
    };
    const actions = scanEventBusActions(pageSchema);
    expect(actions).toHaveLength(2);
    const emit = actions.find((item) => item.kind === 'emit');
    const listen = actions.find((item) => item.kind === 'listen');
    expect(emit?.eventName).toBe('orderChanged');
    expect(emit?.ownerId).toBe('btn_a');
    expect(emit?.boundEvent).toBe('click');
    expect(emit?.ownerLabel).toBe('按钮A');
    expect(listen?.eventName).toBe('orderChanged');
    expect(listen?.boundEvent).toBe('aigenReady');
  });

  it('跳过非事件总线动作与 args 非法时的回退', () => {
    const pageSchema: PageSchema = {
      schemas: [
        {
          id: 'btn_c',
          on: {
            click: [
              { methodName: 'setValue', type: 'component' },
              { args: 'not-json', methodName: 'emitEvent', type: 'custom' },
            ],
          },
          type: 'button',
        },
      ],
    };
    const actions = scanEventBusActions(pageSchema);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.kind).toBe('emit');
    // args 无法解析时事件名回退为 methodName
    expect(actions[0]?.eventName).toBe('emitEvent');
  });
});
