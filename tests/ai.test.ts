import { test } from 'node:test';
import { createAiRuntime } from '../src/lib/ai-runtime';
import assert from 'node:assert/strict';
import {
  chatCompletion,
  generateMindMap,
  generateSummary,
  readSseData,
  testConnection,
} from '../src/lib/ai';
import {
  apiOriginPattern,
  completionUrl,
  DEFAULT_SETTINGS,
} from '../src/lib/config';
import type { Settings, Transcript, VideoInfo } from '../src/lib/types';

const settings: Settings = { ...DEFAULT_SETTINGS, apiKey: 'fixture-key' };
const video: VideoInfo = {
  aid: 1,
  bvid: 'BV1xx411c7mD',
  cid: 2,
  page: 1,
  title: '测试',
  part: '',
  owner: 'UP',
  duration: 100,
  cover: '',
  description: '',
  url: 'https://www.bilibili.com/video/BV1xx411c7mD/?p=1',
};
const encoder = new TextEncoder();
const streamBytes = (bytes: Uint8Array, size: number) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size)
        controller.enqueue(bytes.slice(i, i + size));
      controller.close();
    },
  });
const jsonReply = (content: string, finish_reason = 'stop') =>
  new Response(
    JSON.stringify({ choices: [{ message: { content }, finish_reason }] }),
    { headers: { 'Content-Type': 'application/json' } },
  );

test('API URLs support bases, full endpoint and localhost; origin permission is narrow', () => {
  assert.equal(
    completionUrl('https://example.com/v1/'),
    'https://example.com/v1/chat/completions',
  );
  assert.equal(
    completionUrl('https://example.com/v1/chat/completions'),
    'https://example.com/v1/chat/completions',
  );
  assert.equal(
    apiOriginPattern('http://127.0.0.1:11434/v1'),
    'http://127.0.0.1/*',
  );
  assert.throws(() => completionUrl('http://remote.example/v1'), /HTTPS/);
  assert.throws(
    () => completionUrl('https://example.com/v1?key=secret'),
    /路径/,
  );
});

test('SSE decoding preserves Chinese split at every byte and sealed CRLF events', async () => {
  const wire =
    ': keepalive\r\ndata: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: [DONE]\r\n\r\n';
  const events: string[] = [];
  for await (const event of readSseData(streamBytes(encoder.encode(wire), 1)))
    events.push(event);
  assert.equal(events.length, 2);
  assert.equal(JSON.parse(events[0]!).choices[0].delta.content, '你好');
  assert.equal(events[1], '[DONE]');
});

test('streamed completion accumulates tokens and uses bearer auth without cookies', async () => {
  const wire =
    'data: {"choices":[{"delta":{"content":"中"}}]}\n\ndata: {"choices":[{"delta":{"content":"文"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
  const seen: string[] = [];
  const result = await chatCompletion(
    settings,
    [{ role: 'user', content: 'test' }],
    {
      onToken: (token) => seen.push(token),
      runtime: createAiRuntime({ intervalMs: 0 }),
      fetcher: (async (_url, init) => {
        assert.equal(
          (init?.headers as Record<string, string>).Authorization,
          'Bearer fixture-key',
        );
        assert.equal(init?.credentials, 'omit');
        assert.equal(init?.redirect, 'error');
        return new Response(streamBytes(encoder.encode(wire), 2), {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }) as typeof fetch,
    },
  );
  assert.equal(result, '中文');
  assert.equal(seen.at(-1), '中文');
});

test('truncated streams, server errors and length-limit outputs are not accepted as complete', async () => {
  await assert.rejects(
    () =>
      chatCompletion(settings, [], {
        runtime: createAiRuntime({ intervalMs: 0 }),
        fetcher: (async () =>
          new Response(
            'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
            { headers: { 'Content-Type': 'text/event-stream' } },
          )) as typeof fetch,
      }),
    /提前中断/,
  );
  await assert.rejects(
    () =>
      chatCompletion(settings, [], {
        runtime: createAiRuntime({ intervalMs: 0 }),
        fetcher: (async () => jsonReply('partial', 'length')) as typeof fetch,
      }),
    /长度上限/,
  );
  await assert.rejects(
    () =>
      chatCompletion(settings, [], {
        runtime: createAiRuntime({ intervalMs: 0 }),
        fetcher: (async () =>
          new Response(
            JSON.stringify({ error: { message: 'bad fixture-key' } }),
            { status: 401 },
          )) as typeof fetch,
      }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes('fixture-key'));
      return true;
    },
  );
});

test('abort promptly cancels a stalled SSE reader', async () => {
  const abort = new AbortController();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: first\n\n'));
    },
    cancel() {
      cancelled = true;
    },
  });
  const iterator = readSseData(stream, abort.signal);
  assert.equal((await iterator.next()).value, 'first');
  const waiting = iterator.next();
  abort.abort();
  await assert.rejects(
    waiting,
    (error) => (error as Error).name === 'AbortError',
  );
  assert.equal(cancelled, true);
});

