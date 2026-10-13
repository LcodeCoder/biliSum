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
