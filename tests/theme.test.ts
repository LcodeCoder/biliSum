import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPEARANCES,
  appearancePalette,
  normalizeTheme,
} from '../src/lib/theme';
import { validateSettings, DEFAULT_SETTINGS } from '../src/lib/config';

function luminance(color: string): number {
  const rgb = [1, 3, 5].map(
    (index) => parseInt(color.slice(index, index + 2), 16) / 255,
  );
  return rgb.reduce(
    (total, value, index) =>
      total +
      (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
        [0.2126, 0.7152, 0.0722][index]!,
    0,
  );
}
function contrast(a: string, b: string): number {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high! + 0.05) / (low! + 0.05);
}

test('all appearances keep readable body, secondary, link and status text', () => {
  for (const appearance of APPEARANCES) {
    const p = appearancePalette(appearance);
    for (const foreground of [p.text, p.muted, p.subtle, p.accent])
      for (const background of [p.background, p.surface, p.soft])
        assert.ok(
          contrast(foreground, background) >= 4.5,
          `${appearance}: ${foreground} on ${background}`,
        );
    for (const [foreground, background] of [
      [p.onAccent, p.accent],
      [p.error, p.errorBg],
      [p.success, p.successBg],
      [p.warning, p.warningBg],
    ])
      assert.ok(
        contrast(foreground!, background!) >= 4.5,
        `${appearance}: status/button text`,
      );
  }
});

test('eye preference survives validation and legacy system preferences remain supported', () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    apiKey: 'fixture-key',
    theme: 'eye' as const,
  };
  assert.equal(validateSettings(settings).theme, 'eye');
  assert.equal(normalizeTheme('system'), 'system');
  assert.equal(normalizeTheme('blue'), 'light');
  assert.equal(normalizeTheme({}, 'system'), 'system');
  assert.equal(appearancePalette('invalid'), appearancePalette('light'));
});
