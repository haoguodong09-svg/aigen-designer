import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        description: '定义插槽的唯一具名标识，供父组件向此位置注入内容',
        field: 'slotName',
        group: '基础信息',
        label: '插槽名称',
        type: 'input',
      },
      {
        description: '描述该插槽的用途说明，便于使用者理解插入位置',
        field: 'description',
        group: '基础信息',
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
