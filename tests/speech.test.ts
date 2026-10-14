import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transcribeSpeechAudio } from '../src/lib/speech';
import { whisperCues, appendSpeechCues } from '../src/lib/speech-segments';
import {
  nativeRecognitionConstructor,
  nativeSpeechStatus,
  installNativeSpeech,
} from '../src/lib/speech-native';
import { createWhisperRecognizer } from '../src/lib/speech-whisper';
import { decodeWhisperAudio } from '../src/lib/speech-whisper-decode';
import type { SpeechDependencies } from '../src/lib/speech';
import type {
  SpeechAudioChunk,
  SpeechPreferences,
} from '../src/lib/speech-types';
const preferences: SpeechPreferences = { engine: 'auto', language: 'zh-CN' };
function fixture(
  parts = [
    [0, 1],
    [1, 2],
  ],
  duration = 2,
) {
  const stats = {
    audioDisposed: 0,
    workerDisposed: 0,
    passes: [] as boolean[],
    nativeCalls: 0,
    whisperCalls: 0,
  };
  const deps: SpeechDependencies = {
    openAudio: async () => ({
      duration,
      dispose() {
        stats.audioDisposed++;
      },
      async *chunks(overlap) {
        stats.passes.push(overlap);
        for (const [from, to] of parts)
          yield {
            from: from!,
            to: to!,
            coreFrom: from!,
            coreTo: to!,
            samples: new Float32Array(Math.round((to! - from!) * 16000)).fill(
              0.1,
            ),
          };
      },
    }),
    nativeStatus: async () => 'available',
    nativeChunk: async () => {
      stats.nativeCalls++;
      return '内置文本';
    },
    whisper: () => ({
      init: async () => true,
      transcribe: async (samples) => {
        stats.whisperCalls++;
        return {
          text: '本地文本',
          chunks: [
            {
              text: '本地文本' + stats.whisperCalls,
              timestamp: [0, samples.length / 16000],
            },
          ],
        };
      },
      dispose() {
        stats.workerDisposed++;
      },
    }),
  };
  return { stats, deps };
}
const run = (
  deps: SpeechDependencies,
  prefs = preferences,
  signal = new AbortController().signal,
) =>
  transcribeSpeechAudio(
    new Blob(['fixture']),
    2,
    prefs,
    signal,
    () => {},
    deps,
  );
