import { checkAudioDuration } from './speech-audio';
import { openSpeechAudio } from './speech-decode';
import { isSilentAudio } from './speech-decode';
import { nativeSpeechStatus, recognizeNativeChunk } from './speech-native';
import { createWhisperRecognizer } from './speech-whisper';
import { normalizeCues } from './transcript';
import { appendSpeechCues, whisperCues } from './speech-segments';
import type {
  OnSpeechProgress,
  SpeechOutput,
  SpeechPreferences,
} from './speech-types';
import type { SubtitleCue } from './types';

export interface SpeechDependencies {
  openAudio: typeof openSpeechAudio;
  nativeStatus: typeof nativeSpeechStatus;
  nativeChunk: typeof recognizeNativeChunk;
  whisper(
    signal: AbortSignal,
    onProgress: OnSpeechProgress,
  ):
    | ReturnType<typeof createWhisperRecognizer>
    | Promise<ReturnType<typeof createWhisperRecognizer>>;
}
const dependencies: SpeechDependencies = {
  openAudio: openSpeechAudio,
  nativeStatus: nativeSpeechStatus,
  nativeChunk: recognizeNativeChunk,
  whisper: async (signal, onProgress) => {
    const { default: WhisperWorker } = await import('./speech.worker?worker');
    return createWhisperRecognizer(
      signal,
      onProgress,
      () => new WhisperWorker(),
    );
  },
};
export async function transcribeSpeechAudio(
  blob: Blob,
  expected: number,
  preferences: SpeechPreferences,
  signal: AbortSignal,
  onProgress: OnSpeechProgress,
  deps: SpeechDependencies = dependencies,
): Promise<SpeechOutput> {
  signal.throwIfAborted();
  checkAudioDuration(expected);
  onProgress({ message: '正在检查音频完整性…' });
  const audio = await deps.openAudio(blob, expected, signal);
  let worker: ReturnType<typeof createWhisperRecognizer> | undefined;
  try {
    checkAudioDuration(audio.duration, expected);
    let engine: 'native' | 'whisper' = 'whisper';
    if (preferences.engine !== 'whisper') {
      const status = await deps.nativeStatus(preferences.language, signal);
      if (status === 'available') engine = 'native';
    }
    const recognize = async (): Promise<SubtitleCue[]> => {
      const cues: SubtitleCue[] = [];
      let processedTo = 0;
      if (engine === 'whisper') {
        onProgress({
          message: '正在加载本地模型…',
        });
        worker = await deps.whisper(signal, onProgress);
        await worker.init();
      }
      for await (const chunk of audio.chunks(engine === 'whisper')) {
        signal.throwIfAborted();
        if (
          Math.abs(chunk.coreFrom - processedTo) > 0.1 ||
          chunk.coreTo <= chunk.coreFrom
        )
          throw new Error('音频片段不连续，未采用部分识别结果。');
        onProgress({
          message:
            (engine === 'native' ? '内置识别' : '本地模型识别') +
            ' · ' +
            Math.floor(chunk.coreFrom / 60) +
            ':' +
            String(Math.floor(chunk.coreFrom % 60)).padStart(2, '0'),
          percent: Math.round((processedTo / audio.duration) * 100),
        });
        if (!isSilentAudio(chunk.samples)) {
          if (engine === 'native') {
            const text = await deps.nativeChunk(
              chunk.samples,
              preferences.language,
              signal,
            );
            if (text.trim())
              appendSpeechCues(cues, [
                {
                  from: chunk.coreFrom,
                  to: chunk.coreTo,
                  content: text.trim(),
                },
              ]);
          } else {
            const result = await worker!.transcribe(
              chunk.samples,
              preferences.language,
            );
            appendSpeechCues(cues, whisperCues(result, chunk));
          }
        }
        processedTo = chunk.coreTo;
      }
      signal.throwIfAborted();
      if (Math.abs(processedTo - audio.duration) > 0.1)
        throw new Error('音频未识别到结尾，未生成部分视频结果。');
      if (!cues.length) throw new Error('未识别到语音，请检查音频或识别语言。');
      return cues;
    };
    let cues: SubtitleCue[];
    try {
      cues = await recognize();
    } catch (error) {
      signal.throwIfAborted();
      if (engine !== 'native') throw error;
      // Restart from the beginning; never concatenate results from a failed native run.
      engine = 'whisper';
      onProgress({
        message: '内置识别中断，正在切换本地模型…',
      });
      cues = await recognize();
    }
    signal.throwIfAborted();
    return {
      complete: true,
      duration: audio.duration,
      engine,
      transcript: {
        cues: normalizeCues(cues),
        timed: engine === 'whisper',
        source:
          engine === 'whisper'
            ? '本地模型语音识别 · Whisper Base'
            : '浏览器本地语音识别 · 无精确时间轴',
      },
    };
  } finally {
    worker?.dispose();
    audio.dispose();
  }
}
