import 'virtual:uno.css';
import './index.less';
// builder
export { AigenBuilder } from './components/builder/';
// designer
export { AigenDesigner } from './components/designer/';
// 兼容旧版组件名

export { default as AigenNodeItem } from './components/designer/src/modules/editContainer/nodeItem.vue';

// 注册全局组件
// const AigenDesignr = {