test('long video generation reads the final chunk before final synthesis', async () => {
  const transcript: Transcript = {
    source: '中文',
    timed: true,
    cues: Array.from({ length: 30 }, (_, i) => ({
      from: i * 2,
      to: i * 2 + 1,
      content: 'MARKER_' + i + '_' + '长字幕'.repeat(300),
    })),
  };
  const requests: string[] = [];
  const fetcher = (async (_url, init) => {
    const payload = JSON.parse(init?.body as string);
    const prompt = payload.messages[1].content;
    requests.push(prompt);
    return jsonReply(
      prompt.includes('这段是') || prompt.includes('这是第')
        ? '分段要点'
        : '## 核心要点\n完整笔记',
    );
  }) as typeof fetch;
  const output = await generateSummary(video, transcript, settings, {
    runtime: createAiRuntime({ intervalMs: 0 }),
    fetcher,
  });
  assert.ok(requests.length >= 3);
  assert.ok(
    requests.slice(0, -1).some((prompt) => prompt.includes('MARKER_29_')),
  );
  for (let i = 0; i < 30; i++)
    assert.ok(
      requests
        .slice(0, -1)
        .some((prompt) => prompt.includes('MARKER_' + i + '_')),
    );
  assert.ok(output.includes('完整笔记'));
});

test('map generation validates model JSON and TXT summaries forbid invented timing', async () => {
  const transcript: Transcript = {
    source: '导入 TXT',
    timed: false,
    cues: [{ from: 0, to: 0, content: '重要知识' }],
  };
  const map = await generateMindMap(video, transcript, settings, {
    runtime: createAiRuntime({ intervalMs: 0 }),
    fetcher: (async () =>
      jsonReply(
        '{"title":"知识","children":[{"title":"重点","children":[]}]}',
      )) as typeof fetch,
  });
  assert.equal(map.children[0]?.title, '重点');
  await generateSummary(video, transcript, settings, {
    runtime: createAiRuntime({ intervalMs: 0 }),
    fetcher: (async (_url, init) => {
      assert.ok(String(init?.body).includes('不要创建或推断时间戳'));
      return jsonReply('## 要点');
    }) as typeof fetch,
  });
});

