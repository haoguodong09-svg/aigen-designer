import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: async () => await import('./index.vue'),
  config: {},
  defaultSchema: {
    input: true,
    label: '数据字段',
    type: 'AigenField',
  },
} as ComponentConfigModel;