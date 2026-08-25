import { defineComponent, h } from 'vue';

import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { createEventBus } from '../common/createEventBus';

/**
 * 挂载一个在 setup 中调用 createEventBus 并注册监听的组件。
 * createEventBus 内部会调用 provide/onUnmounted，必须在组件实例内执行。
 */
function mountHost(channelId: string, setupBody: (bus: any) => void) {
  const Comp = defineComponent({
    setup() {
      const bus = createEventBus(channelId);
      setupBody(bus);
      return () => h('div');
    },
  });
  return mount(Comp);
}

describe('createEventBus', () => {
  it('同一通道内卸载一个组件不会清掉其他组件的监听（修复 4.3 清理逻辑失效）', () => {
    const channel = 'ch-test-keep-others';
    const cbA = vi.fn();
    const cbB = vi.fn();
    let busB: any;

    const wrapperA = mountHost(channel, (bus) => {
      bus.on('evt', cbA);
    });
    const wrapperB = mountHost(channel, (bus) => {
      busB = bus;
      bus.on('evt', cbB);
    });

    // 卸载 A：A 的监听被移除，但 B 的监听必须保留
    wrapperA.unmount();

    // 从 B 的通道触发事件
    busB.emit('evt', 'x');

    expect(cbB).toHaveBeenCalledTimes(1);
    expect(cbA).not.toHaveBeenCalled();

    wrapperB.unmount();
  });

  it('最后一个监听卸载后通道被清理（新监听不再收到旧事件缓存回放）', () => {
    const channel = 'ch-test-cleanup';
    const cb = vi.fn();
    let bus1: any;

    const wrapperA = mountHost(channel, (bus) => {
      bus1 = bus;
      bus.on('evt', cb);
    });
    // 先触发一次事件，写入通道的事件缓存
    bus1.emit('evt', 'old');

    // 卸载唯一监听：通道（含事件缓存）应被清理
    wrapperA.unmount();

    // 再次监听同一通道：若通道未被清理（bug），on() 会立即回放旧事件 'old'
    const cb2 = vi.fn();
    let bus2: any;
    mountHost(channel, (bus) => {
      bus2 = bus;
      bus.on('evt', cb2);
    });
    expect(cb2).not.toHaveBeenCalled();

    // 新通道上正常收发事件
    bus2.emit('evt', 'new');
    expect(cb2).toHaveBeenCalledWith('new');
  });

  it('onRoot 监听卸载时清理的是 root 通道而非作用域通道（修复 4.3 onRoot 清错通道）', () => {
    const channel = 'ch-test-root';
    const cbScoped2 = vi.fn();

    let busB: any;
    const wrapperA = mountHost(channel, (bus) => {
      bus.on('evt', () => {});
      bus.onRoot('rootEvt', () => {});
    });
    // 组件 B：同一通道的 scoped 监听
    const wrapperB = mountHost(channel, (bus) => {
      busB = bus;
      bus.on('evt', cbScoped2);
    });

    // 卸载 A：原实现 onRoot 的清理逻辑会误调 clear() 清掉 scoped 通道，
    // 导致 B 的监听失效；修复后只清理 root 通道
    wrapperA.unmount();

    // B 通道上的 scoped 监听必须仍然有效
    busB.emit('evt', 'x');
    expect(cbScoped2).toHaveBeenCalledTimes(1);

    wrapperB.unmount();
  });

  it('emit 触发同事件所有监听并传递参数', () => {
    const channel = 'ch-test-emit';
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    let bus: any;

    const wrapper = mountHost(channel, (b) => {
      bus = b;
      b.on('evt', cb1);
      b.on('evt', cb2);
    });

    bus.emit('evt', 1, 2);

    expect(cb1).toHaveBeenCalledWith(1, 2);
    expect(cb2).toHaveBeenCalledWith(1, 2);

    wrapper.unmount();
  });
});