test('one detail setting controls Markdown coverage and map node/layer limits', async () => {
  const transcript: Transcript = {
    source: '中文',
    timed: true,
    cues: [{ from: 0, to: 5, content: '核心结论与案例' }],
  };
  for (const detailLevel of [1, 5] as const) {
    const current = { ...settings, detailLevel };
    let summaryPrompt = '',
      mapPrompt = '';
    await generateSummary(video, transcript, current, {
      runtime: createAiRuntime({ intervalMs: 0 }),
      fetcher: (async (_url, init) => {
        summaryPrompt = JSON.parse(init?.body as string).messages.at(
          -1,
        ).content;
        return jsonReply('## 观点\n\n总结正文');
      }) as typeof fetch,
    });
    await generateMindMap(video, transcript, current, {
      runtime: createAiRuntime({ intervalMs: 0 }),
      fetcher: (async (_url, init) => {
        mapPrompt = JSON.parse(init?.body as string).messages.at(-1).content;
        return jsonReply('{"title":"观点","children":[]}');
      }) as typeof fetch,
    });
    const label = detailLevel === 1 ? '精简' : '详尽';
    assert.ok(summaryPrompt.includes('总结细腻程度：' + label));
    assert.ok(mapPrompt.includes('总结细腻程度：' + label));
    assert.ok(
      summaryPrompt.includes(detailLevel === 1 ? '150–400' : '2200–3500'),
    );
    assert.ok(
      mapPrompt.includes('总节点不超过 ' + (detailLevel === 1 ? 25 : 110)),
    );
    assert.ok(
      mapPrompt.includes('最多 ' + (detailLevel === 1 ? 3 : 6) + ' 层'),
    );
    assert.ok(mapPrompt.includes('不需要填满'));
    assert.ok(summaryPrompt.includes('以连贯的段落总结为主'));
    assert.ok(summaryPrompt.includes('0–2 个表格'));
    assert.ok(summaryPrompt.includes('没有适合的内容就不插入'));
  }
});

test('long transcripts preserve more detail in intermediate notes at higher levels', async () => {
  const transcript: Transcript = {
    source: '中文',
    timed: true,
    cues: Array.from({ length: 30 }, (_, i) => ({
      from: i * 2,
      to: i * 2 + 1,
      content: 'PART_' + i + '_' + '字幕'.repeat(500),
    })),
  };
  for (const detailLevel of [1, 5] as const) {
    const prompts: string[] = [];
    await generateSummary(
      video,
      transcript,
      { ...settings, detailLevel },
      {
        runtime: createAiRuntime({ intervalMs: 0 }),
        fetcher: (async (_url, init) => {
          const prompt = JSON.parse(init?.body as string).messages.at(
            -1,
          ).content;
          prompts.push(prompt);
          return jsonReply('简短片段笔记');
        }) as typeof fetch,
      },
    );
    const notes = prompts.slice(0, -1);
    assert.ok(notes.length > 1);
    assert.ok(
      notes.every((prompt) =>
        prompt.includes('不超过 ' + (detailLevel === 1 ? 500 : 1900) + ' 字'),
      ),
    );
    assert.ok(notes.some((prompt) => prompt.includes('PART_29_')));
  }
});

test('SSE supports CR-only framing, BOM, and split CRLF delimiters', async () => {
  for (const delimiter of ['\r', '\r\n', '\n']) {
    const events = [];
    for await (const event of readSseData(
      streamBytes(
        encoder.encode(
          '\uFEFFdata: first' +
            delimiter +
            'data: second' +
            delimiter +
            delimiter +
            'data: [DONE]' +
            delimiter +
            delimiter,
        ),
        1,
      ),
    ))
      events.push(event);
    assert.deepEqual(events, ['first\nsecond', '[DONE]']);
  }
});

test('oversized SSE events and JSON outputs are rejected and streaming bodies cancelled', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: ' + 'x'.repeat(1_000_001)));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(async () => {
    for await (const _ of readSseData(stream)) {
    }
  }, /过大/);
  assert.equal(cancelled, true);
  await assert.rejects(
    chatCompletion(settings, [], {
      runtime: createAiRuntime({ intervalMs: 0 }),
      fetcher: (async () => jsonReply('x'.repeat(180001))) as typeof fetch,
    }),
    /过长/,
  );
});

