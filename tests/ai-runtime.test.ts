import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiRuntime, retryAfterMs } from '../src/lib/ai-runtime';
import { abortable } from '../src/lib/request';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function sharedGate() {
  const tails = new Map<string, Promise<void>>();
  return async <T>(
    key: string,
    signal: AbortSignal,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const previous = tails.get(key) ?? Promise.resolve();
    const result = previous.then(() => {
      signal.throwIfAborted();
      return operation();
    });
    tails.set(
      key,
      result.then(
        () => {},
        () => {},
      ),
    );
    return abortable(result, signal);
  };
}
const endpoint = 'https://fixture.example/v1/chat/completions';

test('separate panels serialize one service and share the minimum start interval', async () => {
  let now = 100000;
  const data: Record<string, unknown> = {};
  const storage = {
    async get(key: string) {
      return { [key]: structuredClone(data[key]) };
    },
    async set(values: Record<string, unknown>) {
      Object.assign(data, structuredClone(values));
    },
  };
  const lock = sharedGate();
  const config = {
    storage,
    lock,
    now: () => now,
    wait: async (ms: number) => {
      now += ms;
    },
  };
  const firstPanel = createAiRuntime(config),
    secondPanel = createAiRuntime(config);
  const started = deferred(),
    release = deferred();
  const calls: number[] = [];
  const first = firstPanel.request(endpoint, {}, async () => {
    calls.push(now);
    started.resolve();
    await release.promise;
    return 'first';
  });
  await started.promise;
  const second = secondPanel.request(
    endpoint.replace('/v1/', '/v2/'),
    {},
    async () => {
      calls.push(now);
      return 'second';
    },
  );
  assert.equal(
    await secondPanel.request(
      'https://another.example/v1/chat/completions',
      {},
      async () => 'independent',
    ),
    'independent',
  );
  assert.equal(calls.length, 1);
  release.resolve();
  assert.deepEqual(await Promise.all([first, second]), ['first', 'second']);
  assert.deepEqual(calls, [100000, 103000]);
  assert.ok(
    Object.values(data).every(
      (value) =>
        Object.keys(value as object)
          .sort()
          .join(',') === 'blockedUntil,nextAt',
    ),
  );
});

test('cancelling a queued request never starts it or releases the preceding operation early', async () => {
  const runtime = createAiRuntime({ intervalMs: 0 });
  const started = deferred(),
    release = deferred();
  const first = runtime.request(endpoint, {}, async () => {
    started.resolve();
    await release.promise;
  });
  await started.promise;
  const controller = new AbortController();
  let cancelledCalls = 0,
    lastCalls = 0;
  const cancelled = runtime.request(
    endpoint,
    { signal: controller.signal },
    async () => {
      cancelledCalls++;
    },
  );
  controller.abort();
  await assert.rejects(cancelled, { name: 'AbortError' });
  const last = runtime.request(endpoint, {}, async () => {
    lastCalls++;
  });
  await Promise.resolve();
  assert.equal(lastCalls, 0);
  release.resolve();
  await Promise.all([first, last]);
  assert.equal(cancelledCalls, 0);
  assert.equal(lastCalls, 1);
});

test('Retry-After supports seconds and dates, blocks immediate retries and resumes after expiry', async () => {
  let now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(retryAfterMs('2.5', now), 2500);
  assert.equal(retryAfterMs('Thu, 01 Jan 2026 00:02:00 GMT', now), 120000);
  assert.equal(retryAfterMs('nonsense', now), 30000);
  assert.equal(retryAfterMs(null, now), 30000);
  assert.equal(retryAfterMs('0', now), 1000);
  const runtime = createAiRuntime({
    intervalMs: 0,
    now: () => now,
    wait: async (ms) => {
      now += ms;
    },
  });
  let calls = 0;
  await assert.rejects(
    runtime.request(endpoint, {}, async (cooldown) => {
      calls++;
      await cooldown('120');
      throw new Error('limited');
    }),
    /limited/,
  );
  await assert.rejects(
    runtime.request(endpoint, {}, async () => {
      calls++;
    }),
    /120 秒后/,
  );
  assert.equal(calls, 1, 'no automatic or early paid retry');
  now += 120000;
  await runtime.request(endpoint, {}, async () => {
    calls++;
  });
  assert.equal(calls, 2);
  await runtime.request(endpoint, {}, async (cooldown) => {
    await cooldown('2');
  });
  const progress: string[] = [];
  await runtime.request(
    endpoint,
    { onProgress: (text) => progress.push(text) },
    async () => {
      calls++;
    },
  );
  assert.ok(progress.some((text) => text.includes('2 秒后')));
  assert.equal(calls, 3);
});

test('cancelling during the rate interval stops waiting without sending a request', async () => {
  const waiting = deferred();
  const controller = new AbortController();
  const runtime = createAiRuntime({
    now: () => 1000,
    wait: async (_ms, signal) => {
      waiting.resolve();
      await abortable(new Promise<void>(() => {}), signal);
    },
  });
  await runtime.request(endpoint, {}, async () => {});
  let calls = 0;
  const request = runtime.request(
    endpoint,
    { signal: controller.signal },
    async () => {
      calls++;
    },
  );
  await waiting.promise;
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('unavailable session storage fails before sending instead of bypassing rate control', async () => {
  let calls = 0;
  for (const fail of ['read', 'write']) {
    const runtime = createAiRuntime({
      storage: {
        async get() {
          if (fail === 'read') throw new Error('unavailable');
          return {};
        },
        async set() {
          if (fail === 'write') throw new Error('unavailable');
        },
      },
    });
    await assert.rejects(
      runtime.request(endpoint, {}, async () => {
        calls++;
      }),
      /请求队列失败/,
    );
  }
  assert.equal(calls, 0);
});

test('temporary note reuse expires and stays bounded as other videos are prepared', async () => {
  let now = 1000;
  const runtime = createAiRuntime({ now: () => now });
  const save = (key: string) =>
    runtime.prepare(key, undefined, async (notes) => {
      notes.set('part', key);
    });
  const read = (key: string) =>
    runtime.prepare(key, undefined, async (notes) => notes.get('part'));
  await save('first');
  assert.equal(await read('first'), 'first');
  now += 31 * 60 * 1000;
  assert.equal(await read('first'), undefined);
  for (let i = 0; i < 5; i++) {
    now++;
    await save('video' + i);
  }
  assert.equal(await read('video0'), undefined);
  assert.equal(await read('video4'), 'video4');
});

test('storage latency cannot shorten actual start intervals and a failed correction keeps the paid result', async () => {
  let now = 100000,
    writes = 0;
  const data: Record<string, unknown> = {};
  const starts: number[] = [];
  const runtime = createAiRuntime({
    now: () => now,
    wait: async (ms) => {
      now += ms;
    },
    storage: {
      async get(key) {
        return { [key]: structuredClone(data[key]) };
      },
      async set(values) {
        now += 1000;
        if (++writes === 2) throw new Error('failed rate timestamp correction');
        Object.assign(data, structuredClone(values));
      },
    },
  });
  const run = () =>
    runtime.request(endpoint, {}, async () => {
      starts.push(now);
      return 'completed paid result';
    });
  assert.equal(await run(), 'completed paid result');
  assert.equal(await run(), 'completed paid result');
  assert.ok(starts[1]! - starts[0]! >= 3000);
});
