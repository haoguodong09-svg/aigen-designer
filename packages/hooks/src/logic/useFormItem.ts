import type { FormDataModel } from '@aigen-designer/types';

import { inject, reactive } from 'vue';

import { FORM_CONTEXT_KEY } from './useForm';

export function useFormItem() {
  const formData = inject(FORM_CONTEXT_KEY, reactive({})) as FormDataModel;
  return { formData };
}
