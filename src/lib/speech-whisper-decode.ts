import {
  appendSpeechCues,
  whisperCues,
  type WhisperResult,
} from './speech-segments';
import { SPEECH_SAMPLE_RATE } from './speech-types';
import type { SubtitleCue } from './types';

export interface WhisperTokenStream {
  put(tokens: bigint[][]): void;
  end(): void;
}
type WhisperDecoder = (
  samples: Float32Array,
  streamer: WhisperTokenStream,
) => Promise<WhisperResult>;

// Keep each decoder pass bounded. Dense speech or repetition can exhaust the
// token budget even on valid audio; retry that audio in shorter, overlapping
// windows rather than accepting the truncated text or failing the whole video.
export async function decodeWhisperAudio(
  samples: Float32Array,
  eosTokenId: number | number[],
  decode: WhisperDecoder,
  onRetry: () => void = () => {},
): Promise<WhisperResult> {
  const eos = new Set(Array.isArray(eosTokenId) ? eosTokenId : [eosTokenId]);
  if (!eos.size || [...eos].some((token) => !Number.isSafeInteger(token)))
    throw new Error('本地模型缺少有效结束标记。');
  let prompt = true;
  let ended = false;
  const result = await decode(samples, {
    put(tokens) {
      if (prompt) {
        prompt = false;
        return;
      }
      if (tokens[0]?.some((token) => eos.has(Number(token)))) ended = true;
    },
    end() {
      // A finished generate() call also occurs at the token limit. Only an
      // actual generated EOS proves that this pass completed normally.
    },
  });
  if (ended) return result;
  if (samples.length <= 4 * SPEECH_SAMPLE_RATE)
    throw new Error('音频片段识别未完成，请检查识别语言后重试。');
  onRetry();
  const middle = Math.floor(samples.length / 2);
  const overlap = Math.round(0.8 * SPEECH_SAMPLE_RATE);
  const leftEnd = middle + overlap;
  const rightStart = middle - overlap;
  const duration = samples.length / SPEECH_SAMPLE_RATE;
  const boundary = middle / SPEECH_SAMPLE_RATE;
  const cues: SubtitleCue[] = [];
  const left = await decodeWhisperAudio(
    samples.subarray(0, leftEnd),
    eosTokenId,
    decode,
    onRetry,
  );
  appendSpeechCues(
    cues,
    whisperCues(left, {
      from: 0,
      to: leftEnd / SPEECH_SAMPLE_RATE,
      coreFrom: 0,
      coreTo: boundary,
    }),
  );
  const right = await decodeWhisperAudio(
    samples.subarray(rightStart),
    eosTokenId,
    decode,
    onRetry,
  );
  appendSpeechCues(
    cues,
    whisperCues(right, {
      from: rightStart / SPEECH_SAMPLE_RATE,
      to: duration,
      coreFrom: boundary,
      coreTo: duration,
    }),
  );
  return {
    text: cues.map((cue) => cue.content).join(' '),
    chunks: cues.map((cue) => ({
      text: cue.content,
      timestamp: [cue.from, cue.to],
    })),
  };
}
