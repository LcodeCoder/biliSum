import { checkAudioDuration } from './speech-audio';
import { normalizeCues } from './transcript';
import type {
  SpeechEngine,
  SpeechLanguage,
  SpeechOutput,
} from './speech-types';
import type { VideoInfo } from './types';

export const SPEECH_CACHE_KEY = 'biliSum.transcripts.v1';
const CACHE_VERSION = 'whisper-base-64da5728-q8-v1';
const CACHE_BUDGET = 2_000_000;
interface Storage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}
interface Entry {
  version: string;
  bvid: string;
  cid: number;
  language: SpeechLanguage;
  updatedAt: number;
  output: SpeechOutput;
}
function validEntry(raw: unknown): Entry | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Entry;
  if (
    value.version !== CACHE_VERSION ||
    typeof value.bvid !== 'string' ||
    !Number.isSafeInteger(value.cid) ||
    value.cid <= 0 ||
    !Number.isFinite(value.updatedAt) ||
    !['zh-CN', 'en-US', 'ja-JP', 'ko-KR', 'auto'].includes(value.language)
  )
    return null;
  const output = value.output;
  if (
    !output ||
    output.complete !== true ||
    !['native', 'whisper'].includes(output.engine)
  )
    return null;
  try {
    checkAudioDuration(output.duration);
  } catch {
    return null;
  }
  const transcript = output.transcript;
  if (
    !transcript ||
    typeof transcript.timed !== 'boolean' ||
    typeof transcript.source !== 'string' ||
    transcript.source.length > 200 ||
    !Array.isArray(transcript.cues) ||
    !transcript.cues.length ||
    transcript.cues.length > 50_000
  )
    return null;
  if (transcript.timed !== (output.engine === 'whisper')) return null;
  const cues = normalizeCues(transcript.cues);
  if (
    cues.length !== transcript.cues.length ||
    cues.some((cue) => cue.to > output.duration + 0.1) ||
    cues.reduce((size, cue) => size + cue.content.length, 0) > 900_000
  )
    return null;
  return {
    ...value,
    output: {
      complete: true,
      duration: output.duration,
      engine: output.engine,
      transcript: { cues, timed: transcript.timed, source: transcript.source },
    },
  };
}
const keyFor = (
  video: Pick<VideoInfo, 'bvid' | 'cid'>,
  language: SpeechLanguage,
  engine: string,
) => video.bvid + ':' + video.cid + ':' + language + ':' + engine;
export function createSpeechCache(
  storage: Storage,
  lock?: (operation: () => Promise<void>) => Promise<void>,
) {
  let queue: Promise<void> = Promise.resolve();
  const read = async (): Promise<Record<string, Entry>> => {
    const raw = (await storage.get(SPEECH_CACHE_KEY))[SPEECH_CACHE_KEY];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const entries = Object.entries(raw)
      .flatMap(([key, value]) => {
        const entry = validEntry(value);
        return entry &&
          key === keyFor(entry, entry.language, entry.output.engine)
          ? [[key, entry] as const]
          : [];
      })
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, 12);
    return Object.fromEntries(entries);
  };
  return {
    async load(
      video: VideoInfo,
      language: SpeechLanguage,
      engine: SpeechEngine,
    ): Promise<SpeechOutput | null> {
      const entries = await read();
      const candidates = Object.values(entries)
        .filter(
          (entry) =>
            entry.bvid === video.bvid &&
            entry.cid === video.cid &&
            entry.language === language &&
            (engine === 'auto' || entry.output.engine === engine),
        )
        .sort((a, b) => b.updatedAt - a.updatedAt);
      for (const entry of candidates) {
        try {
          checkAudioDuration(entry.output.duration, video.duration);
          return entry.output;
        } catch {
          /* Different or corrupt audio coverage. */
        }
      }
      return null;
    },
    save(
      video: VideoInfo,
      language: SpeechLanguage,
      output: SpeechOutput,
    ): Promise<void> {
      const operation = async () => {
        checkAudioDuration(output.duration, video.duration);
        const entry = validEntry({
          version: CACHE_VERSION,
          bvid: video.bvid,
          cid: video.cid,
          language,
          updatedAt: Date.now(),
          output,
        });
        if (!entry) throw new Error('识别结果不完整，未写入字幕缓存。');
        const entries = await read();
        entries[keyFor(video, language, output.engine)] = entry;
        const sorted = Object.entries(entries)
          .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
          .slice(0, 12);
        while (
          sorted.length &&
          new TextEncoder().encode(JSON.stringify(Object.fromEntries(sorted)))
            .byteLength > CACHE_BUDGET
        )
          sorted.pop();
        if (
          !sorted.some(
            ([key]) => key === keyFor(video, language, output.engine),
          )
        )
          throw new Error('字幕过长，未写入缓存；当前内容仍可使用和下载。');
        await storage.set({ [SPEECH_CACHE_KEY]: Object.fromEntries(sorted) });
      };
      const next = queue
        .catch(() => {})
        .then(() => (lock ? lock(operation) : operation()));
      queue = next;
      return next;
    },
  };
}