test('malformed successful responses produce friendly errors and redact thrown credentials', async () => {
  for (const response of [
    new Response('null', { headers: { 'Content-Type': 'application/json' } }),
    new Response('data: null\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
    new Response('<html>bad gateway</html>', {
      headers: { 'Content-Type': 'text/html' },
    }),
  ]) {
    await assert.rejects(
      chatCompletion(settings, [], {
        runtime: createAiRuntime({ intervalMs: 0 }),
        fetcher: (async () => response) as typeof fetch,
      }),
      /格式异常|不是 JSON/,
    );
  }
  await assert.rejects(
    chatCompletion(settings, [], {
      runtime: createAiRuntime({ intervalMs: 0 }),
      fetcher: (async () => {
        throw new TypeError('failed fetch fixture-key');
      }) as typeof fetch,
    }),
    (error: Error) => {
      assert.equal(error.name, 'TypeError');
      assert.ok(!error.message.includes(settings.apiKey));
      return true;
    },
  );
});

test('already aborted generation never sends a billable request', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    chatCompletion(settings, [], {
      signal: controller.signal,
      runtime: createAiRuntime({ intervalMs: 0 }),
      fetcher: (async () => {
        calls++;
        return jsonReply('OK');
      }) as typeof fetch,
    }),
    { name: 'AbortError' },
  );
  assert.equal(calls, 0);
});

test('finish_reason completes and closes a stream even when the server keeps the connection open', async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"正文"},"finish_reason":"stop"}]}\n\n',
          ),
        );
      },
      cancel() {
        cancelled = true;
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
  assert.equal(
    await chatCompletion(settings, [], {
      runtime: createAiRuntime({ intervalMs: 0 }),
      fetcher: (async () => response) as typeof fetch,
    }),
    '正文',
  );
  assert.equal(cancelled, true);
});

test('API key validation rejects invalid header characters before any permission prompt', async () => {
  const { validateSettings } = await import('../src/lib/config');
  for (const apiKey of [
    'key\nInjected',
    '中文密钥',
    'key\u200bhidden',
    'key with spaces',
  ])
    assert.throws(() => validateSettings({ ...settings, apiKey }), /无效字符/);
});

const longSource: Transcript = {
  source: '中文',
  timed: true,
  cues: Array.from({ length: 4 }, (_, index) => ({
    from: index * 10,
    to: index * 10 + 9,
    content: 'SECTION_' + index + '_' + '字幕内容'.repeat(1300),
  })),
};

test('summary and map reuse full long-video notes, while account, detail and source changes isolate them', async () => {
  const runtime = createAiRuntime({ intervalMs: 0 });
  const bodies: any[] = [];
  const fetcher = (async (_url, init) => {
    const payload = JSON.parse(init?.body as string);
    bodies.push(payload);
    const prompt = payload.messages.at(-1).content;
    return jsonReply(
      prompt.includes('这是第')
        ? '已完成分段要点'
        : prompt.includes('思维导图')
          ? '{"title":"主题","children":[]}'
          : '## 完整总结',
    );
  }) as typeof fetch;
  await generateSummary(video, longSource, settings, { runtime, fetcher });
  const first = bodies.length;
  assert.ok(first > 2);
  assert.ok(bodies.slice(0, -1).every((body) => body.stream === true));
  assert.equal(bodies.at(-1).stream, true);
  await generateMindMap(video, longSource, settings, { runtime, fetcher });
  assert.equal(
    bodies.length,
    first + 1,
    'only the final map needs a new request',
  );
  assert.equal(bodies.at(-1).stream, true);
  for (const [nextSettings, nextSource, nextVideo] of [
    [{ ...settings, apiKey: 'another-account' }, longSource, video],
    [{ ...settings, detailLevel: 5 as const }, longSource, video],
    [settings, { ...longSource, source: '导入文件' }, video],
    [settings, longSource, { ...video, cid: 99 }],
  ] as const) {
    const before = bodies.length;
    await generateSummary(nextVideo, nextSource, nextSettings, {
      runtime,
      fetcher,
    });
    assert.equal(bodies.length - before, first);
  }
});

