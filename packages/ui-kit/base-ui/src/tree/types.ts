import type { ComponentSchema } from '@aigen-designer/types';

export interface TreeProps {
  draggable?: boolean;
  hoverKey?: string;
  options: ComponentSchema[];
  selectedKeys: string[];
}
