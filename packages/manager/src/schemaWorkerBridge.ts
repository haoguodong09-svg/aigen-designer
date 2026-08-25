/**
 * Schema Worker 桥接层：单例 Worker + 自增请求 id + Promise 回调映射。
 * W6（revoke diff Worker 化）与 W15（Builder 渲染优化）通过 postToWorker() 调用。
 *
 * - 使用 new URL('./schema.worker.ts', import.meta.url) 创建 Worker。
 * - 请求 id 自增，响应按 id 匹配到对应 Promise，支持并发请求。
 * - type === 'error' 的响应会 reject 对应 Promise（错误消息透传）。
 * - 该模块不依赖 Vue/响应式，仅依赖 Worker 全局；无 Worker 环境下
 *   postToWorker 会以 Promise 拒绝的形式报告错误，不会抛出同步异常。
 * - @vite-ignore：库构建（aigen-designer dist）不生成独立 worker 资源文件，
 *   避免 vite 库模式对 worker URL 的根绝对路径输出破坏消费方构建（vite 已知局限）。
 *   库消费场景下 worker 加载失败（404）会走错误处理 → 调用方同步回退；
 *   monorepo dev / 源码链路下由应用自身 vite 配置处理 worker 打包，功能完整。
 */
import type {
  SchemaWorkerRequest,
  SchemaWorkerResponse,
} from './schema.worker';

let worker: null | Worker = null;
/** worker 加载/运行失败标记：失败后本会话不再重试创建（调用方走同步回退） */
let workerBroken = false;
let requestId = 0;
const pending = new Map<
  number,
  { reject: (e: Error) => void; resolve: (v: any) => void }
>();

/** 拒绝所有挂起请求 */
function rejectAllPending(reason: string): void {
  for (const { reject } of pending.values()) {
    reject(new Error(reason));
  }
  pending.clear();
}

/** 获取（懒创建）单例 Worker；不可用时抛出（调用方自行降级） */
function getWorker(): Worker {
  if (workerBroken) {
    throw new Error('Schema Worker 不可用（此前加载失败），已降级为同步路径');
  }
  if (!worker) {
    const instance = new Worker(
      // unicorn/relative-url-style：vite 的 worker 资源解析要求相对 URL 带 ./ 前缀
      // eslint-disable-next-line unicorn/relative-url-style
      new URL('./schema.worker.ts', import.meta.url),
      { type: 'module' },
    );
    instance.addEventListener('message', (e) => {
      const { error, id, result, type } = (
        e as MessageEvent<SchemaWorkerResponse>
      ).data;
      const handler = pending.get(id);
      if (!handler) {
        // 未知 id（如已 dispose 后迟到的响应）：直接丢弃
        return;
      }
      if (type === 'error') {
        handler.reject(new Error(error));
      } else {
        handler.resolve(result);
      }
      pending.delete(id);
    });
    instance.addEventListener('error', (event) => {
      // 脚本加载失败（如库消费场景下资源路径不可解析）或运行期错误：
      // 拒绝全部挂起请求并标记降级，避免请求悬挂
      console.warn(
        '[schemaWorkerBridge] Worker 加载/运行失败，降级为同步路径:',
        event?.message ?? event,
      );
      workerBroken = true;
      rejectAllPending('Schema Worker 加载/运行失败，请求被取消');
      instance.terminate();
      worker = null;
    });
    worker = instance;
  }
  return worker;
}

/**
 * 向 Schema Worker 发送请求并等待结果
 * @param type 消息类型：computeDiff | processSchema | materialize | validateImport
 * @param payload 消息载荷（协议见 schema.worker.ts）
 * @returns Worker 计算结果；Worker 不可用或内抛错时 Promise 以 Error 拒绝（调用方应回退同步实现）
 */
export function postToWorker<T = any>(type: string, payload: any): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = ++requestId;
    pending.set(id, { reject, resolve });
    try {
      getWorker().postMessage({ id, payload, type } as SchemaWorkerRequest);
    } catch (error) {
      // 构造或 postMessage 失败（如环境无 Worker / 已降级）：同步清理并拒绝，避免悬挂
      pending.delete(id);
      reject(
        error instanceof Error
          ? error
          : new Error(`postToWorker 发送失败: ${String(error)}`),
      );
    }
  });
}

/**
 * 终止 Worker 并清理未完成请求（组件卸载 / 测试重置时使用）。
 * 调用后再次 postToWorker 会重新创建 Worker（降级标记一并重置）。
 */
export function disposeSchemaWorker(): void {
  rejectAllPending('Schema Worker 已终止，请求被取消');
  worker?.terminate();
  worker = null;
  workerBroken = false;
}
