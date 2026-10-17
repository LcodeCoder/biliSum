// Run with: node scripts/generate-icons.mjs
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const directory = resolve(import.meta.dirname, '../public/icons');
const source = await readFile(resolve(directory, 'source.svg'), 'utf8');
for (const size of [16, 32, 48, 128]) {
  const artwork =
    size === 16
      ? source.replace(
          'class="map-mark"',
          'class="map-mark" style="stroke-width:2.1"',
        )
      : source;
  await sharp(Buffer.from(artwork), { density: 288 })
    .resize(size, size)
    .png()
    .toFile(resolve(directory, `${size}.png`));
  console.log(`Generated icons/${size}.png`);
}
