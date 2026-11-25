import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        field: 'slotName',
        label: '插槽名称',
        type: 'input',
      },
      {
        field: 'description',
        label: '插槽说明',
        type: 'input',
      },
    ],
  },
  defaultSchema: {
    label: '插槽',
    slotName: 'default',
    slotParams: [],
    type: 'slot',
  },
  groupName: '高级',
  icon: 'icon--aigen--sdk-outline-rounded',
  sort: 900,
} as ComponentConfigModel;
