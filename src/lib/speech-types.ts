import type { Transcript } from './types';

export type SpeechEngine = 'auto' | 'native' | 'whisper';
export type SpeechLanguage = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR' | 'auto';
export interface SpeechPreferences {
  engine: SpeechEngine;
  language: SpeechLanguage;
}
export const DEFAULT_SPEECH_PREFERENCES: SpeechPreferences = {
  engine: 'auto',
  language: 'zh-CN',
};
export function normalizeSpeechPreferences(raw: unknown): SpeechPreferences {
  const value =
    raw && typeof raw === 'object' ? (raw as Partial<SpeechPreferences>) : {};
  return {
    engine: ['auto', 'native', 'whisper'].includes(value.engine || '')
      ? value.engine!
      : 'auto',
    language: ['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'auto'].includes(
      value.language || '',
    )
      ? value.language!
      : 'zh-CN',
  };
}
export const SPEECH_SAMPLE_RATE = 16_000;
export const SPEECH_CHUNK_SECONDS = 25;
export const MAX_AUDIO_BYTES = 128 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 4 * 60 * 60;
export interface SpeechAudioChunk {
  samples: Float32Array;
  from: number;
  to: number;
  coreFrom: number;
  coreTo: number;
}
export interface SpeechProgress {
  message: string;
  percent?: number;
}
export type OnSpeechProgress = (progress: SpeechProgress) => void;
export interface SpeechOutput {
  complete: true;
  transcript: Transcript;
  duration: number;
  engine: Exclude<SpeechEngine, 'auto'>;
}
