<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const uiKey = computed(() => {
  return route.params.ui as string;
});
</script>
<template>
  <div :key="uiKey" class="aigen-page-container">
    <router-view />
  </div>
</template>
