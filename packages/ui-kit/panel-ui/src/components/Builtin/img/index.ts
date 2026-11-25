import type { ComponentConfigModel } from '@aigen-designer/types';

import { createSelectOptions, DEFAULT_IMG_PLACEHOLDER } from '../shared';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        description: '图片的资源 URL 地址或 Base64 编码',
        field: 'props.src',
        group: '基础信息',
        label: '图片地址',
        type: 'input',
      },
      {
        description: '图片加载失败或无障碍读取时显示的替代说明文字',
        field: 'props.alt',
        group: '基础信息',
        label: '替代文本',
        type: 'input',
      },
      {
        description: '控制图片内容在指定宽高容器内的裁剪与缩放适应方式',
        field: 'props.objectFit',
        group: '外观与布局',
        label: '填充模式',
        props: {
          options: createSelectOptions(['cover', 'contain', 'fill', 'none']),
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        description: '设置图片的显示宽度（支持 px、% 等 CSS 单位）',
        field: 'props.width',
        group: '外观与布局',
        label: '宽度',
        type: 'input',
      },
      {
        description: '设置图片的显示高度（支持 px、% 等 CSS 单位）',
        field: 'props.height',
        group: '外观与布局',
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
