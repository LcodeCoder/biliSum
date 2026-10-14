import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const source = join(root, '.output', 'chrome-mv3');
const target = join(root, 'dist');
// Replace only this project's generated installation directory.
if (resolve(target, '..') !== root) {
  throw new Error('Unexpected packaging directory.');
}
await readFile(join(source, 'manifest.json'), 'utf8');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
await cp(
  join(root, 'THIRD_PARTY_NOTICES.md'),
  join(target, 'THIRD_PARTY_NOTICES.md'),
);
if (process.argv.includes('--zip')) {
  const { version } = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  );
  const files = await readdir(join(root, '.output'));
  const archive = files.find(
    (file) =>
      file.endsWith('.zip') &&
      file.includes('chrome') &&
      file.includes('-' + version + '-') &&
      !file.includes('sources'),
  );
  if (!archive) throw new Error('WXT did not produce a Chrome ZIP.');
  const name = 'biliSum-' + version + '-chrome.zip';
  await cp(join(root, '.output', archive), join(root, name));
  console.log('ZIP: ' + name);
}
console.log('Chrome 安装目录: ' + target);
