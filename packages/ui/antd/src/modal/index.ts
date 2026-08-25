import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./modal.vue'),
  config: {
    attribute: [
      {
        // 与组件 props 对齐：modal.vue 使用 componentSchema.label 作为标题
        field: 'label',
        label: '标题',
        type: 'input',
      },
    ],
  },
  defaultSchema: {
    label: '模态框',
    type: 'modal',
    children: [],
  },
  icon: 'aigen-icon-xiala',
} as ComponentConfigModel;
