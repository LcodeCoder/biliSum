import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detailInstruction,
  detailProfile,
  normalizeDetailLevel,
} from '../src/lib/detail';
import { DEFAULT_SETTINGS, validateSettings } from '../src/lib/config';

test('older settings default to standard detail; invalid detail is normalized', () => {
  for (const input of [undefined, null, NaN, Infinity, '5', {}])
    assert.equal(normalizeDetailLevel(input), 3);
  assert.equal(normalizeDetailLevel(-8), 1);
  assert.equal(normalizeDetailLevel(20), 5);
  assert.equal(normalizeDetailLevel(3.6), 4);
  const migrated = validateSettings({
    ...DEFAULT_SETTINGS,
    apiKey: 'fixture',
    detailLevel: undefined,
  } as any);
  assert.equal(migrated.detailLevel, 3);
  assert.equal(DEFAULT_SETTINGS.theme, 'light');
});

test('detail profiles increase coverage budgets without asking for padding', () => {
  const low = detailProfile(1),
    high = detailProfile(5);
  assert.ok(high.mapNodes > low.mapNodes);
  assert.ok(high.mapLayers > low.mapLayers);
  assert.ok(high.noteLength > low.noteLength);
  assert.ok(high.mapNodes <= 120 && high.mapLayers <= 6);
  for (let level = 1; level <= 5; level++) {
    const instruction = detailInstruction(level);
    assert.ok(instruction.includes('核心主线和最终结论'));
    assert.ok(instruction.includes('不凑字数'));
    assert.ok(instruction.includes('不添加字幕之外的事实'));
  }
});