test('failed long-video generation resumes at the unfinished chunk and final failures reuse prepared notes', async () => {
  const runtime = createAiRuntime({ intervalMs: 0 });
  const prompts: string[] = [];
  let failChunk = true,
    failFinal = true;
  const fetcher = (async (_url, init) => {
    const prompt = JSON.parse(init?.body as string).messages.at(-1).content;
    prompts.push(prompt);
    if (prompt.includes('这是第 2/') && failChunk) {
      failChunk = false;
      throw new TypeError('Failed to fetch');
    }
    if (prompt.includes('这是第')) return jsonReply('笔记');
    if (failFinal) {
      failFinal = false;
      throw new TypeError('Failed to fetch');
    }
    return jsonReply('## 结果');
  }) as typeof fetch;
  await assert.rejects(
    generateSummary(video, longSource, settings, { runtime, fetcher }),
    /fetch/,
  );
  await assert.rejects(
    generateSummary(video, longSource, settings, { runtime, fetcher }),
    /fetch/,
  );
  const before = prompts.length;
  await generateSummary(video, longSource, settings, { runtime, fetcher });
  assert.equal(prompts.length, before + 1);
  assert.equal(prompts.filter((text) => text.includes('这是第 1/')).length, 1);
  assert.equal(prompts.filter((text) => text.includes('这是第 2/')).length, 2);
});

test('concurrent summary and map share preprocessing and cancellation does not poison later requests', async () => {
  const runtime = createAiRuntime({ intervalMs: 0 });
  let notes = 0;
  const fetcher = (async (_url, init) => {
    const prompt = JSON.parse(init?.body as string).messages.at(-1).content;
    if (prompt.includes('这是第')) {
      notes++;
      return jsonReply('笔记');
    }
    return jsonReply(
      prompt.includes('思维导图')
        ? '{"title":"主题","children":[]}'
        : '## 结果',
    );
  }) as typeof fetch;
  await Promise.all([
    generateSummary(video, longSource, settings, { runtime, fetcher }),
    generateMindMap(video, longSource, settings, { runtime, fetcher }),
  ]);
  const { chunkTranscript } = await import('../src/lib/transcript');
  assert.equal(notes, chunkTranscript(longSource).length);

  const cancelledRuntime = createAiRuntime({ intervalMs: 0 });
  const controller = new AbortController();
  const started: string[] = [];
  let cancel = true;
  const cancellingFetcher = (async (_url, init) => {
    const prompt = JSON.parse(init?.body as string).messages.at(-1).content;
    started.push(prompt);
    if (prompt.includes('这是第 2/') && cancel) {
      cancel = false;
      controller.abort();
    }
    return jsonReply('## 笔记');
  }) as typeof fetch;
  await assert.rejects(
    generateSummary(video, longSource, settings, {
      runtime: cancelledRuntime,
      signal: controller.signal,
      fetcher: cancellingFetcher,
    }),
    { name: 'AbortError' },
  );
  await generateSummary(video, longSource, settings, {
    runtime: cancelledRuntime,
    fetcher: cancellingFetcher,
  });
  assert.equal(started.filter((text) => text.includes('这是第 1/')).length, 1);
  assert.equal(started.filter((text) => text.includes('这是第 2/')).length, 2);
});

test('HTTP 429 records Retry-After, sends no automatic retry and redacts service credentials', async () => {
  const runtime = createAiRuntime({ intervalMs: 0 });
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    return new Response('{"error":{"message":"fixture-key too fast"}}', {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '120' },
    });
  }) as typeof fetch;
  await assert.rejects(
    chatCompletion(settings, [], { runtime, fetcher }),
    (error: Error) => {
      assert.ok(error.message.includes('120 秒后'));
      assert.ok(!error.message.includes(settings.apiKey));
      return true;
    },
  );
  await assert.rejects(
    chatCompletion(settings, [], { runtime, fetcher }),
    /秒后重试/,
  );
  assert.equal(calls, 1);
});

