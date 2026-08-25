import type { ComponentInternalInstance } from 'vue';

import type { ComponentSchema } from './aigen-designer';

export interface ExtendedExposed {
  getAttr?: (key: string) => unknown;
  getValue?: () => unknown;
  schema?: ComponentSchema;
  setAttr?: (key: string, value: unknown) => unknown;
  setValue?: (value: unknown) => void;
}

export type AigenNodeInstance = ComponentInternalInstance & {
  exposed?: ComponentInternalInstance['exposed'] & ExtendedExposed;
};
