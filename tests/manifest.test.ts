import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production manifest opens native sidepanel with no popup and optional API hosts', async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL('../.output/chrome-mv3/manifest.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(manifest.name, 'biliSum');
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.side_panel.default_path, 'sidepanel.html');
  assert.ok(manifest.permissions.includes('sidePanel'));
  assert.equal(manifest.action.default_popup, undefined);
  assert.ok(!manifest.host_permissions.includes('<all_urls>'));
  assert.ok(manifest.optional_host_permissions.includes('https://*/*'));
  const background = await readFile(
    new URL('../.output/chrome-mv3/background.js', import.meta.url),
    'utf8',
  );
  assert.ok(
    background.includes('openPanelOnActionClick:!0') ||
      background.includes('openPanelOnActionClick:true'),
  );
});
