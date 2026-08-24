<script lang="ts" setup>
import { pluginManager } from '@aigen-designer/manager';

const Input = pluginManager.component.get('input');
const modelValue = defineModel<string>();
</script>

<template>
  <Input v-model="modelValue" v-model:value="modelValue" />
</template>