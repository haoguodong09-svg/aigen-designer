// 兼容旧文件名（已弃用，请使用上方正确拼写）
export * from './useBuiderDisabled';
export * from './useBuiderReadonly';

export * from './useBuilderContext';
// 正确拼写的新文件（显式导出，避免与旧文件名的 star 导出产生命名冲突）
export {
  BUILDER_DISABLED_KEY,
  injectBuilderDisabled,
  provideBuilderDisabled,
} from './useBuilderDisabled';

export {
  BUILDER_READONLY_KEY,
  injectBuilderReadonly,
  provideBuilderReadonly,
} from './useBuilderReadonly';
export * from './useDesignerContext';
export * from './useFieldPathPrefix';
export * from './useLinkMode';
export * from './useNodeAttrs';
export * from './usePageManager';
export * from './useTableMeta';
