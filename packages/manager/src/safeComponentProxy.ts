export interface SafeProxyOptions {
  componentId: string;
  pageManager: any;
  scopeName?: string;
}

/** 预置常用 Getter 方法的类型安全中立回退表 */
export const SAFE_GETTER_DEFAULTS: Record<string, () => unknown> = {
  getComponentState: () => ({ mounted: false, unmounted: true }),
  getFormData: () => ({}),
  getHtml: () => '',
  getNativeRef: () => null,
  getSelectedOptions: () => [],
  getSelectedRowKeys: () => [],
  getSelectedRows: () => [],
  getText: () => '',
  getValue: () => undefined,
};

/**
 * 创建生命周期受控的组件安全代理
 * - 拦截 Promise Thenable 与 Symbol 探测，杜绝死锁挂起
 * - 区分 Getter 类型安全中立回退与命令式 Action 状态，规避 TypeError
 * - 未挂载状态支持操作待决排队与安全回放
 */
export function createSafeComponentProxy(options: SafeProxyOptions) {
  const { componentId, pageManager, scopeName = 'default' } = options;

  return new Proxy({} as any, {
    get(_target, propKey: string | symbol) {
      // 1. 拦截 Promise Thenable 与 Symbol 属性，根绝死锁挂起
      if (propKey === 'then' || typeof propKey === 'symbol') {
        return undefined;
      }

      const stringKey = String(propKey);

      // 2. 尝试从活动实例获取真实暴露对象
      const liveInstance = pageManager.findInstance
        ? pageManager.findInstance(componentId, 'id', scopeName)
        : null;

      if (
        liveInstance?.exposed && // 如果是已暴露的真实属性/方法
        stringKey in liveInstance.exposed
      ) {
        const exposedItem = liveInstance.exposed[stringKey];
        if (typeof exposedItem === 'function') {
          return exposedItem.bind(liveInstance.exposed);
        }
        return exposedItem;
      }

      // 3. 实例未挂载或方法未暴露时的安全降级处理
      // 策略 A: 若为查询型 Getter 方法，返回类型安全的中立值，防止下游 TypeError
      if (stringKey in SAFE_GETTER_DEFAULTS) {
        return async () => SAFE_GETTER_DEFAULTS[stringKey]();
      }

      // 策略 B: 状态操作支持待决排队 (Queue-and-Replay)
      const QUEUEABLE_COMMANDS = [
        'setValue',
        'setFormData',
        'setSelection',
        'setOptions',
      ];
      if (!liveInstance && QUEUEABLE_COMMANDS.includes(stringKey)) {
        return async (...args: unknown[]) => {
          console.warn(
            `[Aigen Proxy]: Component '${componentId}' unmounted (v-if). Enqueuing operation '${stringKey}' for replay.`,
          );
          if (typeof pageManager.enqueuePendingOperation === 'function') {
            pageManager.enqueuePendingOperation(componentId, {
              args,
              methodName: stringKey,
              timestamp: Date.now(),
            });
          }
          return { queued: true, success: true };
        };
      }

      // 策略 C: 其它控制命令方法优雅失败，提供明确诊断，不使管道崩溃
      return async (..._args: unknown[]) => {
        const isMounted = Boolean(liveInstance);
        console.warn(
          `[Aigen Proxy]: Method '${stringKey}' called on ${
            isMounted ? 'component lacking method' : 'unmounted component'
          } '${componentId}'. Gracefully handled.`,
        );
        return {
          componentId,
          methodName: stringKey,
          reason: isMounted ? 'METHOD_NOT_FOUND' : 'COMPONENT_UNMOUNTED',
          success: false,
        };
      };
    },

    has(_target, propKey: string | symbol) {
      if (propKey === 'then' || typeof propKey === 'symbol') {
        return false;
      }
      const stringKey = String(propKey);
      const liveInstance = pageManager.findInstance
        ? pageManager.findInstance(componentId, 'id', scopeName)
        : null;
      if (liveInstance?.exposed && stringKey in liveInstance.exposed) {
        return true;
      }
      return stringKey in SAFE_GETTER_DEFAULTS;
    },
  });
}
