import type { ComponentConfigModel } from '@aigen-designer/types';

export default {
  component: async () => await import('./index.vue'),
  config: {
    attribute: [
      {
        description: '视频资源 URL 地址（支持 mp4 / webm 等格式）',
        field: 'props.src',
        group: '基础信息',
        label: '视频地址',
        type: 'input',
      },
      {
        description: '是否显示播放/暂停、进度条等控制栏',
        field: 'props.controls',
        group: '基础信息',
        label: '显示控件',
        type: 'switch',
      },
      {
        description: '加载完成后是否自动播放',
        field: 'props.autoplay',
        group: '基础信息',
        label: '自动播放',
        type: 'switch',
      },
      {
        description: '播放结束后是否循环播放',
        field: 'props.loop',
        group: '基础信息',
        label: '循环播放',
        type: 'switch',
      },
      {
        description: '是否默认静音播放',
        field: 'props.muted',
        group: '基础信息',
        label: '静音播放',
        type: 'switch',
      },
      {
        description: '设置视频播放器宽度（支持 px、% 等单位）',
        field: 'props.width',
        group: '外观与布局',
        label: '播放器宽度',
        type: 'input',
      },
      {
        description: '设置视频播放器高度（支持 px、% 等单位）',
        field: 'props.height',
        group: '外观与布局',
        label: '播放器高度',
        type: 'input',
      },
    ],
  },
  defaultSchema: {
    label: '视频',
    props: {
      autoplay: false,
      controls: true,
      height: '180px',
      loop: false,
      muted: false,
      src: '',
      width: '100%',
    },
    type: 'video',
  },
  groupName: '基础元素',
  icon: 'icon--aigen--preview-outline',
  sort: 695,
} as ComponentConfigModel;
