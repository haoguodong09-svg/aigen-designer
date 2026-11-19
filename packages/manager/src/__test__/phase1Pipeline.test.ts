import '@aigen-designer/manager';
import { describe, expect, it, vi } from 'vitest';
import { createPageManager } from '../pageManager';
import { createSafeComponentProxy } from '../safeComponentProxy';

describe('Phase 1: SafeComponentProxy & Async Pipeline 防死锁/防环引擎', () => {
  describe('SafeComponentProxy 健壮性测试', () => {
    it('拦截 then 属性，规避 Promise.resolve 挂起死锁', async () => {
      const pageManager = createPageManager();
      const proxy = createSafeComponentProxy({
        componentId: 'test_input',
        pageManager,
      });

      // 验证 proxy.then 为 undefined
      expect(proxy.then).toBeUndefined();

      // 验证 Promise.resolve(proxy) 能够立即正常 resolve，绝不挂起
      const resolved = await Promise.resolve(proxy);
      expect(resolved).toBe(proxy);
    });

    it('未暴露的方法调用优雅回退，绝不抛出 TypeError', async () => {
      const pageManager = createPageManager();
      const proxy = createSafeComponentProxy({
        componentId: 'non_existent_comp',
        pageManager,
      });

      // 调用未实现的方法，不崩溃
      const res = await proxy.someMethod('hello');
      expect(res).toEqual({
        componentId: 'non_existent_comp',
        methodName: 'someMethod',
        reason: 'COMPONENT_UNMOUNTED',
        success: false,
      });
    });

    it('Getter 查询方法返回类型安全中立默认值', async () => {
      const pageManager = createPageManager();
      const proxy = createSafeComponentProxy({
        componentId: 'table_1',
        pageManager,
      });

      const rows = await proxy.getSelectedRows();
      expect(rows).toEqual([]);
      // 验证可以安全调用 .map() 不崩溃
      expect(rows.map((r: any) => r.id)).toEqual([]);

      const formData = await proxy.getFormData();
      expect(formData).toEqual({});
    });

    it('未挂载组件的状态修改操作进入待决排队并在挂载后自动重放', () => {
      const pageManager = createPageManager();
      const proxy = createSafeComponentProxy({
        componentId: 'deferred_comp',
        pageManager,
      });

      // 调用未挂载组件的 setValue
      proxy.setValue('new_value');

      // 挂载后重放
      const setValueSpy = vi.fn();
      pageManager.addComponentInstance('deferred_comp', {
        exposed: {
          setValue: setValueSpy,
        },
      } as any);

      expect(setValueSpy).toHaveBeenCalledWith('new_value');
    });
  });

  describe('ActionExecutionEngine 异步与防环测试', () => {
    it('顺序合法多次调用同一方法不被误杀', async () => {
      const pageManager = createPageManager();
      const logs: string[] = [];

      pageManager.funcs.value = {
        setLoading: (loading: boolean) => {
          logs.push(`loading:${loading}`);
        },
        saveApi: async () => {
          logs.push('api_start');
          await new Promise((r) => setTimeout(r, 10));
          logs.push('api_done');
          return { id: 123 };
        },
      };

      // 经典业务序列：开启 loading -> 调接口 -> 关闭 loading
      const res = await pageManager.doActions([
        { args: '[true]', methodName: 'setLoading', type: 'custom' },
        { id: 'api_step', methodName: 'saveApi', type: 'custom' },
        { args: '[false]', methodName: 'setLoading', type: 'custom' },
      ]);

      expect(res.success).toBe(true);
      expect(logs).toEqual([
        'loading:true',
        'api_start',
        'api_done',
        'loading:false',
      ]);
    });

    it('真正的递归再入能够被精准检测并阻断', async () => {
      const pageManager = createPageManager();
      let callCount = 0;

      pageManager.funcs.value = {
        loopSelf: () => {
          callCount++;
          // 自身递归重入触发 doActions
          return pageManager.doActions([
            { methodName: 'loopSelf', type: 'custom' },
          ]);
        },
      };

      const res = await pageManager.doActions([
        { methodName: 'loopSelf', type: 'custom' },
      ]);

      // 第一次进入执行，再次重入时被检测并阻断，不发生栈溢出崩溃
      expect(callCount).toBe(1);
      expect(res.success).toBe(true); // 外层执行完成
    });

    it('支持管道结果传递与 onError continue 策略', async () => {
      const pageManager = createPageManager();

      pageManager.funcs.value = {
        failStep: () => {
          throw new Error('boom');
        },
        okStep: () => {
          return 'hello';
        },
      };

      const res = await pageManager.doActions([
        { methodName: 'failStep', onError: 'continue', type: 'custom' },
        { id: 'step2', methodName: 'okStep', type: 'custom' },
      ]);

      expect(res.success).toBe(true);
      expect(res.finalResult).toBe('hello');
      expect(res.stepResults).toEqual({ step2: 'hello' });
    });
  });
});
