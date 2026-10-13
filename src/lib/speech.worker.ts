import { env, pipeline } from '@huggingface/transformers';
import { SPEECH_MODEL, SPEECH_MODEL_REVISION } from './speech-model';
import type { SpeechLanguage } from './speech-types';

const scope = self as unknown as {
  location: Location;
  postMessage(value: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
};
const nativeFetch = globalThis.fetch.bind(globalThis);
// The model is data. Executable JS and WASM are shipped with the extension.
env.allowLocalModels = false;
env.useBrowserCache = true;
env.useFS = false;
env.useWasmCache = false;
env.backends.onnx.wasm!.wasmPaths = {
  mjs: new URL(
    '../asr-runtime/ort-wasm-simd-threaded.asyncify.mjs',
    scope.location.href,
  ).href,
  wasm: new URL(
    '../asr-runtime/ort-wasm-simd-threaded.asyncify.wasm',
    scope.location.href,
  ).href,
};
env.backends.onnx.wasm!.numThreads = 1;
env.backends.onnx.wasm!.proxy = false;
const modelHost = (url: URL) =>
  url.protocol === 'https:' &&
  (url.hostname === 'huggingface.co' ||
    url.hostname.endsWith('.huggingface.co') ||
    url.hostname.endsWith('.hf.co'));
globalThis.fetch = async (input, init) => {
  const url = new URL(
    input instanceof Request ? input.url : String(input),
    scope.location.href,
  );
  const local = url.origin === scope.location.origin;
  if (
    !local &&
    (!modelHost(url) ||
      !url.pathname.startsWith(
        '/' + SPEECH_MODEL + '/resolve/' + SPEECH_MODEL_REVISION + '/',
      ))
  )
    throw new Error('模型下载地址不受支持。');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const reset = () => {
    clearTimeout(timer);
    timer = setTimeout(
      () =>
        controller.abort(
          new DOMException(
            '模型下载长时间没有进展，请检查网络后重试。',
            'TimeoutError',
          ),
        ),
      60_000,
    );
  };
  reset();
  try {
    const response = await nativeFetch(input, {
      ...init,
      credentials: 'omit',
      signal: controller.signal,
    });
    if (response.url) {
      const final = new URL(response.url);
      if (final.origin !== scope.location.origin && !modelHost(final))
        throw new Error('模型下载被重定向到不受支持的服务。');
    }
    if (!response.ok || !response.body) {
      clearTimeout(timer!);
      return response;
    }
    const limit = /\.onnx(?:$|\?)/.test(url.pathname)
      ? 200 * 1024 * 1024
      : local
        ? 80 * 1024 * 1024
        : 8 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > limit)
      throw new Error('模型文件大小异常，已停止下载。');
    const reader = response.body.getReader();
    let bytes = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(output) {
        try {
          const next = await reader.read();
          if (next.done) {
            clearTimeout(timer);
            reader.releaseLock();
            output.close();
            return;
          }
          reset();
          bytes += next.value.byteLength;
          if (bytes > limit) throw new Error('模型文件过大，已停止下载。');
          output.enqueue(next.value);
        } catch (error) {
          clearTimeout(timer);
          controller.abort();
          await reader.cancel().catch(() => {});
          output.error(error);
        }
      },
      async cancel() {
        clearTimeout(timer);
        controller.abort();
        await reader.cancel().catch(() => {});
      },
    });
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    clearTimeout(timer!);
    controller.abort();
    throw error;
  }
};
let transcriber: Awaited<
  ReturnType<typeof pipeline<'automatic-speech-recognition'>>
> | null = null;
let active = false;
const languages = {
  'zh-CN': 'chinese',
  'en-US': 'english',
  'ja-JP': 'japanese',
  'ko-KR': 'korean',
};
scope.onmessage = async (event) => {
  const message = event.data;
  const id = message?.id;
  if (!Number.isSafeInteger(id) || active) return;
  active = true;
  try {
    if (message.type === 'init') {
      transcriber = await pipeline(
        'automatic-speech-recognition',
        SPEECH_MODEL,
        {
          revision: SPEECH_MODEL_REVISION,
          device: 'wasm',
          dtype: 'q8',
          progress_callback: (progress) => {
            if (progress.status === 'progress')
              scope.postMessage({
                id,
                type: 'progress',
                message: '正在下载本地识别模型 · ' + progress.file,
                percent: Math.round(progress.progress),
              });
            else if (progress.status === 'initiate')
              scope.postMessage({
                id,
                type: 'progress',
                message: '正在准备本地识别模型…',
              });
          },
        },
      );
      scope.postMessage({ id, type: 'result', result: true });
    } else if (message.type === 'transcribe' && transcriber) {
      const samples = message.samples;
      const language = message.language as SpeechLanguage;
      if (
        !(samples instanceof Float32Array) ||
        !samples.length ||
        samples.length > 30 * 16_000 ||
        !['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'auto'].includes(language)
      )
        throw new Error('识别音频片段格式无效。');
      const result = await transcriber(samples, {
        return_timestamps: true,
        task: 'transcribe',
        ...(language === 'auto' ? {} : { language: languages[language] }),
      });
      scope.postMessage({ id, type: 'result', result });
    } else throw new Error('本地识别模型尚未准备好。');
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message.replace(/https?:\/\/\S+/g, '[下载地址]').slice(0, 250)
        : '';
    scope.postMessage({
      id,
      type: 'error',
      message:
        '本地模型处理失败。请检查模型下载网络或关闭其他占用内存的页面后重试。' +
        (detail ? '（' + detail + '）' : ''),
    });
  } finally {
    active = false;
  }
};
