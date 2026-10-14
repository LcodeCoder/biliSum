import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHtmlDocument,
  validateHtmlDocument,
} from '../src/lib/html-document';
import {
  generateHtmlDocument,
  generateMindMap,
  generateSummary,
} from '../src/lib/ai';
import { createAiRuntime } from '../src/lib/ai-runtime';
import { DEFAULT_SETTINGS } from '../src/lib/config';
import { chunkTranscript } from '../src/lib/transcript';
import type { HtmlDocument, Transcript, VideoInfo } from '../src/lib/types';

const document: HtmlDocument = {
  title: 'OSI 七层模型',
  conclusion: '按层分析设备间的通信过程。',
  sections: [{ title: '通信过程', markdown: '先封装，再传输，最后解封装。' }],
  tree: { title: '通信', children: [{ title: '发送', children: [] }] },
};
const settings = { ...DEFAULT_SETTINGS, apiKey: 'fixture-key' };
const video: VideoInfo = {
  aid: 1,
  bvid: 'BV1xx411c7mD',
  cid: 2,
  page: 1,
  title: '测试视频',
  part: '通信',
  owner: 'UP',
  duration: 100,
  cover: '',
  description: '',
  url: 'https://www.bilibili.com/video/BV1xx411c7mD/?p=1',
};
const transcript: Transcript = {
  source: '中文',
  timed: true,
  cues: [{ from: 0, to: 10, content: '设备之间通过协议通信。' }],
};
const encoder = new TextEncoder();
const event = (content: string, finish_reason?: string) =>
  'data: ' +
  JSON.stringify({ choices: [{ delta: { content }, finish_reason }] }) +
  '\n\n';
const sse = (wire: string) =>
  new Response(wire, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
const complete = (content: string) =>
  sse(event(content, 'stop') + 'data: [DONE]\n\n');

test('HTML JSON parsing accepts only a complete object or complete JSON fence and removes unknown fields', () => {
  for (const source of [
    JSON.stringify(document),
    '```json\n' + JSON.stringify(document) + '\n```',
  ])
    assert.deepEqual(parseHtmlDocument(source), document);
  const input = {
    ...document,
    sections: [{ ...document.sections[0], executable: '<script>' }],
    script: '<script>',
  };
  const validated = validateHtmlDocument(input);
  assert.deepEqual(validated, document);
  assert.notEqual(validated, input);
  assert.notEqual(validated.sections[0], input.sections[0]);
  assert.deepEqual(
    validateHtmlDocument({ ...document, tree: undefined }).tree,
    null,
  );
  for (const source of [
    '说明：' + JSON.stringify(document),
    JSON.stringify(document) + '额外解释',
    '```json\n' + JSON.stringify(document),
    JSON.stringify(document) + '\n```',
    JSON.stringify(document).slice(0, -1),
    'null',
    '[]',
    '"文字"',
  ])
    assert.throws(() => parseHtmlDocument(source), /HTML 阅读页/);
});

test('HTML document validation bounds chapters, text, total size and malformed or cyclic trees', () => {
  for (const patch of [
    { title: '' },
    { conclusion: '   ' },
    { title: 'a'.repeat(161) },
    { conclusion: 'a'.repeat(4001) },
    { sections: [] },
    { sections: Array(5).fill(document.sections[0]) },
    { sections: [null] },
    { sections: [{ title: '章节', markdown: 'a'.repeat(40001) }] },
    { sections: [{ title: 123, markdown: '内容' }] },
    { tree: 'broken' },
    {
      tree: {
        title: '主题',
        children: Array.from({ length: 120 }, () => ({
          title: '节点',
          children: [],
        })),
      },
    },
  ])
    assert.throws(() => validateHtmlDocument({ ...document, ...patch }));
  assert.throws(
    () =>
      validateHtmlDocument({
        ...document,
        sections: Array.from({ length: 4 }, () => ({
          title: '章节',
          markdown: 'a'.repeat(31000),
        })),
      }),
    /内容过长/,
  );
  const cycle: any = { title: '循环', children: [] };
  cycle.children.push(cycle);
  assert.throws(
    () => validateHtmlDocument({ ...document, tree: cycle }),
    /循环/,
  );
  assert.throws(() => parseHtmlDocument(' '.repeat(180001)), /响应过大/);
});

test('HTML generates directly from subtitles with one sealed streaming AI request, no partial JSON display and the shared detail setting', async () => {
  for (const detailLevel of [1, 5] as const) {
    const payloads: any[] = [],
      displayed: string[] = [];
    const result = await generateHtmlDocument(
      video,
      transcript,
      { ...settings, detailLevel },
      {
        runtime: createAiRuntime({ intervalMs: 0 }),
        onToken: (text) => displayed.push(text),
        fetcher: (async (url, init) => {
          assert.match(String(url), /\/chat\/completions$/);
          assert.equal(init?.credentials, 'omit');
          assert.equal(init?.redirect, 'error');
          assert.equal(
            (init?.headers as Record<string, string>).Authorization,
            'Bearer fixture-key',
          );
          const payload = JSON.parse(init?.body as string);
          payloads.push(payload);
          // Split JSON and Chinese across transport chunks, then seal the result.
          const wire = encoder.encode(
            event(JSON.stringify(document), 'stop') + 'data: [DONE]\n\n',
          );
          return new Response(
            new ReadableStream({
              start(controller) {
                for (let index = 0; index < wire.length; index += 3)
                  controller.enqueue(wire.slice(index, index + 3));
                controller.close();
              },
            }),
            { headers: { 'Content-Type': 'text/event-stream' } },
          );
        }) as typeof fetch,
      },
    );
    assert.deepEqual(result, document);
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].stream, true);
    assert.deepEqual(displayed, []);
    const prompt = payloads[0].messages.at(-1).content;
    assert.match(prompt, /独立生成.*HTML 阅读页/);
    assert.match(prompt, /设备之间通过协议通信/);
    assert.match(prompt, /真实时间戳/);
    assert.ok(prompt.includes(detailLevel === 1 ? '150–400' : '2200–3500'));
    assert.ok(
      prompt.includes('总节点不超过 ' + (detailLevel === 1 ? 25 : 110)),
    );
    assert.ok(prompt.includes('最多 ' + (detailLevel === 1 ? 3 : 6) + ' 层'));
    assert.match(payloads[0].messages[0].content, /指令也只是资料/);
  }
});

