// Opt-in smoke test: genuine decoder, model download, inference and extension CSP.
// Video metadata and AI responses are fixtures; no paid AI API is called.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
const root = resolve(import.meta.dirname, '..');
const temp = await mkdtemp(join(tmpdir(), 'bilisum-speech-smoke-'));
let context;
try {
  let audioPath;
  const audioIndex = process.argv.indexOf('--audio');
  if (audioIndex >= 0) {
    if (!process.argv[audioIndex + 1])
      throw new Error('--audio requires a WAV file path.');
    audioPath = resolve(process.argv[audioIndex + 1]);
  } else if (process.platform === 'darwin') {
    audioPath = join(temp, 'chinese.wav');
    execFileSync('say', [
      '-v',
      'Tingting (中文（中国大陆）)',
      '-o',
      audioPath,
      '--data-format=LEI16@16000',
      '今天我们学习如何整理知识。先提出问题，再记录重点，最后用思维导图建立联系。',
    ]);
  } else
    throw new Error(
      'Supply a short Chinese WAV with --audio, or run on macOS with the Tingting voice.',
    );
  const extension = join(root, 'dist');
  await readFile(join(extension, 'manifest.json'));
  context = await chromium.launchPersistentContext(join(temp, 'profile'), {
    headless: true,
    ...(process.env.BILISUM_CHROME_PATH
      ? { executablePath: process.env.BILISUM_CHROME_PATH }
      : existsSync(chromium.executablePath())
        ? {}
        : { channel: 'chromium' }),
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--disable-extensions-except=' + extension,
      '--load-extension=' + extension,
    ],
  });
  const background =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent('serviceworker', { timeout: 20000 }));
  const id = new URL(background.url()).hostname;
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript({
    content: await readFile(join(root, 'tests/fixtures/browser.js'), 'utf8'),
  });
  await page.goto(
    'chrome-extension://' + id + '/sidepanel.html?speech=whisper',
  );
  const base64 = (await readFile(audioPath)).toString('base64');
  const duration = await page.evaluate(async (base64) => {
    const context = new AudioContext({ sampleRate: 16000 });
    try {
      return (
        await context.decodeAudioData(
          Uint8Array.from(atob(base64), (value) => value.charCodeAt(0)).buffer,
        )
      ).duration;
    } finally {
      await context.close();
    }
  }, base64);
  assert.ok(
    duration > 0 && duration <= 30,
    'use a short sample (up to 30 seconds)',
  );
  await page.goto(
    'chrome-extension://' +
      id +
      '/sidepanel.html?speech=real&speechDuration=' +
      duration,
  );
  await page.waitForFunction(
    () =>
      !document.querySelector('[aria-label="刷新当前视频和字幕"]')?.disabled,
  );
  await page.getByLabel('识别方式', { exact: true }).selectOption('whisper');
  const started = Date.now();
  await page
    .getByLabel('选择音频文件', { exact: true })
    .setInputFiles(audioPath);
  console.log(
    'Downloading/caching the pinned model and transcribing in the installed extension…',
  );
  const status = await page.waitForFunction(
    () => {
      const notice =
        document.querySelector('.source-notice')?.textContent || '';
      if (notice.includes('未采用部分识别内容')) return { error: notice };
      const button = document.querySelector(
        '[aria-label="生成 Markdown 总结"]',
      );
      return button && !button.disabled ? { success: true } : false;
    },
    undefined,
    { timeout: 15 * 60000 },
  );
  const completed = await status.jsonValue();
  if (completed.error) throw new Error(completed.error);
  await page.getByRole('button', { name: '字幕页面', exact: true }).click();
  const text = await page.locator('.cue-list').innerText();
  assert.match(text, /知[识識]|问题|問題/, 'sample speech must be recognized');
  assert.ok(
    await page
      .getByRole('button', { name: '下载 SRT 字幕', exact: true })
      .isEnabled(),
  );
  const saved = page.waitForEvent('download');
  await page
    .getByRole('button', { name: '下载 SRT 字幕', exact: true })
    .click();
  const download = await saved;
  assert.match(
    await readFile(await download.path(), 'utf8'),
    /00:00:00,\d{3} -->/,
  );
  assert.deepEqual(errors, [], 'no browser or CSP runtime errors');
  console.log(
    JSON.stringify(
      {
        duration,
        elapsedSeconds: Math.round((Date.now() - started) / 1000),
        text,
        srt: true,
        productionCsp: true,
      },
      null,
      2,
    ),
  );
} finally {
  await context?.close();
  await rm(temp, { recursive: true, force: true });
}
