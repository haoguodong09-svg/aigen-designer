import '@aigen-designer/manager';
import type { PageSchema, ReactiveRule } from '@aigen-designer/types';
import { describe, expect, it } from 'vitest';
import { nextTick, reactive } from 'vue';
import { adaptLegacySchema } from '@aigen-designer/utils';
import { createPageManager } from '../pageManager';
import { createReactiveEngine } from '../reactiveRuleEngine';

describe('Phase 2: 响应式规则引擎与双轨兼容解析测试', () => {
  describe('adaptLegacySchema 双轨兼容解析', () => {
    it('将存量 schema.links 自动升轨转换为 reactiveRules', () => {
      const legacyPageSchema = {
        schemas: [
          {
            field: 'vipType',
            id: 'vip_select',
            type: 'select',
            links: [
              {
                behavior: 'SHOW',
                id: 'link_1',
                sourceField: 'vipType',
                targetId: 'discount_input',
                when: {
                  items: [{ field: 'vipType', operator: '==', value: 'VIP' }],
                  logic: 'AND',
                },
              },
            ],
            on: {
              change: [
                // 旧编译器生成的动作（带 linkId）
                {
                  componentId: 'discount_input',
                  linkId: 'link_1',
                  methodName: 'setAttr',
                  type: 'component',
                },
                // 用户手工配置的真实业务动作（不带 linkId）
                {
                  methodName: 'logAnalytics',
                  type: 'custom',
                },
              ],
            },
          },
          {
            field: 'discount',
            id: 'discount_input',
            type: 'input',
          },
        ],
      };

      const adapted = adaptLegacySchema(legacyPageSchema);

      // 1. 验证升轨成功生成 reactiveRules
      expect(adapted.reactiveRules).toHaveLength(1);
      expect(adapted.reactiveRules![0].targetField).toBe('discount_input');
      expect(adapted.reactiveRules![0].effects.hidden).toBe(false);

      // 2. 💥 关键校验：验证已剔除带 linkId 的预编译冗余动作，保留真实业务动作
      const comp = adapted.schemas[0];
      expect(comp.on?.change).toHaveLength(1);
      expect(comp.on?.change[0].methodName).toBe('logAnalytics');
    });
  });

  describe('createReactiveEngine 响应式计算与状态自愈', () => {
    it('首屏即时计算，并在条件反转时自动清除派生状态（自愈）', async () => {
      const pageManager = createPageManager();
      const testSchema: PageSchema = {
        schemas: [],
        reactiveRules: [
          {
            id: 'rule_vip',
            targetField: 'discount',
            condition: {
              items: [{ field: 'vip', operator: '==', value: 'yes' }],
              logic: 'AND',
            },
            effects: {
              disabled: true,
              hidden: false,
            },
          },
        ],
      };

      const formData = reactive({ vip: 'no' });
      pageManager.forms.value = { default: formData };

      const engine = createReactiveEngine(testSchema, pageManager);

      // 1. 初始 vip: 'no' 不满足条件，无派生状态
      expect(engine.reactiveStateMap['default:discount']).toBeUndefined();

      // 2. 修改 vip 为 'yes'，满足条件
      formData.vip = 'yes';
      await nextTick();

      expect(engine.reactiveStateMap['default:discount']).toEqual({
        disabled: true,
        hidden: false,
      });

      // 3. 💥 条件反转测试：修改 vip 为 'no'，之前施加的状态必须被自动复位清理！
      formData.vip = 'no';
      await nextTick();

      expect(engine.reactiveStateMap['default:discount']).toBeUndefined();

      engine.destroy();
    });

    it('computedValue 派生计算带脏检查，不触发死循环', async () => {
      const pageManager = createPageManager();
      const testSchema = {
        schemas: [],
        reactiveRules: [
          {
            id: 'rule_calc',
            targetField: 'total',
            effects: {
              computedValue: {
                __isExpression__: true,
                content: '$formData.price * $formData.count',
              },
            },
          },
        ],
      };

      const formData = reactive({
        count: 2,
        price: 50,
        total: 0,
      });
      pageManager.forms.value = { default: formData };

      const engine = createReactiveEngine(testSchema, pageManager);

      // 首屏计算
      await nextTick();
      expect(formData.total).toBe(100);

      // 修改 count
      formData.count = 3;
      await nextTick();
      expect(formData.total).toBe(150);

      engine.destroy();
    });

    it('pageManager 集成：页面级共享表单数据可驱动规则，并在条件反转时自愈', async () => {
      const pageManager = createPageManager();
      pageManager.setPageSchema({
        schemas: [
          {
            field: 'input_1',
            id: 'input_1',
            input: true,
            label: '输入框',
            type: 'input',
          },
          {
            field: 'select_1',
            id: 'select_1',
            input: true,
            label: '选择框',
            type: 'select',
          },
        ],
        reactiveRules: [
          {
            condition: {
              items: [{ field: 'select_1', operator: '==', value: '选项2' }],
              logic: 'AND',
            },
            effects: { hidden: true },
            id: 'rule_hide_input',
            targetField: 'input_1',
          },
        ],
      });

      // 首屏数据回填（无 <form>，走页面级共享数据）
      pageManager.pageFormData.select_1 = '选项2';
      await nextTick();
      expect(pageManager.reactiveStateMap['default:input_1']).toEqual({
        hidden: true,
      });

      // 条件反转：规则施加的状态必须被自动清除
      pageManager.pageFormData.select_1 = '选项1';
      await nextTick();
      expect(pageManager.reactiveStateMap['default:input_1']).toBeUndefined();
    });

    it('pageManager 集成：computedValue 支持按组件 id 解析字段并写入页面级数据', async () => {
      const pageManager = createPageManager();
      pageManager.setPageSchema({
        schemas: [
          {
            field: 'total',
            id: 'total_1',
            input: true,
            label: '合计',
            type: 'number',
          },
        ],
        reactiveRules: [
          {
            effects: {
              computedValue: {
                __isExpression__: true,
                content: '$formData.price * $formData.count',
              },
            },
            id: 'rule_total',
            targetField: 'total_1',
          },
        ],
      });

      pageManager.pageFormData.price = 50;
      pageManager.pageFormData.count = 2;
      await nextTick();
      expect(pageManager.pageFormData.total).toBe(100);

      pageManager.pageFormData.count = 3;
      await nextTick();
      expect(pageManager.pageFormData.total).toBe(150);
    });
  });
});
