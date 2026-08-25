import type { ComponentSchema } from '@aigen-designer/types';

import { describe, expect, it } from 'vitest';

import {
  createLinkMode,
  LINK_SOURCE_COLOR,
  LINK_TARGET_COLOR,
} from '../designer/useLinkMode';

const createSchema = (id: string, type = 'input'): ComponentSchema =>
  ({ id, label: id, type }) as ComponentSchema;

describe('useLinkMode 关联模式状态机', () => {
  it('初始状态为 idle，isActive 为 false', () => {
    const linkMode = createLinkMode();

    expect(linkMode.state.value).toBe('idle');
    expect(linkMode.isActive.value).toBe(false);
    expect(linkMode.source.value).toBeNull();
    expect(linkMode.target.value).toBeNull();
  });

  it('enter 进入 select-source 并清空旧选择', () => {
    const linkMode = createLinkMode();

    linkMode.enter();
    linkMode.setSource(createSchema('a'));
    linkMode.enter();

    expect(linkMode.state.value).toBe('select-source');
    expect(linkMode.source.value).toBeNull();
    expect(linkMode.target.value).toBeNull();
    expect(linkMode.isActive.value).toBe(true);
  });

  it('toggle 在 idle 与 select-source 间切换', () => {
    const linkMode = createLinkMode();

    linkMode.toggle();
    expect(linkMode.isActive.value).toBe(true);
    expect(linkMode.state.value).toBe('select-source');

    linkMode.toggle();
    expect(linkMode.state.value).toBe('idle');
    expect(linkMode.isActive.value).toBe(false);
  });

  it('pick 先设源再设目标，完成选择', () => {
    const linkMode = createLinkMode();

    linkMode.enter();
    linkMode.pick(createSchema('a'));

    expect(linkMode.state.value).toBe('select-target');
    expect(linkMode.source.value?.id).toBe('a');

    linkMode.pick(createSchema('b'));
    expect(linkMode.target.value?.id).toBe('b');
  });

  it('idle 状态下 setSource/setTarget 不生效', () => {
    const linkMode = createLinkMode();

    linkMode.setSource(createSchema('a'));
    linkMode.setTarget(createSchema('b'));

    expect(linkMode.state.value).toBe('idle');
    expect(linkMode.source.value).toBeNull();
    expect(linkMode.target.value).toBeNull();
  });

  it('源与目标不能是同一元素', () => {
    const linkMode = createLinkMode();
    const schema = createSchema('a');

    linkMode.enter();
    linkMode.setSource(schema);
    linkMode.setTarget(schema);

    expect(linkMode.target.value).toBeNull();
  });

  it('重新选源会清空旧源与目标', () => {
    const linkMode = createLinkMode();

    linkMode.enter();
    linkMode.setSource(createSchema('a'));
    linkMode.setTarget(createSchema('b'));
    linkMode.setSource(createSchema('c'));

    expect(linkMode.source.value?.id).toBe('c');
    expect(linkMode.target.value).toBeNull();
  });

  it('handleBlankClick：有选择时取消选择（不退出），无选择时退出', () => {
    const linkMode = createLinkMode();

    linkMode.enter();
    linkMode.setSource(createSchema('a'));
    linkMode.handleBlankClick();

    expect(linkMode.state.value).toBe('select-source');
    expect(linkMode.source.value).toBeNull();
    expect(linkMode.isActive.value).toBe(true);

    // 再点一次空白退出模式
    linkMode.handleBlankClick();
    expect(linkMode.state.value).toBe('idle');
    expect(linkMode.isActive.value).toBe(false);
  });

  it('exit 清空选择并回到 idle', () => {
    const linkMode = createLinkMode();

    linkMode.enter();
    linkMode.setSource(createSchema('a'));
    linkMode.setTarget(createSchema('b'));
    linkMode.exit();

    expect(linkMode.state.value).toBe('idle');
    expect(linkMode.source.value).toBeNull();
    expect(linkMode.target.value).toBeNull();
  });

  it('setHighlight/clearHighlights 在无 DOM 元素时不抛错', () => {
    const linkMode = createLinkMode();

    linkMode.setHighlight('a', LINK_SOURCE_COLOR);
    linkMode.setHighlight('b', LINK_TARGET_COLOR);
    linkMode.setHighlight('a', null);
    linkMode.clearHighlights();

    expect(linkMode.state.value).toBe('idle');
  });
});
