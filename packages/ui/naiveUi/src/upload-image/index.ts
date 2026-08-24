import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  bindModel: 'modelValue',
  component: () => import('./uploadImage'),
  config: {
    attribute: [
      {
        field: 'field',
        label: '数据字段',
        type: 'EpField',
      },
      {
        field: 'label',
        label: '标题',
        type: 'input',
      },
      {
        field: 'props.action',
        label: '请求地址',
        type: 'input',
      },
      {
        field: 'props.name',
        label: '上传文件字段',
        type: 'input',
      },
      {
        field: 'props.maxCount',
        label: '允许上传最大数量',
        props: {
          min: 0,
        },
        type: 'number',
      },
      {
        field: 'props.showFileList',
        label: '展示文件列表',
        type: 'switch',
      },
      {
        field: 'props.multiple',
        label: '多选',
        type: 'switch',
      },
      {
        field: 'props.disabled',
        label: '禁用',
        type: 'switch',
      },
      {
        field: 'props.hidden',
        label: '隐藏',
        type: 'switch',
      },
      {
        description: '校验规则需要配合表单使用',
        field: 'rules',
        label: '表单校验',
        layout: 'vertical',
        props: {
          ruleType: 'string',
        },
        type: 'ERuleEditor',
      },
    ],
  },
  defaultSchema: {
    field: 'uploadImage',
    input: true,
    label: '上传图片',
    props: {
      action: '/api/common/upload',
    },
    type: 'upload-image',
  },
  groupName: '表单',
  icon: 'icon--aigen--imagesmode-outline-rounded',
  sort: 920,
} as ComponentConfigModel;