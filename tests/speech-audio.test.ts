import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAudioUrl,
  normalizeAudioPlan,
  signPlaybackQuery,
  getVideoAudioPlan,
  downloadAudio,
  audioHeaderRule,
} from '../src/lib/speech-audio';
import { MAX_AUDIO_BYTES } from '../src/lib/speech-types';
import type { VideoInfo } from '../src/lib/types';
const video = { bvid: 'BV1xx411c7mD', cid: 102, duration: 50 } as VideoInfo;
const audio = (url = 'https://a.bilivideo.com/audio.m4s') => ({
  duration: 50,
  renditions: [{ urls: [url], bandwidth: 32000 }],
});
const reply = (data: unknown) => new Response(JSON.stringify(data));
const payload = {
  timelength: 50000,
  dash: {
    audio: [
      {
        codecs: 'mp4a.40.2',
        baseUrl: 'https://a.bilivideo.com/audio.m4s',
        bandwidth: 32000,
      },
    ],
  },
};

test('audio URLs require approved HTTPS CDN domains with no credentials', () => {
  assert.equal(
    normalizeAudioUrl('//a.bilivideo.cn/a'),
    'https://a.bilivideo.cn/a',
  );
  assert.equal(
    normalizeAudioUrl('http://a.hdslb.com/a'),
    'https://a.hdslb.com/a',
  );
  for (const url of [
    'https://evil.test/a',
    'https://bilivideo.com.evil.test/a',
    'https://user@a.bilivideo.com/a',
    'file:///audio',
    'data:audio/mp4,xx',
  ])
    assert.throws(() => normalizeAudioUrl(url));
  const rule = audioHeaderRule('extension-id');
  assert.deepEqual(rule.condition.initiatorDomains, ['extension-id']);
  assert.deepEqual(rule.condition.resourceTypes, ['xmlhttprequest']);
});
test('audio plan rejects wrong-part duration and chooses bounded AAC renditions and backups', () => {
  assert.throws(() => normalizeAudioPlan(payload, 530), /分 P/);
  assert.throws(
    () => normalizeAudioPlan({ timelength: 4 * 3600000 + 1 }, 14401),
    /4 小时/,
  );
  const plan = normalizeAudioPlan(
    {
      ...payload,
      dash: {
        audio: [
          {
            codecs: 'ec-3',
            baseUrl: 'https://a.bilivideo.com/dolby',
            bandwidth: 1,
          },
          {
            codecs: 'mp4a.40.2',
            base_url: 'https://a.bilivideo.com/large',
            bandwidth: 128000,
          },
          {
            codecs: 'mp4a.40.2',
            baseUrl: 'https://evil.test/a',
            backupUrl: ['https://b.bilivideo.com/small'],
            bandwidth: 32000,
          },
        ],
      },
    },
    50,
  );
  assert.equal(plan.renditions.length, 2);
  assert.equal(plan.renditions[0]!.urls[0], 'https://b.bilivideo.com/small');
});
test('WBI signing matches an independent canonical MD5 vector', () => {
  assert.equal(
    signPlaybackQuery(
      { foo: '114', bar: '514', baz: '1919810' },
      'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',
      'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png',
      1702204169,
    ),
    'bar=514&baz=1919810&foo=114&wts=1702204169&w_rid=6149fdadf571698ca7e6a567265cd0ee',
  );
});
test('playback fallback uses fresh current CID, signed query and login-scoped API credentials', async () => {
  const calls: URL[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(init?.credentials, 'include');
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname.endsWith('/nav'))
      return reply({
        code: -101,
        data: {
          wbi_img: {
            img_url:
              'https://i0.hdslb.com/7cd084941338484aae1ad9425b84077c.png',
            sub_url:
              'https://i0.hdslb.com/4932caff0ff746eab6f01bf08b70ac45.png',
          },
        },
      });
    if (!url.pathname.includes('/wbi/')) return reply({ code: -352 });
    assert.equal(url.searchParams.get('cid'), '102');
    assert.ok(url.searchParams.get('w_rid'));
    return reply({ code: 0, data: payload });
  };
  assert.equal((await getVideoAudioPlan(video, { fetcher })).duration, 50);
  assert.equal(calls.length, 3);
});
test('a failed or partial download uses a fresh backup and never sends CDN credentials', async () => {
  let calls = 0;
  const blob = await downloadAudio(
    {
      duration: 50,
      renditions: [
        {
          bandwidth: 1,
          urls: ['https://a.bilivideo.com/a', 'https://b.bilivideo.com/a'],
        },
      ],
    },
    {
      fetcher: async (_input, init) => {
        assert.equal(init?.credentials, 'omit');
        calls++;
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'Content-Length': calls === 1 ? '4' : '3' },
        });
      },
    },
  );
  assert.equal(calls, 2);
  assert.equal(blob.size, 3);
});
test('oversized headers and streamed audio are rejected and release the body', async () => {
  let canceled = false;
  await assert.rejects(
    downloadAudio(audio(), {
      fetcher: async () =>
        new Response(
          new ReadableStream({
            cancel() {
              canceled = true;
            },
          }),
          { headers: { 'Content-Length': String(MAX_AUDIO_BYTES + 1) } },
        ),
    }),
    /128 MB/,
  );
  assert.equal(canceled, true);
  await assert.rejects(
    downloadAudio(audio(), {
      fetcher: async () => new Response(new Uint8Array(MAX_AUDIO_BYTES + 1)),
    }),
    /128 MB/,
  );
});
test('abort stops blocked stream and prevents trying another URL', async () => {
  const controller = new AbortController();
  let calls = 0;
  let cancelled = false;
  const operation = downloadAudio(
    {
      duration: 50,
      renditions: [
        {
          bandwidth: 1,
          urls: ['https://a.bilivideo.com/a', 'https://b.bilivideo.com/a'],
        },
      ],
    },
    {
      signal: controller.signal,
      fetcher: async () => {
        calls++;
        return new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array([1]));
            },
            cancel() {
              cancelled = true;
            },
          }),
        );
      },
      onProgress: () =>
        controller.abort(new DOMException('stop', 'AbortError')),
    },
  );
  await assert.rejects(operation, { name: 'AbortError' });
  assert.equal(calls, 1);
  assert.equal(cancelled, true);
  await assert.rejects(
    downloadAudio(audio(), {
      signal: controller.signal,
      fetcher: async () => {
        throw new Error('must not fetch');
      },
    }),
    { name: 'AbortError' },
  );
});

test('invalid expected duration and malformed WBI fallback return guidance without internal errors', async () => {
  for (const duration of [0, NaN, -1])
    assert.throws(() => normalizeAudioPlan(payload, duration), /分 P/);
  let calls = 0;
  await assert.rejects(
    getVideoAudioPlan(video, {
      fetcher: async () => {
        calls++;
        return reply(calls === 1 ? { code: -352 } : { code: 0, data: {} });
      },
    }),
    /签名信息格式异常/,
  );
});