test('complete native text is untimed; Whisper is timed and explicitly complete', async () => {
  const native = fixture();
  const nativeOutput = await run(native.deps);
  assert.equal(nativeOutput.transcript.timed, false);
  assert.equal(nativeOutput.complete, true);
  assert.deepEqual(native.stats.passes, [false]);
  assert.equal(native.stats.audioDisposed, 1);
  const whisper = fixture();
  const output = await run(whisper.deps, { ...preferences, engine: 'whisper' });
  assert.equal(output.transcript.timed, true);
  assert.equal(output.engine, 'whisper');
  assert.equal(whisper.stats.workerDisposed, 1);
});
test('automatic native failure discards every partial cue and restarts whole audio with Whisper', async () => {
  const { deps, stats } = fixture();
  deps.nativeChunk = async () => {
    stats.nativeCalls++;
    if (stats.nativeCalls === 2) throw new Error('early stop');
    return '必须丢弃的前半段';
  };
  const output = await run(deps);
  assert.equal(output.engine, 'whisper');
  assert.ok(
    output.transcript.cues.every((cue) => !cue.content.includes('必须丢弃')),
  );
  assert.deepEqual(stats.passes, [false, true]);
  assert.equal(stats.whisperCalls, 2);
});
test('incomplete audio coverage and gaps never return a usable transcript', async () => {
  for (const parts of [
    [[0, 1]],
    [
      [0, 0.5],
      [1, 2],
    ],
  ]) {
    const { deps, stats } = fixture(parts);
    await assert.rejects(
      run(deps, { ...preferences, engine: 'whisper' }),
      /结尾|不连续/,
    );
    assert.equal(stats.audioDisposed, 1);
    assert.equal(stats.workerDisposed, 1);
  }
});
test('cancelled native run never starts Whisper fallback and always releases audio', async () => {
  const { deps, stats } = fixture();
  const controller = new AbortController();
  deps.nativeChunk = async () => {
    controller.abort(new DOMException('cancel', 'AbortError'));
    throw controller.signal.reason;
  };
  await assert.rejects(run(deps, preferences, controller.signal), {
    name: 'AbortError',
  });
  assert.equal(stats.whisperCalls, 0);
  assert.equal(stats.audioDisposed, 1);
});
test('Whisper errors preserve failure, dispose worker, and silence yields no made-up transcript', async () => {
  const { deps, stats } = fixture();
  deps.whisper = () => ({
    init: async () => true,
    transcribe: async () => {
      throw new Error('model failure');
    },
    dispose() {
      stats.workerDisposed++;
    },
  });
  await assert.rejects(
    run(deps, { ...preferences, engine: 'whisper' }),
    /model failure/,
  );
  assert.equal(stats.workerDisposed, 1);
  deps.openAudio = async () => ({
    duration: 2,
    dispose() {},
    async *chunks() {
      yield {
        from: 0,
        to: 2,
        coreFrom: 0,
        coreTo: 2,
        samples: new Float32Array(32000),
      };
    },
  });
  await assert.rejects(
    run(deps, { ...preferences, engine: 'whisper' }),
    /未识别到/,
  );
});
test('native capability and install require on-device API and always request processLocally', async () => {
  assert.equal(
    nativeRecognitionConstructor({
      webkitSpeechRecognition: function CloudOnly() {},
    }),
    null,
  );
  let requested: any;
  class Local {
    processLocally = false;
    static async available(options: any) {
      requested = options;
      return 'available';
    }
    static async install(options: any) {
      requested = options;
      return true;
    }
  }
  Object.defineProperty(Local.prototype, 'processLocally', { value: false });
  assert.equal(
    await nativeSpeechStatus('zh-CN', undefined, { SpeechRecognition: Local }),
    'available',
  );
  assert.equal(requested.processLocally, true);
  await installNativeSpeech('zh-CN', new AbortController().signal, {
    SpeechRecognition: Local,
  });
  assert.equal(requested.processLocally, true);
  assert.equal(
    await nativeSpeechStatus('auto', undefined, { SpeechRecognition: Local }),
    'unsupported',
  );
});
test('timestamp ownership handles overlap and missing final end; invalid output fails closed', () => {
  const chunk = { from: 23, to: 52, coreFrom: 25, coreTo: 50 };
  assert.deepEqual(
    whisperCues(
      {
        text: 'a b c',
        chunks: [
          { text: 'a', timestamp: [0, 1] },
          { text: 'b', timestamp: [2, 4] },
          { text: 'c', timestamp: [28, null] },
        ],
      },
      chunk,
    ),
    [{ from: 25, to: 27, content: 'b' }],
  );
  assert.deepEqual(
    whisperCues(
      { text: '结尾', chunks: [{ text: '结尾', timestamp: [0, null] }] },
      { from: 0, to: 2, coreFrom: 0, coreTo: 2 },
    ),
    [{ from: 0, to: 2, content: '结尾' }],
  );
  assert.throws(
    () =>
      whisperCues(
        { text: 'invalid', chunks: [{ text: 'invalid', timestamp: [-1, 2] }] },
        chunk,
      ),
    /时间/,
  );
  assert.throws(() => whisperCues({ text: 'invalid' }, chunk), /时间轴/);
  const cues = [{ from: 0, to: 2, content: '重复。' }];
  appendSpeechCues(cues, [{ from: 1.5, to: 3, content: '重复' }]);
  assert.equal(cues.length, 1);
  assert.equal(cues[0]!.to, 3);
  appendSpeechCues(cues, [{ from: 3, to: 4, content: '重复' }]);
  assert.equal(cues.length, 2, 'actual successive repetitions must remain');
});
test('Whisper padding timestamps are clipped to real audio, including the failing P3 window', () => {
  const chunk = { from: 98, to: 127, coreFrom: 100, coreTo: 125 };
  assert.deepEqual(
    whisperCues(
      {
        text: '函数的对应关系',
        chunks: [{ text: '函数的对应关系', timestamp: [26.32, 29.32] }],
      },
      chunk,
    ),
    [],
  );
  assert.deepEqual(
    whisperCues(
      {
        text: '函数的对应关系',
        chunks: [{ text: '函数的对应关系', timestamp: [26.32, 29.32] }],
      },
      { ...chunk, coreTo: 127 },
    ),
    [{ from: 124.32, to: 127, content: '函数的对应关系' }],
  );
  assert.deepEqual(
    whisperCues(
      {
        text: '最后一句 补零区域',
        chunks: [
          { text: '最后一句', timestamp: [3.8, 5.2] },
          { text: '补零区域', timestamp: [7, null] },
        ],
      },
      { from: 1800, to: 1804.484, coreFrom: 1800, coreTo: 1804.484 },
    ),
    [{ from: 1803.8, to: 1804.484, content: '最后一句' }],
  );
  assert.deepEqual(
    whisperCues(
      {
        text: '结尾',
        chunks: [{ text: '结尾', timestamp: [3.8, null] }],
      },
      { from: 1800, to: 1804.484, coreFrom: 1800, coreTo: 1804.484 },
    ),
    [{ from: 1803.8, to: 1804.484, content: '结尾' }],
  );
});
test('clipping does not turn corrupt Whisper timestamps into completed subtitles', () => {
  const chunk = { from: 0, to: 29, coreFrom: 0, coreTo: 29 };
  for (const timestamp of [
    [-1, 2],
    [4, 3],
    [0, 30.02],
    [30.02, null],
    [0, Infinity],
    [NaN, 2],
    [null, 2],
  ]) {
    assert.throws(
      () =>
        whisperCues(
          {
            text: '异常结果',
            chunks: [
              {
                text: '异常结果',
                timestamp: timestamp as [number | null, number | null],
              },
            ],
          },
          chunk,
        ),
      /时间/,
    );
  }
  assert.throws(
    () =>
      whisperCues(
        {
          text: '异常结果',
          chunks: [
            { text: '异常结果', timestamp: [0, null] },
            { text: '结尾', timestamp: [1, 2] },
          ],
        },
        chunk,
      ),
    /时间/,
  );
});
test('padded Whisper endings still require the entire audio before returning completion', async () => {
  const { deps, stats } = fixture();
  deps.whisper = () => ({
    init: async () => true,
    transcribe: async () => ({
      text: '有效内容',
      chunks: [{ text: '有效内容', timestamp: [0, 1.32] }],
    }),
    dispose() {
      stats.workerDisposed++;
    },
  });
  const output = await run(deps, { ...preferences, engine: 'whisper' });
  assert.equal(output.complete, true);
  assert.equal(output.duration, 2);
  assert.equal(output.transcript.cues.at(-1)?.to, 2);
  assert.equal(stats.audioDisposed, 1);
  assert.equal(stats.workerDisposed, 1);
  const incomplete = fixture([[0, 1]]);
  incomplete.deps.whisper = deps.whisper;
  await assert.rejects(
    run(incomplete.deps, { ...preferences, engine: 'whisper' }),
    /结尾/,
  );
});
class FakeWorker extends EventTarget {
  sent: any[] = [];
  terminated = 0;
  postMessage(message: unknown) {
    this.sent.push(message);
  }
  terminate() {
    this.terminated++;
  }
  emit(data: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}
test('worker broker ignores stale results, rejects concurrent jobs and terminates immediately on cancellation', async () => {
  const worker = new FakeWorker();
  const controller = new AbortController();
  const progress: unknown[] = [];
  const recognizer = createWhisperRecognizer(
    controller.signal,
    (value) => progress.push(value),
    () => worker,
  );
  const init = recognizer.init();
  await assert.rejects(recognizer.init(), /处理其他/);
  worker.emit({ id: 9, type: 'result', result: true });
  worker.emit({ id: 1, type: 'progress', message: 'loading', percent: 110 });
  worker.emit({ id: 1, type: 'result', result: true });
  await init;
  assert.deepEqual(progress, [{ message: 'loading', percent: 100 }]);
  const transcript = recognizer.transcribe(new Float32Array([0.1]), 'zh-CN');
  controller.abort(new DOMException('stop', 'AbortError'));
  await assert.rejects(transcript, { name: 'AbortError' });
  assert.equal(worker.terminated, 1);
  recognizer.dispose();
  assert.equal(worker.terminated, 1);
});
test('worker crash rejects pending task and releases thread', async () => {
  const worker = new FakeWorker();
  const recognizer = createWhisperRecognizer(
    new AbortController().signal,
    () => {},
    () => worker,
  );
  const pending = recognizer.init();
  worker.dispatchEvent(new Event('error'));
  await assert.rejects(pending, /异常退出/);
  assert.equal(worker.terminated, 1);
});

test('explicit native selection also recovers from aborted recognition with a complete model transcript', async () => {
  const { deps, stats } = fixture();
  deps.nativeChunk = async () => {
    stats.nativeCalls++;
    if (stats.nativeCalls === 2) throw new Error('aborted');
    return 'discard this native fragment';
  };
  const output = await run(deps, { ...preferences, engine: 'native' });
  assert.equal(output.engine, 'whisper');
  assert.equal(output.complete, true);
  assert.ok(
    output.transcript.cues.every((cue) => !cue.content.includes('discard')),
  );
  assert.deepEqual(stats.passes, [false, true]);
  assert.equal(stats.audioDisposed, 1);
  assert.equal(stats.workerDisposed, 1);
});

test('native language availability failure uses the model without starting a broken native session', async () => {
  const { deps, stats } = fixture();
  deps.nativeStatus = async () => 'unsupported';
  const output = await run(deps, { ...preferences, engine: 'native' });
  assert.equal(output.engine, 'whisper');
  assert.equal(stats.nativeCalls, 0);
  assert.equal(stats.whisperCalls, 2);
});

test('Whisper accepts generated EOS while a prompt EOS and stream.end do not prove completion', async () => {
  const samples = new Float32Array(16000);
  const result = {
    text: 'complete',
    chunks: [{ text: 'complete', timestamp: [0, 1] as [number, number] }],
  };
  assert.equal(
    await decodeWhisperAudio(samples, [2, 3], async (_, stream) => {
      stream.put([[2n]]); // Prompt must be ignored.
      stream.put([[42n]]);
      stream.put([[3n]]);
      stream.end();
      return result;
    }),
    result,
  );
  await assert.rejects(
    decodeWhisperAudio(samples, 2, async (_, stream) => {
      stream.put([[2n]]);
      stream.put([[42n]]);
      stream.end();
      return result;
    }),
    /识别未完成/,
  );
});

test('token-limited Whisper windows are retried with overlap and correct absolute timestamps', async () => {
  const samples = Float32Array.from(
    { length: 29 * 16000 },
    (_, index) => index / 16000,
  );
  const windows: [number, number][] = [];
  let retries = 0;
  const result = await decodeWhisperAudio(
    samples,
    2,
    async (part, stream) => {
      const from = part[0]!;
      const duration = part.length / 16000;
      windows.push([from, from + duration]);
      stream.put([[1n]]);
      stream.put([[42n]]);
      if (duration > 20)
        return {
          text: 'discard truncated text',
          chunks: [
            { text: 'discard truncated text', timestamp: [0, duration] },
          ],
        };
      stream.put([[2n]]);
      return {
        text: 'complete ' + from,
        chunks: [
          { text: 'complete ' + from, timestamp: [0.2, duration - 0.2] },
        ],
      };
    },
    () => retries++,
  );
  assert.equal(retries, 1);
  assert.equal(windows.length, 3);
  assert.equal(windows[1]![0], 0);
  assert.ok(windows[1]![1] > windows[2]![0], 'retry windows must overlap');
  assert.ok(
    Math.abs(windows[2]![1] - 29) < 0.001,
    'the full audio tail must be retried',
  );
  assert.ok(!result.text.includes('discard'));
  assert.equal(result.chunks!.length, 2);
  assert.equal(result.chunks![0]!.timestamp[0], 0.2);
  assert.ok(
    Math.abs(result.chunks![1]!.timestamp[0]! - (windows[2]![0] + 0.2)) < 0.001,
  );
  assert.ok(Math.abs(result.chunks![1]!.timestamp[1]! - 28.8) < 0.001);
});

test('retry overlap keeps one copy of a boundary sentence', async () => {
  let call = 0;
  const result = await decodeWhisperAudio(
    new Float32Array(29 * 16000),
    2,
    async (_, stream) => {
      stream.put([[1n]]);
      if (++call === 1) return { text: 'truncated' };
      stream.put([[2n]]);
      return call === 2
        ? {
            text: 'left boundary',
            chunks: [
              { text: 'left', timestamp: [0, 10] },
              { text: 'boundary', timestamp: [13.8, 15.3] },
            ],
          }
        : {
            text: 'boundary right',
            chunks: [
              { text: 'boundary', timestamp: [0.1, 1.8] },
              { text: 'right', timestamp: [2, 15.3] },
            ],
          };
    },
  );
  assert.deepEqual(
    result.chunks!.map((chunk) => chunk.text),
    ['left', 'boundary', 'right'],
  );
});

test('persistent decoder truncation has bounded retries and never returns partial text', async () => {
  const durations: number[] = [];
  await assert.rejects(
    decodeWhisperAudio(
      new Float32Array(29 * 16000),
      2,
      async (part, stream) => {
        durations.push(part.length / 16000);
        stream.put([[1n]]);
        stream.end();
        return { text: 'truncated' };
      },
    ),
    /识别未完成/,
  );
  assert.ok(durations.length <= 6);
  assert.ok(durations.at(-1)! <= 4);
  assert.ok(
    durations.every(
      (duration, index) => index === 0 || duration < durations[index - 1]!,
    ),
  );
});

test('a failed second retry rejects the whole Whisper window; runtime failures are not retried as truncation', async () => {
  let calls = 0;
  await assert.rejects(
    decodeWhisperAudio(
      new Float32Array(29 * 16000),
      2,
      async (part, stream) => {
        stream.put([[1n]]);
        if (++calls === 1) return { text: 'truncated' };
        if (calls === 3) throw new Error('runtime failure');
        stream.put([[2n]]);
        return {
          text: 'left',
          chunks: [{ text: 'left', timestamp: [0, part.length / 16000] }],
        };
      },
    ),
    /runtime failure/,
  );
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(
    decodeWhisperAudio(new Float32Array(29 * 16000), 2, async () => {
      calls++;
      throw new Error('memory failure');
    }),
    /memory failure/,
  );
  assert.equal(calls, 1);
});
