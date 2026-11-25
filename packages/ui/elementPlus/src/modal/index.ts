import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./modal.vue'),
  config: {
    attribute: [
      {
        field: 'title',
        label: '标题',
        type: 'input',
      },
    ],
    slots: {
      footer: {
        label: '底部操作区',
      },
      header: {
        label: '标题插槽',
      },
    },
  },
  defaultSchema: {
    label: '模态框',
    type: 'modal',
    children: [],
  },
} as ComponentConfigModel;