test('non-shrinking merge notes can be retried without rereading successful subtitle chunks', async () => {
  const runtime = createAiRuntime({ intervalMs: 0 });
  let chunks = 0,
    merges = 0,
    shrink = false;
  const fetcher = (async (_url, init) => {
    const prompt = JSON.parse(init?.body as string).messages.at(-1).content;
    if (prompt.includes('这是第')) {
      chunks++;
      return jsonReply('原始笔记'.repeat(3500));
    }
    if (prompt.includes('<notes>')) {
      merges++;
      return jsonReply(shrink ? '有效合并' : '不收缩笔记'.repeat(3000));
    }
    return jsonReply('## 完整结果');
  }) as typeof fetch;
  await assert.rejects(
    generateSummary(video, longSource, settings, { runtime, fetcher }),
    /未按要求压缩/,
  );
  const readChunks = chunks,
    failedMerges = merges;
  shrink = true;
  await generateSummary(video, longSource, settings, { runtime, fetcher });
  assert.equal(chunks, readChunks);
  assert.equal(merges, failedMerges * 2);
});

const shortSource: Transcript = {
  source: '中文',
  timed: true,
  cues: [{ from: 0, to: 10, content: '完整主题与案例' }],
};
const sseEvent = (data: unknown) => 'data: ' + JSON.stringify(data) + '\n\n';
const contentEvent = (content: string, finish_reason?: string) =>
  sseEvent({ choices: [{ delta: { content }, finish_reason }] });
const sseReply = (wire: string, size = 7) =>
  new Response(streamBytes(encoder.encode(wire), size), {
    headers: { 'Content-Type': 'text/event-stream' },
  });

test('EOF discards unsealed data and cannot turn a truncated finish marker into success', async () => {
  for (const ending of ['', '\n', '\r', '\r\n']) {
    const events: string[] = [];
    for await (const event of readSseData(
      streamBytes(encoder.encode('data: sealed\n\ndata: tail' + ending), 1),
    ))
      events.push(event);
    assert.deepEqual(events, ['sealed']);
  }
  for (const tail of [
    'data: [DONE]',
    'data: [DONE]\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n',
  ]) {
    await assert.rejects(
      chatCompletion(settings, [], {
        runtime: createAiRuntime({ intervalMs: 0 }),
        fetcher: (async () =>
          sseReply(contentEvent('可解析但未完成') + tail)) as typeof fetch,
      }),
      /提前中断/,
    );
  }
});

