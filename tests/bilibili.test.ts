import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSubtitleCues,
  getSubtitleTracks,
  normalizeSubtitleUrl,
  normalizeVideo,
  parseVideoUrl,
  resolveVideo,
  selectSubtitle,
} from '../src/lib/bilibili';
import type { VideoInfo } from '../src/lib/types';

const locator = parseVideoUrl(
  'https://www.bilibili.com/video/BV1xx411c7mD/?p=2',
)!;
const data = {
  aid: 170001,
  bvid: 'BV1xx411c7mD',
  cid: 1,
  title: '测试视频',
  owner: { name: 'UP' },
  pages: [
    { page: 1, cid: 101, part: '第一集', duration: 10 },
    { page: 2, cid: 102, part: '第二集', duration: 20 },
  ],
};

test('video URL parsing only accepts Bilibili video URLs and separates multipart identity', () => {
  assert.equal(locator.bvid, 'BV1xx411c7mD');
  assert.equal(locator.page, 2);
  assert.equal(parseVideoUrl('https://evil.example/video/BV1xx411c7mD'), null);
  assert.equal(
    parseVideoUrl('https://www.bilibili.com.evil.example/video/BV1xx411c7mD'),
    null,
  );
  assert.equal(
    parseVideoUrl('https://www.bilibili.com/bangumi/play/ep1'),
    null,
  );
  assert.equal(
    parseVideoUrl('https://www.bilibili.com/video/av170001/?p=-2')?.page,
    1,
  );
});

test('multipart CID and duration are selected correctly; stale page data is rejected', () => {
  const video = normalizeVideo(data, locator);
  assert.equal(video.cid, 102);
  assert.equal(video.duration, 20);
  assert.equal(video.part, '第二集');
  assert.throws(() => normalizeVideo(data, { ...locator, page: 8 }), /分 P/);
  assert.throws(
    () => normalizeVideo({ ...data, bvid: 'BV1yy411c7mD' }, locator),
    /切换/,
  );
});

test('page metadata is a validated fallback when the view API fails', async () => {
  const fetcher = (async () =>
    new Response(
      JSON.stringify({ code: -412, message: 'busy' }),
    )) as typeof fetch;
  const video = await resolveVideo(locator, data, { fetcher });
  assert.equal(video.cid, 102);
  await assert.rejects(
    () => resolveVideo(locator, { ...data, bvid: 'BV1yy411c7mD' }, { fetcher }),
    /限制/,
  );
});

test('player endpoint falls back, includes cookies and preserves selected language', async () => {
  const video = normalizeVideo(data, locator);
  const calls: string[] = [];
  const fetcher = (async (url, init) => {
    calls.push(String(url));
    assert.equal(init?.credentials, 'include');
    return new Response(
      JSON.stringify(
        calls.length === 1
          ? { code: -400 }
          : {
              code: 0,
              data: {
                subtitle: {
                  subtitles: [
                    {
                      id_str: '2',
                      lan: 'en',
                      lan_doc: '英语',
                      subtitle_url: '//aisubtitle.hdslb.com/en.json',
                    },
                    {
                      id_str: '3',
                      lan: 'ai-zh',
                      lan_doc: '中文自动',
                      subtitle_url: '//aisubtitle.hdslb.com/zh.json',
                    },
                  ],
                },
              },
            },
      ),
    );
  }) as typeof fetch;
  const tracks = await getSubtitleTracks(video, { fetcher });
  assert.equal(calls.length, 2);
  assert.ok(calls[1]?.includes('/x/player/v2'));
  assert.equal(selectSubtitle(tracks)?.id, '3');
  assert.equal(selectSubtitle(tracks, 'en')?.id, '2');
  assert.equal(tracks[0]?.url, 'https://aisubtitle.hdslb.com/en.json');
});

test('subtitle download restricts URLs and validates body', async () => {
  assert.equal(
    normalizeSubtitleUrl('//aisubtitle.hdslb.com/a.json'),
    'https://aisubtitle.hdslb.com/a.json',
  );
  assert.throws(
    () => normalizeSubtitleUrl('https://hdslb.com.evil.example/sub.json'),
    /地址/,
  );
  assert.throws(
    () => normalizeSubtitleUrl('http://aisubtitle.hdslb.com/sub.json'),
    /地址/,
  );
  const cues = await getSubtitleCues(
    {
      id: '1',
      label: '中文',
      language: 'zh-CN',
      url: '//aisubtitle.hdslb.com/a.json',
    },
    {
      fetcher: (async () =>
        new Response(
          JSON.stringify({ body: [{ from: 1, to: 3, content: '字幕' }] }),
        )) as typeof fetch,
    },
  );
  assert.equal(cues[0]?.content, '字幕');
});

