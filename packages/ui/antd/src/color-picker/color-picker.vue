<script lang="ts" setup>
defineOptions({
  name: 'AigenColorPicker',
});

const props = withDefaults(
  defineProps<{
    class?: string;
    disabled?: boolean;
    placeholder?: string;
    readonly?: boolean;
    style?: Record<string, any>;
    value?: string;
  }>(),
  {
    class: '',
    placeholder: '请选择颜色',
    style: () => ({}),
    value: '',
  },
);

const emit = defineEmits<{
  (e: 'update:value', value: string): void;
}>();

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  emit('update:value', target.value);
}
</script>
<template>
  <input
    type="color"
    :value="props.value ?? ''"
    :placeholder="props.placeholder"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :style="props.style"
    :class="props.class"
    @input="handleInput"
  />
</template>
