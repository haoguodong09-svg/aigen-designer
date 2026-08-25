import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./collapseItem'),
  config: {
    attribute: [],
  },
  defaultSchema: {
    label: '折叠项',
    type: 'collapse-item',
    children: [],
  },
} as ComponentConfigModel;
