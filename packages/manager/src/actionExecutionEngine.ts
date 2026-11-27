import type {
  ActionsModel,
  PipelineContext,
  PipelineResult,
  TraceContext,
} from '@aigen-designer/types';

import {
  evaluateCondition,
  isFormulaExpressionModel,
  resolveBoundValue,
} from '@aigen-designer/utils';

export interface ActionExecutionOptions {
  formulaEngine?: any;
  funcs?: any;
  getFormData?: () => Record<string, unknown>;
  pageEventBus?: any;
  pageManager?: any;
  pluginManager?: any;
  vars?: any;
}

function isPromise(val: unknown): val is Promise<unknown> {
  return (
    val !== null &&
    typeof val === 'object' &&
    typeof (val as any).then === 'function'
  );
}

/**
 * 新一代异步管道执行引擎（Async Pipeline Engine）
 * - 支持混合同步/异步执行，支持 Promise 链式流转（$prev, $steps）
 * - 活动调用栈（Active Call Stack）精准防环，杜绝合法同名方法误杀
 * - 携带因果调用链与 Trace ID 跨总线防环
 */
export class ActionExecutionEngine {
  public static readonly MAX_CHAIN_DEPTH = 30;

  /** 实例级活动调用栈：生命周期跨 doActions 调用，精准检测递归再入与死循环 */
  private currentActiveStack: string[] = [];
  private currentChainDepth = 0;

  constructor(private options: ActionExecutionOptions) {}

