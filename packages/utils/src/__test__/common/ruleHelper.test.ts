import { describe, expect, it } from 'vitest';
import type { PageSchema, ReactiveRule } from '@aigen-designer/types';
import {
  buildReactiveRule,
  buildRuleCondition,
  buildRuleEffects,
  collectReactiveRules,
  createEmptyRuleDraft,
  findRelatedReactiveRules,
  inferRuleBehavior,
  parseConstantValue,
  removeReactiveRule,
  upsertReactiveRule,
} from '../../schema/ruleHelper';

describe('ruleHelper in utils', () => {
  it('parseConstantValue parses primitives correctly', () => {
    expect(parseConstantValue('')).toBe('');
    expect(parseConstantValue('true')).toBe(true);
    expect(parseConstantValue('false')).toBe(false);
    expect(parseConstantValue('null')).toBe(null);
    expect(parseConstantValue('123')).toBe(123);
    expect(parseConstantValue('-45.6')).toBe(-45.6);
    expect(parseConstantValue('hello')).toBe('hello');
  });

  it('buildRuleEffects generates expected effects', () => {
    const draft = createEmptyRuleDraft();
    draft.behavior = 'SHOW';
    expect(buildRuleEffects(draft)).toEqual({ hidden: false });

    draft.behavior = 'HIDE';
    expect(buildRuleEffects(draft)).toEqual({ hidden: true });

    draft.behavior = 'DISABLE';
    expect(buildRuleEffects(draft)).toEqual({ disabled: true });

    draft.behavior = 'ENABLE';
    expect(buildRuleEffects(draft)).toEqual({ disabled: false });

    draft.behavior = 'REQUIRED';
    expect(buildRuleEffects(draft)).toEqual({ required: true });

    draft.behavior = 'OPTIONAL';
    expect(buildRuleEffects(draft)).toEqual({ required: false });

    draft.behavior = 'READ';
    expect(buildRuleEffects(draft)).toEqual({ readonly: true });

    draft.behavior = 'EDIT';
    expect(buildRuleEffects(draft)).toEqual({ readonly: false });

    draft.behavior = 'CLEAR';
    expect(buildRuleEffects(draft)).toEqual({ computedValue: '' });

    draft.behavior = 'SET_VALUE';
    draft.constantValue = '100';
    expect(buildRuleEffects(draft)).toEqual({ computedValue: 100 });
  });

  it('buildRuleCondition creates condition group', () => {
    const draft = createEmptyRuleDraft();
    draft.sourceField = 'type';
    draft.operator = '==';
    draft.conditionValue = 'vip';

    const cond = buildRuleCondition(draft);
    expect(cond).toEqual({
      logic: 'AND',
      items: [{ field: 'type', operator: '==', value: 'vip' }],
    });
  });

  it('buildReactiveRule and inferRuleBehavior work roundtrip', () => {
    const draft = createEmptyRuleDraft();
    draft.sourceField = 'switch1';
    draft.targetId = 'input1';
    draft.operator = '==';
    draft.conditionValue = true;
    draft.behavior = 'SHOW';

    const rule = buildReactiveRule(draft, 'rule_1');
    expect(rule).not.toBeNull();
    expect(rule?.id).toBe('rule_1');
    expect(rule?.targetField).toBe('input1');
    expect(inferRuleBehavior(rule as ReactiveRule)).toBe('SHOW');
  });

  it('findRelatedReactiveRules matches target and source', () => {
    const pageSchema: PageSchema = {
      schemas: [],
      reactiveRules: [
        {
          id: 'r1',
          targetField: 'input1',
          effects: { hidden: false },
          condition: {
            logic: 'AND',
            items: [{ field: 'type', operator: '==' }],
          },
        },
        {
          id: 'r2',
          targetField: 'input2',
          effects: { disabled: true },
          condition: {
            logic: 'AND',
            items: [{ field: 'status', operator: '==' }],
          },
        },
      ],
    };

    const related = findRelatedReactiveRules(pageSchema, {
      id: 'input1',
      field: 'input1_field',
      type: 'input',
    });
    expect(related.total).toBe(1);
    expect(related.asTarget.length).toBe(1);
    expect(related.asTarget[0].id).toBe('r1');

    const relatedSource = findRelatedReactiveRules(pageSchema, {
      id: 'type_id',
      field: 'type',
      type: 'select',
    });
    expect(relatedSource.total).toBe(1);
    expect(relatedSource.asSource.length).toBe(1);
    expect(relatedSource.asSource[0].id).toBe('r1');
  });

  it('upsertReactiveRule and removeReactiveRule work properly', () => {
    const pageSchema: PageSchema = {
      schemas: [],
      reactiveRules: [],
    };

    const rule: ReactiveRule = {
      id: 'r1',
      targetField: 't1',
      effects: { hidden: true },
    };

    upsertReactiveRule(pageSchema, rule);
    expect(collectReactiveRules(pageSchema).length).toBe(1);

    const updatedRule: ReactiveRule = {
      id: 'r1',
      targetField: 't1',
      effects: { hidden: false },
    };
    upsertReactiveRule(pageSchema, updatedRule);
    expect(collectReactiveRules(pageSchema).length).toBe(1);
    expect(pageSchema.reactiveRules?.[0].effects.hidden).toBe(false);

    const removed = removeReactiveRule(pageSchema, 'r1');
    expect(removed).toBe(true);
    expect(collectReactiveRules(pageSchema).length).toBe(0);
  });
});