test('invalid video protocols and unsafe numeric identifiers are rejected', () => {
  assert.equal(
    parseVideoUrl('ftp://www.bilibili.com/video/BV1xx411c7mD'),
    null,
  );
  assert.equal(
    parseVideoUrl('https://secret@www.bilibili.com/video/BV1xx411c7mD'),
    null,
  );
  assert.equal(
    parseVideoUrl('https://www.bilibili.com/video/av99999999999999999999'),
    null,
  );
  assert.throws(
    () => normalizeVideo({ ...data, pages: undefined }, locator),
    /分 P/,
  );
  assert.throws(
    () => normalizeVideo({ ...data, aid: Infinity }, locator),
    /标识/,
  );
  assert.throws(() => normalizeVideo(null as any, locator), /格式异常/);
});

test('bad subtitle entries do not hide valid tracks and duplicate IDs are removed', async () => {
  const valid = {
    id: 1,
    lan: 'zh',
    subtitle_url: '//aisubtitle.hdslb.com/sub.json',
  };
  const tracks = await getSubtitleTracks(normalizeVideo(data, locator), {
    fetcher: (async () =>
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            subtitle: {
              subtitles: [
                null,
                {},
                { subtitle_url: 'https://evil.example/sub' },
                valid,
                valid,
              ],
            },
          },
        }),
      )) as typeof fetch,
  });
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0]?.id, '1');
});

test('subtitle downloads omit credentials and block redirects outside the allowed host', async () => {
  await getSubtitleCues(
    {
      id: '1',
      label: '中文',
      language: 'zh',
      url: '//aisubtitle.hdslb.com/sub.json',
    },
    {
      fetcher: (async (_url, init) => {
        assert.equal(init?.credentials, 'omit');
        assert.equal(init?.redirect, 'error');
        return new Response(
          JSON.stringify({ body: [{ from: 0, to: 1, content: '字幕' }] }),
        );
      }) as typeof fetch,
    },
  );
});

test('malformed player and view responses report format errors, cancellation skips fallbacks', async () => {
  await assert.rejects(
    resolveVideo(locator, null, {
      fetcher: (async () => new Response('null')) as typeof fetch,
    }),
    /格式异常/,
  );
  await assert.rejects(
    getSubtitleTracks(normalizeVideo(data, locator), {
      fetcher: (async () =>
        new Response(
          JSON.stringify({ data: { subtitle: { subtitles: {} } } }),
        )) as typeof fetch,
    }),
    /列表格式异常/,
  );
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    resolveVideo(locator, data, {
      signal: controller.signal,
      fetcher: (async () => {
        calls++;
        return new Response('{}');
      }) as typeof fetch,
    }),
    { name: 'AbortError' },
  );
  assert.equal(calls, 0);
});

test('fallback metadata must contain the actual video identity and endpoint errors stay visible', async () => {
  assert.throws(() => normalizeVideo({ ...data, bvid: '' }, locator), /标识/);
  let calls = 0;
  await assert.rejects(
    getSubtitleTracks(normalizeVideo(data, locator), {
      fetcher: (async () =>
        new Response(
          JSON.stringify(
            ++calls === 1
              ? { code: -101 }
              : { code: 0, data: { subtitle: { subtitles: [] } } },
          ),
        )) as typeof fetch,
    }),
    /登录/,
  );
});

test('cover hostname validation rejects query and credential tricks while allowing the actual CDN', () => {
  for (const pic of [
    'https://evil.example?image=.hdslb.com/cover.png',
    'https://i0.hdslb.com.evil.example/cover.png',
    'https://evil.example/#.hdslb.com/cover.png',
    'https://user:pass@i0.hdslb.com/cover.png',
    'https://i0.hdslb.com:8443/cover.png',
    'http://i0.hdslb.com/cover.png',
    'broken',
  ])
    assert.equal(normalizeVideo({ ...data, pic }, locator).cover, '');
  assert.equal(
    normalizeVideo(
      { ...data, pic: '//i0.hdslb.com/bfs/cover.png?token=1' },
      locator,
    ).cover,
    'https://i0.hdslb.com/bfs/cover.png?token=1',
  );
});
