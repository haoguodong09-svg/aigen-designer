import { onUnmounted, provide } from 'vue';

import { EVENT_BUS_KEY } from '../logic/useEventBus';

type EventCallback = (...args: any[]) => void;

interface CachedEvent {
  args: any[];
  timestamp: number;
}

interface EventChannel {
  clear(): void;
  emit(event: string, ...args: any[]): void;
  eventCache: Map<string, CachedEvent[]>;
  listeners: Map<string, Set<EventCallback>>;
  off(event: string, callback: EventCallback): void;
  on(event: string, callback: EventCallback): () => void;
}

// 创建全局的通道管理器
const channelMap = new Map<string, EventChannel>();

export function createEventBus(channelId: string = 'root') {
  // 获取或创建指定通道的事件总线
  const getOrCreateChannel = (id: string): EventChannel => {
    if (!channelMap.has(id)) {
      // 创建独立的事件总线
      const listeners = new Map<string, Set<EventCallback>>();
      const eventCache = new Map<string, CachedEvent[]>(); // 缓存最近的事件
      const MAX_CACHE_SIZE = 10; // 最多缓存10个事件

      const channel: EventChannel = {
        // 清空通道
        clear() {
          listeners.clear();
          eventCache.clear();
        },
        // 触发事件
        emit(event: string, ...args: any[]) {
          // 缓存事件
          let cache = eventCache.get(event);
          if (!cache) {
            cache = [];
            eventCache.set(event, cache);
          }
          cache.push({ args, timestamp: Date.now() });

          // 限制缓存大小
          if (cache.length > MAX_CACHE_SIZE) {
            cache.shift();
          }

          // 触发监听器
          const eventListeners = listeners.get(event);
          if (eventListeners) {
            eventListeners.forEach((callback) => {
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
        off(event: string, callback: EventCallback) {
          const eventListeners = listeners.get(event);
          if (eventListeners) {
            eventListeners.delete(callback);
          }
        },

        // 监听事件
        on(event: string, callback: EventCallback) {
          let eventListeners = listeners.get(event);
          if (!eventListeners) {
            eventListeners = new Set();
            listeners.set(event, eventListeners);
          }
          eventListeners.add(callback);

          // 处理缓存的事件（立即触发最近的事件）
          const cachedEvents = eventCache.get(event);
          if (cachedEvents && cachedEvents.length > 0) {
            const recentEvent = cachedEvents[cachedEvents.length - 1];
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

    // has() 守卫保证此处必然存在（上面已创建），非空断言避免二次 get
    return channelMap.get(id) as EventChannel;
  };

  // 获取当前通道的事件总线
  const scopedBus = getOrCreateChannel(channelId);
  const rootBus = getOrCreateChannel('root');

  // 触发事件（A组件使用）
  const emit = (event: string, ...args: any[]) => {
    scopedBus.emit(event, ...args);
  };

  const emitRoot = (event: string, ...args: any[]) => {
    rootBus.emit(event, ...args);
  };

  // 取消监听
  const off = (event: string, callback: EventCallback) => {
    scopedBus.off(event, callback);
  };
  const offRoot = (event: string, callback: EventCallback) => {
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
  const hasChannelListeners = (bus: EventChannel) =>
    [...bus.listeners.values()].some((set) => set.size > 0);

  // 自动清理的监听函数
  const useAutoCleanupListener = (event: string, callback: EventCallback) => {
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

  const onRoot = (event: string, callback: EventCallback) => {
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
