import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const root = join(import.meta.dirname, '..');
const output = join(root, 'public', 'asr-runtime');
const runtime = dirname(
  require.resolve('onnxruntime-web/ort-wasm-simd-threaded.wasm'),
);
const names = [
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
];
// Fail the build if upstream assets change; do not fall back to a remote executable.
for (const name of names) await readFile(join(runtime, name));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of names) await cp(join(runtime, name), join(output, name));
console.log('Local speech runtime prepared.');
