import type { SubtitleCue } from './types';
import { WHISPER_WINDOW_SECONDS, type SpeechAudioChunk } from './speech-types';

export interface WhisperResult {
  text: string;
  chunks?: { text: string; timestamp: [number | null, number | null] }[];
}
export function whisperCues(
  result: WhisperResult,
  chunk: Omit<SpeechAudioChunk, 'samples'>,
): SubtitleCue[] {
  if (!result || typeof result.text !== 'string' || result.text.length > 20_000)
    throw new Error('本地模型返回了无效文本。');
  if (!result.text.trim()) return [];
  if (!Array.isArray(result.chunks) || result.chunks.length > 2_000)
    throw new Error('本地模型未返回有效时间轴，未采用该片段。');
  const duration = chunk.to - chunk.from;
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > WHISPER_WINDOW_SECONDS
  )
    throw new Error('本地模型音频片段时长无效，已停止识别。');
  const cues: SubtitleCue[] = [];
  for (let index = 0; index < result.chunks.length; index++) {
    const item = result.chunks[index]!;
    if (
      !item ||
      typeof item.text !== 'string' ||
      !Array.isArray(item.timestamp) ||
      item.timestamp.length !== 2
    )
      throw new Error('本地模型返回的字幕片段格式异常。');
    const [start, finish] = item.timestamp;
    const end =
      finish === null && index === result.chunks.length - 1
        ? WHISPER_WINDOW_SECONDS
        : finish;
    if (
      typeof start !== 'number' ||
      typeof end !== 'number' ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start ||
      start > WHISPER_WINDOW_SECONDS ||
      end > WHISPER_WINDOW_SECONDS
    )
      throw new Error('本地模型返回的字幕时间无效，已停止识别。');
    // Whisper pads every input to 30 seconds, so valid timestamps can fall
    // beyond the real samples. Clip to the audio and drop padding-only cues.
    const clippedStart = Math.min(duration, start);
    const clippedEnd = Math.min(duration, end);
    if (!item.text.trim() || clippedEnd <= clippedStart) continue;
    const midpoint = chunk.from + (clippedStart + clippedEnd) / 2;
    // Each overlapping window owns only its central interval.
    if (
      midpoint < chunk.coreFrom ||
      (midpoint >= chunk.coreTo && chunk.coreTo < chunk.to)
    )
      continue;
    const from = Math.min(chunk.to, chunk.from + clippedStart);
    const to = Math.min(chunk.to, chunk.from + clippedEnd);
    if (to > from) cues.push({ from, to, content: item.text.trim() });
  }
  return cues;
}
export function appendSpeechCues(
  target: SubtitleCue[],
  next: SubtitleCue[],
): void {
  for (const cue of next) {
    const previous = target[target.length - 1];
    const normalize = (text: string) =>
      text.replace(/[\s，。！？、,.!?]/g, '').toLowerCase();
    if (
      previous &&
      cue.from < previous.to - 0.02 &&
      normalize(previous.content) === normalize(cue.content)
    )
      previous.to = Math.max(previous.to, cue.to);
    else target.push({ ...cue });
  }
  if (
    target.length > 50_000 ||
    target.reduce((size, cue) => size + cue.content.length, 0) > 900_000
  )
    throw new Error('识别文本过大，已停止处理，请分段导入字幕。');
}
