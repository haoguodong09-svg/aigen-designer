<script lang="ts" setup>
import { useTheme } from '@aigen-designer/hooks';
import {
  ConfigProvider,
  Layout,
  LayoutContent,
  LayoutSider,
  theme,
} from 'ant-design-vue';

import AigenHeader from './components/Header/index.vue';
import Main from './components/Main/index.vue';
import AigenMenu from './components/Menu/index.vue';

const { isDark } = useTheme();
</script>
<template>
  <ConfigProvider
    :theme="{
      algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    }"
  >
    <Layout class="maximize aigen-scoped">
      <AigenHeader />
      <Layout>
        <LayoutSider>
          <div class="aigen-demo-menu h-full">
            <AigenMenu />
          </div>
        </LayoutSider>
        <LayoutContent>
          <Main />
        </LayoutContent>
      </Layout>
    </Layout>
  </ConfigProvider>
</template>