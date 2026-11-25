import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        description: '选择内置图标库中要渲染的图标名称',
        field: 'props.name',
        group: '基础信息',
        label: '图标名称',
        type: 'AigenIconPicker',
      },
      {
        description: '设置图标的渲染尺寸大小（如 20px）',
        field: 'props.fontSize',
        group: '外观与布局',
        label: '图标大小',
        type: 'input',
      },
      {
        description: '设置图标的颜色值（如 #1677ff 或 CSS 颜色名）',
        field: 'props.color',
        group: '外观与布局',
        label: '图标颜色',
        type: 'input',
      },
    ],
  },
  defaultSchema: {
    label: '图标',
    props: {
      fontSize: '20px',
      name: 'icon--aigen--add-rounded',
    },
    type: 'icon',
  },
  editConstraints: {
    inline: true,
  },
  groupName: '基础元素',
  icon: 'icon--aigen--component',
  sort: 740,
} as ComponentConfigModel;
