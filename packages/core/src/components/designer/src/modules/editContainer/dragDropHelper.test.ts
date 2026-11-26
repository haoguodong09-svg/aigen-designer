import { describe, expect, it, vi } from 'vitest';

import {
  findDirectChildNodeEl,
  findDirectChildNodeElFromTarget,
  getContainerMeasureRect,
  isSchemaInline,
} from './dragDropHelper';

vi.mock('@aigen-designer/manager', () => ({
  pluginManager: {
    component: {
      getComponentConfigByType: (type: string) => {
        if (type === 'button') {
          return { editConstraints: { inline: true } };
        }
        return { editConstraints: { inline: false } };
      },
      getConfigByType: (type: string) => {
        if (type === 'button') {
          return { editConstraints: { inline: true } };
        }
        return { editConstraints: { inline: false } };
      },
    },
  },
}));

describe('dragDropHelper 无壳直出碰撞与容器测量', () => {
  it('isSchemaInline：优先尊重 props.style.display，再回退到 editConstraints.inline', () => {
    expect(isSchemaInline({ id: '1', type: 'button' })).toBe(true);
    expect(
      isSchemaInline({
        id: '2',
        props: { style: { display: 'block' } },
        type: 'button',
      }),
    ).toBe(false);
    expect(
      isSchemaInline({
        id: '3',
        props: { style: { display: 'inline-block' } },
        type: 'div',
      }),
    ).toBe(true);
    expect(isSchemaInline({ id: '4', type: 'div' })).toBe(false);
  });

  it('findDirectChildNodeEl：在无 .aigen-node-item 包装壳下精准定位直接子节点', () => {
    const container = document.createElement('div');
    container.className = 'aigen-draggable-range';

    const childA = document.createElement('div');
    childA.dataset.aigenId = 'child_a';
    container.append(childA);

    const nestedRange = document.createElement('div');
    nestedRange.className = 'aigen-draggable-range';
    const nestedChild = document.createElement('span');
    nestedChild.dataset.aigenId = 'child_b';
    nestedRange.append(nestedChild);
    childA.append(nestedRange);

    expect(findDirectChildNodeEl(container, 'child_a')).toBe(childA);
  });

  it('findDirectChildNodeElFromTarget：从深层内部元素回溯到当前容器的直接子节点', () => {
    const container = document.createElement('div');
    container.className = 'aigen-draggable-range';

    const card = document.createElement('div');
    card.dataset.aigenId = 'card_1';
    const innerSpan = document.createElement('span');
    card.append(innerSpan);
    container.append(card);

    const childIds = new Set(['card_1']);
    expect(
      findDirectChildNodeElFromTarget(innerSpan, container, childIds),
    ).toBe(card);
    expect(
      findDirectChildNodeElFromTarget(innerSpan, container, new Set(['other'])),
    ).toBeNull();
  });

  it('getContainerMeasureRect：当 .aigen-draggable-range 为 display: contents 时回退到宿主容器 rect', () => {
    const host = document.createElement('div');
    host.dataset.aigenId = 'box_1';
    host.getBoundingClientRect = () =>
      ({
        bottom: 200,
        height: 150,
        left: 10,
        right: 310,
        top: 50,
        width: 300,
      }) as DOMRect;

    const range = document.createElement('div');
    range.className = 'aigen-draggable-range is-contents';
    range.style.display = 'contents';
    host.append(range);
    document.body.append(host);

    const rect = getContainerMeasureRect(range, 'box_1');
    expect(rect.width).toBe(300);
    expect(rect.height).toBe(150);

    host.remove();
  });
});
