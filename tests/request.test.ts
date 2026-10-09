import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abortable,
  errorMessage,
  readJsonResponse,
  requestSignal,
} from '../src/lib/request';

test('JSON reads reject invalid shapes and HTML without exposing response contents', async () => {
  for (const body of ['null', '[]', '"secret"', '<html>secret</html>']) {
    await assert.rejects(
      readJsonResponse(new Response(body)),
      (error: Error) => {
        assert.match(error.message, /格式异常/);
        assert.ok(!error.message.includes('secret'));
        return true;
      },
    );
  }
});

test('oversized chunked JSON is cancelled before buffering an unbounded response', async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(101)));
      },
      cancel() {
        cancelled = true;
      },
    }),
  );
  await assert.rejects(readJsonResponse(response, undefined, 100), /数据过大/);
  assert.equal(cancelled, true);
});

test('aborting a stalled JSON body promptly cancels its reader', async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      cancel() {
        cancelled = true;
      },
    }),
  );
  const controller = new AbortController();
  const reading = readJsonResponse(response, controller.signal);
  controller.abort();
  await assert.rejects(reading, { name: 'AbortError' });
  assert.equal(cancelled, true);
});

test('timeouts and external aborts retain actionable reasons', async () => {
  const request = requestSignal(undefined, 5);
  await assert.rejects(abortable(new Promise(() => {}), request.signal), {
    name: 'TimeoutError',
  });
  assert.match(errorMessage(request.signal.reason), /超时/);
  request.dispose();
  const parent = new AbortController();
  parent.abort(new Error('cancelled'));
  const forwarded = requestSignal(parent.signal);
  assert.equal(forwarded.signal.reason, parent.signal.reason);
  forwarded.dispose();
});
