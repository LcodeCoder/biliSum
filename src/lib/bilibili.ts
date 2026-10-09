// Video → CID → player subtitle tracks → subtitle JSON.
// This flow is adapted from bilibili-copilot (MIT), © 2026 Kuma.
import type {
  ApiOptions,
  SubtitleTrack,
  VideoInfo,
  VideoLocator,
} from './types';
import { readJsonResponse, requestSignal } from './request';
import { normalizeCues } from './transcript';

type JsonObject = Record<string, any>;

export function parseVideoUrl(input: string): VideoLocator | null {
  try {
    const url = new URL(input);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !['www.bilibili.com', 'bilibili.com', 'm.bilibili.com'].includes(
        url.hostname,
      )
    )
      return null;
    const match = /^\/video\/(BV[a-zA-Z0-9]{10}|av[0-9]+)(?:\/|$)/.exec(
      url.pathname,
    );
    if (!match?.[1]) return null;
    const id = match[1];
    const value = Number(url.searchParams.get('p') || 1);
    const page = Number.isSafeInteger(value) && value > 0 ? value : 1;
    if (
      id.startsWith('av') &&
      (!Number.isSafeInteger(Number(id.slice(2))) || Number(id.slice(2)) <= 0)
    )
      return null;
    return {
      ...(id.startsWith('BV') ? { bvid: id } : { aid: Number(id.slice(2)) }),
      page,
      url: 'https://www.bilibili.com/video/' + id + '/?p=' + page,
      key: id + ':' + page,
    };
  } catch {
    return null;
  }
}

