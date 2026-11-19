import type { FormDataModel } from '@aigen-designer/types';

import { inject, reactive } from 'vue';

import { PAGE_MANAGER_KEY } from '../designer/usePageManager';
import { FORM_CONTEXT_KEY } from './useForm';

/**
 * 获取当前节点所属的表单数据。
 * - 位于 <form> 内：使用该表单通过 provide 注入的独立数据；
 * - 位于页面/布局容器中（无 <form>）：回退到 pageManager 的页面级共享数据，
 *   保证页面级字段之间也能互相读取、参与联动条件与公式计算。
 *   旧实现回退为「每个节点各自 reactive({})」，导致页面级字段的联动条件永远读不到值。
 * - 脱离 Builder 上下文（如设计器属性面板）：再回退为节点本地响应式对象。
 */
export function useFormItem() {
  const injectedFormData = inject<FormDataModel | null>(FORM_CONTEXT_KEY, null);
  const pageManager = inject<null | { pageFormData?: FormDataModel }>(
    PAGE_MANAGER_KEY,
    null,
  );
  const formData = (injectedFormData ??
    pageManager?.pageFormData ??
    reactive({})) as FormDataModel;
  return { formData };
}
