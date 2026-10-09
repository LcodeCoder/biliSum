import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fitMap,
  panMap,
  zoomMap,
  MIN_MAP_SCALE,
  MAX_MAP_SCALE,
} from '../src/lib/map-view';

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, actual + ' != ' + expected);

test('fit centers wide and tall maps with margins', () => {
  for (const content of [
    { width: 900, height: 180 },
    { width: 450, height: 7500 },
  ]) {
    const viewport = { width: 320, height: 300 };
    const camera = fitMap(content, viewport);
    close(camera.x + (content.width * camera.scale) / 2, viewport.width / 2);
    close(camera.y + (content.height * camera.scale) / 2, viewport.height / 2);
    assert.ok(content.width * camera.scale <= viewport.width - 48 + 1e-8);
    assert.ok(content.height * camera.scale <= viewport.height - 48 + 1e-8);
  }
});

test('wheel zoom preserves the diagram point under the cursor, including scale limits', () => {
  const camera = { x: -114, y: 62, scale: 0.7 };
  const cursor = { x: 273, y: 145 };
  for (const factor of [1.2, 0.6, 100, 0.0001]) {
    const next = zoomMap(camera, factor, cursor);
    close(
      (cursor.x - next.x) / next.scale,
      (cursor.x - camera.x) / camera.scale,
    );
    close(
      (cursor.y - next.y) / next.scale,
      (cursor.y - camera.y) / camera.scale,
    );
    assert.ok(next.scale >= MIN_MAP_SCALE && next.scale <= MAX_MAP_SCALE);
  }
  const roundtrip = zoomMap(zoomMap(camera, 1.2, cursor), 1 / 1.2, cursor);
  close(roundtrip.scale, camera.scale);
  close(roundtrip.x, camera.x);
  close(roundtrip.y, camera.y);
});

test('drag pans in screen pixels independently of zoom', () => {
  const camera = { x: -100, y: -400, scale: 2 };
  assert.deepEqual(panMap(camera, 75, -20), { x: -25, y: -420, scale: 2 });
  assert.deepEqual(camera, { x: -100, y: -400, scale: 2 });
});
