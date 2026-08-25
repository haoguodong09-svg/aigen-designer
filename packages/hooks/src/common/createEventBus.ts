import { onUnmounted, provide } from 'vue';

import { EVENT_BUS_KEY } from '../logic/useEventBus';

// 创建全局的通道管理器
const channelMap = new Map();

export function createEventBus(channelId = 'root') {
  // 获取或创建指定通道的事件总线
  const getOrCreateChannel = (id) => {
    if (!channelMap.has(id)) {
      // 创建独立的事件总线
      const listeners = new Map();
      const eventCache = new Map(); // 缓存最近的事件
      const MAX_CACHE_SIZE = 10; // 最多缓存10个事件

      const channel = {
        // 清空通道
        clear() {
          listeners.clear();
          eventCache.clear();
        },
        // 触发事件
        emit(event, ...args) {
          // 缓存事件
          if (!eventCache.has(event)) {
            eventCache.set(event, []);
          }
          const cache = eventCache.get(event);
          cache.push({ args, timestamp: Date.now() });

          // 限制缓存大小
          if (cache.length > MAX_CACHE_SIZE) {
            cache.shift();
          }

          // 触发监听器
          if (listeners.has(event)) {
            listeners.get(event).forEach((callback) => {
              try {
                callback(...args);
              } catch (error) {
                console.error(`事件 "${event}" 处理错误:`, error);
              }
            });
          }
        },

        eventCache,

        // 取消监听
        off(event, callback) {
          if (listeners.has(event)) {
            listeners.get(event).delete(callback);
          }
        },

        // 监听事件
        on(event, callback) {
          if (!listeners.has(event)) {
            listeners.set(event, new Set());
          }
          listeners.get(event).add(callback);

          // 处理缓存的事件（立即触发最近的事件）
          if (eventCache.has(event) && eventCache.get(event).length > 0) {
            const recentEvent =
              eventCache.get(event)[eventCache.get(event).length - 1];
            try {
              callback(...recentEvent.args);
            } catch (error) {
              console.error(`缓存事件 "${event}" 处理错误:`, error);
            }
          }

          // 返回取消监听函数
          return () => {
            this.off(event, callback);
          };
        },

        // 监听器集合与事件缓存挂到通道对象上，供自动清理逻辑检查
        // （原实现只挂在闭包里，外部读取恒为 undefined，导致卸载时误判「无监听器」清空整个通道）
        listeners,
      };

      channelMap.set(id, channel);
    }

    return channelMap.get(id);
  };

  // 获取当前通道的事件总线
  const scopedBus = getOrCreateChannel(channelId);
  const rootBus = getOrCreateChannel('root');

  // 触发事件（A组件使用）
  const emit = (event, ...args: any[]) => {
    scopedBus.emit(event, ...args);
  };

  const emitRoot = (event, ...args: any[]) => {
    rootBus.emit(event, ...args);
  };

  // 取消监听
  const off = (event, callback) => {
    scopedBus.off(event, callback);
  };
  const offRoot = (event, callback) => {
    rootBus.off(event, callback);
  };

  const clear = () => {
    scopedBus.clear();
    channelMap.delete(channelId);
  };

  // 清空 root 通道
  const clearRoot = () => {
    rootBus.clear();
    channelMap.delete('root');
  };

  // 判断通道是否还存在监听器
  const hasChannelListeners = (bus) =>
    [...bus.listeners.values()].some((set) => set.size > 0);

  // 自动清理的监听函数
  const useAutoCleanupListener = (event, callback) => {
    const unsubscribe = scopedBus.on(event, callback);

    // 组件卸载时自动取消监听
    onUnmounted(() => {
      unsubscribe();

      // 仅当本通道已无任何监听器时清理通道，避免一个组件卸载清掉整个通道
      if (channelMap.has(channelId) && !hasChannelListeners(scopedBus)) {
        clear();
      }
    });

    return unsubscribe;
  };

  const onRoot = (event, callback) => {
    const unsubscribe = rootBus.on(event, callback);

    // 组件卸载时自动取消监听
    onUnmounted(() => {
      unsubscribe();

      // 清理 root 通道（原实现误调 clear() 清掉了当前作用域通道）
      if (channelMap.has('root') && !hasChannelListeners(rootBus)) {
        clearRoot();
      }
    });

    return unsubscribe;
  };

  const eventBus = {
    clear,
    emit,
    emitRoot,
    off,
    offRoot,
    on: useAutoCleanupListener,
    onRoot,
  };

  provide(EVENT_BUS_KEY, eventBus);
  return eventBus;
}

export type EventBus = ReturnType<typeof createEventBus>;
