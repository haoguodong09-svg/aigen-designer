import type { ComponentConfigModel } from '@aigen-designer/types';

import { createSelectOptions, DEFAULT_IMG_PLACEHOLDER } from '../shared';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        field: 'props.src',
        label: '图片地址',
        type: 'input',
      },
      {
        field: 'props.alt',
        label: '替代文本',
        type: 'input',
      },
      {
        field: 'props.objectFit',
        label: '填充模式',
        props: {
          options: createSelectOptions(['cover', 'contain', 'fill', 'none']),
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        field: 'props.width',
        label: '宽度',
        type: 'input',
      },
      {
        field: 'props.height',
        label: '高度',
        type: 'input',
      },
    ],
  },
  defaultSchema: {
    label: '图片',
    props: {
      alt: '图片',
      height: '120px',
      objectFit: 'cover',
      src: DEFAULT_IMG_PLACEHOLDER,
      width: '120px',
    },
    type: 'img',
  },
  groupName: '基础元素',
  icon: 'icon--aigen--imagesmode-outline-rounded',
  sort: 730,
} as ComponentConfigModel;
