<script lang="ts" setup>
import BaseLoader from './baseLoader.vue';
</script>
<template>
  <div class="aigen-designer-skeleton relative">
    <div class="aigen-skeleton-header">
      <div class="aigen-skeleton-header-left">
        <div class="aigen-skeleton-button"></div>
      </div>
      <div class="aigen-skeleton-header-right">
        <div class="aigen-skeleton-button"></div>
        <div class="aigen-skeleton-button"></div>
      </div>
    </div>
    <div class="aigen-skeleton-body">
      <div class="aigen-skeleton-activity-bar">
        <div class="aigen-skeleton-activity-item"></div>
        <div class="aigen-skeleton-activity-item"></div>
        <div class="aigen-skeleton-activity-item"></div>
      </div>
      <div class="aigen-skeleton-sidebar">
        <div class="aigen-skeleton-form-item"></div>
        <div class="aigen-skeleton-form-item"></div>
        <div class="aigen-skeleton-form-item"></div>
      </div>
      <div class="flex-1"></div>
      <div class="aigen-skeleton-sidebar">
        <div class="aigen-skeleton-form-item"></div>
        <div class="aigen-skeleton-form-item"></div>
        <div class="aigen-skeleton-form-item"></div>
      </div>
    </div>
    <BaseLoader class="top-50/100 left-50/100 absolute" />
  </div>
</template>
