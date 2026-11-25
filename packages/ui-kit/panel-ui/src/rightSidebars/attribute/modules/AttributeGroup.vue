<script lang="ts" setup>
import { ref } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';

const props = withDefaults(
  defineProps<{
    count?: number;
    defaultExpanded?: boolean;
    title: string;
  }>(),
  {
    count: undefined,
    defaultExpanded: true,
  },
);

const expanded = ref(props.defaultExpanded);
</script>
<template>
  <div class="aigen-attr-group">
    <button
      type="button"
      class="aigen-attr-group__header"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="aigen-attr-group__title">
        <AigenIcon
          name="icon--aigen--arrow-forward-ios-rounded"
          class="aigen-attr-group__arrow"
          :class="{ 'is-expanded': expanded }"
        />
        <span>{{ props.title }}</span>
        <span v-if="props.count !== undefined" class="aigen-attr-group__count">
          {{ props.count }}
        </span>
      </span>
    </button>
    <div v-show="expanded" class="aigen-attr-group__body">
      <slot></slot>
    </div>
  </div>
</template>