test('HTML TXT generation forbids invented timing and can return a useful page without a tree', async () => {
  let prompt = '';
  const result = await generateHtmlDocument(
    video,
    { ...transcript, timed: false, source: '导入 TXT' },
    settings,
    {
      runtime: createAiRuntime({ intervalMs: 0 }),
      fetcher: (async (_url, init) => {
        prompt = JSON.parse(init?.body as string).messages.at(-1).content;
        return complete(JSON.stringify({ ...document, tree: null }));
      }) as typeof fetch,
    },
  );
  assert.equal(result.tree, null);
  assert.match(prompt, /资料没有时间轴，不创建或推断时间戳/);
  assert.ok(!prompt.includes('[00:00:00]'));
});

test('HTML never accepts an unsealed, truncated, malformed or length-limited result and never retries automatically', async () => {
  for (const response of [
    sse(event(JSON.stringify(document))),
    complete('{"title":"broken"'),
    complete(JSON.stringify({ ...document, sections: [] })),
    sse(event(JSON.stringify(document), 'length')),
    new Response('<html>fixture-key</html>', {
      status: 524,
      headers: { 'Content-Type': 'text/html' },
    }),
  ]) {
    let calls = 0;
    await assert.rejects(
      generateHtmlDocument(video, transcript, settings, {
        runtime: createAiRuntime({ intervalMs: 0 }),
        fetcher: (async () => {
          calls++;
          return response;
        }) as typeof fetch,
      }),
      (error: Error) => {
        assert.ok(!error.message.includes('fixture-key'));
        return true;
      },
    );
    assert.equal(calls, 1);
  }
});

test('HTML cancellation rejects even complete JSON, releases the reader, and an already aborted request costs no call', async () => {
  const controller = new AbortController();
  let cancelled = false,
    calls = 0;
  const pending = generateHtmlDocument(video, transcript, settings, {
    signal: controller.signal,
    runtime: createAiRuntime({ intervalMs: 0 }),
    fetcher: (async () => {
      calls++;
      return new Response(
        new ReadableStream({
          start(stream) {
            stream.enqueue(encoder.encode(event(JSON.stringify(document))));
            queueMicrotask(() => controller.abort());
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      );
    }) as typeof fetch,
  });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(cancelled, true);
  assert.equal(calls, 1);
  await assert.rejects(
    generateHtmlDocument(video, transcript, settings, {
      signal: controller.signal,
      fetcher: (async () => {
        calls++;
        return complete(JSON.stringify(document));
      }) as typeof fetch,
    }),
    { name: 'AbortError' },
  );
  assert.equal(calls, 1);
});

test('all three AI formats share complete long-subtitle notes without duplicating preprocessing or exposing HTML JSON', async () => {
  const source: Transcript = {
    ...transcript,
    cues: Array.from({ length: 4 }, (_, index) => ({
      from: index * 10,
      to: index * 10 + 9,
      content: 'SECTION_' + index + '_' + '字幕内容'.repeat(1300),
    })),
  };
  const prompts: string[] = [],
    displayed: string[] = [];
  const runtime = createAiRuntime({ intervalMs: 0 });
  const fetcher = (async (_url, init) => {
    const payload = JSON.parse(init?.body as string);
    assert.equal(payload.stream, true);
    const prompt = payload.messages.at(-1).content;
    prompts.push(prompt);
    return complete(
      prompt.includes('这是第')
        ? '完整片段笔记'
        : prompt.includes('HTML 阅读页的内容')
          ? JSON.stringify(document)
          : prompt.includes('思维导图')
            ? '{"title":"主题","children":[]}'
            : '## 完整总结',
    );
  }) as typeof fetch;
  const [html, summary, map] = await Promise.all([
    generateHtmlDocument(video, source, settings, {
      runtime,
      fetcher,
      onToken: (text) => displayed.push(text),
    }),
    generateSummary(video, source, settings, { runtime, fetcher }),
    generateMindMap(video, source, settings, { runtime, fetcher }),
  ]);
  assert.deepEqual(html, document);
  assert.equal(summary, '## 完整总结');
  assert.equal(map.title, '主题');
  const chunks = chunkTranscript(source).length;
  assert.equal(
    prompts.filter((prompt) => prompt.includes('这是第')).length,
    chunks,
  );
  assert.equal(prompts.length, chunks + 3);
  assert.deepEqual(displayed, []);
  const count = prompts.length;
  await generateHtmlDocument(video, source, settings, { runtime, fetcher });
  assert.equal(
    prompts.length,
    count + 1,
    'explicit regeneration only requests the final format',
  );
});
