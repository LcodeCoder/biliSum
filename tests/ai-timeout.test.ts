import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completionSignal } from '../src/lib/ai-timeout';
import { errorMessage } from '../src/lib/request';

const limits = {
  firstResponseTimeoutMs: 180,
  idleTimeoutMs: 90,
  timeoutMs: 600,
};

test('first response timeout is distinct from stalled transmission and retains its fee warning', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const waiting = completionSignal(undefined, limits);
  t.mock.timers.tick(179);
  assert.equal(waiting.signal.aborted, false);
  t.mock.timers.tick(1);
  assert.equal(waiting.signal.reason.name, 'TimeoutError');
  assert.match(errorMessage(waiting.signal.reason), /等待模型响应超时/);
  assert.match(errorMessage(waiting.signal.reason), /可能再次计费/);
  waiting.dispose();

  const stalled = completionSignal(undefined, limits);
  t.mock.timers.tick(100);
  stalled.received();
  t.mock.timers.tick(89);
  assert.equal(stalled.signal.aborted, false);
  t.mock.timers.tick(1);
  assert.match(errorMessage(stalled.signal.reason), /停滞/);
  stalled.dispose();
});

test('heartbeats or reasoning keep a paid response alive but cannot extend the total deadline', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const request = completionSignal(undefined, limits);
  for (let i = 0; i < 7; i++) {
    t.mock.timers.tick(80);
    assert.equal(request.signal.aborted, false);
    request.received();
  }
  t.mock.timers.tick(40);
  assert.equal(request.signal.reason.name, 'TimeoutError');
  assert.match(errorMessage(request.signal.reason), /模型处理超过/);
  request.dispose();
});

test('cancellation, settled requests and connection-test deadlines release their timers', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const parent = new AbortController();
  const aborted = completionSignal(parent.signal, limits);
  parent.abort(new Error('停止生成'));
  assert.equal(aborted.signal.reason, parent.signal.reason);
  aborted.received();
  aborted.dispose();
  const settled = completionSignal(undefined, limits);
  settled.received();
  settled.dispose();
  t.mock.timers.tick(1000);
  assert.equal(settled.signal.aborted, false);
  const testCall = completionSignal(undefined, { timeoutMs: 30 });
  t.mock.timers.tick(20);
  testCall.received();
  t.mock.timers.tick(10);
  assert.equal(testCall.signal.aborted, true);
  testCall.dispose();
});
