import { describe, expect, it } from 'vitest';

import { convertKFormData, recursionConvertedNode } from '../../';

describe('convertKFormData / recursionConvertedNode', () => {
  it('convertKFormData 不应修改输入数据', () => {
    const data: any = {
      config: { labelWidth: 120, labelLayout: 'flex' },
      script: 'console.log(1)',
      list: [
        {
          key: 'k1',
          type: 'input',
          label: '输入框',
          model: 'input_k1',
          options: { placeholder: '请输入', width: '100%' },
          rules: [{ required: false }, { required: true }],
        },
      ],
    };
    const snapshot = JSON.parse(JSON.stringify(data));

    const result = convertKFormData(data);

    // 输入数据不应被修改（修复前会向 data.config 写入空对象）
    expect(JSON.stringify(data)).toBe(JSON.stringify(snapshot));
    const formSchema = result.schemas[0]?.children?.[0];
    expect(formSchema?.children).toHaveLength(1);
    expect(formSchema?.children?.[0].type).toBe('input');
  });

  it('网格父节点应生成新 key 而不修改输入', () => {
    const item: any = {
      key: 'grid_item',
      type: 'input',
      label: '列',
      model: 'col_1',
      options: { width: '50%' },
    };

    const children = recursionConvertedNode([item], { type: 'grid' });

    expect(item.key).toBe('grid_item'); // 输入 key 未被改写
    expect(children[0].id).not.toBe('grid_item');
    expect(children[0].type).toBe('col');
    // width 已迁移到 style（转换逻辑），且未污染输入 options
    expect(children[0].props.style).toEqual({ width: '50%' });
    expect(item.options.width).toBe('50%');
  });

  it('首条规则 required 为 false 时应剔除而不修改输入', () => {
    const rules = [{ required: false }, { required: true }];
    const children = recursionConvertedNode([
      { key: 'k1', type: 'input', model: 'm1', rules },
    ]);

    expect(rules).toHaveLength(2); // 输入 rules 未被 shift
    expect(children[0].rules).toEqual([{ required: true }]);
  });

  it('对 options 的改写不应污染输入数据', () => {
    const item: any = {
      key: 'k2',
      type: 'textarea',
      model: 'm2',
      options: { maxRows: 3, minRows: 1, width: '100%' },
    };

    const children = recursionConvertedNode([item]);

    // 输入 options 保持原样
    expect(item.options).toEqual({ maxRows: 3, minRows: 1, width: '100%' });
    // 转换结果包含合并后的 props
    expect(children[0].props.autoSize).toEqual({ maxRows: 3, minRows: 1 });
    expect(children[0].props.style).toEqual({ width: '100%' });
  });
});
