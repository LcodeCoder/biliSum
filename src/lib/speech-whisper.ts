import type { WhisperResult } from './speech-segments';
import type { OnSpeechProgress, SpeechLanguage } from './speech-types';

interface SpeechWorker {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}
export function createWhisperRecognizer(
  signal: AbortSignal,
  onProgress: OnSpeechProgress,
  factory: () => SpeechWorker,
) {
  signal.throwIfAborted();
  const worker = factory();
  let serial = 0;
  let disposed = false;
  let pending: {
    id: number;
    resolve(value: any): void;
    reject(error: unknown): void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener('abort', dispose);
    worker.removeEventListener('message', message);
    worker.removeEventListener('error', failed);
    worker.removeEventListener('messageerror', failed);
    worker.terminate();
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(
        signal.aborted
          ? signal.reason
          : new DOMException('本地识别已停止。', 'AbortError'),
      );
      pending = null;
    }
  };
  const message: EventListener = (event) => {
    const value = (event as MessageEvent).data;
    if (disposed || !pending || value?.id !== pending.id) return;
    if (value.type === 'progress') {
      onProgress({
        message: String(value.message || '').slice(0, 250),
        ...(Number.isFinite(value.percent)
          ? { percent: Math.max(0, Math.min(100, value.percent)) }
          : {}),
      });
      return;
    }
    if (value.type !== 'result' && value.type !== 'error') return;
    const current = pending;
    pending = null;
    clearTimeout(current.timer);
    if (value.type === 'result') current.resolve(value.result);
    else
      current.reject(
        new Error(String(value.message || '本地识别失败。').slice(0, 500)),
      );
  };
  const failed: EventListener = () => {
    if (pending)
      pending.reject(
        new Error('本地识别线程异常退出，可关闭占用内存的页面后重试。'),
      );
    dispose();
  };
  worker.addEventListener('message', message);
  worker.addEventListener('error', failed);
  worker.addEventListener('messageerror', failed);
  signal.addEventListener('abort', dispose, { once: true });
  const run = (
    type: string,
    values: Record<string, unknown>,
    timeoutMs: number,
    transfer?: Transferable[],
  ): Promise<any> => {
    signal.throwIfAborted();
    if (disposed || pending)
      return Promise.reject(
        new Error('本地识别线程不可用或正在处理其他片段。'),
      );
    return new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => {
        if (pending?.id !== id) return;
        pending.reject(
          new DOMException(
            '本地识别超时，可关闭占用资源的页面后重试。',
            'TimeoutError',
          ),
        );
        dispose();
      }, timeoutMs);
      pending = { id, resolve, reject, timer };
      try {
        worker.postMessage({ id, type, ...values }, transfer);
      } catch (error) {
        clearTimeout(timer);
        pending = null;
        reject(error);
        dispose();
      }
    });
  };
  return {
    init: () => run('init', {}, 15 * 60_000),
    transcribe: (
      samples: Float32Array,
      language: SpeechLanguage,
    ): Promise<WhisperResult> =>
      run('transcribe', { samples, language }, 5 * 60_000, [
        samples.buffer as ArrayBuffer,
      ]),
    dispose,
  };
}
