import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./modal.vue'),
  config: {
    action: [
      {
        description: '打开模态框',
        type: 'open',
      },
      {
        description: '关闭模态框',
        type: 'close',
      },
      {
        description: '切换模态框显示状态',
        type: 'toggle',
      },
      {
        description: '设置确定按钮加载状态',
        type: 'setConfirmLoading',
      },
      {
        description: '动态设置弹窗标题',
        type: 'setTitle',
      },
    ],
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
  icon: 'icon--aigen--window-outline',
} as ComponentConfigModel;
