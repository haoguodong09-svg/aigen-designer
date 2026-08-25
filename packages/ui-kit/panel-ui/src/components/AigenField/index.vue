<script lang="ts" setup>
import { useBindModel } from '@aigen-designer/base-ui';
import { pluginManager } from '@aigen-designer/manager';

const Input = pluginManager.component.get('input');
const modelValue = defineModel<string>();
const { bindModel } = useBindModel('input');
</script>

<template>
  <Input v-model:[bindModel]="modelValue" />
</template>
