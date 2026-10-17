import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

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
  const output = new URL('../.output/chrome-mv3/', import.meta.url);
  for (const [size, path] of Object.entries(manifest.icons)) {
    const bytes = await readFile(new URL(path as string, output));
    assert.equal(bytes.readUInt32BE(16), Number(size));
    assert.equal(bytes.readUInt32BE(20), Number(size));
    assert.deepEqual(
      bytes,
      await readFile(new URL('../public/' + path, import.meta.url)),
      'the installed extension receives the current artwork',
    );
  }
  for (const path of Object.values(manifest.action.default_icon))
    assert.ok(Object.values(manifest.icons).includes(path));
  assert.match(
    await readFile(new URL('sidepanel.html', output), 'utf8'),
    /rel="icon"[^>]*href="\/icons\/32\.png"/,
  );
  const background = await readFile(
    new URL('../.output/chrome-mv3/background.js', import.meta.url),
    'utf8',
  );
  assert.ok(
    background.includes('openPanelOnActionClick:!0') ||
      background.includes('openPanelOnActionClick:true'),
  );
});

test('speech workers and the pinned WASM runtime are executable local assets under extension CSP', async () => {
  const output = new URL('../.output/chrome-mv3/', import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL('manifest.json', output), 'utf8'),
  );
  assert.ok(
    manifest.permissions.includes('declarativeNetRequestWithHostAccess'),
  );
  assert.ok(
    manifest.content_security_policy.extension_pages.includes(
      "'wasm-unsafe-eval'",
    ),
  );
  assert.ok(
    !manifest.content_security_policy.extension_pages.includes("'unsafe-eval'"),
  );
  const workers = (await readdir(new URL('assets/', output))).filter((name) =>
    /^speech\.worker-.+\.js$/.test(name),
  );
  assert.equal(workers.length, 1, 'worker must be emitted by Vite');
  const worker = await readFile(
    new URL('assets/' + workers[0], output),
    'utf8',
  );
  assert.ok(
    worker.includes('../asr-runtime/ort-wasm-simd-threaded.asyncify.mjs'),
  );
  assert.ok(
    worker.includes('../asr-runtime/ort-wasm-simd-threaded.asyncify.wasm'),
  );
  assert.ok(worker.includes('64da57285918e20ea79ea5c88eed7197933abaa8'));
  for (const name of [
    'ort-wasm-simd-threaded.asyncify.mjs',
    'ort-wasm-simd-threaded.asyncify.wasm',
  ])
    assert.ok(
      (await readFile(new URL('asr-runtime/' + name, output))).byteLength >
        1000,
    );
  for (const name of [
    'Mediabunny-MPL-2.0.txt',
    'Transformers-Apache-2.0.txt',
    'ONNX-Runtime-MIT.txt',
    'Noble-Hashes-MIT.txt',
    'Whisper-MIT.txt',
  ])
    assert.ok(
      (await readFile(new URL('licenses/' + name, output))).byteLength > 1000,
    );
});
