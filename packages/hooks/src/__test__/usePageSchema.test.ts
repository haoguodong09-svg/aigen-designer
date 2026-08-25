import { nextTick, watch, watchEffect } from 'vue';

import { deepToRaw } from '@aigen-designer/utils';
import { describe, expect, it } from 'vitest';

import { usePageSchema } from '../plugin/usePageSchema';

describe('usePageSchema', () => {
  it('setPageSchema 整体替换后能读到新数据', () => {
    const { pageSchema, setPageSchema } = usePageSchema();

    expect(pageSchema.schemas).toEqual([]);

    setPageSchema({
      schemas: [{ id: '1', type: 'input', props: {} }],
      script: 'const x = 1',
    });

    expect(pageSchema.schemas).toHaveLength(1);
    expect(pageSchema.schemas[0].id).toBe('1');
    expect(pageSchema.script).toBe('const x = 1');
  });

  it('pageSchema.script 变化能触发 watch（pageManager targeted watch 依赖此行为）', async () => {
    const { pageSchema } = usePageSchema();
    const scripts: Array<string | undefined> = [];

    watch(
      () => pageSchema.script,
      (script) => scripts.push(script),
    );
    await nextTick();

    pageSchema.script = 'v2';
    await nextTick();
    expect(scripts).toEqual(['v2']);

    // setPageSchema 整体替换 script 也应触发
    pageSchema.script = 'v3';
    await nextTick();
    expect(scripts).toEqual(['v2', 'v3']);
  });

  it('schemas 就地修改（push/splice）可被追踪', async () => {
    const { pageSchema, setPageSchema } = usePageSchema();
    setPageSchema({ schemas: [{ id: '1', type: 'input', props: {} }] });

    let length = 0;
    watchEffect(() => {
      length = pageSchema.schemas.length;
    });
    await nextTick();
    expect(length).toBe(1);

    pageSchema.schemas.push({ id: '2', type: 'input', props: {} });
    await nextTick();
    expect(length).toBe(2);

    pageSchema.schemas.splice(0, 1);
    await nextTick();
    expect(length).toBe(1);
  });

  it('pageSchema.schemas 整体替换后订阅者收到更新（引用同步，撤销/初始化依赖此行为）', async () => {
    const { pageSchema } = usePageSchema();
    pageSchema.schemas = [{ id: 'a', type: 'x', props: {} }];

    let firstId = '';
    watchEffect(() => {
      firstId = pageSchema.schemas[0]?.id ?? '';
    });
    await nextTick();
    expect(firstId).toBe('a');

    pageSchema.schemas = [{ id: 'b', type: 'y', props: {} }];
    await nextTick();
    expect(firstId).toBe('b');
  });

  it('canvas 赋值与读取正常，且能触发 watch（editScreenContainer 依赖此行为）', async () => {
    const { pageSchema } = usePageSchema();
    let width = '';

    watch(
      () => pageSchema.canvas?.width,
      (value) => {
        width = value ?? '';
      },
    );
    await nextTick();

    pageSchema.canvas = { width: '390px', mode: 'mobile' };
    await nextTick();

    expect(width).toBe('390px');
    expect(pageSchema.canvas?.mode).toBe('mobile');
  });

  it('deepToRaw 能剥离 pageSchema 的响应式代理（撤销快照依赖此行为）', () => {
    const { pageSchema, setPageSchema } = usePageSchema();
    setPageSchema({
      schemas: [{ id: '1', type: 'input', props: {} }],
      script: 's',
    });

    const raw = deepToRaw(pageSchema) as any;
    expect(Array.isArray(raw.schemas)).toBe(true);
    expect(raw.schemas[0].id).toBe('1');
    expect(raw.script).toBe('s');
  });

  it('JSON.stringify 可序列化 pageSchema（previewJson 依赖此行为）', () => {
    const { pageSchema } = usePageSchema();
    pageSchema.canvas = { width: '100px' };

    const json = JSON.stringify(pageSchema);
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed.schemas)).toBe(true);
    expect(parsed.canvas.width).toBe('100px');
  });
});
