import { abortable } from './request';
import { checkAudioDuration } from './speech-audio';
import type { AudioDurationOptions } from './speech-audio';
import {
  MAX_AUDIO_BYTES,
  SPEECH_CHUNK_SECONDS,
  SPEECH_SAMPLE_RATE,
} from './speech-types';
import type { SpeechAudioChunk } from './speech-types';

export interface DecodedSpeechAudio {
  duration: number;
  chunks(overlap: boolean): AsyncGenerator<SpeechAudioChunk>;
  dispose(): void;
}
export async function openSpeechAudio(
  blob: Blob,
  expected: number,
  signal: AbortSignal,
  options: AudioDurationOptions = {},
): Promise<DecodedSpeechAudio> {
  signal.throwIfAborted();
  if (!blob.size || blob.size > MAX_AUDIO_BYTES)
    throw new Error('请选择非空且不超过 128 MB 的音频文件。');
  const {
    Input,
    BlobSource,
    MP4,
    MP3,
    WAVE,
    OGG,
    FLAC,
    ADTS,
    MATROSKA,
    AudioBufferSink,
  } = await import('mediabunny');
  signal.throwIfAborted();
  const input = new Input({
    source: new BlobSource(blob),
    formats: [MP4, MP3, WAVE, OGG, FLAC, ADTS, MATROSKA],
  });
  const dispose = () => input.dispose();
  signal.addEventListener('abort', dispose, { once: true });
  try {
    const track = await abortable(input.getPrimaryAudioTrack(), signal);
    if (!track || !(await abortable(track.canDecode(), signal)))
      throw new Error(
        '浏览器无法解码这份音频，请使用 AAC/M4A、MP3 或 WAV 音频。',
      );
    const [duration, first, sampleRate, channels] = await abortable(
      Promise.all([
        track.computeDuration(),
        track.getFirstTimestamp(),
        track.getSampleRate(),
        track.getNumberOfChannels(),
      ]),
      signal,
    );
    checkAudioDuration(duration, expected, options);
    if (
      !Number.isFinite(first) ||
      first > 0.3 ||
      sampleRate < 8_000 ||
      sampleRate > 96_000 ||
      channels < 1 ||
      channels > 8
    )
      throw new Error('音频起点或采样格式异常，无法确认完整内容。');
    const sink = new AudioBufferSink(track);
    return {
      duration,
      dispose() {
        signal.removeEventListener('abort', dispose);
        dispose();
      },
      async *chunks(overlap) {
        for (
          let coreFrom = 0;
          coreFrom < duration;
          coreFrom += SPEECH_CHUNK_SECONDS
        ) {
          signal.throwIfAborted();
          const coreTo = Math.min(duration, coreFrom + SPEECH_CHUNK_SECONDS);
          const from = Math.max(0, coreFrom - (overlap ? 2 : 0));
          const to = Math.min(duration, coreTo + (overlap ? 2 : 0));
          // Only one short PCM window is held; never decode a long video into one huge AudioBuffer.
          const mono = new Float32Array(Math.ceil((to - from) * sampleRate));
          let coveredTo = from;
          let found = false;
          const iterator = sink.buffers(from, to);
          try {
            for (;;) {
              const next = await abortable(iterator.next(), signal);
              if (next.done) break;
              const { buffer, timestamp } = next.value;
              if (
                buffer.sampleRate !== sampleRate ||
                buffer.numberOfChannels !== channels ||
                !Number.isFinite(timestamp)
              )
                throw new Error('音频解码格式发生变化，已停止识别。');
              if (timestamp > coveredTo + 0.3)
                throw new Error('音频存在未解码的缺口，已停止识别。');
              coveredTo = Math.max(coveredTo, timestamp + buffer.duration);
              const offset = Math.round((timestamp - from) * sampleRate);
              const begin = Math.max(0, -offset);
              const end = Math.min(buffer.length, mono.length - offset);
              for (let channel = 0; channel < channels; channel++) {
                const data = buffer.getChannelData(channel);
                for (let index = begin; index < end; index++)
                  mono[offset + index]! += data[index]! / channels;
              }
              found ||= end > begin;
            }
          } finally {
            await iterator.return().catch(() => {});
          }
          signal.throwIfAborted();
          if (!found || coveredTo < to - 0.3)
            throw new Error(
              '音频解码提前结束，已停止识别，未生成部分视频结果。',
            );
          const offline = new OfflineAudioContext(
            1,
            Math.max(1, Math.round((to - from) * SPEECH_SAMPLE_RATE)),
            SPEECH_SAMPLE_RATE,
          );
          const buffer = offline.createBuffer(1, mono.length, sampleRate);
          buffer.copyToChannel(mono, 0);
          const source = offline.createBufferSource();
          source.buffer = buffer;
          source.connect(offline.destination);
          source.start();
          const rendered = await abortable(offline.startRendering(), signal);
          signal.throwIfAborted();
          yield {
            samples: rendered.getChannelData(0).slice(),
            from,
            to,
            coreFrom,
            coreTo,
          };
        }
      },
    };
  } catch (error) {
    signal.removeEventListener('abort', dispose);
    dispose();
    signal.throwIfAborted();
    throw error;
  }
}
export function isSilentAudio(samples: Float32Array): boolean {
  let energy = 0;
  for (const value of samples) energy += value * value;
  return !samples.length || Math.sqrt(energy / samples.length) < 0.0001;
}
