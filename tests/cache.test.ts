import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_KEY,
  createResultCache,
  validateResults,
} from '../src/lib/cache';
import type { SavedResults } from '../src/lib/types';
const meta = {
  model: 'test',
  source: '中文',
  createdAt: '2026-10-08T00:00:00Z',
};
const value: SavedResults = {
  sourceHash: 'hash',
  summary: { ...meta, markdown: '完整总结' },
  map: null,
};
function fixture(
  initial: unknown = {},
  fail?: (items: Record<string, any>) => void,
) {
  let store: any = { [CACHE_KEY]: initial };
  return {
    async get(key: string) {
      return structuredClone({ [key]: store[key] });
    },
    async set(items: Record<string, any>) {
      fail?.(items);
      store = { ...store, ...structuredClone(items) };
    },
  };
}

test('cache isolates corrupt records and preserves a good summary when the map is corrupt', async () => {
  const storage = fixture({
    bad: null,
    invalid: { updatedAt: 1, value: {} },
    good: {
      updatedAt: 2,
      value: { ...value, map: { ...meta, tree: 'broken' } },
    },
  });
  const cache = createResultCache(storage);
  assert.equal((await cache.load('good'))?.summary?.markdown, '完整总结');
  assert.equal((await cache.load('good'))?.map, null);
  assert.equal(await cache.load('bad'), null);
  await cache.save('new', value);
  assert.equal((await cache.load('new'))?.summary?.markdown, '完整总结');
  assert.equal(
    validateResults({
      ...value,
      summary: { ...value.summary, incomplete: true },
    })?.summary,
    null,
  );
});

test('concurrent saves preserve different videos and merge different formats for one source', async () => {
  const cache = createResultCache(fixture());
  const map: SavedResults = {
    sourceHash: 'hash',
    summary: null,
    map: { ...meta, tree: { title: '主题', children: [] } },
  };
  const html: SavedResults = {
    sourceHash: 'hash',
    summary: null,
    map: null,
    html: {
      ...meta,
      document: {
        title: '主题',
        conclusion: '结论',
        sections: [{ title: '章节', markdown: '正文' }],
        tree: null,
      },
    },
  };
  await Promise.all([
    cache.save('one', value, 'summary'),
    cache.save('two', value),
    cache.save('one', map, 'map'),
    cache.save('one', html, 'html'),
  ]);
  assert.ok((await cache.load('two'))?.summary);
  assert.ok((await cache.load('one'))?.summary);
  assert.ok((await cache.load('one'))?.map);
  assert.ok((await cache.load('one'))?.html);
  await cache.save(
    'one',
    { ...value, summary: { ...meta, markdown: '更新总结' } },
    'summary',
  );
  assert.ok((await cache.load('one'))?.html);
  assert.ok((await cache.load('one'))?.map);
  await cache.save('one', { ...map, sourceHash: 'different' }, 'map');
  assert.equal((await cache.load('one'))?.summary, null);
  assert.equal((await cache.load('one'))?.html, null);
});

test('cache bounds history and evicts old entries on quota errors', async () => {
  const storage = fixture({}, (items) => {
    if (Object.keys(items[CACHE_KEY]).length > 2)
      throw new Error('QUOTA_BYTES quota exceeded');
  });
  const cache = createResultCache(storage);
  for (let i = 0; i < 5; i++) await cache.save(String(i), value);
  assert.ok((await cache.load('4'))?.summary);
  assert.equal(
    Object.keys((await storage.get(CACHE_KEY))[CACHE_KEY]).length,
    2,
  );
  const normalStorage = fixture();
  const normal = createResultCache(normalStorage);
  for (let i = 0; i < 15; i++) await normal.save(String(i), value);
  assert.equal(
    Object.keys((await normalStorage.get(CACHE_KEY))[CACHE_KEY]).length,
    12,
  );
  assert.ok(await normal.load('14'));
});

test('a failed write does not poison subsequent cache saves', async () => {
  let fail = true;
  const storage = fixture({}, () => {
    if (fail) throw new Error('storage unavailable');
  });
  const cache = createResultCache(storage);
  await assert.rejects(cache.save('one', value), /unavailable/);
  fail = false;
  await cache.save('two', value);
  assert.ok(await cache.load('two'));
});

test('separate panel cache instances serialize under the shared lock', async () => {
  let pending: Promise<void> = Promise.resolve();
  const lock = (operation: () => Promise<void>) => {
    const next = pending.catch(() => {}).then(operation);
    pending = next;
    return next;
  };
  const storage = fixture();
  const panelA = createResultCache(storage, lock),
    panelB = createResultCache(storage, lock);
  await Promise.all([panelA.save('one', value), panelB.save('two', value)]);
  assert.ok(await panelA.load('one'));
  assert.ok(await panelB.load('two'));
});

test('corrupt HTML is isolated from other cached formats and old records remain compatible', () => {
  const full = {
    ...value,
    map: { ...meta, tree: { title: '导图', children: [] } },
  };
  for (const html of [
    undefined,
    null,
    {},
    { ...meta, document: { title: '坏记录' } },
    {
      ...meta,
      document: { title: '主题', conclusion: '结论', sections: [], tree: null },
    },
  ]) {
    const result = validateResults({ ...full, html });
    assert.equal(result?.html, null);
    assert.equal(result?.summary?.markdown, '完整总结');
    assert.equal(result?.map?.tree.title, '导图');
  }
  const goodHtml = {
    ...meta,
    document: {
      title: '主题',
      conclusion: '结论',
      sections: [{ title: '章节', markdown: '正文' }],
      tree: null,
    },
  };
  const result = validateResults({
    sourceHash: 'hash',
    html: goodHtml,
    summary: { ...meta, markdown: '草稿', incomplete: true },
    map: { ...meta, tree: 'broken' },
  });
  assert.ok(result?.html);
  assert.equal(result?.summary, null);
  assert.equal(result?.map, null);
});
