import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { readJsonResponse, requestSignal } from './request';
import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } from './speech-types';
import type { OnSpeechProgress } from './speech-types';
import type { ApiOptions, VideoInfo } from './types';

export const AUDIO_DOMAINS = ['bilivideo.com', 'bilivideo.cn', 'hdslb.com'];
export const AUDIO_ORIGINS = AUDIO_DOMAINS.map(
  (host) => 'https://*.' + host + '/*',
);
export interface AudioRendition {
  urls: string[];
  bandwidth: number;
}
export interface VideoAudioPlan {
  duration: number;
  renditions: AudioRendition[];
}
const WBI_ORDER = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
];

export function normalizeAudioUrl(input: unknown): string {
  if (typeof input !== 'string' || input.length > 16_000)
    throw new Error('音频地址格式异常。');
  const url = new URL(input.startsWith('//') ? 'https:' + input : input);
  if (url.protocol === 'http:') url.protocol = 'https:';
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !AUDIO_DOMAINS.some(
      (host) => url.hostname === host || url.hostname.endsWith('.' + host),
    )
  )
    throw new Error('音频地址不属于受支持的 B 站音频服务。');
  return url.toString();
}
export interface AudioDurationOptions {
  // Only for audio fetched by the current video's CID after playback metadata validation.
  allowShorterTrack?: boolean;
}
export function checkAudioDuration(
  duration: number,
  expected?: number,
  options: AudioDurationOptions = {},
): void {
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error('音频时长无效，无法确认内容是否完整。');
  if (duration > MAX_AUDIO_SECONDS)
    throw new Error('本地识别目前支持最多 4 小时音频，请分段处理后导入字幕。');
  if (expected === undefined) return;
  if (!Number.isFinite(expected) || expected <= 0)
    throw new Error('当前分 P 时长无效，请刷新视频后重试。');
  // Video can outlast its AAC track (for example, a silent end card).
  // Bound that difference by both 5% and 15 seconds, retaining the 2s rounding tolerance.
  const shortfall = options.allowShorterTrack
    ? Math.max(2, Math.min(15, expected * 0.05))
    : 2;
  if (expected - duration > shortfall || duration - expected > 2)
    throw new Error(
      `音频时长与当前分 P 不一致（音频 ${duration.toFixed(2)} 秒，视频 ${expected.toFixed(2)} 秒），已停止识别。请刷新视频后重试。`,
    );
}
export function normalizeAudioPlan(
  data: unknown,
  expected: number,
): VideoAudioPlan {
  if (!data || typeof data !== 'object')
    throw new Error('B 站音频信息格式异常。');
  const value = data as Record<string, any>;
  const duration =
    Number(value.timelength) / 1000 || Number(value.dash?.duration);
  checkAudioDuration(duration, expected);
  const list = value.dash?.audio;
  if (!Array.isArray(list))
    throw new Error(
      'B 站未返回独立音轨。请在浏览器登录、播放视频后重试，或导入音频文件。',
    );
  const renditions = list
    .filter((item) => item && (!item.codecs || /^mp4a\./.test(item.codecs)))
    .flatMap((item) => {
      const urls = [
        item.baseUrl,
        item.base_url,
        ...(Array.isArray(item.backupUrl ?? item.backup_url)
          ? (item.backupUrl ?? item.backup_url)
          : []),
      ].flatMap((url) => {
        try {
          return [normalizeAudioUrl(url)];
        } catch {
          return [];
        }
      });
      return urls.length
        ? [
            {
              urls: [...new Set(urls)].slice(0, 4),
              bandwidth: Math.max(0, Number(item.bandwidth) || 0),
            },
          ]
        : [];
    })
    .sort((a, b) => a.bandwidth - b.bandwidth);
  if (!renditions.length)
    throw new Error(
      'B 站没有返回有效的 AAC 音轨，请刷新后重试，或导入音频文件。',
    );
  return { duration, renditions: renditions.slice(0, 3) };
}
export function signPlaybackQuery(
  query: Record<string, string>,
  imageUrl: string,
  subUrl: string,
  timestamp: number,
): string {
  const key = [imageUrl, subUrl]
    .map((input) => {
      const name = new URL(input).pathname.split('/').pop() || '';
      return name.split('.')[0];
    })
    .join('');
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new Error('B 站签名信息无效，请刷新后重试。');
  const mixin = WBI_ORDER.map((index) => key[index])
    .join('')
    .slice(0, 32);
  const params: Record<string, string> = {
    ...query,
    wts: String(Math.floor(timestamp)),
  };
  const encoded = Object.keys(params)
    .sort()
    .map(
      (name) =>
        encodeURIComponent(name) +
        '=' +
        encodeURIComponent(params[name]!.replace(/[!'()*]/g, '')),
    )
    .join('&');
  return encoded + '&w_rid=' + bytesToHex(md5(utf8ToBytes(encoded + mixin)));
}
async function playbackJson(url: string, options: ApiOptions, nav = false) {
  const request = requestSignal(options.signal);
  try {
    request.signal.throwIfAborted();
    const response = await (options.fetcher ?? fetch)(url, {
      credentials: 'include',
      redirect: 'error',
      signal: request.signal,
    });
    if (!response.ok)
      throw new Error('B 站音频信息请求失败（HTTP ' + response.status + '）。');
    const json = await readJsonResponse(response, request.signal);
    if (json.code !== 0 && !(nav && json.data?.wbi_img)) {
      if ([-101, -111].includes(json.code))
        throw new Error('请先在浏览器登录 B 站，再识别音频。');
      if ([-352, -412].includes(json.code))
        throw new Error('B 站暂时限制了音频请求，请稍后重试。');
      throw new Error(
        'B 站未提供音频：' +
          String(json.message || '请刷新后重试').slice(0, 120),
      );
    }
    return json;
  } catch (error) {
    if (request.signal.aborted) throw request.signal.reason;
    throw error;
  } finally {
    request.dispose();
  }
}
export async function getVideoAudioPlan(
  video: VideoInfo,
  options: ApiOptions = {},
): Promise<VideoAudioPlan> {
  checkAudioDuration(video.duration);
  const query = {
    bvid: video.bvid,
    cid: String(video.cid),
    fnval: '16',
    fnver: '0',
    fourk: '0',
  };
  // Fetch by CID every time. Page-global playinfo can still belong to the previous part.
  let firstError: unknown;
  try {
    const json = await playbackJson(
      'https://api.bilibili.com/x/player/playurl?' + new URLSearchParams(query),
      options,
    );
    return normalizeAudioPlan(json.data, video.duration);
  } catch (error) {
    options.signal?.throwIfAborted();
    firstError = error;
  }
  try {
    const nav = await playbackJson(
      'https://api.bilibili.com/x/web-interface/nav',
      options,
      true,
    );
    const keys = nav.data?.wbi_img;
    if (typeof keys?.img_url !== 'string' || typeof keys?.sub_url !== 'string')
      throw new Error('B 站签名信息格式异常，请刷新后重试。');
    const signed = signPlaybackQuery(
      query,
      keys.img_url,
      keys.sub_url,
      Date.now() / 1000,
    );
    const json = await playbackJson(
      'https://api.bilibili.com/x/player/wbi/playurl?' + signed,
      options,
    );
    return normalizeAudioPlan(json.data, video.duration);
  } catch (error) {
    options.signal?.throwIfAborted();
    throw error instanceof Error ? error : firstError;
  }
}
export function audioHeaderRule(extensionId: string) {
  return {
    id: 8101,
    priority: 1,
    action: {
      type: 'modifyHeaders' as const,
      requestHeaders: [
        {
          header: 'Referer',
          operation: 'set' as const,
          value: 'https://www.bilibili.com/',
        },
      ],
    },
    condition: {
      initiatorDomains: [extensionId],
      requestDomains: AUDIO_DOMAINS,
      resourceTypes: ['xmlhttprequest' as const],
    },
  };
}
export async function downloadAudio(
  plan: VideoAudioPlan,
  options: ApiOptions & { onProgress?: OnSpeechProgress } = {},
): Promise<Blob> {
  let lastError: unknown;
  const urls = [...new Set(plan.renditions.flatMap((item) => item.urls))].slice(
    0,
    4,
  );
  for (const url of urls) {
    options.signal?.throwIfAborted();
    const request = requestSignal(options.signal, 10 * 60_000);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let stall: ReturnType<typeof setTimeout> | undefined;
    const resetStall = () => {
      clearTimeout(stall);
      stall = setTimeout(
        () =>
          controller.abort(
            new DOMException(
              '音频下载长时间没有进展，请检查网络后重试。',
              'TimeoutError',
            ),
          ),
        30_000,
      );
    };
    const controller = new AbortController();
    const cancel = () => {
      controller.abort(request.signal.reason);
      void reader?.cancel().catch(() => {});
    };
    request.signal.addEventListener('abort', cancel, { once: true });
    if (request.signal.aborted) cancel();
    controller.signal.addEventListener(
      'abort',
      () => {
        void reader?.cancel().catch(() => {});
      },
      { once: true },
    );
    try {
      controller.signal.throwIfAborted();
      resetStall();
      const response = await (options.fetcher ?? fetch)(
        normalizeAudioUrl(url),
        { credentials: 'omit', redirect: 'follow', signal: controller.signal },
      );
      if (response.body) reader = response.body.getReader();
      if (!response.ok)
        throw new Error('音频下载失败（HTTP ' + response.status + '）。');
      if (response.url) normalizeAudioUrl(response.url);
      const length = Number(response.headers.get('content-length')) || 0;
      if (length > MAX_AUDIO_BYTES)
        throw new RangeError('音频超过 128 MB，请导入较小的音频或分段字幕。');
      if (!response.body) throw new Error('音频服务返回了空文件。');
      const buffers: ArrayBuffer[] = [];
      let bytes = 0;
      for (;;) {
        controller.signal.throwIfAborted();
        const next = await reader!.read();
        controller.signal.throwIfAborted();
        if (next.done) break;
        if (!next.value.byteLength) continue;
        resetStall();
        bytes += next.value.byteLength;
        if (bytes > MAX_AUDIO_BYTES)
          throw new RangeError('音频超过 128 MB，已停止下载。');
        buffers.push(next.value.slice().buffer);
        options.onProgress?.({
          message: '正在下载音频 · ' + (bytes / 1024 / 1024).toFixed(1) + ' MB',
          ...(length
            ? { percent: Math.min(100, Math.round((bytes / length) * 100)) }
            : {}),
        });
      }
      if (!bytes || (length && bytes !== length))
        throw new Error('音频下载不完整，请重试。');
      return new Blob(buffers, { type: 'audio/mp4' });
    } catch (error) {
      options.signal?.throwIfAborted();
      if (error instanceof RangeError) throw error;
      lastError = controller.signal.aborted ? controller.signal.reason : error;
      options.onProgress?.({ message: '正在尝试备用音频地址…' });
    } finally {
      clearTimeout(stall);
      controller.abort();
      request.signal.removeEventListener('abort', cancel);
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
      request.dispose();
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('没有可下载的音轨，请刷新后重试，或导入音频文件。');
}
