import type { ComponentSchema } from '@aigen-designer/types';
import type { PositionType } from '@aigen-designer/utils';

import type { ComputedRef, InjectionKey } from 'vue';

import { computed, inject, provide, reactive } from 'vue';

import { calculatePosLine, isAncestor } from '@aigen-designer/utils';

export interface DragState {
  dragData: ComponentSchema | null;
  dragType: 'move' | 'new' | null;
  isDragging: boolean;
  mousePoint: { x: number; y: number };
  sourceElement: HTMLElement | null;
  startPoint: { x: number; y: number };
}

export interface LineState {
  componentName: string;
  forbidden: boolean;
  id: string;
  position: '' | PositionType;
  rect: { height: number; left: number; top: number; width: number };
  slotName: string;
}

export interface CanvasDrag {
  clearDragOver: () => void;
  dragState: DragState;
  endDrag: () => {
    dragData: ComponentSchema | null;
    dragType: 'move' | 'new' | null;
    lineState: LineState;
  };
  isDragging: ComputedRef<boolean>;
  lineState: LineState;
  startDrag: (
    data: ComponentSchema,
    dragType: 'move' | 'new',
    sourceEl?: HTMLElement | null,
    event?: DragEvent | MouseEvent,
  ) => void;
  startSmoothScroll: (
    container: HTMLElement,
    direction: 'down' | 'up',
    step?: number,
  ) => void;
  stopSmoothScroll: () => void;
  updateDragOver: (
    targetId: string,
    targetRect: {
      bottom: number;
      height: number;
      left: number;
      right: number;
      top: number;
      width: number;
    },
    mousePos: { x: number; y: number },
    options: {
      componentName?: string;
      isContainer: boolean;
      isInline?: boolean;
      onlyIn?: boolean;
      schemas: ComponentSchema[];
      slotName?: string;
    },
  ) => void;
}

export const CANVAS_DRAG_KEY: InjectionKey<CanvasDrag> = Symbol('canvasDrag');

// 模块级单例备用
let globalCanvasDragInstance: CanvasDrag | null = null;

export function createCanvasDrag(): CanvasDrag {
  const dragState = reactive<DragState>({
    dragData: null,
    dragType: null,
    isDragging: false,
    mousePoint: { x: 0, y: 0 },
    sourceElement: null,
    startPoint: { x: 0, y: 0 },
  });

  const lineState = reactive<LineState>({
    componentName: '',
    forbidden: false,
    id: '',
    position: '',
    rect: { height: 0, left: 0, top: 0, width: 0 },
    slotName: '',
  });

  let smoothScrollTimer: null | number = null;
  let smoothScrollDirection: 'down' | 'up' | null = null;
  let smoothScrollTarget: HTMLElement | null = null;
  let smoothScrollStep = 25;

  const isDragging = computed(() => dragState.isDragging);

  function startDrag(
    data: ComponentSchema,
    dragType: 'move' | 'new',
    sourceEl: HTMLElement | null = null,
    event?: DragEvent | MouseEvent,
  ) {
    dragState.isDragging = true;
    dragState.dragType = dragType;
    dragState.dragData = data;
    dragState.sourceElement = sourceEl;

    const x = event?.clientX ?? 0;
    const y = event?.clientY ?? 0;
    dragState.startPoint = { x, y };
    dragState.mousePoint = { x, y };
  }

  function updateDragOver(
    targetId: string,
    targetRect: {
      bottom: number;
      height: number;
      left: number;
      right: number;
      top: number;
      width: number;
    },
    mousePos: { x: number; y: number },
    options: {
      componentName?: string;
      isContainer: boolean;
      isInline?: boolean;
      onlyIn?: boolean;
      schemas: ComponentSchema[];
      slotName?: string;
    },
  ) {
    if (!dragState.isDragging) return;

    dragState.mousePoint = { ...mousePos };

    // 计算几何碰撞方位 (TOP / BOTTOM / LEFT / RIGHT / IN)
    const result = calculatePosLine(targetRect, mousePos, {
      isContainer: options.isContainer,
      isInline: options.isInline,
      onlyIn: options.onlyIn,
    });

    let forbidden = false;

    // 若为已有组件挪动，执行严格的防环死锁检测
    if (
      dragState.dragType === 'move' &&
      dragState.dragData?.id &&
      isAncestor(options.schemas, dragState.dragData.id, targetId)
    ) {
      forbidden = true;
    }

    lineState.id = targetId;
    lineState.position = result.type;
    lineState.rect = {
      height: targetRect.height,
      left: targetRect.left,
      top: targetRect.top,
      width: targetRect.width,
    };
    lineState.forbidden = forbidden;
    lineState.componentName = options.componentName ?? '';
    lineState.slotName = options.slotName ?? '';
  }

  function clearDragOver() {
    lineState.id = '';
    lineState.position = '';
    lineState.rect = { height: 0, left: 0, top: 0, width: 0 };
    lineState.forbidden = false;
    lineState.componentName = '';
    lineState.slotName = '';
  }

  function startSmoothScroll(
    container: HTMLElement,
    direction: 'down' | 'up',
    step = 25,
  ) {
    smoothScrollDirection = direction;
    smoothScrollTarget = container;
    smoothScrollStep = step;
    if (smoothScrollTimer !== null) return;
    smoothScrollTimer = window.setInterval(() => {
      if (!smoothScrollTarget || !smoothScrollDirection) return;
      if (smoothScrollDirection === 'up') {
        smoothScrollTarget.scrollTop -= smoothScrollStep;
      } else {
        smoothScrollTarget.scrollTop += smoothScrollStep;
      }
    }, 40);
  }

  function stopSmoothScroll() {
    if (smoothScrollTimer !== null) {
      window.clearInterval(smoothScrollTimer);
      smoothScrollTimer = null;
    }
    smoothScrollDirection = null;
    smoothScrollTarget = null;
  }

  function endDrag() {
    stopSmoothScroll();
    const result = {
      dragData: dragState.dragData,
      dragType: dragState.dragType,
      lineState: { ...lineState },
    };

    dragState.isDragging = false;
    dragState.dragData = null;
    dragState.dragType = null;
    dragState.sourceElement = null;

    clearDragOver();
    return result;
  }

  const instance: CanvasDrag = {
    clearDragOver,
    dragState,
    endDrag,
    isDragging,
    lineState,
    startDrag,
    startSmoothScroll,
    stopSmoothScroll,
    updateDragOver,
  };

  globalCanvasDragInstance = instance;
  return instance;
}

export function provideCanvasDrag(): CanvasDrag {
  const instance = createCanvasDrag();
  provide(CANVAS_DRAG_KEY, instance);
  return instance;
}

export function useCanvasDrag(): CanvasDrag {
  const injected = inject(CANVAS_DRAG_KEY, null);
  if (injected) return injected;
  if (!globalCanvasDragInstance) {
    globalCanvasDragInstance = createCanvasDrag();
  }
  return globalCanvasDragInstance;
}
