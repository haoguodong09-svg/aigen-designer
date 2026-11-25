import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: () => import('./button'),
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
        description: '设置按钮的视觉语义主题（主色、成功、信息、警告、危险）',
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
              label: 'success',
              value: 'success',
            },
            {
              label: 'info',
              value: 'info',
            },
            {
              label: 'warning',
              value: 'warning',
            },
            {
              label: 'danger',
              value: 'danger',
            },
          ],
        },
        type: 'select',
      },
      {
        description: '设置原生 button 标签的 type 属性',
        field: 'props.native-type',
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
        description: '自定义按钮的主题颜色并自动计算悬停与激活态配色',
        field: 'props.color',
        group: '外观与布局',
        label: '自定义颜色',
        props: {
          type: 'color',
        },
        type: 'color-picker',
      },
      {
        description: '开启后渲染为浅色背景的朴素样式按钮',
        field: 'props.plain',
        group: '外观与布局',
        label: '朴素按钮',
        type: 'switch',
      },
      {
        description: '开启后将按钮两侧边角设置为胶囊圆角样式',
        field: 'props.round',
        group: '外观与布局',
        label: '圆角按钮',
        type: 'switch',
      },
      {
        description: '开启后将按钮渲染为正圆形，适合纯图标按钮',
        field: 'props.circle',
        group: '外观与布局',
        label: '圆形按钮',
        type: 'switch',
      },
      {
        description: '开启后仅保留文字外观，隐藏默认背景与边框',
        field: 'props.text',
        group: '外观与布局',
        label: '文字按钮',
        type: 'switch',
      },
      {
        description: '是否显示加载中状态图标并禁止点击',
        field: 'props.loading',
        group: '校验与限制',
        label: '加载状态',
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
