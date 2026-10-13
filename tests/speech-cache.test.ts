import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechCache, SPEECH_CACHE_KEY } from '../src/lib/speech-cache';
import type { SpeechOutput } from '../src/lib/speech-types';
import type { VideoInfo } from '../src/lib/types';
const video = { bvid: 'BV1xx411c7mD', cid: 101, duration: 2 } as VideoInfo;
const output: SpeechOutput = {
  complete: true,
  duration: 2,
  engine: 'whisper',
  transcript: {
    timed: true,
    source: '本地识别',
    cues: [{ from: 0, to: 1, content: '完整转写' }],
  },
};
function fixture() {
  const values: Record<string, any> = {};
  return {
    values,
    async get(key: string) {
      return structuredClone({ [key]: values[key] });
    },
    async set(items: Record<string, unknown>) {
      Object.assign(values, structuredClone(items));
    },
  };
}
test('speech cache matches BVID, CID, language, engine and duration', async () => {
  const cache = createSpeechCache(fixture());
  await cache.save(video, 'zh-CN', output);
  assert.deepEqual(await cache.load(video, 'zh-CN', 'auto'), output);
  for (const other of [
    { ...video, cid: 102 },
    { ...video, bvid: 'BV2xx411c7mD' },
    { ...video, duration: 10 },
  ])
    assert.equal(await cache.load(other, 'zh-CN', 'auto'), null);
  assert.equal(await cache.load(video, 'en-US', 'auto'), null);
  assert.equal(await cache.load(video, 'zh-CN', 'native'), null);
});
test('incomplete or corrupt records never enable generation', async () => {
  const storage = fixture();
  const cache = createSpeechCache(storage);
  await assert.rejects(
    cache.save(video, 'zh-CN', {
      ...output,
      complete: false,
    } as unknown as SpeechOutput),
    /不完整/,
  );
  await assert.rejects(
    cache.save(video, 'zh-CN', {
      ...output,
      transcript: {
        ...output.transcript,
        cues: [{ from: 0, to: 5, content: '过长' }],
      },
    }),
    /不完整/,
  );
  await cache.save(video, 'zh-CN', output);
  storage.values[SPEECH_CACHE_KEY].corrupt = null;
  const key = Object.keys(storage.values[SPEECH_CACHE_KEY]).find(
    (k) => k !== 'corrupt',
  )!;
  storage.values[SPEECH_CACHE_KEY][key].output.complete = false;
  assert.equal(await cache.load(video, 'zh-CN', 'auto'), null);
});
test('concurrent saves retain both parts and eviction stays below byte and count budgets', async () => {
  const storage = fixture();
  const cache = createSpeechCache(storage);
  await Promise.all([
    cache.save(video, 'zh-CN', output),
    cache.save({ ...video, cid: 102 }, 'zh-CN', output),
  ]);
  assert.ok(await cache.load(video, 'zh-CN', 'auto'));
  assert.ok(await cache.load({ ...video, cid: 102 }, 'zh-CN', 'auto'));
  for (let i = 0; i < 15; i++)
    await cache.save({ ...video, cid: 200 + i }, 'zh-CN', {
      ...output,
      transcript: {
        ...output.transcript,
        cues: [{ from: 0, to: 1, content: '中'.repeat(250000) }],
      },
    });
  const cached = storage.values[SPEECH_CACHE_KEY];
  assert.ok(Object.keys(cached).length <= 12);
  assert.ok(
    new TextEncoder().encode(JSON.stringify(cached)).byteLength <= 2000000,
  );
  assert.ok(await cache.load({ ...video, cid: 214 }, 'zh-CN', 'auto'));
});
