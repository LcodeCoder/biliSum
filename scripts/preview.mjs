import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '.output/chrome-mv3');
const mime = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.mjs': 'text/javascript;charset=utf-8',
  '.wasm': 'application/wasm',
  '.css': 'text/css;charset=utf-8',
  '.png': 'image/png',
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1:3003');
    let filename;
    if (url.pathname === '/fixture.js')
      filename = resolve(root, 'tests/fixtures/browser.js');
    else
      filename = resolve(
        output,
        '.' + (url.pathname === '/' ? '/sidepanel.html' : url.pathname),
      );
    if (
      !filename.startsWith(output + '/') &&
      !filename.startsWith(output + '\\') &&
      filename !== resolve(root, 'tests/fixtures/browser.js')
    )
      throw new Error('Invalid file');
    let body = await readFile(filename);
    if (filename.endsWith('sidepanel.html')) {
      body = Buffer.from(
        body
          .toString()
          .replace('<head>', '<head><script src="/fixture.js"></script>'),
      );
    }
    response.writeHead(200, {
      'Content-Type': mime[extname(filename)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
server.listen(
  Number(process.env.BILISUM_PREVIEW_PORT ?? 3003),
  '127.0.0.1',
  () =>
    console.log(
      'biliSum 模拟预览（仅模拟数据）: http://127.0.0.1:' +
        server.address().port +
        '/?width=380',
    ),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => server.close());
