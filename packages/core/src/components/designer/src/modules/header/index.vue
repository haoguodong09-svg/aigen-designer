<script lang="ts" setup>
import { AigenIcon } from '@aigen-designer/base-ui';
import { useDesignerContext } from '@aigen-designer/hooks';
import { pluginManager } from '@aigen-designer/manager';

const emits = defineEmits(['save', 'reset', 'preview']);
const Button = pluginManager.component.get('button');
const designerProps = useDesignerContext().props;

/**
 * 预览
 */
function handlePreview() {
  emits('preview');
}

/**
 * 触发保存操作
 */
function handleSave() {
  emits('save');
}
</script>
<template>
  <header class="aigen-header relative">
    <div class="aigen-header-item flex flex-1 items-center">
      <slot name="prefix">
        <a
          class="decoration-none flex items-center"
          href="https://github.com/haoguodong09-svg/aigen-designer"
          target="_blank"
        >
          <img
            src="../../../../../static/logo.png"
            class="w-18px h-18px"
            alt=""
            srcset=""
          />
          <span class="ml-3">AigenDesigner</span>
        </a>
      </slot>
    </div>

    <div class="aigen-header-item text-12px flex flex-1 justify-center">
      <slot name="title">
        {{ designerProps.title }}
      </slot>
    </div>
    <div class="aigen-header-item flex flex-1 items-center justify-end">
      <slot name="right-prefix"></slot>
      <slot name="right-action">
        <div>
          <Button size="small" @click="handlePreview">
            <span class="flex! h-full items-center">
              <AigenIcon name="icon--aigen--eye" class="mr-4px" />
              预览
            </span>
          </Button>
        </div>
        <div class="ml-2">
          <Button size="small" @click="handleSave">
            <span class="flex! h-full items-center">
              <AigenIcon
                name="icon--aigen--save-outline-rounded"
                class="mr-4px"
              />
              保存
            </span>
          </Button>
        </div>
      </slot>
      <slot name="right-suffix"></slot>
    </div>
  </header>
</template>