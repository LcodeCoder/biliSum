export function requestSignal(parent?: AbortSignal, timeoutMs = 20000) {
  const controller = new AbortController();
  const forward = () => controller.abort(parent?.reason);
  if (parent?.aborted) forward();
  else parent?.addEventListener('abort', forward, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(new DOMException('请求超时，请重试。', 'TimeoutError')),
    timeoutMs,
  );
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', forward);
    },
  };
}

// Bound bytes before JSON.parse, including chunked responses without Content-Length.
export async function readJsonResponse(
  response: Response,
  signal?: AbortSignal,
  maxBytes = 4_000_000,
  onChunk?: () => void,
): Promise<Record<string, any>> {
  if (!response.body) throw new Error('服务返回了空响应，请重试。');
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel(signal?.reason).catch(() => {});
  };
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const decoder = new TextDecoder();
  let text = '',
    size = 0,
    complete = false;
  try {
    if (Number(response.headers.get('content-length')) > maxBytes)
      throw new Error('服务返回的数据过大，已停止读取。');
    for (;;) {
      signal?.throwIfAborted();
      const next = await reader.read();
      signal?.throwIfAborted();
      if (next.done) {
        complete = true;
        break;
      }
      if (next.value.byteLength) onChunk?.();
      size += next.value.byteLength;
      if (size > maxBytes) throw new Error('服务返回的数据过大，已停止读取。');
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('服务返回的 JSON 格式异常，请检查服务地址后重试。');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('服务返回的数据格式异常，请稍后重试。');
    return data as Record<string, any>;
  } finally {
    signal?.removeEventListener('abort', cancel);
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return '操作已取消，可重新尝试。';
    if (error.name === 'TimeoutError')
      return !error.message || error.message === '请求超时，请重试。'
        ? '请求超时，请检查网络后重试。'
        : error.message;
    if (error.name === 'NotAllowedError')
      return '浏览器未允许此操作；复制失败时可下载文件，或检查浏览器权限后重试。';
    if (error.name === 'TypeError' && /fetch|network|load/i.test(error.message))
      return '网络连接失败，请检查网络和服务地址后重试。';
    return error.message || '操作未完成，请重试。';
  }
  return '操作未完成，请重试。';
}

// Browser APIs such as executeScript cannot be cancelled, but callers can stop waiting.
export function abortable<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cancel = () => reject(signal.reason);
    if (signal.aborted) cancel();
    else signal.addEventListener('abort', cancel, { once: true });
    operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', cancel));
  });
}
