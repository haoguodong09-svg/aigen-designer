import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./button.vue'),
  config: {
    attribute: [
      {
        description: '按钮上显示的文字内容',
        field: 'label',
        group: '基础信息',
        label: '标题',
        type: 'input',
      },
      {
        description: '设置按钮的视觉语义类型（如主按钮、虚线、链接等）',
        field: 'props.type',
        group: '基础信息',
        label: '类型',
        props: {
          clearable: true,
          options: [
            {
              label: 'primary',
              value: 'primary',
            },
            {
              label: 'ghost',
              value: 'ghost',
            },
            {
              label: 'dashed',
              value: 'dashed',
            },
            {
              label: 'link',
              value: 'link',
            },
            {
              label: 'text',
              value: 'text',
            },
            {
              label: 'default',
              value: 'default',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '设置原生 button 标签的 type 属性',
        field: 'props.htmlType',
        group: '基础信息',
        label: '操作类型',
        props: {
          clearable: true,
          options: [
            {
              label: 'button',
              value: 'button',
            },
            {
              label: 'submit',
              value: 'submit',
            },
            {
              label: 'reset',
              value: 'reset',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '点击按钮后跳转的链接地址，设置后将渲染为超链接',
        field: 'props.href',
        group: '基础信息',
        label: '链接',
        props: {
          allowClear: true,
        },
        type: 'input',
      },
      {
        description: '指定链接的打开窗口方式（如新标签页或当前页）',
        field: 'props.target',
        group: '基础信息',
        label: '链接打开方式',
        props: {
          clearable: true,
          options: [
            {
              label: 'blank',
              value: '_blank',
            },
            {
              label: 'parent',
              value: '_parent',
            },
            {
              label: 'self',
              value: '_self',
            },
            {
              label: 'top',
              value: '_top',
            },
          ],
        },
        show: ({ values }) => values.props?.href,
        type: 'select',
      },
      {
        description: '设置按钮的尺寸大小',
        field: 'props.size',
        group: '外观与布局',
        label: '尺寸',
        props: {
          allowClear: true,
          options: [
            {
              label: 'default',
              value: 'default',
            },
            {
              label: 'small',
              value: 'small',
            },
            {
              label: 'large',
              value: 'large',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '设置按钮的边角形状（默认、圆形或胶囊圆角）',
        field: 'props.shape',
        group: '外观与布局',
        label: '形状',
        props: {
          clearable: true,
          options: [
            {
              label: 'default',
              value: 'default',
            },
            {
              label: 'circle',
              value: 'circle',
            },
            {
              label: 'round',
              value: 'round',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '开启后按钮背景变为透明，文字和边框保持主色',
        field: 'props.ghost',
        group: '外观与布局',
        label: '幽灵按钮',
        type: 'switch',
      },
      {
        description: '是否显示加载中图标并阻止重复点击',
        field: 'props.loading',
        group: '校验与限制',
        label: '加载状态',
        type: 'switch',
      },
      {
        description: '将按钮宽度调整为其父容器的 100%',
        field: 'props.block',
        group: '外观与布局',
        label: '宽度自适应',
        type: 'switch',
      },
      {
        description: '将按钮样式设置为红色警示状态',
        field: 'props.danger',
        group: '外观与布局',
        label: '危险按钮',
        type: 'switch',
      },
      {
        description: '是否禁用按钮，禁用后不可点击',
        field: 'props.disabled',
        group: '校验与限制',
        label: '禁用',
        type: 'switch',
      },
      {
        description: '是否在页面渲染时隐藏该按钮',
        field: 'props.hidden',
        group: '校验与限制',
        label: '隐藏',
        type: 'switch',
      },
    ],
    event: [
      {
        description: '点击按钮时',
        type: 'click',
      },
      {
        description: '双击按钮时',
        type: 'dblclick',
      },
    ],
    slots: {
      icon: {
        label: '图标插槽',
      },
    },
  },
  defaultSchema: {
    field: 'input',
    input: false,
    label: '按钮',
    type: 'button',
  },
  editConstraints: {
    inline: true,
  },
  groupName: '表单',
  icon: 'icon--aigen--fit-screen-rounded',
  sort: 1200,
} as ComponentConfigModel;
