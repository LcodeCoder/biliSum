import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, apiOriginPattern, validateSettings } from './config';
import { parseVideoUrl } from './bilibili';
import { abortable, requestSignal } from './request';
import { createResultCache } from './cache';
import { createAiRuntime } from './ai-runtime';
import { normalizeDetailLevel } from './detail';
import type {
  GenerationKind,
  SavedResults,
  Settings,
  VideoInfo,
} from './types';

export const aiRuntime = createAiRuntime({ storage: browser.storage.session });

const SETTINGS_KEY = 'biliSum.settings.v1';
const resultCache = createResultCache(
  browser.storage.local,
  async (operation) => {
    // Web Locks serialize read/modify/write across side panels in different windows.
    if (globalThis.navigator?.locks)
      await navigator.locks.request('biliSum.results', operation);
    else await operation();
  },
);
const PREFERENCES_KEY = 'biliSum.preferences.v1';

export async function loadSettings(): Promise<Settings> {
  const [config, preferenceData] = await Promise.all([
    browser.storage.local.get(SETTINGS_KEY),
    browser.storage.local.get(PREFERENCES_KEY),
  ]);
  const raw = config[SETTINGS_KEY];
  const stored =
    raw && typeof raw === 'object' ? (raw as Partial<Settings>) : {};
  const preferences = preferenceData[PREFERENCES_KEY] as
    Partial<Settings> | undefined;
  const theme = preferences?.theme ?? stored.theme;
  return {
    apiBaseUrl:
      typeof stored.apiBaseUrl === 'string'
        ? stored.apiBaseUrl
        : DEFAULT_SETTINGS.apiBaseUrl,
    apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : '',
    model:
      typeof stored.model === 'string' ? stored.model : DEFAULT_SETTINGS.model,
    theme:
      theme && ['system', 'dark', 'light'].includes(theme)
        ? theme
        : DEFAULT_SETTINGS.theme,
    detailLevel: normalizeDetailLevel(
      preferences?.detailLevel ?? stored.detailLevel,
    ),
  };
}

// Appearance and detail level can be saved before any API is configured.
export async function savePreferences(
  settings: Pick<Settings, 'theme' | 'detailLevel'>,
): Promise<void> {
  await browser.storage.local.set({
    [PREFERENCES_KEY]: {
      theme: settings.theme,
      detailLevel: normalizeDetailLevel(settings.detailLevel),
    },
  });
}

// Call directly from the Save/Test click so Chrome retains the user gesture.
export async function permitApi(
  settings: Settings,
  signal?: AbortSignal,
): Promise<Settings> {
  signal?.throwIfAborted();
  const next = validateSettings(settings);
  const permission = browser.permissions.request({
    origins: [apiOriginPattern(next.apiBaseUrl)],
  });
  const granted = signal
    ? await abortable(permission, signal)
    : await permission;
  signal?.throwIfAborted();
  if (!granted)
    throw new Error('请允许访问所填写的 API 服务后，再保存或测试。');
  return next;
}

export async function saveSettings(
  settings: Settings,
  signal?: AbortSignal,
): Promise<Settings> {
  const next = await permitApi(settings, signal);
  signal?.throwIfAborted();
  await browser.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function hasApiPermission(settings: Settings): Promise<boolean> {
  return browser.permissions.contains({
    origins: [apiOriginPattern(settings.apiBaseUrl)],
  });
}

export async function readPageVideo(
  tabId: number,
  signal?: AbortSignal,
): Promise<Record<string, any> | null> {
  const request = requestSignal(signal, 4000);
  try {
    request.signal.throwIfAborted();
    const results = await abortable(
      browser.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        world: 'MAIN',
        func: () => {
          const state = (window as any).__INITIAL_STATE__;
          const data = state?.videoData;
          if (!data) return null;
          return {
            aid: Number(data.aid),
            bvid: String(data.bvid || ''),
            cid: Number(data.cid),
            title: String(data.title || '').slice(0, 500),
            pic: String(data.pic || ''),
            duration: Number(data.duration),
            desc: String(data.desc || '').slice(0, 3000),
            owner: { name: String(data.owner?.name || '') },
            pages: Array.isArray(data.pages)
              ? data.pages.slice(0, 500).map((page: any) => ({
                  cid: Number(page.cid),
                  page: Number(page.page),
                  part: String(page.part || ''),
                  duration: Number(page.duration),
                }))
              : [],
          };
        },
      }),
      request.signal,
    );
    return results[0]?.result || null;
  } catch {
    signal?.throwIfAborted();
    return null;
  } finally {
    request.dispose();
  }
}

export async function seekVideo(
  tabId: number,
  video: VideoInfo,
  seconds: number,
): Promise<void> {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error('字幕时间无效，无法跳转。');
  const tab = await browser.tabs.get(tabId);
  const locator = parseVideoUrl(tab.url || '');
  if (
    !locator ||
    locator.page !== video.page ||
    (locator.bvid ? locator.bvid !== video.bvid : locator.aid !== video.aid)
  )
    throw new Error('当前标签已切换，请刷新字幕后再跳转。');
  const result = await browser.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    args: [video.bvid, video.aid, video.page, seconds] as [
      string,
      number,
      number,
      number,
    ],
    func: (bvid, aid, page, time) => {
      const match = /\/video\/(BV[a-zA-Z0-9]{10}|av[0-9]+)/.exec(
        location.pathname,
      );
      const currentPage = Number(
        new URL(location.href).searchParams.get('p') || 1,
      );
      if (
        !match ||
        ![bvid, 'av' + aid].includes(match[1] || '') ||
        currentPage !== page
      )
        return false;
      const player = document.querySelector('video');
      if (!player) return false;
      const limit = Number.isFinite(player.duration)
        ? Math.max(0, player.duration - 0.05)
        : time;
      player.currentTime = Math.min(Math.max(0, time), limit);
      return true;
    },
  });
  if (!result[0]?.result) throw new Error('请等待播放器加载后再跳转。');
}

export const videoKey = (video: VideoInfo) => video.bvid + ':' + video.cid;

export async function loadResults(
  video: VideoInfo,
): Promise<SavedResults | null> {
  return resultCache.load(videoKey(video));
}

export async function saveResults(
  video: VideoInfo,
  value: SavedResults,
  kind?: GenerationKind,
): Promise<void> {
  return resultCache.save(videoKey(video), value, kind);
}
