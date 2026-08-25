import type { PageSchema } from '@aigen-designer/types';

import { describe, expect, it } from 'vitest';

import { getActionSummaryText } from './actionSummary';

const pageSchema: PageSchema = {
  schemas: [
    {
      id: 'form_1',
      label: '表单',
      type: 'form',
      children: [
        {
          id: 'input_1',
          label: '数量',
          type: 'number',
        },
      ],
    },
  ],
};

describe('getActionSummaryText 动作人话摘要', () => {
  it('component + setValue：取 args 第 1 项作为值摘要', () => {
    expect(
      getActionSummaryText(
        {
          args: '["600"]',
          componentId: 'input_1',
          methodName: 'setValue',
          type: 'component',
        },
        pageSchema,
      ),
    ).toBe('把「数量」设置为 600');
  });

  it('component + setValue 表达式参数：显示 表达式 {content}', () => {
    expect(
      getActionSummaryText(
        {
          args: '[{"__isExpression__":true,"content":"$formData.qty * $formData.price"}]',
          componentId: 'input_1',
          methodName: 'setValue',
          type: 'component',
        },
        pageSchema,
      ),
    ).toBe('把「数量」设置为 表达式 $formData.qty * $formData.price');
  });

  it('component + setAttr：展示属性名', () => {
    expect(
      getActionSummaryText(
        {
          args: '["disabled", true]',
          componentId: 'input_1',
          methodName: 'setAttr',
          type: 'component',
        },
        pageSchema,
      ),
    ).toBe('设置「数量」的 disabled 属性');
  });

  it('component 其他方法：调用「{label}」的 {methodName}', () => {
    expect(
      getActionSummaryText(
        {
          componentId: 'input_1',
          methodName: 'getValue',
          type: 'component',
        },
        pageSchema,
      ),
    ).toBe('调用「数量」的 getValue');
  });

  it('目标组件不存在时回退为 componentId', () => {
    expect(
      getActionSummaryText(
        {
          componentId: 'missing_1',
          methodName: 'setValue',
          type: 'component',
        },
        pageSchema,
      ),
    ).toBe('把「missing_1」设置为 空值');
  });

  it('未传 pageSchema 时回退为 componentId', () => {
    expect(
      getActionSummaryText({
        componentId: 'input_1',
        methodName: 'setValue',
        type: 'component',
      }),
    ).toBe('把「input_1」设置为 空值');
  });

  it('custom / public 摘要', () => {
    expect(
      getActionSummaryText({ methodName: 'calcTotal', type: 'custom' }),
    ).toBe('执行自定义函数 calcTotal');
    expect(
      getActionSummaryText({ methodName: 'showToast', type: 'public' }),
    ).toBe('执行公共函数 showToast');
  });

  it('非法输入返回空串', () => {
    expect(getActionSummaryText(null)).toBe('');
    expect(getActionSummaryText(undefined)).toBe('');
    expect(getActionSummaryText('custom' as never)).toBe('');
  });
});
