export interface CompletionTimeouts {
  timeoutMs?: number;
  firstResponseTimeoutMs?: number;
  idleTimeoutMs?: number;
}

// Keep active streams alive, but bound both stalled reads and the whole paid call.
export function completionSignal(
  parent?: AbortSignal,
  options: CompletionTimeouts = {},
) {
  const total = options.timeoutMs ?? 600_000;
  const first = Math.min(options.firstResponseTimeoutMs ?? 180_000, total);
  const idle = Math.min(options.idleTimeoutMs ?? 90_000, total);
  const controller = new AbortController();
  const feeHint = '未自动重试；重新生成可能再次计费。';
  const timeout = (message: string) =>
    controller.abort(new DOMException(message + feeHint, 'TimeoutError'));
  let activityTimer = setTimeout(
    () => timeout(`等待模型响应超时（${Math.ceil(first / 1000)} 秒）。`),
    first,
  );
  const totalTimer = setTimeout(
    () => timeout(`模型处理超过 ${Math.ceil(total / 1000)} 秒，已停止等待。`),
    total,
  );
  const clearTimers = () => {
    clearTimeout(activityTimer);
    clearTimeout(totalTimer);
  };
  const forward = () => controller.abort(parent?.reason);
  controller.signal.addEventListener('abort', clearTimers, { once: true });
  if (parent?.aborted) forward();
  else parent?.addEventListener('abort', forward, { once: true });
  return {
    signal: controller.signal,
    received() {
      if (controller.signal.aborted) return;
      clearTimeout(activityTimer);
      activityTimer = setTimeout(
        () =>
          timeout(
            `模型响应已停滞 ${Math.ceil(idle / 1000)} 秒，未收到完整结果。`,
          ),
        idle,
      );
    },
    dispose() {
      clearTimers();
      parent?.removeEventListener('abort', forward);
      controller.signal.removeEventListener('abort', clearTimers);
    },
  };
}
