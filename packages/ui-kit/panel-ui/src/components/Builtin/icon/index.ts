import type { ComponentConfigModel } from '@aigen-designer/types';

const BUILTIN_ICON_OPTIONS = [
  { label: '加号 (add-rounded)', value: 'icon--aigen--add-rounded' },
  { label: '减号 (minus-rounded)', value: 'icon--aigen--minus-rounded' },
  { label: '搜索 (search-rounded)', value: 'icon--aigen--search-rounded' },
  {
    label: '删除 (delete-outline-rounded)',
    value: 'icon--aigen--delete-outline-rounded',
  },
  {
    label: '编辑 (edit-square-outline-rounded)',
    value: 'icon--aigen--edit-square-outline-rounded',
  },
  {
    label: '复制 (copy-all-outline-rounded)',
    value: 'icon--aigen--copy-all-outline-rounded',
  },
  {
    label: '保存 (save-outline-rounded)',
    value: 'icon--aigen--save-outline-rounded',
  },
  { label: '上传 (upload-rounded)', value: 'icon--aigen--upload-rounded' },
  {
    label: '查看 (visibility-outline-rounded)',
    value: 'icon--aigen--visibility-outline-rounded',
  },
  {
    label: '隐藏 (visibility-off-outline-rounded)',
    value: 'icon--aigen--visibility-off-outline-rounded',
  },
  { label: '锁定 (lock-outline)', value: 'icon--aigen--lock-outline' },
  {
    label: '解锁 (lock-open-outline)',
    value: 'icon--aigen--lock-open-outline',
  },
  { label: '信息 (info)', value: 'icon--aigen--info' },
  {
    label: '帮助 (help-outline-rounded)',
    value: 'icon--aigen--help-outline-rounded',
  },
  {
    label: '警告 (error-outline-rounded)',
    value: 'icon--aigen--error-outline-rounded',
  },
  { label: '链接 (link-rounded)', value: 'icon--aigen--link-rounded' },
  {
    label: '日历 (calendar-month-outline-rounded)',
    value: 'icon--aigen--calendar-month-outline-rounded',
  },
  { label: '时间 (time-line)', value: 'icon--aigen--time-line' },
  { label: '组件 (component)', value: 'icon--aigen--component' },
  { label: '代码 (code)', value: 'icon--aigen--code' },
  { label: '调色板 (palette-outline)', value: 'icon--aigen--palette-outline' },
  {
    label: '图片 (imagesmode-outline-rounded)',
    value: 'icon--aigen--imagesmode-outline-rounded',
  },
  {
    label: '左箭头 (arrow-back-ios-rounded)',
    value: 'icon--aigen--arrow-back-ios-rounded',
  },
  {
    label: '右箭头 (arrow-forward-ios-rounded)',
    value: 'icon--aigen--arrow-forward-ios-rounded',
  },
];

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        field: 'props.name',
        label: '图标名称',
        props: {
          options: BUILTIN_ICON_OPTIONS,
          style: { width: '100%' },
        },
        type: 'select',
      },
      {
        field: 'props.fontSize',
        label: '图标大小',
        type: 'input',
      },
      {
        field: 'props.color',
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
