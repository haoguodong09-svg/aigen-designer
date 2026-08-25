import { computed, ref } from 'vue';

export function useMountMonitor() {
  // 存储待加载项的id列表
  // 使用 Set 替代数组：pop 从 O(n) 的 filter 降为 O(1) 的 delete（性能文档 P-W7）
  const pendingIds = ref(new Set<string>());

  // 使用 computed 确保状态是响应式的
  const isAllMounted = computed(() => pendingIds.value.size === 0);

  /**
   * 注册待加载项
   */
  function push(id: string) {
    pendingIds.value.add(id);
  }

  /**
   * 移除待加载项
   */
  function pop(id: string) {
    pendingIds.value.delete(id);
  }

  /**
   * 重置待加载项
   */
  function reset() {
    pendingIds.value = new Set();
  }

  return {
    isAllMounted,
    pendingIds,
    pop,
    push,
    reset,
  };
}

export type MountMonitor = ReturnType<typeof useMountMonitor>;