async function apiJson(
  url: string,
  options: ApiOptions = {},
): Promise<JsonObject> {
  const request = requestSignal(options.signal);
  try {
    request.signal.throwIfAborted();
    const response = await (options.fetcher ?? fetch)(url, {
      credentials:
        new URL(url).hostname === 'api.bilibili.com' ? 'include' : 'omit',
      redirect: 'error',
      signal: request.signal,
    });
    if (!response.ok)
      throw new Error(
        'B 站请求失败（HTTP ' + response.status + '），请刷新后重试。',
      );
    const json = await readJsonResponse(response, request.signal);
    if (json.code !== undefined && json.code !== 0) {
      if ([-101, -111].includes(json.code))
        throw new Error('请先在当前浏览器登录 B 站，再刷新字幕。');
      if ([-352, -412].includes(json.code))
        throw new Error('B 站暂时限制了请求，请稍后刷新。');
      throw new Error(
        'B 站返回：' + String(json.message || '视频信息读取失败').slice(0, 160),
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

export function normalizeVideo(
  data: JsonObject,
  locator: VideoLocator,
): VideoInfo {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('视频信息格式异常，请刷新后重试。');
  const page = Array.isArray(data.pages)
    ? data.pages.find(
        (item: JsonObject) => item && Number(item.page) === locator.page,
      )
    : undefined;
  if (
    !page &&
    (locator.page > 1 || (Array.isArray(data.pages) && data.pages.length))
  )
    throw new Error('当前分 P 已变化，请刷新视频后重试。');
  const aid = Number(data.aid),
    cid = Number(page?.cid ?? data.cid);
  const bvid = String(data.bvid || '');
  if (!(
    Number.isSafeInteger(aid) &&
    Number.isSafeInteger(cid) &&
    aid > 0 &&
    cid > 0 &&
    /^BV[a-zA-Z0-9]{10}$/.test(bvid)
  ))
    throw new Error('视频标识读取失败，请等待页面加载后刷新。');
  if (
    (locator.bvid && bvid !== locator.bvid) ||
    (locator.aid && aid !== locator.aid)
  )
    throw new Error('视频正在切换，请稍后刷新。');
  const pic = String(data.pic || '');
  let cover = '';
  try {
    const url = new URL(pic.startsWith('//') ? 'https:' + pic : pic);
    if (
      url.protocol === 'https:' &&
      (url.hostname === 'hdslb.com' || url.hostname.endsWith('.hdslb.com')) &&
      !url.username &&
      !url.password &&
      !url.port
    )
      cover = url.toString();
  } catch {
    /* Missing or unsafe covers fall back to the video icon. */
  }
  return {
    aid,
    cid,
    bvid,
    page: locator.page,
    title: String(data.title || bvid).slice(0, 500),
    part: String(page?.part || '').slice(0, 500),
    owner: String(data.owner?.name || '').slice(0, 200),
    duration: Number.isFinite(Number(page?.duration ?? data.duration))
      ? Math.max(0, Number(page?.duration ?? data.duration))
      : 0,
    description: String(data.desc || '').slice(0, 3000),
    cover,
    url: 'https://www.bilibili.com/video/' + bvid + '/?p=' + locator.page,
  };
}

export async function resolveVideo(
  locator: VideoLocator,
  fallback?: JsonObject | null,
  options: ApiOptions = {},
): Promise<VideoInfo> {
  try {
    const query = locator.bvid ? 'bvid=' + locator.bvid : 'aid=' + locator.aid;
    const response = await apiJson(
      'https://api.bilibili.com/x/web-interface/view?' + query,
      options,
    );
    return normalizeVideo(response.data || {}, locator);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (fallback) {
      try {
        return normalizeVideo(fallback, locator);
      } catch {
        /* Preserve the API error. */
      }
    }
    throw error;
  }
}

export function normalizeSubtitleUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.startsWith('//') ? 'https:' + input : input);
  } catch {
    throw new Error('字幕地址格式异常，请刷新视频。');
  }
  const allowed = ['hdslb.com', 'bilibili.com'].some(
    (host) => url.hostname === host || url.hostname.endsWith('.' + host),
  );
  if (url.protocol !== 'https:' || !allowed || url.username || url.password)
    throw new Error('字幕地址格式异常，请刷新视频。');
  return url.toString();
}

export async function getSubtitleTracks(
  video: VideoInfo,
  options: ApiOptions = {},
): Promise<SubtitleTrack[]> {
  let firstError: unknown;
  for (const path of ['/x/player/wbi/v2', '/x/player/v2']) {
    try {
      const json = await apiJson(
        'https://api.bilibili.com' +
          path +
          '?aid=' +
          video.aid +
          '&cid=' +
          video.cid,
        options,
      );
      const list = json.data?.subtitle?.subtitles;
      if (list === undefined || (Array.isArray(list) && !list.length)) {
        continue;
      }
      if (!Array.isArray(list))
        throw new Error('字幕列表格式异常，请刷新后重试。');
      const tracks: SubtitleTrack[] = [];
      const ids = new Set<string>();
      for (const item of list) {
        if (!item || typeof item.subtitle_url !== 'string') continue;
        try {
          const url = normalizeSubtitleUrl(item.subtitle_url);
          const id = String(item.id_str ?? item.id ?? item.lan ?? url);
          if (ids.has(id)) continue;
          ids.add(id);
          tracks.push({
            id,
            language: String(item.lan || ''),
            label: String(item.lan_doc || item.lan || '字幕').slice(0, 100),
            url,
          });
        } catch {
          /* One invalid track must not hide valid languages. */
        }
      }
      if (tracks.length) return tracks;
      throw new Error('字幕列表中没有有效地址，请刷新后重试。');
    } catch (error) {
      if (options.signal?.aborted) throw error;
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
  return [];
}

export function selectSubtitle(
  tracks: SubtitleTrack[],
  preferred?: string,
): SubtitleTrack | undefined {
  return (
    tracks.find((track) => track.language === preferred) ??
    tracks.find((track) => track.language === 'zh-CN') ??
    tracks.find((track) => track.language.startsWith('zh')) ??
    tracks.find((track) => track.language.startsWith('ai-zh')) ??
    tracks[0]
  );
}

export async function getSubtitleCues(
  track: SubtitleTrack,
  options: ApiOptions = {},
) {
  const json = await apiJson(normalizeSubtitleUrl(track.url), options);
  if (!Array.isArray(json.body))
    throw new Error('字幕内容格式异常，请刷新后重试。');
  const cues = normalizeCues(json.body);
  if (!cues.length) throw new Error('当前字幕为空，可切换语言或导入字幕文件。');
  return cues;
}