  public executePipeline(
    actions: ActionsModel[],
    initialContext: Partial<PipelineContext> = {},
    scopeName = 'default',
    ...rawArgs: unknown[]
  ): Promise<PipelineResult> {
    if (!actions || actions.length === 0) {
      return Promise.resolve({ stepResults: {}, success: true });
    }

    const traceId =
      initialContext.traceId ??
      `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const causalChain = initialContext.causalChain
      ? [...initialContext.causalChain]
      : [];

    const getFormDataSnapshot = (): Record<string, unknown> => {
      if (typeof this.options.getFormData === 'function') {
        return this.options.getFormData();
      }
      return {};
    };

    const ctx: PipelineContext = {
      activeStack: this.currentActiveStack,
      causalChain,
      formData: initialContext.formData ?? getFormDataSnapshot(),
      prevResult: initialContext.prevResult,
      stepResults: initialContext.stepResults ?? {},
      traceId,
      triggerEvent: initialContext.triggerEvent ?? rawArgs,
      vars: this.options.vars?.value ?? {},
      ...initialContext,
    };

    // 同步/异步混合调度器
    const runStep = (
      index: number,
    ): PipelineResult | Promise<PipelineResult> => {
      if (index >= actions.length) {
        return {
          finalResult: ctx.prevResult,
          stepResults: ctx.stepResults,
          success: true,
        };
      }

      const action = actions[index];
      if (action.enabled === false) {
        return runStep(index + 1);
      }

      // 1. 深度安全边界防线
      if (this.currentChainDepth >= ActionExecutionEngine.MAX_CHAIN_DEPTH) {
        console.error(
          `[Aigen Pipeline Error]: Action cascade depth exceeded threshold (${ActionExecutionEngine.MAX_CHAIN_DEPTH}) in Trace [${traceId}]. Aborting.`,
        );
        return {
          error: new Error('Action cascade depth overflow'),
          success: false,
        };
      }

      // 2. 构造动作执行指纹
      const targetIdentifier =
        action.componentId || action.target || action.id || '';
      const actionSignature = `${action.type}:${targetIdentifier}:${action.methodName || ''}`;

      // 💥 真正的递归再入检测：检查实例级活动调用栈 (Active Stack)
      // 若当前栈帧中已包含该签名，说明其未完成便被再次触发（如自身递归或深层环路重入）
      if (this.currentActiveStack.includes(actionSignature)) {
        console.error(
          `[Aigen Pipeline Error]: Re-entrant cyclic execution detected for '${actionSignature}' in Trace [${traceId}]. Active call stack:`,
          this.currentActiveStack,
        );
        return {
          error: new Error(`Cyclic invocation of '${actionSignature}'`),
          success: false,
        };
      }

      // 3. 入栈 (Push) 与记录因果边
      this.currentActiveStack.push(actionSignature);
      this.currentChainDepth++;
      ctx.causalChain.push(actionSignature);

      const popActive = () => {
        this.currentChainDepth--;
        const idx = this.currentActiveStack.lastIndexOf(actionSignature);
        if (idx !== -1) {
          this.currentActiveStack.splice(idx, 1);
        }
      };

      // 4. 评估单步先验条件
      const currentContext = {
        $event: ctx.triggerEvent,
        $formData: ctx.formData,
        $prev: ctx.prevResult,
        $steps: ctx.stepResults,
        $vars: ctx.vars,
        event: ctx.triggerEvent,
        formData: ctx.formData,
        prev: ctx.prevResult,
        steps: ctx.stepResults,
        vars: ctx.vars,
      };

      if (
        action.condition &&
        !evaluateCondition(action.condition, currentContext)
      ) {
        popActive();
        return runStep(index + 1);
      }

      const executeCurrentAction = (): Promise<unknown> | unknown => {
        try {
          const resolved = this.resolveActionArgs(
            action,
            ctx,
            currentContext,
            rawArgs,
          );
          if (resolved.skip) {
            return undefined;
          }
          return this.executeSingleAction(
            action,
            scopeName,
            resolved.args,
            ctx,
          );
        } catch (error) {
          console.error(
            `[Aigen Action Error] Step ${index + 1} (${action.methodName || action.type}) failed:`,
            error,
          );
          if (action.onError === 'continue') {
            return undefined;
          }
          throw error;
        }
      };

      const handleStepResult = (
        result: unknown,
      ): PipelineResult | Promise<PipelineResult> => {
        popActive();
        ctx.prevResult = result;
        if (action.id) {
          ctx.stepResults[action.id] = result;
        }
        return runStep(index + 1);
      };

      const handleStepError = (err: unknown): PipelineResult => {
        popActive();
        if (action.onError === 'continue') {
          return runStep(index + 1) as PipelineResult;
        }
        return {
          error: err,
          failedActionId: action.id,
          success: false,
        };
      };

      // 延迟分支处理：若指定了 delay > 0，兼容独立非阻塞延迟执行
      if (typeof action.delay === 'number' && action.delay > 0) {
        popActive();
        window.setTimeout(() => {
          this.currentActiveStack.push(actionSignature);
          this.currentChainDepth++;
          try {
            const res = executeCurrentAction();
            if (isPromise(res)) {
              res
                .then((val) => {
                  ctx.prevResult = val;
                  if (action.id) ctx.stepResults[action.id] = val;
                })
                .catch((error) =>
                  console.error('[Aigen Delayed Action Error]:', error),
                )
                .finally(() => popActive());
            } else {
              ctx.prevResult = res;
              if (action.id) ctx.stepResults[action.id] = res;
              popActive();
            }
          } catch (error) {
            popActive();
            console.error('[Aigen Delayed Action Error]:', error);
          }
        }, action.delay);

        return runStep(index + 1);
      }

      try {
        const stepResult = executeCurrentAction();
        return isPromise(stepResult)
          ? stepResult.then(handleStepResult).catch(handleStepError)
          : handleStepResult(stepResult);
      } catch (error) {
        return handleStepError(error);
      }
    };

    const outcome = runStep(0);
    return isPromise(outcome) ? outcome : Promise.resolve(outcome);
  }

  /**
   * API 请求动作：target 为 URL，methodName 为 http 方法（默认 GET），
   * args[0] 为请求数据（对象/原始值）。
   * 优先使用宿主注入的 pageManager.request（便于统一鉴权/拦截），
   * 未注入时回退到全局 fetch。
   */
  private async executeApiAction(
    action: ActionsModel,
    args: unknown[],
  ): Promise<unknown> {
    const url = action.target || (args[1] as string);
    if (!url) {
      console.warn('[Aigen Action]: API 请求缺少 URL');
      return undefined;
    }
    const method = (action.methodName || 'get').toUpperCase();
    const body = args[1] ?? args[0];
    const headers = (args[2] as Record<string, string>) || {};

    if (typeof this.options.pageManager?.request === 'function') {
      return await this.options.pageManager.request(url, {
        body,
        headers,
        method,
      });
    }

    if (typeof fetch !== 'function') {
      console.warn('[Aigen Action]: 当前环境不支持 fetch，API 动作已跳过');
      return undefined;
    }

    // GET / HEAD：把请求数据转为 query string（与面板提示一致）
    let finalUrl = url;
    if (
      ['GET', 'HEAD'].includes(method) &&
      body &&
      typeof body === 'object' &&
      !Array.isArray(body)
    ) {
      const params = new URLSearchParams();
      Object.entries(body as Record<string, unknown>).forEach(
        ([key, value]) => {
          if (value === undefined || value === null) return;
          if (Array.isArray(value)) {
            value.forEach((item) => params.append(key, String(item)));
          } else {
            params.append(key, String(value));
          }
        },
      );
      const query = params.toString();
      if (query) {
        finalUrl += `${finalUrl.includes('?') ? '&' : '?'}${query}`;
      }
    }

    const hasBody = !['GET', 'HEAD'].includes(method) && body !== undefined;
    const response = await fetch(finalUrl, {
      body: hasBody ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      method,
    });
    if (!response.ok) {
      throw new Error(
        `API 请求失败：${response.status} ${response.statusText}`,
      );
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  }

  private executeSingleAction(
    action: ActionsModel,
    scopeName: string,
    args: unknown[],
    ctx: PipelineContext,
  ): unknown {
    switch (action.type) {
      case 'api': {
        return this.executeApiAction(action, args);
      }

      case 'component': {
        const targetId = action.componentId || action.target;
        if (!targetId) {
          console.warn('[Aigen Action]: 未指定 target/componentId');
          return undefined;
        }

        const component = this.options.pageManager?.find
          ? this.options.pageManager.find(targetId, 'id', scopeName)
          : null;

        if (!component) {
          console.warn(`[Aigen：组件${targetId}]未找到`);
          return undefined;
        }

        const method = component[action.methodName];
        if (typeof method !== 'function') {
          console.warn(
            `[Aigen：组件${targetId}]不存在函数方法 '${action.methodName}'`,
          );
          return undefined;
        }

        return method(...args);
      }

      case 'custom': {
        const customFunc = this.options.funcs?.value?.[action.methodName];
        if (typeof customFunc === 'function') {
          return customFunc(...args);
        }
        console.warn(`[Aigen：自定义函数(${action.methodName})]未定义`);
        return undefined;
      }

      case 'event': {
        const eventName =
          action.target || action.methodName || (action.id as string);
        if (!eventName) {
          console.warn('[Aigen Action]: 事件广播缺少事件名');
          return undefined;
        }
        if (this.options.pageEventBus?.emit) {
          // 兼容两种参数布局：
          // 1) args = [payload]（推荐：事件名在 methodName/target 中）
          // 2) args = [eventName, payload]（旧/手工配置）
          let payload: unknown =
            args.length > 1 && args[0] === eventName ? args[1] : args[0];
          if (args.length > 1 && args[0] !== eventName) {
            payload = args[1];
          }
          const tracePayload: TraceContext = {
            causalChain: ctx.causalChain,
            depth: ctx.causalChain.length,
            traceId: ctx.traceId,
          };
          return this.options.pageEventBus.emit(eventName, payload, {
            $traceContext: tracePayload,
          });
        }
        return undefined;
      }

      case 'navigate': {
        const url = action.target || (args[0] as string);
        if (!url) {
          console.warn('[Aigen Action]: 页面跳转缺少 URL');
          return undefined;
        }
        const target = (args[1] as string) || '_self';
        window.open(url, target);
        return undefined;
      }

      case 'public': {
        const publicMethod =
          this.options.pluginManager?.publicMethods?.methodsMap?.[
            action.methodName
          ];
        if (typeof publicMethod?.handler === 'function') {
          return publicMethod.handler(...args);
        }
        console.warn(`[Aigen：公共函数(${action.methodName})]未注册`);
        return undefined;
      }

      default: {
        console.warn(`未知的动作类型: ${action.type}`);
        return undefined;
      }
    }
  }

  private resolveActionArgs(
    action: ActionsModel,
    _ctx: PipelineContext,
    formulaContext: Record<string, unknown>,
    fallbackArgs: unknown[],
  ): { args: unknown[]; skip: boolean } {
    let methodArgs: unknown[];

    if (action.args !== undefined && action.args !== null) {
      if (typeof action.args === 'string') {
        try {
          const parsed = JSON.parse(action.args);
          methodArgs = Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
          console.warn(
            `[Aigen：动作(${action.methodName})]args 非法 JSON，已跳过该动作`,
            { args: action.args, error },
          );
          return { args: [], skip: true };
        }
      } else if (Array.isArray(action.args)) {
        methodArgs = action.args;
      } else {
        methodArgs = [action.args];
      }
    } else {
      methodArgs = fallbackArgs;
    }

    // 表达式求值
    const resolvedArgs = methodArgs.map((arg: any) => {
      if (
        isFormulaExpressionModel(arg) &&
        this.options.formulaEngine?.calculate
      ) {
        return resolveBoundValue(arg, {
          formulaContext,
          formulaEngine: this.options.formulaEngine,
        });
      }
      return arg;
    });

    return { args: resolvedArgs, skip: false };
  }
}
