import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkTranscript,
  exportSrt,
  formatTime,
  importTranscript,
  normalizeCues,
  transcriptHash,
  transcriptText,
} from '../src/lib/transcript';

test('SRT import preserves timing, multiline text and Unicode; export round-trips', () => {
  const input =
    '1\r\n00:00:01,250 --> 00:00:03,600\r\n你好，世界\r\n第二行\r\n\r\n2\r\n01:02:03,999 --> 01:02:05,010\r\n收尾';
  const transcript = importTranscript(input, 'subtitles.srt');
  assert.equal(transcript.timed, true);
  assert.equal(transcript.cues.length, 2);
  assert.equal(transcript.cues[0]?.from, 1.25);
  assert.equal(transcript.cues[0]?.content, '你好，世界\n第二行');
  assert.deepEqual(
    importTranscript(exportSrt(transcript), 'out.srt').cues,
    transcript.cues,
  );
  assert.equal(formatTime(3723), '01:02:03');
});

test('WebVTT settings parse; TXT never invents timestamps', () => {
  const vtt = importTranscript(
    'WEBVTT\n\n00:01.200 --> 00:04.900 align:start\n<b>你好</b>\n\n00:05.000 --> 00:08.000\n第二句',
    'sub.vtt',
  );
  assert.deepEqual(vtt.cues[0], { from: 1.2, to: 4.9, content: '你好' });
  const txt = importTranscript('知识第一条\n知识第二条', 'notes.txt');
  assert.equal(txt.timed, false);
  assert.equal(transcriptText(txt), '知识第一条\n知识第二条');
  assert.throws(() => exportSrt(txt), /没有时间轴/);
});

test('Bilibili JSON validation rejects invalid cues and sorts time', () => {
  const cues = normalizeCues([
    { from: 3, to: 4, content: ' later ' },
    { from: -1, to: 2, content: 'bad' },
    { from: 0, to: 1, content: 'first' },
    { from: 4, to: 2, content: 'bad' },
    { from: 'oops', to: 1, content: 'bad' },
  ]);
  assert.deepEqual(
    cues.map((cue) => cue.content),
    ['first', 'later'],
  );
  assert.equal(
    importTranscript(JSON.stringify({ body: cues }), 'bili.json').cues.length,
    2,
  );
  assert.throws(() => importTranscript('{broken', 'bili.json'), /JSON/);
});

test('chunking covers the complete transcript including oversized single cues', async () => {
  const paragraphs = Array.from(
    { length: 45 },
    (_, i) => '片段' + i + '-' + '内容'.repeat(i === 20 ? 3000 : 80),
  );
  const transcript = {
    source: 'test',
    timed: false,
    cues: paragraphs.map((content) => ({ from: 0, to: 0, content })),
  };
  const chunks = chunkTranscript(transcript, 500);
  assert.ok(chunks.length > 10);
  assert.ok(chunks.every((chunk) => chunk.length <= 500));
  assert.equal(chunks.join('').replace(/\n/g, ''), paragraphs.join(''));
  const changed = {
    ...transcript,
    cues: [...transcript.cues, { from: 0, to: 0, content: 'new' }],
  };
  assert.notEqual(
    await transcriptHash(transcript),
    await transcriptHash(changed),
  );
});

test('invalid JSON subtitle shapes return guidance instead of internal exceptions', () => {
  for (const raw of [
    'null',
    '{}',
    '{"body":{}}',
    '{"body":"oops"}',
    '[null,false,{}]',
  ]) {
    assert.throws(() => importTranscript(raw, 'bad.json'), /body 数组/);
  }
  assert.equal(
    normalizeCues([
      { from: null, to: 3, content: 'bad' },
      { from: false, to: 3, content: 'bad' },
      { from: '', to: 3, content: 'bad' },
    ]).length,
    0,
  );
});

test('broken timed files are not silently imported as plain text and invalid timestamps are rejected', () => {
  assert.throws(
    () => importTranscript('WEBVTT\n\nbroken', 'bad.vtt'),
    /时间轴/,
  );
  assert.throws(
    () => importTranscript('00:99:01,000 --> 00:99:03,000\nBad', 'bad.srt'),
    /时间轴/,
  );
  assert.throws(
    () => importTranscript('1234:00:01,000 --> 1234:00:03,000\nBad', 'bad.srt'),
    /时间轴/,
  );
  assert.equal(importTranscript('A --> B\n自然语言', 'note.txt').timed, false);
});

test('cache identity includes subsecond times, end times, and source provenance', async () => {
  const original = {
    source: '中文',
    timed: true,
    cues: [{ from: 1.1, to: 2, content: 'same' }],
  };
  for (const changed of [
    { ...original, source: '导入：notes.srt' },
    { ...original, cues: [{ ...original.cues[0]!, from: 1.2 }] },
    { ...original, cues: [{ ...original.cues[0]!, to: 3 }] },
  ])
    assert.notEqual(
      await transcriptHash(original),
      await transcriptHash(changed),
    );
  for (const budget of [NaN, Infinity, 100.5, 0])
    assert.throws(() => chunkTranscript(original, budget));
  assert.equal(formatTime(Infinity), '00:00');
});

test('request chunks preserve emoji at timed and plain-text boundaries', () => {
  for (const timed of [true, false]) {
    const content = 'X'.repeat(timed ? 87 : 98) + '🧠' + '知识🚀'.repeat(160);
    const chunks = chunkTranscript(
      {
        source: 'Unicode',
        timed,
        cues: [{ from: 0, to: 1, content }],
      },
      100,
    );
    assert.ok(chunks.length > 1);
    assert.ok(
      chunks.every(
        (chunk) => chunk.length <= 100 && !/[\uD800-\uDFFF]/u.test(chunk),
      ),
    );
    const restored = chunks
      .map((chunk) => chunk.replace(/^\[00:00:00\] /, ''))
      .join('');
    assert.equal(restored, content);
  }
});
