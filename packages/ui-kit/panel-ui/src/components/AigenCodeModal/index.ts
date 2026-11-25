import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: async () => await import('./index.vue'),
  config: {},
  defaultSchema: {
    label: '代码编辑器',
    props: {},
    type: 'AigenCodeModal',
  },
} as ComponentConfigModel;
