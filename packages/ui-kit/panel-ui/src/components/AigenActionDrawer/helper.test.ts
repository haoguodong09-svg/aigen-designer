import type { ComponentSchema } from '@aigen-designer/types';

import { describe, expect, it } from 'vitest';

import {
  buildCacheKey,
  buildMockFormData,
  createEmptyDraft,
  createExpressionValue,
  filterSchemasByKeyword,
  formatPreviewValue,
  getArgsArray,
  getComponentLabel,
  isExpressionValue,
  setArgsValue,
  stringifyArgs,
} from './helper';

describe('createEmptyDraft', () => {
  it('返回默认草稿：enabled 默认 true，type 为空', () => {
    const draft = createEmptyDraft();
    expect(draft.type).toBe('');
    expect(draft.enabled).toBe(true);
    expect(draft.componentId).toBeNull();
    expect(draft.methodName).toBe('');
    expect(draft.args).toBeNull();
    expect(draft.delay).toBeNull();
    expect(draft.condition).toBeNull();
  });
});

describe('表达式对象', () => {
  it('createExpressionValue 产出运行时支持的 __isExpression__ 对象', () => {
    const expr = createExpressionValue('$formData.qty * $formData.price');
    expect(expr).toEqual({
      __isExpression__: true,
      content: '$formData.qty * $formData.price',
    });
  });

  it('isExpressionValue 正确识别表达式对象与普通值', () => {
    expect(isExpressionValue(createExpressionValue('SUM(1,2)'))).toBe(true);
    expect(isExpressionValue('SUM(1,2)')).toBe(false);
    expect(isExpressionValue(123)).toBe(false);
    expect(isExpressionValue(null)).toBe(false);
    expect(isExpressionValue({ a: 1 })).toBe(false);
    expect(isExpressionValue({ __isExpression__: false, content: 'x' })).toBe(
      false,
    );
  });
});

describe('args 序列化', () => {
  it('getArgsArray 处理空值 / 数组 / 非数组 JSON / 非法 JSON', () => {
    expect(getArgsArray(null)).toEqual([]);
    expect(getArgsArray(undefined)).toEqual([]);
    expect(getArgsArray('')).toEqual([]);
    expect(getArgsArray('[1, "a", true]')).toEqual([1, 'a', true]);
    expect(getArgsArray('{"a":1}')).toEqual([{ a: 1 }]);
    expect(getArgsArray('not-json')).toEqual([]);
  });

  it('setArgsValue 按下标写入并保留其他参数', () => {
    const args = stringifyArgs(['disabled', true]);
    const next = setArgsValue(args, 1, false);
    expect(getArgsArray(next)).toEqual(['disabled', false]);
    const withExpr = setArgsValue(null, 0, createExpressionValue('SUM(1,2)'));
    expect(getArgsArray(withExpr)).toEqual([
      { __isExpression__: true, content: 'SUM(1,2)' },
    ]);
    // 写入表达式后 JSON 往返仍保持表达式结构（与运行时 doActions 对齐）
    expect(JSON.parse(withExpr)[0].__isExpression__).toBe(true);
  });

  it('stringifyArgs / getArgsArray 往返一致', () => {
    const values = ['a', 1, { __isExpression__: true, content: 'IF(1,2,3)' }];
    expect(getArgsArray(stringifyArgs(values))).toEqual(values);
  });
});

describe('buildCacheKey', () => {
  it('拼接 componentId 与 methodName，空 componentId 安全', () => {
    expect(buildCacheKey('input_abc', 'setValue')).toBe('input_abcsetValue');
    expect(buildCacheKey(null, 'customFn')).toBe('customFn');
  });
});

describe('buildMockFormData', () => {
  it('按输入组件类型生成模拟值', () => {
    const formData = buildMockFormData([
      { field: 'qty', label: '数量', type: 'number' },
      { field: 'type', label: '类型', type: 'select' },
      { field: 'name', label: '名称', type: 'input' },
      { field: 'enabled', label: '启用', type: 'switch' },
      { field: 'date', label: '日期', type: 'date' },
    ]);
    expect(formData).toEqual({
      date: '2024-01-01 12:00:00',
      enabled: true,
      name: '示例文本',
      qty: 100,
      type: '选项1',
    });
  });

  it('跳过无 field 的字段', () => {
    const formData = buildMockFormData([
      { field: '', label: '空字段', type: 'input' },
      { field: 'a', label: 'A', type: 'input' },
    ]);
    expect(formData).toEqual({ a: '示例文本' });
  });
});

describe('filterSchemasByKeyword', () => {
  const tree: ComponentSchema[] = [
    {
      id: 'root',
      label: '页面',
      type: 'page',
      children: [
        {
          children: [
            { id: 'input_2', input: true, label: '单价', type: 'number' },
          ],
          id: 'input_1',
          label: '数量',
          type: 'input',
        },
        { id: 'btn_1', label: '提交按钮', type: 'button' },
      ],
    },
  ];

  it('空关键字返回全部节点', () => {
    expect(resultIds(tree, '').sort()).toEqual(
      ['root', 'input_1', 'input_2', 'btn_1'].sort(),
    );
  });

  it('按 label 过滤（含子节点）', () => {
    expect(resultIds(tree, '单价')).toEqual(['input_2']);
  });

  it('按 id 过滤', () => {
    expect(resultIds(tree, 'btn_1')).toEqual(['btn_1']);
  });

  it('按 type 与类型中文名过滤', () => {
    const byType = resultIds(tree, 'number');
    expect(byType).toEqual(['input_2']);
    const byTypeLabel = resultIds(
      tree,
      '按钮',
      (type) => ({ button: '按钮' })[type] ?? '',
    );
    expect(byTypeLabel).toEqual(['btn_1']);
  });

  it('大小写不敏感', () => {
    expect(resultIds(tree, 'INPUT_1')).toEqual(['input_1']);
  });
});

/** 过滤后取 id 列表（按原遍历顺序） */
function resultIds(
  tree: ComponentSchema[],
  keyword: string,
  resolveTypeLabel?: (type: string) => string,
): string[] {
  return filterSchemasByKeyword(tree, keyword, resolveTypeLabel).map(
    (item) => item.id ?? '',
  );
}

describe('getComponentLabel / formatPreviewValue', () => {
  it('getComponentLabel 依次回退', () => {
    expect(getComponentLabel({ label: '数量', type: 'input' })).toBe('数量');
    expect(
      getComponentLabel({ type: 'input' }, (type) =>
        type === 'input' ? '输入框' : undefined,
      ),
    ).toBe('输入框');
    expect(getComponentLabel({ type: 'unknown' })).toBe('未命名组件');
  });

  it('formatPreviewValue 格式化各类结果', () => {
    expect(formatPreviewValue(null)).toBe('空');
    expect(formatPreviewValue(undefined)).toBe('空');
    expect(formatPreviewValue(600)).toBe('600');
    expect(formatPreviewValue('abc')).toBe('abc');
    expect(formatPreviewValue({ a: 1 })).toBe('{"a":1}');
  });
});