test('streamed mind-map JSON stays private until finished and reasoning/usage chunks never become content', async () => {
  const raw =
    '{"title":"网络😀","children":[{"title":"七层模型","children":[]}]}';
  const progress: string[] = [],
    exposed: string[] = [];
  let cancelled = false;
  const wire =
    ': heartbeat\n\ndata: \n\n' +
    sseEvent({ choices: [], usage: { prompt_tokens: 123 } }) +
    sseEvent({
      choices: [{ delta: { reasoning_content: '内部思考，不应展示' } }],
    }) +
    Array.from(raw, (char) => contentEvent(char)).join('') +
    sseEvent({ choices: [{ delta: {}, finish_reason: 'stop' }] });
  const tree = await generateMindMap(video, shortSource, settings, {
    runtime: createAiRuntime({ intervalMs: 0 }),
    onProgress: (text) => progress.push(text),
    onToken: (text) => exposed.push(text),
    fetcher: (async (_url, init) => {
      assert.equal(JSON.parse(init?.body as string).stream, true);
      assert.match(
        (init?.headers as Record<string, string>).Accept ?? '',
        /text\/event-stream/,
      );
      return new Response(
        new ReadableStream({
          start(controller) {
            const bytes = encoder.encode(wire);
            for (let i = 0; i < bytes.length; i++)
              controller.enqueue(bytes.slice(i, i + 1));
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      );
    }) as typeof fetch,
  });
  assert.equal(tree.title, '网络😀');
  assert.equal(tree.children[0]?.title, '七层模型');
  assert.deepEqual(exposed, []);
  assert.ok(progress.some((text) => text.includes('模型正在思考')));
  assert.ok(progress.some((text) => text.includes('正在接收正文')));
  assert.equal(progress.at(-1), '正在校验思维导图');
  assert.equal(cancelled, true);
  assert.ok(progress.every((text) => !text.includes('内部思考')));
});

test('even syntactically complete map JSON is rejected without a sealed completion, on length limits, or on cancellation', async () => {
  const raw = '{"title":"不能缓存的半成品","children":[]}';
  for (const wire of [
    contentEvent(raw),
    contentEvent(raw) + 'data: [DONE]\n',
    contentEvent(raw, 'length'),
    contentEvent(raw, 'content_filter'),
    contentEvent('{"title":', 'stop'),
    contentEvent(raw, 'tool_calls'),
  ]) {
    await assert.rejects(
      generateMindMap(video, shortSource, settings, {
        runtime: createAiRuntime({ intervalMs: 0 }),
        fetcher: (async () => sseReply(wire)) as typeof fetch,
      }),
    );
  }
  const abort = new AbortController();
  let cancelled = false;
  await assert.rejects(
    generateMindMap(video, shortSource, settings, {
      runtime: createAiRuntime({ intervalMs: 0 }),
      signal: abort.signal,
      onProgress(text) {
        if (text.includes('正在接收正文')) abort.abort();
      },
      fetcher: (async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(contentEvent(raw)));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        )) as typeof fetch,
    }),
    { name: 'AbortError' },
  );
  assert.equal(cancelled, true);
});

test('long source notes and merging all request streams without exposing intermediate text; connection tests stay bounded', async () => {
  const runtime = createAiRuntime({ intervalMs: 0 });
  const requests: { stream: boolean; prompt: string }[] = [],
    visible: string[] = [];
  await generateSummary(video, longSource, settings, {
    runtime,
    onToken: (text) => visible.push(text),
    fetcher: (async (_url, init) => {
      const payload = JSON.parse(init?.body as string);
      const prompt = payload.messages.at(-1).content;
      requests.push({ stream: payload.stream, prompt });
      const text = prompt.includes('这是第')
        ? '片段笔记'.repeat(3200)
        : prompt.includes('<notes>')
          ? '合并后的笔记'
          : '## 最终正文';
      return sseReply(contentEvent(text, 'stop'), 997);
    }) as typeof fetch,
  });
  assert.ok(requests.some((request) => request.prompt.includes('<notes>')));
  assert.ok(requests.every((request) => request.stream));
  assert.deepEqual(visible, ['## 最终正文']);
  await testConnection(settings, {
    runtime: createAiRuntime({ intervalMs: 0 }),
    fetcher: (async (_url, init) => {
      assert.equal(JSON.parse(init?.body as string).stream, false);
      return jsonReply('OK');
    }) as typeof fetch,
  });
});

test('a cut-off source-note stream is never checkpointed but completed notes survive the retry', async () => {
  const runtime = createAiRuntime({ intervalMs: 0 });
  const prompts: string[] = [];
  let cutoff = true;
  const fetcher = (async (_url, init) => {
    const prompt = JSON.parse(init?.body as string).messages.at(-1).content;
    prompts.push(prompt);
    if (prompt.includes('这是第 2/') && cutoff) {
      cutoff = false;
      return sseReply(contentEvent('不完整笔记'));
    }
    return sseReply(
      contentEvent(
        prompt.includes('这是第') ? '完整笔记' : '## 完整总结',
        'stop',
      ),
    );
  }) as typeof fetch;
  await assert.rejects(
    generateSummary(video, longSource, settings, { runtime, fetcher }),
    /提前中断/,
  );
  assert.equal(
    await generateSummary(video, longSource, settings, { runtime, fetcher }),
    '## 完整总结',
  );
  assert.equal(prompts.filter((text) => text.includes('这是第 1/')).length, 1);
  assert.equal(prompts.filter((text) => text.includes('这是第 2/')).length, 2);
});

test('gateway timeouts cancel HTML error bodies promptly and never trigger paid fallback requests', async () => {
  for (const status of [408, 504, 524]) {
    let calls = 0,
      cancelled = false;
    await assert.rejects(
      chatCompletion(settings, [], {
        runtime: createAiRuntime({ intervalMs: 0 }),
        fetcher: (async () => {
          calls++;
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(encoder.encode('<html>fixture-key</html>'));
              },
              cancel() {
                cancelled = true;
              },
            }),
            { status, headers: { 'Content-Type': 'text/html' } },
          );
        }) as typeof fetch,
      }),
      (error: Error) => {
        assert.match(error.message, new RegExp(String(status)));
        assert.match(error.message, /未收到完整结果/);
        assert.match(error.message, /计费/);
        assert.ok(!error.message.includes(settings.apiKey));
        return true;
      },
    );
    assert.equal(calls, 1);
    assert.equal(cancelled, true);
  }
});

