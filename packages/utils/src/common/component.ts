import type { AsyncComponentLoader, Component } from 'vue';

import { defineAsyncComponent } from 'vue';

import { AigenBaseLoader } from '@aigen-designer/base-ui';

/**
 * 异步加载组件
 * @param loader
 */
export const loadAsyncComponent = (
  loader: AsyncComponentLoader,
  loadingComponent: Component = AigenBaseLoader,
) =>
  defineAsyncComponent({
    delay: 80,
    loader,
    loadingComponent,
  });
