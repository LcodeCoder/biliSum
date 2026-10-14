import { abortable, requestSignal } from './request';
import { SPEECH_SAMPLE_RATE } from './speech-types';
import type { SpeechLanguage } from './speech-types';

export type NativeSpeechStatus =
  'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported';
// The DOM declarations do not yet cover the local Web Speech API in all TS versions.
export interface LocalRecognition {
  processLocally: boolean;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(track: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
}
export interface LocalRecognitionConstructor {
  new (): LocalRecognition;
  prototype: LocalRecognition;
  available(options: {
    langs: string[];
    processLocally: boolean;
  }): Promise<string>;
  install(options: {
    langs: string[];
    processLocally: boolean;
  }): Promise<boolean>;
}
export function nativeRecognitionConstructor(
  scope: any = globalThis,
): LocalRecognitionConstructor | null {
  const constructor = scope.SpeechRecognition || scope.webkitSpeechRecognition;
  return constructor &&
    'processLocally' in constructor.prototype &&
    typeof constructor.available === 'function'
    ? constructor
    : null;
}
export async function nativeSpeechStatus(
  language: SpeechLanguage,
  signal?: AbortSignal,
  scope: any = globalThis,
): Promise<NativeSpeechStatus> {
  const constructor = nativeRecognitionConstructor(scope);
  if (!constructor || language === 'auto') return 'unsupported';
  const request = requestSignal(signal, 5_000);
  try {
    const status = await abortable(
      constructor.available({ langs: [language], processLocally: true }),
      request.signal,
    );
    return ['available', 'downloadable', 'downloading', 'unavailable'].includes(
      status,
    )
      ? (status as NativeSpeechStatus)
      : 'unsupported';
  } catch {
    signal?.throwIfAborted();
    return 'unsupported';
  } finally {
    request.dispose();
  }
}
// Called directly by the installation button, before an await loses user activation.
export function installNativeSpeech(
  language: SpeechLanguage,
  signal: AbortSignal,
  scope: any = globalThis,
): Promise<boolean> {
  const constructor = nativeRecognitionConstructor(scope);
  if (
    !constructor ||
    language === 'auto' ||
    typeof constructor.install !== 'function'
  )
    return Promise.reject(
      new Error('此浏览器不支持安装所选本地语言包，请使用本地模型。'),
    );
  signal.throwIfAborted();
  return abortable(
    constructor.install({ langs: [language], processLocally: true }),
    signal,
  );
}
export async function recognizeNativeChunk(
  samples: Float32Array,
  language: SpeechLanguage,
  signal: AbortSignal,
): Promise<string> {
  const Constructor = nativeRecognitionConstructor();
  if (!Constructor || language === 'auto')
    throw new Error('浏览器不支持本地语音识别，请使用本地模型。');
  signal.throwIfAborted();
  const duration = samples.length / SPEECH_SAMPLE_RATE;
  const request = requestSignal(signal, Math.ceil((duration + 15) * 1000));
  let context: AudioContext | undefined;
  let source: AudioBufferSourceNode | undefined;
  let destination: MediaStreamAudioDestinationNode | undefined;
  let recognition: LocalRecognition | undefined;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    context = new AudioContext({ sampleRate: SPEECH_SAMPLE_RATE });
    destination = context.createMediaStreamDestination();
    source = context.createBufferSource();
    const buffer = context.createBuffer(1, samples.length, SPEECH_SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);
    source.buffer = buffer;
    source.connect(destination);
    const track = destination.stream.getAudioTracks()[0];
    if (!track || track.kind !== 'audio' || track.readyState !== 'live')
      throw new Error('无法创建视频音频轨道。');
    recognition = new Constructor();
    recognition.processLocally = true;
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = false;
    await abortable(context.resume(), request.signal);
    request.signal.throwIfAborted();
    const recognizer = recognition;
    const audioSource = source;
    return await new Promise<string>((resolve, reject) => {
      const fragments = new Map<number, string>();
      let complete = false;
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        request.signal.removeEventListener('abort', cancel);
        if (error) reject(error);
        else
          resolve(
            [...fragments.entries()]
              .sort((a, b) => a[0] - b[0])
              .map((item) => item[1])
              .join(' ')
              .trim(),
          );
      };
      const cancel = () => finish(request.signal.reason);
      request.signal.addEventListener('abort', cancel, { once: true });
      recognizer.onstart = () => {
        if (!settled) {
          try {
            audioSource.start();
          } catch (error) {
            finish(error);
          }
        }
      };
      recognizer.onresult = (event) => {
        for (
          let index = event.resultIndex;
          index < event.results.length;
          index++
        ) {
          const result = event.results[index];
          if (result.isFinal && typeof result[0]?.transcript === 'string')
            fragments.set(index, result[0].transcript.trim());
        }
      };
      recognizer.onerror = (event) =>
        finish(new Error('内置识别中断（' + event.error + '）。'));
      recognizer.onend = () =>
        finish(
          complete
            ? undefined
            : new Error('浏览器识别在音频结束前停止，未采用部分内容。'),
        );
      audioSource.onended = () => {
        complete = true;
        stopTimer = setTimeout(() => {
          try {
            recognizer.stop();
          } catch (error) {
            finish(error);
          }
        }, 350);
      };
      // Explicit video track: no microphone input, and processLocally forbids cloud fallback.
      try {
        request.signal.throwIfAborted();
        recognizer.start(track);
      } catch (error) {
        finish(error);
      }
    });
  } finally {
    clearTimeout(stopTimer);
    request.dispose();
    if (recognition) {
      recognition.onstart =
        recognition.onresult =
        recognition.onerror =
        recognition.onend =
          null;
      try {
        recognition.abort();
      } catch {
        /* Session may already be ended. */
      }
    }
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* Source may not have started. */
      }
      source.disconnect();
    }
    destination?.stream.getTracks().forEach((track) => track.stop());
    await context?.close().catch(() => {});
  }
}