test('reasoning-only output and malformed or unsupported completion reasons cannot be accepted as success', async () => {
  for (const response of [
    sseReply(
      sseEvent({ choices: [{ delta: { reasoning_content: 'thoughts' } }] }) +
        'data: [DONE]\n\n',
    ),
    sseReply('data: {"choices":{}}\n\n'),
    sseReply(
      sseEvent({
        choices: [{ delta: { content: '正文' }, finish_reason: {} }],
      }),
    ),
    jsonReply('正文', 'tool_calls'),
    jsonReply('正文', 'function_call'),
  ]) {
    await assert.rejects(
      chatCompletion(settings, [], {
        runtime: createAiRuntime({ intervalMs: 0 }),
        fetcher: (async () => response) as typeof fetch,
      }),
      /正文|格式异常/,
    );
  }
});

test('response streams are released even when persisting the server cooldown fails before acquiring a reader', async () => {
  let writes = 0,
    cancelled = false,
    calls = 0;
  const runtime = createAiRuntime({
    intervalMs: 0,
    storage: {
      async get() {
        return {};
      },
      async set() {
        if (++writes === 2) throw new Error('storage unavailable');
      },
    },
  });
  await assert.rejects(
    chatCompletion(settings, [], {
      runtime,
      fetcher: (async () => {
        calls++;
        return new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '120',
            },
          },
        );
      }) as typeof fetch,
    }),
    /保存 AI 请求队列失败/,
  );
  assert.equal(calls, 1);
  assert.equal(cancelled, true);
});

test('AI transport first-response and idle timeouts cancel the underlying request or reader without a retry', async () => {
  for (const contentType of ['', 'text/event-stream', 'application/json']) {
    let cancelled = false,
      calls = 0;
    await assert.rejects(
      chatCompletion(settings, [], {
        runtime: createAiRuntime({ intervalMs: 0 }),
        firstResponseTimeoutMs: 15,
        idleTimeoutMs: 15,
        timeoutMs: 1000,
        fetcher: ((_, init) => {
          calls++;
          if (!contentType)
            return new Promise((_, reject) => {
              init?.signal?.addEventListener(
                'abort',
                () => {
                  cancelled = true;
                  reject(init?.signal?.reason);
                },
                { once: true },
              );
            });
          return Promise.resolve(
            new Response(
              new ReadableStream({
                cancel() {
                  cancelled = true;
                },
              }),
              { headers: { 'Content-Type': contentType } },
            ),
          );
        }) as typeof fetch,
      }),
      (error: Error) => {
        assert.equal(error.name, 'TimeoutError');
        assert.match(error.message, contentType ? /停滞/ : /等待模型响应超时/);
        assert.match(error.message, /可能再次计费/);
        return true;
      },
    );
    assert.equal(cancelled, true);
    assert.equal(calls, 1);
  }
});
